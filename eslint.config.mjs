import next from 'eslint-config-next'

const config = [
  ...next,
  {
    ignores: ['coverage/**'],
  },
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['**/*.config.js', '**/*.config.cjs', '**/*.config.mjs', 'jest.config.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['scripts/**/*.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx', '**/*.test.js', '**/*.test.mjs'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['app/api/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]

export default config
