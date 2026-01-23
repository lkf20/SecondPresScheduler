import { z } from 'zod'
import { NextResponse } from 'next/server'

/**
 * Utility function to validate request data with Zod schema
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: NextResponse } {
  const result = schema.safeParse(data)

  if (!result.success) {
    const errors = result.error.issues.map(err => ({
      path: err.path.join('.'),
      message: err.message,
    }))

    return {
      success: false,
      error: NextResponse.json(
        {
          error: 'Validation failed',
          details: errors,
        },
        { status: 400 }
      ),
    }
  }

  return {
    success: true,
    data: result.data,
  }
}

/**
 * Validate query parameters
 */
export function validateQueryParams<T>(
  schema: z.ZodSchema<T>,
  searchParams: URLSearchParams
): { success: true; data: T } | { success: false; error: NextResponse } {
  const params: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    params[key] = value
  })

  return validateRequest(schema, params)
}
