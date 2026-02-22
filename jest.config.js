const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const isPhase1CoverageGate = process.env.ENFORCE_PHASE1_COVERAGE === 'true'
const isPhase2CoverageGate = process.env.ENFORCE_PHASE2_COVERAGE === 'true'

const defaultCoverageGlobs = [
  'app/**/*.{js,jsx,ts,tsx}',
  'components/**/*.{js,jsx,ts,tsx}',
  'lib/**/*.{js,jsx,ts,tsx}',
  '!**/*.d.ts',
  '!**/node_modules/**',
  '!**/.next/**',
]

const phase1CoverageGlobs = [
  'app/api/time-off/**/*.ts',
  'app/api/sub-finder/**/*.ts',
  'components/time-off/**/*.tsx',
  'components/sub-finder/**/*.tsx',
]

const phase2CoverageGlobs = [
  'app/api/staffing-events/**/*.ts',
  'app/api/teacher-schedules/**/*.ts',
  'app/api/weekly-schedule/**/*.ts',
]

const getCoverageGlobs = () => {
  if (isPhase1CoverageGate && isPhase2CoverageGate) {
    return [...phase1CoverageGlobs, ...phase2CoverageGlobs]
  }
  if (isPhase1CoverageGate) {
    return phase1CoverageGlobs
  }
  if (isPhase2CoverageGate) {
    return phase2CoverageGlobs
  }
  return defaultCoverageGlobs
}

const getCoverageThreshold = () => {
  if (isPhase1CoverageGate && isPhase2CoverageGate) {
    return {
      global: {
        branches: 60,
        functions: 70,
        lines: 70,
        statements: 70,
      },
    }
  }

  if (isPhase2CoverageGate) {
    return {
      global: {
        branches: 60,
        functions: 70,
        lines: 70,
        statements: 70,
      },
    }
  }

  if (isPhase1CoverageGate) {
    return {
      // Progressive Phase 1 gate: enforce a meaningful floor now and ratchet up as
      // remaining high-complexity files gain coverage.
      // TODO(phase-1): raise to statements/lines/functions 70 and branches 60.
      global: {
        branches: 45,
        functions: 55,
        lines: 60,
        statements: 60,
      },
    }
  }

  return undefined
}

const customJestConfig = {
  watchman: false,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: ['<rootDir>/tests/e2e/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  collectCoverageFrom: getCoverageGlobs(),
  coverageThreshold: getCoverageThreshold(),
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
