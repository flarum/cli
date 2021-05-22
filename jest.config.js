module.exports = {
  collectCoverage: true,
  preset: 'ts-jest',
  coverageReporters: [
    'html',
    'lcov',
    'text-summary',
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
  transform: {
    '^.+\\.(ts|tsx)?$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
};
