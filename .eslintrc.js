module.exports = {
  root: true,
  extends: ['expo'],
  plugins: ['react-hooks'],
  env: {
    jest: true,
  },
  globals: {
    __DEV__: 'readonly',
  },
  rules: {
    // Surface real bugs
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'no-unused-vars': ['warn', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      ignoreRestSiblings: true,
    }],
    'no-undef': 'error',

    // Style / hygiene
    'prefer-const': 'warn',
    eqeqeq: ['warn', 'always', { null: 'ignore' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],

    // React Native specific noise we don't want
    'react/prop-types': 'off',
    'react/display-name': 'off',
    'react-native/no-inline-styles': 'off',
    'react-native/no-color-literals': 'off',
  },
  ignorePatterns: [
    'node_modules/',
    '.expo/',
    'android/',
    'ios/',
    'dist/',
    'web-build/',
  ],
};
