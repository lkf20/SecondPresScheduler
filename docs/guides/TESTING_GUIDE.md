# Testing Guide

This document outlines the testing setup and best practices for the Preschool Scheduler application.

## Setup

The project uses **Jest** and **React Testing Library** for testing.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Structure

Tests should be placed next to the files they test:

```
lib/utils/
  errors.ts
  __tests__/
    errors.test.ts

components/
  shared/
    ErrorMessage.tsx
    __tests__/
      ErrorMessage.test.tsx
```

## Writing Tests

### Component Tests

```typescript
import { render, screen } from '@testing-library/react'
import MyComponent from '../MyComponent'

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })
})
```

### Utility Function Tests

```typescript
import { myFunction } from '../myFunction'

describe('myFunction', () => {
  it('should return expected value', () => {
    expect(myFunction('input')).toBe('expected output')
  })
})
```

## Best Practices

1. **Test behavior, not implementation**: Focus on what the component/function does, not how
2. **Use descriptive test names**: Test names should clearly describe what is being tested
3. **Keep tests simple**: Each test should verify one thing
4. **Use appropriate queries**: Prefer `getByRole`, `getByLabelText` over `getByTestId`
5. **Test edge cases**: Include tests for error states, empty states, boundary conditions

## Coverage Goals

- **Start small**: Begin with critical utilities and shared components
- **Build over time**: Add tests as you work on features
- **Aim for 80%+**: Focus on high-value code paths

## Example Tests

See the existing tests for examples:

- `lib/utils/__tests__/errors.test.ts` - Utility function tests
- `components/shared/__tests__/ErrorMessage.test.tsx` - Component tests

---

_Last updated: January 2025_
