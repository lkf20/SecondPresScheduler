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

    // Collect all conflicts (include role label: Permanent teacher, Flex teacher, or Floater for messaging)
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
      /** How the teacher is scheduled in the conflicting assignment, for copy */
      conflicting_role_label: 'Permanent teacher' | 'Flex teacher' | 'Floater'
    }> = []

    // For each check, find conflicts (any schedule for same teacher/day/time_slot in another classroom — floater or permanent)
    for (const check of checks) {
      const { data: conflictingSchedules, error } = await supabase
        .from('teacher_schedules')
        .select(
          `
          id,
          classroom_id,
          is_floater,
          classroom:classrooms(name),
          day_of_week:days_of_week(name),
          time_slot:time_slots(code),
          teacher:staff(
            first_name,
            last_name,
            display_name,
            staff_role_type_assignments(staff_role_types(code))
          )
        `
        )
        .eq('teacher_id', check.teacher_id)
        .eq('day_of_week_id', check.day_of_week_id)
        .eq('time_slot_id', check.time_slot_id)
        .neq('classroom_id', check.classroom_id)

      if (error) {
        throw error
      }

      // Transform and add conflicts. Do not report conflict when both the current assignment and the conflicting one are floaters (allowed).
      if (conflictingSchedules && conflictingSchedules.length > 0) {
        for (const schedule of conflictingSchedules) {
          const scheduleRow = schedule as { is_floater?: boolean }
          const checkIsFloater = check.is_floater === true
          if (scheduleRow.is_floater === true && checkIsFloater) continue // both floaters: no conflict
          const teacher = schedule.teacher as {
            first_name?: string | null
            last_name?: string | null
            display_name?: string | null
            staff_role_type_assignments?: Array<{ staff_role_types?: { code?: string } | null }>
          } | null
          const teacherName =
            teacher?.display_name ||
            (teacher?.first_name && teacher?.last_name
              ? `${teacher.first_name} ${teacher.last_name}`
              : 'Unknown')

          const conflicting_role_label: 'Permanent teacher' | 'Flex teacher' | 'Floater' =
            scheduleRow.is_floater === true
              ? 'Floater'
              : (() => {
                  const roleCodes: string[] = []
                  for (const a of teacher?.staff_role_type_assignments ?? []) {
                    const st = (
                      a as {
                        staff_role_types?: { code?: string } | { code?: string }[] | null
                      }
                    ).staff_role_types
                    if (Array.isArray(st)) {
                      for (const s of st) {
                        if (s?.code) roleCodes.push(s.code)
                      }
                    } else if (st && typeof st === 'object' && st.code) {
                      roleCodes.push(st.code)
                    }
                  }
                  return roleCodes.includes('FLEXIBLE') ? 'Flex teacher' : 'Permanent teacher'
                })()

          const classroom = schedule.classroom as { name?: string } | null
          const dayOfWeek = schedule.day_of_week as { name?: string } | null
          const timeSlot = schedule.time_slot as { code?: string } | null

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
            conflicting_role_label,
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
