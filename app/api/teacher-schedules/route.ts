import { NextRequest, NextResponse } from 'next/server'
import {
  getAllTeacherSchedules,
  createTeacherSchedule,
  getTeacherScheduleById,
} from '@/lib/api/schedules'
import { createErrorResponse } from '@/lib/utils/errors'
import {
  teacherScheduleFiltersSchema,
  createTeacherScheduleSchema,
} from '@/lib/validations/teacher-schedules'
import { validateQueryParams, validateRequest } from '@/lib/utils/validation'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getAuditActorContext, logAuditEvent } from '@/lib/audit/logAuditEvent'
import { getStaffDisplayName } from '@/lib/utils/staff-display-name'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Validate query parameters
    const validation = validateQueryParams(teacherScheduleFiltersSchema, searchParams)
    if (!validation.success) {
      return validation.error
    }

    const schedules = await getAllTeacherSchedules(validation.data)
    return NextResponse.json(schedules)
  } catch (error) {
    return createErrorResponse(
      error,
      'Failed to fetch teacher schedules',
      500,
      'GET /api/teacher-schedules'
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const validation = validateRequest(createTeacherScheduleSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const schedule = await createTeacherSchedule(validation.data)
    const schoolId = (schedule as { school_id?: string }).school_id ?? (await getUserSchoolId())
    if (schoolId) {
      const withDetails = await getTeacherScheduleById(schedule.id)
      const teacherName = withDetails?.teacher ? getStaffDisplayName(withDetails.teacher) : null
      const { actorUserId, actorDisplayName } = await getAuditActorContext()
      await logAuditEvent({
        schoolId,
        actorUserId,
        actorDisplayName,
        action: 'assign',
        category: 'baseline_schedule',
        entityType: 'teacher_schedule',
        entityId: schedule.id,
        details: {
          teacher_id: schedule.teacher_id,
          teacher_name: teacherName,
          classroom_id: schedule.classroom_id,
          classroom_name:
            (withDetails as { classroom?: { name?: string } })?.classroom?.name ?? null,
          day_of_week_id: schedule.day_of_week_id,
          day_name: (withDetails as { day_of_week?: { name?: string } })?.day_of_week?.name ?? null,
          time_slot_id: schedule.time_slot_id,
          time_slot_code:
            (withDetails as { time_slot?: { code?: string } })?.time_slot?.code ?? null,
          is_floater: schedule.is_floater ?? false,
        },
      })
    }
    return NextResponse.json(schedule, { status: 201 })
  } catch (error) {
    return createErrorResponse(
      error,
      'Failed to create teacher schedule',
      500,
      'POST /api/teacher-schedules'
    )
  }
}
