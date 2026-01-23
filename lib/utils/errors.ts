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
  // Check for Supabase/PostgreSQL errors with code property (even if not Error instance)
  const errorObj =
    typeof error === 'object' && error !== null
      ? (error as { code?: string; message?: string; details?: string; hint?: string })
      : null

  // Log the error structure for debugging
  if (process.env.NODE_ENV === 'development') {
    console.error('getErrorMessage received:', {
      error,
      type: typeof error,
      isError: error instanceof Error,
      errorObj,
      code: errorObj?.code,
      message: errorObj?.message,
      details: errorObj?.details,
      hint: errorObj?.hint,
    })
  }

  if (errorObj?.code) {
    // PostgreSQL error codes
    if (errorObj.code === '23505') {
      return `This record already exists (duplicate key violation): ${errorObj.message || errorObj.details || ''}`
    }
    if (errorObj.code === '23503') {
      return `Invalid reference to related data (foreign key violation): ${errorObj.message || errorObj.details || ''}`
    }
    if (errorObj.code === '23502') {
      return `Required field is missing (not null violation): ${errorObj.message || errorObj.details || ''}`
    }
    if (errorObj.code === '23514') {
      return `Invalid data provided (check constraint violation): ${errorObj.message || errorObj.details || ''}`
    }
    // Return the error message with code if available
    return errorObj.message || errorObj.details || `Database error (code: ${errorObj.code})`
  }

  if (error instanceof Error) {
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

  // Try to extract message from error object
  if (errorObj?.message) {
    return String(errorObj.message)
  }

  if (errorObj?.details) {
    return String(errorObj.details)
  }

  return `An unexpected error occurred: ${String(error)}`
}

/**
 * Logs error with context for debugging
 */
export function logError(
  context: string,
  error: unknown,
  additionalInfo?: Record<string, unknown>
) {
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
 * Supports two call patterns:
 * 1. createErrorResponse(message: string, statusCode: number)
 * 2. createErrorResponse(error: unknown, defaultMessage?: string, statusCode?: number, context?: string)
 */
export function createErrorResponse(message: string, statusCode: number): Response
export function createErrorResponse(
  error: unknown,
  defaultMessage?: string,
  statusCode?: number,
  context?: string
): Response
export function createErrorResponse(
  errorOrMessage: unknown,
  defaultMessageOrStatusCode?: string | number,
  statusCode?: number,
  context?: string
): Response {
  // Check if first argument is a string (simple message pattern)
  if (typeof errorOrMessage === 'string') {
    // Pattern 1: createErrorResponse(message: string, statusCode: number)
    const message = errorOrMessage
    const status = typeof defaultMessageOrStatusCode === 'number' ? defaultMessageOrStatusCode : 500

    return Response.json({ error: message }, { status })
  }

  // Pattern 2: createErrorResponse(error: unknown, defaultMessage?: string, statusCode?: number, context?: string)
  const error = errorOrMessage
  const defaultMessage =
    typeof defaultMessageOrStatusCode === 'string'
      ? defaultMessageOrStatusCode
      : 'An error occurred'
  const status =
    statusCode ??
    (typeof defaultMessageOrStatusCode === 'number' ? defaultMessageOrStatusCode : 500)

  const message = getErrorMessage(error) || defaultMessage

  if (context) {
    logError(context, error)
  }

  const errorResponse: Record<string, unknown> = {
    error: message,
  }

  if (process.env.NODE_ENV === 'development' && error instanceof Error) {
    errorResponse.details = {
      message: error.message,
      stack: error.stack,
    }
  }

  return Response.json(errorResponse, { status })
}
