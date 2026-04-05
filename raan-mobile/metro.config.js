// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Redirect react-native-maps to web shim on web platform
// Force zustand ESM → CJS to avoid import.meta.env in non-module scripts
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Web: shim react-native-maps (native-only module)
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return {
      filePath: path.resolve(__dirname, 'shims/react-native-maps.web.tsx'),
      type: 'sourceFile',
    };
  }
  // Web: redirect zustand ESM (.mjs) → CJS (.js) to avoid import.meta.env
  if (platform === 'web' && moduleName.startsWith('zustand')) {
    const zustandRoot = path.resolve(__dirname, 'node_modules/zustand');
    const subpath = moduleName === 'zustand' ? '' : moduleName.replace('zustand/', '/');
    const cjsFile = path.join(zustandRoot, subpath ? subpath + '.js' : 'index.js');
    try {
      require.resolve(cjsFile);
      return { filePath: cjsFile, type: 'sourceFile' };
    } catch {}
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
