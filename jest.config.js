module.exports = {
  setupFilesAfterEnv: ['jest-extended'],
  testTimeout: 10_000,
  collectCoverage: true,
  testEnvironment: 'node',
  preset: 'ts-jest',
  coverageReporters: [
    'html',
    'lcov',
    'text-summary',
  ],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'ts-jest',
  },
  moduleNameMapper: {
    '^boilersmith/(.*)': '<rootDir>/src/boilersmith/$1',
  },
};
