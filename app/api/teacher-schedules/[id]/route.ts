import { NextRequest, NextResponse } from 'next/server'
import {
  getTeacherScheduleById,
  updateTeacherSchedule,
  deleteTeacherSchedule,
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
    const schedule = await updateTeacherSchedule(id, body)
    if (!schedule) {
      return NextResponse.json(
        { error: 'Teacher schedule not found or not permitted for update' },
        { status: 404 }
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await getTeacherScheduleById(id)
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
