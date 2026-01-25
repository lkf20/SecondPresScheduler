import { createErrorResponse } from '@/lib/utils/errors'

// Placeholder route - not yet implemented
export async function GET() {
  return createErrorResponse(
    new Error('Not implemented'),
    'This endpoint is not yet implemented',
    501
  )
}

export async function PUT() {
  return createErrorResponse(
    new Error('Not implemented'),
    'This endpoint is not yet implemented',
    501
  )
}

export async function DELETE() {
  return createErrorResponse(
    new Error('Not implemented'),
    'This endpoint is not yet implemented',
    501
  )
}
