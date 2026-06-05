import 'react-native-gesture-handler/jestSetup';

// Mock Reanimated
jest.mock('react-native-reanimated', () => {
  return require('react-native-reanimated/mock');
});

// Mock SQLite Storage
jest.mock('react-native-sqlite-storage', () => ({
  enablePromise: jest.fn(),
  openDatabase: jest.fn(async () => ({
    executeSql: jest.fn(async () => [{rows: {item: () => null, length: 0}}]),
    transaction: jest.fn(cb => cb({executeSql: jest.fn()})),
    close: jest.fn(),
  })),
}));

// Mock Encrypted Storage
jest.mock('react-native-encrypted-storage', () => ({
  setItem: jest.fn(async () => {}),
  getItem: jest.fn(async () => null),
  removeItem: jest.fn(async () => {}),
  clear: jest.fn(async () => {}),
}));

// Mock Device Info
jest.mock('react-native-device-info', () => ({
  isEmulator: jest.fn(async () => false),
  hasSystemFeature: jest.fn(async () => true),
  getModel: jest.fn(async () => 'Jest Test Device'),
  getBrand: jest.fn(async () => 'Jest'),
  getBundleId: jest.fn(async () => 'com.faceguardoffline'),
  getUniqueId: jest.fn(async () => 'unique-device-id-1234'),
  getSystemVersion: jest.fn(async () => '14.0'),
  getVersion: jest.fn(async () => '1.0.0'),
}));

// Mock Vision Camera
jest.mock('react-native-vision-camera', () => {
  return {
    Camera: () => null,
    useCameraDevice: jest.fn(() => ({})),
    useCameraPermission: jest.fn(() => ({
      hasPermission: true,
      requestPermission: jest.fn(async () => true),
    })),
  };
});

// Mock react-native-screens
jest.mock('react-native-screens', () => {
  const React = require('react');
  const {View} = require('react-native');
  return {
    ScreenContainer: View,
    Screen: View,
    NativeScreen: View,
    NativeScreenContainer: View,
    ScreenStack: View,
    ScreenStackHeaderConfig: View,
    ScreenStackHeaderSubview: View,
    enableScreens: jest.fn(),
    screensEnabled: jest.fn(() => false),
  };
});
