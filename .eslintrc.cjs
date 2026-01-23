module.exports = {
  root: true,
  extends: ['next/core-web-vitals', 'next/typescript', 'prettier'],
  ignorePatterns: ['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'coverage/**'],
  rules: {
    'react-hooks/set-state-in-effect': 'off',
  },
  overrides: [
    {
      files: ['**/*.config.js', '**/*.config.cjs', '**/*.config.mjs', 'jest.config.js'],
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
  ],
}
