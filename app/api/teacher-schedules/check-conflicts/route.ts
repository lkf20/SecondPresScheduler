import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createErrorResponse } from '@/lib/utils/errors'
import { checkConflictsSchema } from '@/lib/validations/teacher-schedules'
import { validateRequest } from '@/lib/utils/validation'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const validation = validateRequest(checkConflictsSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const { checks } = validation.data
    const supabase = await createClient()

    // Collect all conflicts
    const conflicts: Array<{
      teacher_id: string
      teacher_name?: string
      conflicting_schedule_id: string
      conflicting_classroom_id: string
      conflicting_classroom_name?: string
      day_of_week_id: string
      day_of_week_name?: string
      time_slot_id: string
      time_slot_code?: string
      target_classroom_id: string
    }> = []

    // For each check, find conflicts (non-floater schedules for same teacher/day/time_slot but different classroom)
    for (const check of checks) {
      const { data: conflictingSchedules, error } = await supabase
        .from('teacher_schedules')
        .select(
          `
          id,
          classroom_id,
          classroom:classrooms(name),
          day_of_week:days_of_week(name),
          time_slot:time_slots(code),
          teacher:staff(first_name, last_name, display_name)
        `
        )
        .eq('teacher_id', check.teacher_id)
        .eq('day_of_week_id', check.day_of_week_id)
        .eq('time_slot_id', check.time_slot_id)
        .neq('classroom_id', check.classroom_id)
        .eq('is_floater', false)

      if (error) {
        throw error
      }

      // Transform and add conflicts
      if (conflictingSchedules && conflictingSchedules.length > 0) {
        for (const schedule of conflictingSchedules) {
          const teacher = schedule.teacher as any
          const teacherName =
            teacher?.display_name ||
            (teacher?.first_name && teacher?.last_name
              ? `${teacher.first_name} ${teacher.last_name}`
              : 'Unknown')

          const classroom = schedule.classroom as any
          const dayOfWeek = schedule.day_of_week as any
          const timeSlot = schedule.time_slot as any

          conflicts.push({
            teacher_id: check.teacher_id,
            teacher_name: teacherName,
            conflicting_schedule_id: schedule.id,
            conflicting_classroom_id: schedule.classroom_id,
            conflicting_classroom_name: classroom?.name || 'Unknown',
            day_of_week_id: check.day_of_week_id,
            day_of_week_name: dayOfWeek?.name || 'Unknown',
            time_slot_id: check.time_slot_id,
            time_slot_code: timeSlot?.code || 'Unknown',
            target_classroom_id: check.classroom_id,
          })
        }
      }
    }

    return NextResponse.json({ conflicts })
  } catch (error) {
    return createErrorResponse(
      error,
      'Failed to check conflicts',
      500,
      'POST /api/teacher-schedules/check-conflicts'
    )
  }
}
