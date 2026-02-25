import { NextRequest, NextResponse } from 'next/server'
import { getScheduleCells, createScheduleCell, getScheduleCellById } from '@/lib/api/schedule-cells'
import { createErrorResponse } from '@/lib/utils/errors'
import {
  scheduleCellFiltersSchema,
  createScheduleCellSchema,
} from '@/lib/validations/schedule-cells'
import { validateQueryParams, validateRequest } from '@/lib/utils/validation'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getAuditActorContext, logAuditEvent } from '@/lib/audit/logAuditEvent'

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
    const schoolId = (cell as { school_id?: string }).school_id ?? (await getUserSchoolId())
    if (schoolId) {
      const cellWithDetails = await getScheduleCellById(cell.id)
      const { actorUserId, actorDisplayName } = await getAuditActorContext()
      await logAuditEvent({
        schoolId,
        actorUserId,
        actorDisplayName,
        action: 'create',
        category: 'baseline_schedule',
        entityType: 'schedule_cell',
        entityId: cell.id,
        details: {
          classroom_id: cell.classroom_id,
          classroom_name: cellWithDetails?.classroom?.name,
          day_of_week_id: cell.day_of_week_id,
          day_name: cellWithDetails?.day_of_week?.name,
          time_slot_id: cell.time_slot_id,
          time_slot_code: cellWithDetails?.time_slot?.code,
          is_active: cell.is_active,
          class_group_ids: validation.data.class_group_ids ?? undefined,
          enrollment_for_staffing: cell.enrollment_for_staffing ?? undefined,
          notes: cell.notes ?? undefined,
        },
      })
    }
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
