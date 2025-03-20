module.exports = {
    name: "Toggle Features",
    description: "Enable or disable features which may or may not be experimental/web version only.",
    version: "1.0",
    author: "bertigert",
    context: ["renderer"],
    scope: ["own"],
    func: () => {
        // ======= Settings START =======
        
        LOG_ALL_FEATURES_DEBUG = true; // useful to see all features (gets logged in the (dev tools) console, use https://github.com/bertigert/DeezMod/blob/main/plugins/enable_dev_mode.js to view)

        CUSTOM_FEATURES = {
            gapless_playback: true,
            // revamp_best_results: true,
            // deeztools: true, // simple way to toggle most of the custom features
        }

        // ======= Settings END =======


        
        function log(...args) {
            console.log("[Toggle Features]", ...args);
        }
        function error(...args) {
            console.error("[Toggle Features]", ...args);
        }
        function debug(...args) {
            console.debug("[Toggle Features]", ...args);
        }
        
        const original_fetch = window.fetch;

        log("Hooking fetch");
        window.fetch = async function (...args) {
            try {
                const url = new URL(args[0]);
            
                if (url.pathname !== "/ajax/gw-light.php" || 
                    url.searchParams.get("method") !== "deezer.getUserData" ||
                    url.searchParams.get("api_token") !== "" ||
                    !url.searchParams.has("cid") ||
                    typeof args[1].body !== "string"
                ) {
                    return original_fetch.apply(window, args);
                }

                debug('Catched original user data fetch call');

                const response = await original_fetch.apply(window, args);
                const resp_json = await response.json();

                if (resp_json.results) {
                    const features = resp_json.results.__DZR_GATEKEEPS__;

                    if (LOG_ALL_FEATURES_DEBUG) {
                        log('All Features:', features);
                    }

                    for (let feature of Object.entries(CUSTOM_FEATURES)) {
                        features[feature[0]] = feature[1];
                        log(feature[1] ? 'Enabled' : 'Disabled', feature[0]);
                    }
                    
                }

                // since this request is only made once, we can unhook now
                log("Unhooking fetch");
                window.fetch = original_fetch;

                return new Response(JSON.stringify(resp_json), {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                });
            } catch (e) {
                error("Error in fetch hook:", e);
                return original_fetch.apply(window, args);
            }
        }
    }
}
