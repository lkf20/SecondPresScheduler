import { NextRequest, NextResponse } from 'next/server'
import { getScheduleCells, updateScheduleCell, deleteScheduleCell } from '@/lib/api/schedule-cells'
import { createErrorResponse } from '@/lib/utils/errors'
import { updateScheduleCellSchema } from '@/lib/validations/schedule-cells'
import { validateRequest } from '@/lib/utils/validation'
import { z } from 'zod'

const uuidSchema = z.string().uuid({ message: 'Invalid ID format' })

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Validate ID format
    const idValidation = uuidSchema.safeParse(id)
    if (!idValidation.success) {
      return NextResponse.json({ error: 'Invalid schedule cell ID format' }, { status: 400 })
    }

    // Note: This route expects a composite key format: classroom_id-day_of_week_id-time_slot_id
    // For now, we'll need to parse it or use a different approach
    // For simplicity, let's use getScheduleCells and filter
    const cells = await getScheduleCells()
    const cell = cells.find(c => c.id === id)

    if (!cell) {
      return NextResponse.json({ error: 'Schedule cell not found' }, { status: 404 })
    }

    return NextResponse.json(cell)
  } catch (error) {
    return createErrorResponse(
      error,
      'Failed to fetch schedule cell',
      500,
      'GET /api/schedule-cells/[id]'
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Validate ID format
    const idValidation = uuidSchema.safeParse(id)
    if (!idValidation.success) {
      return NextResponse.json({ error: 'Invalid schedule cell ID format' }, { status: 400 })
    }

    const body = await request.json()

    // Validate request body
    const validation = validateRequest(updateScheduleCellSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const cell = await updateScheduleCell(id, validation.data)
    return NextResponse.json(cell)
  } catch (error) {
    return createErrorResponse(
      error,
      'Failed to update schedule cell',
      500,
      'PUT /api/schedule-cells/[id]'
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Validate ID format
    const idValidation = uuidSchema.safeParse(id)
    if (!idValidation.success) {
      return NextResponse.json({ error: 'Invalid schedule cell ID format' }, { status: 400 })
    }

    await deleteScheduleCell(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return createErrorResponse(
      error,
      'Failed to delete schedule cell',
      500,
      'DELETE /api/schedule-cells/[id]'
    )
  }
}
