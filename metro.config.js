const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * Extended to bundle TFLite model files (.tflite, .bin, .task)
 */
const defaultConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    assetExts: [
      ...defaultConfig.resolver.assetExts,
      'tflite',
      'bin',
      'task',
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
