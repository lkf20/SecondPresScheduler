import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse } from '@/lib/utils/errors'

// Placeholder route - not yet implemented
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return createErrorResponse(
    new Error('Not implemented'),
    'This endpoint is not yet implemented',
    501
  )
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return createErrorResponse(
    new Error('Not implemented'),
    'This endpoint is not yet implemented',
    501
  )
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return createErrorResponse(
    new Error('Not implemented'),
    'This endpoint is not yet implemented',
    501
  )
}
