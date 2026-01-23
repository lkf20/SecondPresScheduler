import { NextRequest, NextResponse } from 'next/server'
import { bulkUpdateScheduleCells } from '@/lib/api/schedule-cells'
import { createErrorResponse } from '@/lib/utils/errors'
import { bulkUpdateScheduleCellsSchema } from '@/lib/validations/schedule-cells'
import { validateRequest } from '@/lib/utils/validation'

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const validation = validateRequest(bulkUpdateScheduleCellsSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const cells = await bulkUpdateScheduleCells(validation.data.updates)
    return NextResponse.json(cells)
  } catch (error) {
    return createErrorResponse(
      error,
      'Failed to bulk update schedule cells',
      500,
      'PUT /api/schedule-cells/bulk'
    )
  }
}
