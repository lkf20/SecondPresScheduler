import { NextRequest, NextResponse } from 'next/server'
import { getScheduleCells, createScheduleCell } from '@/lib/api/schedule-cells'
import { createErrorResponse } from '@/lib/utils/errors'
import {
  scheduleCellFiltersSchema,
  createScheduleCellSchema,
} from '@/lib/validations/schedule-cells'
import { validateQueryParams, validateRequest } from '@/lib/utils/validation'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Validate query parameters
    const validation = validateQueryParams(scheduleCellFiltersSchema, searchParams)
    if (!validation.success) {
      return validation.error
    }

    const cells = await getScheduleCells(validation.data)
    return NextResponse.json(cells)
  } catch (error) {
    return createErrorResponse(
      error,
      'Failed to fetch schedule cells',
      500,
      'GET /api/schedule-cells'
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const validation = validateRequest(createScheduleCellSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const cell = await createScheduleCell(validation.data)
    return NextResponse.json(cell, { status: 201 })
  } catch (error) {
    return createErrorResponse(
      error,
      'Failed to create schedule cell',
      500,
      'POST /api/schedule-cells'
    )
  }
}
