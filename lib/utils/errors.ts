/**
 * Error handling utilities for API routes
 */

export interface ApiError {
  message: string
  code?: string
  statusCode: number
  details?: unknown
}

/**
 * Creates a user-friendly error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Check for Supabase/PostgreSQL errors with code property
    const errorObj = error as any
    if (errorObj.code) {
      // PostgreSQL error codes
      if (errorObj.code === '23505') {
        return 'This record already exists (duplicate key violation)'
      }
      if (errorObj.code === '23503') {
        return 'Invalid reference to related data (foreign key violation)'
      }
      if (errorObj.code === '23502') {
        return 'Required field is missing (not null violation)'
      }
      if (errorObj.code === '23514') {
        return 'Invalid data provided (check constraint violation)'
      }
    }
    // Check for common database errors in message
    if (error.message.includes('duplicate key') || error.message.includes('23505')) {
      return 'This record already exists'
    }
    if (error.message.includes('foreign key') || error.message.includes('23503')) {
      return 'Invalid reference to related data'
    }
    if (error.message.includes('not null') || error.message.includes('23502')) {
      return 'Required field is missing'
    }
    if (error.message.includes('violates check constraint') || error.message.includes('23514')) {
      return 'Invalid data provided'
    }
    return error.message
  }
  return 'An unexpected error occurred'
}

/**
 * Logs error with context for debugging
 */
export function logError(context: string, error: unknown, additionalInfo?: Record<string, unknown>) {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorStack = error instanceof Error ? error.stack : undefined
  
  console.error(`[${context}] Error:`, {
    message: errorMessage,
    stack: errorStack,
    ...additionalInfo,
  })
}

/**
 * Creates a standardized API error response
 */
export function createErrorResponse(
  error: unknown,
  defaultMessage = 'An error occurred',
  statusCode = 500,
  context?: string
): Response {
  const message = getErrorMessage(error)
  
  if (context) {
    logError(context, error)
  }
  
  return Response.json(
    {
      error: message,
      ...(process.env.NODE_ENV === 'development' && error instanceof Error && {
        details: {
          message: error.message,
          stack: error.stack,
        },
      }),
    },
    { status: statusCode }
  )
}

