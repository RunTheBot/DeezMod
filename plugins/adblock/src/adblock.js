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

                // Enable blocking on default session
                log('Enabling ad blocking on default session...');
                blocker.enableBlockingInSession(session.defaultSession);
                
                // Enable blocking on new sessions
                app.on('session-created', (newSession) => {
                    debug('New session created, enabling ad blocking...');
                    try {
                        blocker.enableBlockingInSession(newSession);
                        debug('Ad blocking enabled for new session');
                    } catch (err) {
                        error('Failed to enable blocking for new session:', err.message);
                    }
                });

                // Enable blocking on new webContents
                app.on('web-contents-created', (event, webContents) => {
                    debug('New webContents created, ensuring ad blocking...');
                    try {
                        if (webContents.session) {
                            blocker.enableBlockingInSession(webContents.session);
                            debug('Ad blocking ensured for webContents session');
                        }
                    } catch (err) {
                        error('Failed to enable blocking for webContents:', err.message);
                    }
                });

                // Log stats if available
                if (blocker.engine && blocker.engine.size) {
                    log(`Loaded ${blocker.engine.size} blocking rules`);
                } else if (blocker.lists) {
                    log(`Loaded ${Object.keys(blocker.lists).length} filter lists`);
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
