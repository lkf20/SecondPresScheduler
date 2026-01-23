# Error Handling Guide

This document outlines the standardized error handling patterns for the Preschool Scheduler application.

## Principles

1. **Fail Gracefully**: Always show user-friendly error messages
2. **Log for Debugging**: Log detailed errors to console for developers
3. **Consistent Format**: Use the same error response format throughout
4. **Actionable Messages**: Tell users what went wrong and how to fix it

## API Routes

### Standard Pattern

All API routes should use the `createErrorResponse` utility from `@/lib/utils/errors`:

```typescript
import { createErrorResponse } from '@/lib/utils/errors'

export async function GET() {
  try {
    // Your logic here
    return NextResponse.json(data)
  } catch (error) {
    return createErrorResponse(
      error,
      'Failed to fetch resource', // User-friendly message
      500, // HTTP status code
      'GET /api/resource' // Context for logging
    )
  }
}
```

### Benefits

- **Consistent error format**: All errors follow the same structure
- **User-friendly messages**: Database errors are translated to readable messages
- **Development details**: Stack traces included in development mode
- **Automatic logging**: Errors are logged with context

### Error Response Format

```json
{
  "error": "User-friendly error message",
  "details": {
    "message": "Technical error message",
    "stack": "Error stack trace"
  }
}
```

The `details` field is only included in development mode.

## Client Components

### Using ErrorMessage Component

For displaying errors in the UI, use the `ErrorMessage` component:

```typescript
import ErrorMessage from '@/components/shared/ErrorMessage'

function MyComponent() {
  const [error, setError] = useState<string | null>(null)

  if (error) {
    return <ErrorMessage message={error} />
  }

  // ... rest of component
}
```

### Error Handling in Forms

For form submissions, handle errors gracefully:

```typescript
const handleSubmit = async (data: FormData) => {
  try {
    setError(null)
    setLoading(true)
    await submitForm(data)
    // Success handling
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred'
    setError(message)
  } finally {
    setLoading(false)
  }
}
```

## Database Errors

The error utility automatically translates common database errors:

- **23505** (Duplicate key): "This record already exists"
- **23503** (Foreign key): "Invalid reference to related data"
- **23502** (Not null): "Required field is missing"
- **23514** (Check constraint): "Invalid data provided"

## Best Practices

1. **Always use try/catch**: Wrap async operations in try/catch blocks
2. **Provide context**: Include the route/function name in error context
3. **User-friendly messages**: Don't expose technical details to users
4. **Log everything**: Use `logError` for debugging information
5. **Handle edge cases**: Consider what happens when data is null/undefined
6. **Validate input**: Check data before processing to prevent errors

## Examples

### Good Error Handling

```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    if (!body.name) {
      return createErrorResponse(
        new Error('Name is required'),
        'Name is required',
        400,
        'POST /api/resource'
      )
    }

    const result = await createResource(body)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return createErrorResponse(error, 'Failed to create resource', 500, 'POST /api/resource')
  }
}
```

### Bad Error Handling

```typescript
// ❌ Don't do this
export async function POST(request: NextRequest) {
  const body = await request.json() // No error handling
  const result = await createResource(body) // Could throw
  return NextResponse.json(result)
}
```

## Migration Checklist

When updating routes to use standardized error handling:

- [ ] Import `createErrorResponse` from `@/lib/utils/errors`
- [ ] Wrap logic in try/catch
- [ ] Replace `NextResponse.json({ error: ... })` with `createErrorResponse`
- [ ] Add context string for logging
- [ ] Test error scenarios
- [ ] Verify user-friendly messages

---

_Last updated: January 2025_
