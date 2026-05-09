const nextJest = require('next/jest.js');

const createJestConfig = nextJest({ dir: './' });

const config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFiles: ['<rootDir>/tests/setup.ts'],
};

module.exports = createJestConfig(config);
