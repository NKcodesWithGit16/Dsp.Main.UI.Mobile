module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native|@react-navigation|expo(nent)?|@expo(nent)?/.*|expo-modules-core|@unimodules/.*|react-native-svg|react-native-reanimated|react-native-gesture-handler)/)',
  ],
  moduleNameMapper: {
    '\\.(png|jpg|jpeg|svg|gif)$': '<rootDir>/__mocks__/fileMock.js',
  },
  setupFilesAfterEach: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'node',
};
