# API Route Patterns

This document outlines the standard patterns for API routes in this application.

## Error Handling

All API routes should use the centralized error handling utility:

```typescript
import { createErrorResponse } from '@/lib/utils/errors'

export async function GET() {
  try {
    // ... route logic
    return NextResponse.json(data)
  } catch (error) {
    return createErrorResponse(error, 'Failed to fetch resource', 500, 'GET /api/resource')
  }
}
```

**Benefits:**

- Consistent error format
- User-friendly error messages
- Structured logging with context
- Development-only stack traces

## Input Validation

Use Zod schemas for request validation:

```typescript
import { validateRequest, validateQueryParams } from '@/lib/utils/validation'
import { createResourceSchema } from '@/lib/validations/resource'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const validation = validateRequest(createResourceSchema, body)
    if (!validation.success) {
      return validation.error
    }

    // Use validated data
    const resource = await createResource(validation.data)
    return NextResponse.json(resource, { status: 201 })
  } catch (error) {
    return createErrorResponse(error, 'Failed to create resource', 500, 'POST /api/resource')
  }
}
```

## Standard HTTP Methods

- **GET**: Fetch resources (with optional query parameters)
- **POST**: Create new resources (returns 201 with created resource)
- **PUT**: Update existing resources (full or partial update)
- **DELETE**: Delete resources (returns 200 with success message)

## Response Patterns

### Success Responses

- **GET**: `NextResponse.json(data)` (200)
- **POST**: `NextResponse.json(data, { status: 201 })`
- **PUT**: `NextResponse.json(data)` (200)
- **DELETE**: `NextResponse.json({ success: true })` (200)

### Error Responses

- Use `createErrorResponse()` for all errors
- 400: Validation errors
- 404: Resource not found
- 500: Server errors

## Query Parameter Validation

For GET routes with query parameters:

```typescript
import { validateQueryParams } from '@/lib/utils/validation'
import { resourceFiltersSchema } from '@/lib/validations/resource'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const validation = validateQueryParams(resourceFiltersSchema, searchParams)
    if (!validation.success) {
      return validation.error
    }

    const resources = await getResources(validation.data)
    return NextResponse.json(resources)
  } catch (error) {
    return createErrorResponse(error, 'Failed to fetch resources', 500, 'GET /api/resources')
  }
}
```

## Dynamic Routes

For routes with dynamic parameters (e.g., `[id]`):

```typescript
import { z } from 'zod'

const uuidSchema = z.string().uuid({ message: 'Invalid ID format' })

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Validate ID format
    const idValidation = uuidSchema.safeParse(id)
    if (!idValidation.success) {
      return NextResponse.json({ error: 'Invalid resource ID format' }, { status: 400 })
    }

    // ... route logic
  } catch (error) {
    return createErrorResponse(error, 'Failed to fetch resource', 500, 'GET /api/resources/[id]')
  }
}
```

## Migration Status

- ✅ Schedule Cells routes - Updated
- ✅ Teacher Schedules routes - Updated
- ✅ Classes routes - Updated
- ✅ Classrooms routes - Updated
- ✅ Time Slots routes - Updated
- ✅ Days of Week routes - Updated
- ⏳ Other routes - To be updated as needed
