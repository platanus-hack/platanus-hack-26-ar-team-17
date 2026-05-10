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

module.exports = async () => {
  const cfg = await createJestConfig(config)();
  // Allow @noble/* ESM packages to be transformed (they use ES module syntax)
  cfg.transformIgnorePatterns = cfg.transformIgnorePatterns.map(p =>
    p.startsWith('/node_modules/') ? p.replace('/node_modules/', '/node_modules/(?!@noble/)') : p,
  );
  return cfg;
};
