const path = require('path');

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': path.resolve(__dirname, 'jest.transformer.cjs').replace(/\\/g, '/'),
  },
};

module.exports = config;
