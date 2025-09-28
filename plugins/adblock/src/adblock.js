const { ElectronBlocker } = require('@ghostery/adblocker-electron');
const fetch = require('cross-fetch');
const { app, session } = require('electron');
const path = require('path');
const fs = require('fs');

module.exports = {
    name: "AdBlock",
    description: "Blocks ads and trackers using Ghostery's adblocker",
    version: "1.0.0",
    author: "DeezMod",
    context: ["main"],
    scope: ["own"],
    func: () => {
        const LOG_DEBUG = true;
        
        function log(...args) {
            console.log("[AdBlock]", ...args);
        }
        
        function error(...args) {
            console.error("[AdBlock]", ...args);
        }
        
        function debug(...args) {
            if (LOG_DEBUG) console.debug("[AdBlock]", ...args);
        }

        // Add timeout wrapper for async operations
        function withTimeout(promise, timeoutMs, operation) {
            return Promise.race([
                promise,
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
                )
            ]);
        }

        // Setup blocking function for sessions using webRequest API
        function setupBlockingForSession(blocker, targetSession) {
            try {
                const { webRequest } = targetSession;
                
                // Set up specific pattern blocking first (like your example)
                const adBlockPatterns = [
                    '*://*.doubleclick.net/*',
                    '*://*.googleadservices.com/*',
                    '*://*.googlesyndication.com/*',
                    '*://*.google-analytics.com/*',
                    '*://*.googletagmanager.com/*',
                    '*://*.facebook.com/tr/*',
                    '*://*.facebook.net/*',
                    '*://connect.facebook.net/*',
                    '*://*.amazon-adsystem.com/*',
                    '*://googleads.g.doubleclick.net/*',
                    '*://pagead2.googlesyndication.com/*'
                ];

                // Block known ad domains first
                webRequest.onBeforeRequest({ urls: adBlockPatterns }, (details, callback) => {
                    log(`🚫 Pattern blocked: ${details.url}`);
                    callback({ cancel: true });
                });
                
                // Use Ghostery for all requests - simpler approach
                webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
                    try {
                        const { url, resourceType } = details;
                        
                        // Check simple string patterns first for common ad domains
                        const urlLower = url.toLowerCase();
                        if (urlLower.includes('doubleclick.net') || 
                            urlLower.includes('googleadservices.com') ||
                            urlLower.includes('googlesyndication.com') ||
                            urlLower.includes('google-analytics.com') ||
                            urlLower.includes('googletagmanager.com') ||
                            urlLower.includes('facebook.com/tr') ||
                            urlLower.includes('connect.facebook.net') ||
                            urlLower.includes('amazon-adsystem.com')) {
                            log(`🚫 Pattern blocked: ${url}`);
                            callback({ cancel: true });
                            return;
                        }
                        
                        // Use Ghostery for everything else
                        const request = {
                            url,
                            type: resourceType || 'other',
                            sourceUrl: details.referrer || '',
                        };
                        
                        if (blocker && typeof blocker.match === 'function') {
                            const result = blocker.match(request);
                            if (result && result.match === true) {
                                log(`🚫 Ghostery blocked: ${url}`);
                                callback({ cancel: true });
                                return;
                            } else if (result && result.redirect) {
                                log(`↪️ Redirected: ${url} -> ${result.redirect}`);
                                callback({ redirectURL: result.redirect });
                                return;
                            }
                            // Log first few requests to verify matching is working
                            if (Math.random() < 0.001) { // 0.1% sample rate
                                debug(`✓ Checked: ${url} (allowed)`);
                            }
                        }
                        callback({});
                    } catch (err) {
                        debug(`Error in blocking logic: ${err.message}`);
                        callback({});
                    }
                });
                
                log('Blocking enabled for session with pattern + Ghostery filtering');
            } catch (err) {
                error('Failed to setup blocking for session:', err.message);
            }
        }

        async function initializeGhosteryAdBlocker() {
            log('Initializing Ghostery AdBlocker...');
            
            try {
                const cacheFile = path.join(app.getPath('userData'), 'ghostery-adblocker-cache.bin');
                debug('Cache file path:', cacheFile);
                
                const { promises: fsp } = fs;
                let blocker;
                
                // Try to load with cache first
                try {
                    debug('Attempting to load with cache (30s timeout)...');
                    const cachePromise = ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, {
                        path: cacheFile,
                        read: fsp.readFile,
                        write: fsp.writeFile,
                    });
                    
                    blocker = await withTimeout(cachePromise, 30000, 'Cache loading');
                    log('Successfully loaded Ghostery engine with cache');
                } catch (cacheError) {
                    debug('Cache loading failed, trying without cache:', cacheError.message);
                    
                    // Try without cache
                    debug('Loading without cache (30s timeout)...');
                    const noCachePromise = ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
                    blocker = await withTimeout(noCachePromise, 30000, 'No-cache loading');
                    log('Successfully loaded Ghostery engine without cache');
                }

                if (!blocker) {
                    throw new Error('Blocker instance is null or undefined');
                }

                // Enable blocking on default session - use manual method since Ghostery's built-in isn't working
                log('Enabling ad blocking on default session...');
                setupBlockingForSession(blocker, session.defaultSession);
                
                // Also set up blocking for any existing webContents
                const { webContents } = require('electron');
                const allWebContents = webContents.getAllWebContents();
                log(`Setting up blocking for ${allWebContents.length} existing webContents...`);
                
                allWebContents.forEach((wc, index) => {
                    try {
                        if (wc.session) {
                            debug(`Setting up blocking for existing webContents ${index + 1}`);
                            // Use manual setup since Ghostery's built-in isn't working properly
                            setupBlockingForSession(blocker, wc.session);
                        }
                    } catch (err) {
                        debug(`Failed to setup blocking for existing webContents ${index + 1}:`, err.message);
                    }
                });
                
                // Enable blocking on new sessions
                app.on('session-created', (newSession) => {
                    debug('New session created, enabling ad blocking...');
                    setupBlockingForSession(blocker, newSession);
                });

                // Enable blocking on new webContents
                app.on('web-contents-created', (event, webContents) => {
                    debug('New webContents created, ensuring ad blocking...');
                    if (webContents.session) {
                        setupBlockingForSession(blocker, webContents.session);
                    }
                });

                // Log stats if available
                let statsLogged = false;
                
                if (blocker.engine) {
                    if (blocker.engine.size) {
                        log(`Loaded ${blocker.engine.size} blocking rules from engine`);
                        statsLogged = true;
                    }
                    if (blocker.engine.filters) {
                        log(`Engine contains ${blocker.engine.filters.length} filters`);
                        statsLogged = true;
                    }
                }
                
                if (blocker.lists && Object.keys(blocker.lists).length > 0) {
                    log(`Loaded ${Object.keys(blocker.lists).length} filter lists`);
                    statsLogged = true;
                }
                
                if (blocker.getFilters) {
                    try {
                        const filters = blocker.getFilters();
                        if (filters.networkFilters) {
                            log(`Network filters: ${filters.networkFilters.length}`);
                            statsLogged = true;
                        }
                        if (filters.cosmeticFilters) {
                            log(`Cosmetic filters: ${filters.cosmeticFilters.length}`);
                            statsLogged = true;
                        }
                    } catch (e) {
                        debug('Error getting filter stats:', e.message);
                    }
                }
                
                if (!statsLogged) {
                    log('Blocker loaded but no filter statistics available');
                    debug('Blocker object keys:', Object.keys(blocker));
                }

                log('✓ Ghostery AdBlocker successfully initialized!');
                return blocker;
                
            } catch (err) {
                error('✗ Failed to initialize Ghostery AdBlocker:', err.message);
                error('AdBlocker will not be active for this session');
                throw err;
            }
        }

        // Initialize when app is ready
        const initializeWhenReady = async () => {
            try {
                await app.whenReady();
                log('App ready, initializing AdBlocker...');
                await initializeGhosteryAdBlocker();
            } catch (err) {
                error('AdBlocker initialization failed:', err.message);
            }
        };

        // Start initialization
        if (app.isReady()) {
            initializeGhosteryAdBlocker().catch(err => {
                error('AdBlocker initialization failed:', err.message);
            });
        } else {
            initializeWhenReady();
        }

        log('AdBlock plugin loaded');
    }
};