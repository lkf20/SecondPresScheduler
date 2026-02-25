import { NextRequest, NextResponse } from 'next/server'
import { bulkUpdateScheduleCells } from '@/lib/api/schedule-cells'
import { createErrorResponse } from '@/lib/utils/errors'
import { bulkUpdateScheduleCellsSchema } from '@/lib/validations/schedule-cells'
import { validateRequest } from '@/lib/utils/validation'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getAuditActorContext, logAuditEvent } from '@/lib/audit/logAuditEvent'
import { createClient } from '@/lib/supabase/server'

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const validation = validateRequest(bulkUpdateScheduleCellsSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const cells = await bulkUpdateScheduleCells(validation.data.updates)
    const schoolId =
      (cells[0] as { school_id?: string } | undefined)?.school_id ?? (await getUserSchoolId())
    if (schoolId && cells.length > 0) {
      const supabase = await createClient()
      const classroomIds = [...new Set(cells.map(c => c.classroom_id))]
      const dayIds = [...new Set(cells.map(c => c.day_of_week_id))]
      const slotIds = [...new Set(cells.map(c => c.time_slot_id))]
      const [{ data: classrooms }, { data: days }, { data: timeSlots }] = await Promise.all([
        supabase.from('classrooms').select('id, name').in('id', classroomIds),
        supabase.from('days_of_week').select('id, name').in('id', dayIds),
        supabase.from('time_slots').select('id, code').in('id', slotIds),
      ])
      const classroomName = classrooms?.[0]?.name ?? null
      const dayName = days?.[0]?.name ?? null
      const timeSlotCodes =
        (timeSlots ?? [])
          .map(s => s.code)
          .filter(Boolean)
          .join(', ') || null
      const summary =
        [cells.length, classroomName, dayName].filter(Boolean).length >= 2
          ? `${cells.length} cell${cells.length !== 1 ? 's' : ''} in ${classroomName ?? '?'}, ${dayName ?? '?'}${timeSlotCodes ? ` (${timeSlotCodes})` : ''}`
          : `${cells.length} cell${cells.length !== 1 ? 's' : ''} updated`
      const { actorUserId, actorDisplayName } = await getAuditActorContext()
      await logAuditEvent({
        schoolId,
        actorUserId,
        actorDisplayName,
        action: 'update',
        category: 'baseline_schedule',
        entityType: 'schedule_cell',
        entityId: cells[0].id,
        details: {
          cell_count: cells.length,
          bulk: true,
          classroom_ids: classroomIds,
          classroom_name: classroomName,
          day_of_week_ids: dayIds,
          day_name: dayName,
          time_slot_ids: slotIds,
          time_slot_codes: timeSlotCodes || undefined,
          summary,
        },
      })
    }
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
