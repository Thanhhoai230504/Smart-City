module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/seeds/**',
    '!src/config/**',
    '!src/jobs/**',
  ],
  coverageDirectory: 'coverage',
  setupFiles: ['./tests/setup.js'],
};
