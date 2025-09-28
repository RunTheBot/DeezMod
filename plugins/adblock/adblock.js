const { app, session } = require('electron');

module.exports = {
    name: "AdBlock",
    description: "Blocks ads and trackers using pattern matching",
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

        // Comprehensive list of ad/tracking domains and patterns
        const adDomains = [
            // Google Ads & Analytics
            'doubleclick.net', 'googleadservices.com', 'googlesyndication.com',
            'google-analytics.com', 'googletagmanager.com', 'googletagservices.com',
            'googletag.com', 'adsystem.google.com', 'ads.google.com',
            
            // Facebook/Meta
            'facebook.com/tr', 'connect.facebook.net', 'facebook.net/en_us/fbevents.js',
            
            // Amazon
            'amazon-adsystem.com', 'adsystem.amazon.com', 'adsystem.amazon.de',
            'adsystem.amazon.co.uk', 'adsystem.amazon.fr',
            
            // Other major ad networks
            'outbrain.com', 'taboola.com', 'criteo.com', 'adsystem.com',
            'ads.yahoo.com', 'advertising.com', 'adsystem.net',
            'scorecardresearch.com', 'quantserve.com', 'adsafeprotected.com',
            
            // Tracking & Analytics
            'hotjar.com', 'fullstory.com', 'mouseflow.com', 'crazyegg.com',
            'mixpanel.com', 'segment.com', 'amplitude.com', 'heap.io',
            
            // More ad networks
            'adsystem.amazon.ca', 'adsystem.amazon.it', 'adsystem.amazon.es',
            'pubmatic.com', 'rubiconproject.com', 'openx.net', 'appnexus.com',
            'adsystem.amazon.com.au', 'adsystem.amazon.com.br'
        ];

        const adPaths = [
            '/ads/', '/advertisement', '/adsystem/', '/adservice/',
            '/analytics/', '/tracking/', '/metrics/', '/collect'
        ];

        // Setup blocking function for sessions using pattern matching
        function setupBlockingForSession(targetSession) {
            try {
                const { webRequest } = targetSession;
                
                webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
                    try {
                        const { url } = details;
                        const urlLower = url.toLowerCase();
                        
                        // Check ad domains
                        for (const domain of adDomains) {
                            if (urlLower.includes(domain)) {
                                log(`🚫 Blocked: ${url}`);
                                callback({ cancel: true });
                                return;
                            }
                        }
                        
                        // Check ad paths
                        for (const path of adPaths) {
                            if (urlLower.includes(path)) {
                                log(`🚫 Blocked: ${url}`);
                                callback({ cancel: true });
                                return;
                            }
                        }
                        
                        callback({});
                    } catch (err) {
                        debug(`Error in blocking logic: ${err.message}`);
                        callback({});
                    }
                });
                
                log('Pattern-based blocking enabled for session');
            } catch (err) {
                error('Failed to setup blocking for session:', err.message);
            }
        }

        function initializeAdBlocker() {
            log('Initializing pattern-based AdBlocker...');
            
            try {
                // Enable blocking on default session
                log('Enabling ad blocking on default session...');
                setupBlockingForSession(session.defaultSession);
                
                // Set up blocking for existing webContents
                const { webContents } = require('electron');
                const allWebContents = webContents.getAllWebContents();
                log(`Setting up blocking for ${allWebContents.length} existing webContents...`);
                
                allWebContents.forEach((wc) => {
                    if (wc.session) {
                        setupBlockingForSession(wc.session);
                    }
                });
                
                // Enable blocking on new sessions and webContents
                app.on('session-created', (newSession) => {
                    debug('New session created, enabling ad blocking...');
                    setupBlockingForSession(newSession);
                });

                app.on('web-contents-created', (event, webContents) => {
                    debug('New webContents created, ensuring ad blocking...');
                    if (webContents.session) {
                        setupBlockingForSession(webContents.session);
                    }
                });

                log(`Loaded ${adDomains.length} ad domains and ${adPaths.length} ad path patterns`);
                log('✓ Pattern-based AdBlocker successfully initialized!');
                
            } catch (err) {
                error('✗ Failed to initialize AdBlocker:', err.message);
                error('AdBlocker will not be active for this session');
                throw err;
            }
        }

        // Initialize when app is ready
        const initializeWhenReady = async () => {
            try {
                await app.whenReady();
                log('App ready, initializing AdBlocker...');
                initializeAdBlocker();
            } catch (err) {
                error('AdBlocker initialization failed:', err.message);
            }
        };

        // Start initialization
        if (app.isReady()) {
            try {
                initializeAdBlocker();
            } catch (err) {
                error('AdBlocker initialization failed:', err.message);
            }
        } else {
            initializeWhenReady();
        }

        log('AdBlock plugin loaded');
    }
};