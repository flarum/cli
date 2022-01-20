module.exports = {
  setupFilesAfterEnv: ['jest-extended'],
  collectCoverage: true,
  testEnvironment: 'node',
  preset: 'ts-jest',
  coverageReporters: ['html', 'lcov', 'text-summary'],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'ts-jest',
  },
  moduleNameMapper: {
    '^boilersmith/(.*)': '<rootDir>/src/boilersmith/$1',
  },
};
