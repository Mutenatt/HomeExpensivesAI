const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite usa wa-sqlite (WebAssembly) para su implementación web; sin
// esto Metro no puede resolver el import de wa-sqlite.wasm y el bundle web
// falla con un error de "Import stack" en expo-sqlite/web/worker.ts.
config.resolver.assetExts.push('wasm');

module.exports = config;
