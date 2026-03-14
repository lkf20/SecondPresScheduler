import { NextRequest, NextResponse } from 'next/server'
import {
  getTeacherScheduleById,
  updateTeacherSchedule,
  deleteTeacherSchedule,
  TeacherScheduleConflictError,
  checkDependentFutureEvents,
  syncFutureClassroom,
} from '@/lib/api/schedules'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getAuditActorContext, logAuditEvent } from '@/lib/audit/logAuditEvent'
import { getStaffDisplayName } from '@/lib/utils/staff-display-name'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const schedule = await getTeacherScheduleById(id)
    return NextResponse.json(schedule)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    // Get existing to check what's changing
    const existing = await getTeacherScheduleById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Teacher schedule not found' }, { status: 404 })
    }

    // Rule 2: Block structural changes if there are future dependents
    const isTeacherChange = body.teacher_id && body.teacher_id !== existing.teacher_id
    const isDayOrTimeChange =
      (body.day_of_week_id && body.day_of_week_id !== existing.day_of_week_id) ||
      (body.time_slot_id && body.time_slot_id !== existing.time_slot_id)

    const isClassroomChange = body.classroom_id && body.classroom_id !== existing.classroom_id

    if (isTeacherChange || isDayOrTimeChange) {
      const { hasDependents, message } = await checkDependentFutureEvents(
        existing.teacher_id,
        existing.day_of_week_id,
        existing.time_slot_id
      )
      if (hasDependents) {
        return NextResponse.json({ error: message }, { status: 409 })
      }
    }

    const schedule = await updateTeacherSchedule(id, body)
    if (!schedule) {
      return NextResponse.json(
        { error: 'Teacher schedule not found or not permitted for update' },
        { status: 404 }
      )
    }

    // Rule 1: Safe Sync future classroom changes
    if (isClassroomChange && !isTeacherChange && !isDayOrTimeChange) {
      await syncFutureClassroom(
        schedule.teacher_id,
        schedule.day_of_week_id,
        schedule.time_slot_id,
        schedule.classroom_id
      )
    }

    const schoolId = (schedule as { school_id?: string }).school_id ?? (await getUserSchoolId())
    if (schoolId) {
      const withDetails = await getTeacherScheduleById(id)
      const teacherName = withDetails?.teacher ? getStaffDisplayName(withDetails.teacher) : null
      const { actorUserId, actorDisplayName } = await getAuditActorContext()
      await logAuditEvent({
        schoolId,
        actorUserId,
        actorDisplayName,
        action: 'update',
        category: 'baseline_schedule',
        entityType: 'teacher_schedule',
        entityId: id,
        details: {
          teacher_id: schedule.teacher_id,
          teacher_name: teacherName,
          classroom_id: schedule.classroom_id,
          classroom_name: withDetails?.classroom?.name ?? null,
          day_of_week_id: schedule.day_of_week_id,
          day_name: withDetails?.day_of_week?.name ?? null,
          time_slot_id: schedule.time_slot_id,
          time_slot_code: withDetails?.time_slot?.code ?? null,
          is_floater: schedule.is_floater,
          updated_fields: Object.keys(body),
        },
      })
    }
    return NextResponse.json(schedule)
  } catch (error: unknown) {
    if (error instanceof TeacherScheduleConflictError) {
      return NextResponse.json({ error: error.userMessage }, { status: 409 })
    }
    const message = error instanceof Error ? error.message : 'Failed to update teacher schedule'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await getTeacherScheduleById(id)

    if (existing) {
      // Rule 2: Block deletion if there are future dependents
      const { hasDependents, message } = await checkDependentFutureEvents(
        existing.teacher_id,
        existing.day_of_week_id,
        existing.time_slot_id
      )
      if (hasDependents) {
        return NextResponse.json({ error: message }, { status: 409 })
      }
    }

    await deleteTeacherSchedule(id)
    const schoolId =
      (existing as { school_id?: string } | null)?.school_id ?? (await getUserSchoolId())
    if (schoolId && existing) {
      const teacherName = existing.teacher ? getStaffDisplayName(existing.teacher) : null
      const { actorUserId, actorDisplayName } = await getAuditActorContext()
      await logAuditEvent({
        schoolId,
        actorUserId,
        actorDisplayName,
        action: 'unassign',
        category: 'baseline_schedule',
        entityType: 'teacher_schedule',
        entityId: id,
        details: {
          teacher_id: existing.teacher_id,
          teacher_name: teacherName,
          classroom_id: existing.classroom_id,
          classroom_name: existing.classroom?.name ?? null,
          day_of_week_id: existing.day_of_week_id,
          day_name: existing.day_of_week?.name ?? null,
          time_slot_id: existing.time_slot_id,
          time_slot_code: existing.time_slot?.code ?? null,
          is_floater: existing.is_floater,
        },
      })
    }
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
