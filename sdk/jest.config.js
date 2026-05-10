/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': require.resolve('./jest.transformer.cjs'),
    '^.+\\.js$': require.resolve('./jest.transformer.cjs'),
  },
  transformIgnorePatterns: ['/node_modules/(?!@noble/)'],
};

module.exports = config;
