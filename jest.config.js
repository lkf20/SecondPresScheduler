const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  watchman: false,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: ['<rootDir>/tests/e2e/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  coverageThreshold:
    process.env.ENFORCE_PHASE1_COVERAGE === 'true'
      ? {
          './app/api/time-off/**/*.ts': {
            branches: 60,
            functions: 70,
            lines: 70,
            statements: 70,
          },
          './app/api/sub-finder/**/*.ts': {
            branches: 60,
            functions: 70,
            lines: 70,
            statements: 70,
          },
          './components/time-off/**/*.tsx': {
            branches: 60,
            functions: 70,
            lines: 70,
            statements: 70,
          },
          './components/sub-finder/**/*.tsx': {
            branches: 60,
            functions: 70,
            lines: 70,
            statements: 70,
          },
        }
      : undefined,
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
