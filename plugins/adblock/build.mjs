import esbuild from 'esbuild';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Custom plugin to handle the preload module resolution
const ghosteryPreloadPlugin = {
  name: 'ghostery-preload',
  setup(build) {
    // Intercept the preload path resolution
    build.onResolve({ filter: /@ghostery\/adblocker-electron-preload/ }, args => {
      // Return the actual preload file path
      try {
        const preloadPath = resolve('./node_modules/@ghostery/adblocker-electron-preload/dist/preload.js');
        return { path: preloadPath };
      } catch (e) {
        // If preload module doesn't exist, return a dummy module
        return { path: resolve('./dummy-preload.js'), namespace: 'dummy' };
      }
    });

    // Handle the dummy namespace
    build.onLoad({ filter: /.*/, namespace: 'dummy' }, () => {
      return {
        contents: 'module.exports = {};',
        loader: 'js'
      };
    });

    // Handle require.resolve calls for the preload module
    build.onLoad({ filter: /preload_path\.js$/ }, async (args) => {
      let contents = readFileSync(args.path, 'utf8');
      
      // Replace the require.resolve call with a static path
      contents = contents.replace(
        /require\.resolve\(['"`]@ghostery\/adblocker-electron-preload['"`]\)/g,
        '"/dev/null"'  // Use a dummy path since we don't need the preload in our use case
      );
      
      return {
        contents,
        loader: 'js'
      };
    });
  }
};

// Build configuration
const buildConfig = {
  entryPoints: ['src/adblock.js'],
  bundle: true,
  outfile: 'bundled_adblock.js',
  platform: 'node',
  target: 'node16',
  minify: process.argv.includes('--minify'),
  sourcemap: process.argv.includes('--sourcemap'),
  external: ['electron'],
  plugins: [ghosteryPreloadPlugin],
  define: {
    'process.env.NODE_ENV': process.argv.includes('--minify') ? '"production"' : '"development"'
  }
};

try {
  await esbuild.build(buildConfig);
  console.log('✓ Build successful! Output: bundled_adblock.js');
} catch (error) {
  console.error('✗ Build failed:', error);
  process.exit(1);
}
