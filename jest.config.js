module.exports = {
  setupFilesAfterEnv: ['jest-extended'],
  collectCoverage: true,
  preset: 'ts-jest',
  coverageReporters: [
    'html',
    'lcov',
    'text-summary',
  ],
  transform: {
    '^.+\\.(ts|tsx)?$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
};
