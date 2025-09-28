# AdBlock Plugin for DeezMod

A powerful ad blocking plugin for DeezMod using Ghostery's adblocker engine.

## Features

- **Ghostery Integration**: Uses Ghostery's proven adblocker engine
- **Automatic Updates**: Fetches the latest filter lists automatically
- **Caching**: Caches filter lists for faster startup
- **Session Management**: Automatically applies blocking to all sessions and webContents
- **Lightweight**: Bundled with esbuild for optimal performance

## Installation

1. Install dependencies:
   ```cmd
   npm install
   ```

2. Build the plugin:
   ```cmd
   npm run build
   ```

3. The bundled plugin will be created as `bundled_adblock.js`

## Available Scripts

- `npm install` - Install dependencies
- `npm run build` - Production build (minified, with automatic cleanup)
- `npm run build:dev` - Development build (unminified with sourcemap)
- `npm run build:watch` - Development build with file watching
- `npm run clean` - Remove built files

## How it Works

The plugin integrates Ghostery's adblocker directly into Electron's session management:

1. **Initialization**: Loads Ghostery's prebuilt ads and tracking filter lists
2. **Caching**: Stores filter lists locally for faster subsequent loads
3. **Session Blocking**: Applies blocking rules to the default session and any new sessions
4. **WebContents Protection**: Ensures all webContents are protected as they're created

## Dependencies

- `@ghostery/adblocker-electron`: Ghostery's Electron adblocker
- `cross-fetch`: Cross-platform fetch implementation
- `esbuild`: Fast JavaScript bundler (dev dependency)

## Configuration

The plugin uses Ghostery's default configuration with:
- Prebuilt ads and tracking filter lists
- Automatic cache management in the app's userData directory
- 30-second timeout for filter list downloads

## Troubleshooting

If the plugin fails to load:

1. Check that all dependencies are installed: `npm install`
2. Ensure you're using a compatible Electron version
3. Check the console for detailed error messages
4. Try rebuilding with `npm run build:dev` for better error visibility

## Plugin Structure

```
plugins/adblock/
├── src/
│   └── adblock.js          # Main plugin source
├── package.json            # Dependencies and npm scripts
├── bundled_adblock.js     # Generated bundle (after build)
└── README.md              # This file
```

## License

MIT License - see the main DeezMod repository for details.
