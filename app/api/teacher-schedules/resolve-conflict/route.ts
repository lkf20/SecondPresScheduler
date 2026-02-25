import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createErrorResponse } from '@/lib/utils/errors'
import { resolveConflictSchema } from '@/lib/validations/teacher-schedules'
import { validateRequest } from '@/lib/utils/validation'
import {
  createTeacherSchedule,
  deleteTeacherSchedule,
  updateTeacherSchedule,
} from '@/lib/api/schedules'
import { createTeacherScheduleAuditLog } from '@/lib/api/audit-logs'
import { getStaffDisplayName } from '@/lib/utils/staff-display-name'
import type { TeacherSchedule } from '@/types/api'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const validation = validateRequest(resolveConflictSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const { teacher_id, day_of_week_id, time_slot_id, resolution, target_classroom_id } =
      validation.data

    const supabase = await createClient()

    // Fetch the conflicting schedule(s) to get full details for audit log
    const { data: conflictingSchedules, error: fetchError } = await supabase
      .from('teacher_schedules')
      .select(
        '*, classroom:classrooms(name), day_of_week:days_of_week(name), time_slot:time_slots(code)'
      )
      .eq('teacher_id', teacher_id)
      .eq('day_of_week_id', day_of_week_id)
      .eq('time_slot_id', time_slot_id)
      .neq('classroom_id', target_classroom_id)
      .eq('is_floater', false)

    if (fetchError) {
      throw fetchError
    }

    if (!conflictingSchedules || conflictingSchedules.length === 0) {
      return NextResponse.json({ error: 'No conflicting schedules found' }, { status: 400 })
    }

    const first = conflictingSchedules[0] as {
      classroom?: { name?: string }
      day_of_week?: { name?: string }
      time_slot?: { code?: string }
    }
    const dayName = first?.day_of_week?.name ?? null
    const timeSlotCode = first?.time_slot?.code ?? null

    const { data: staffRow } = await supabase
      .from('staff')
      .select('first_name, last_name, display_name')
      .eq('id', teacher_id)
      .maybeSingle()
    const teacherName = staffRow ? getStaffDisplayName(staffRow) : null

    const { data: targetClassroom } = await supabase
      .from('classrooms')
      .select('name')
      .eq('id', target_classroom_id)
      .maybeSingle()
    const targetClassroomName = targetClassroom?.name ?? null

    const results: {
      created?: TeacherSchedule
      deleted?: string[]
      updated?: TeacherSchedule[]
    } = {}

    switch (resolution) {
      case 'remove_other': {
        // Delete all conflicting schedules, create new one
        const deletedIds: string[] = []

        for (const conflictingSchedule of conflictingSchedules) {
          await deleteTeacherSchedule(conflictingSchedule.id)
          deletedIds.push(conflictingSchedule.id)

          // Log the deletion
          const conflictClass = conflictingSchedule as { classroom?: { name?: string } }
          await createTeacherScheduleAuditLog(
            {
              teacher_schedule_id: conflictingSchedule.id,
              teacher_id,
              teacher_name: teacherName ?? undefined,
              action: 'deleted',
              action_details: {
                before: {
                  classroom_id: conflictingSchedule.classroom_id,
                  is_floater: conflictingSchedule.is_floater,
                },
              },
              removed_from_classroom_id: conflictingSchedule.classroom_id,
              removed_from_classroom_name: conflictClass?.classroom?.name ?? undefined,
              removed_from_day_id: day_of_week_id,
              removed_from_day_name: dayName ?? undefined,
              removed_from_time_slot_id: time_slot_id,
              removed_from_time_slot_code: timeSlotCode ?? undefined,
              reason: 'conflict_resolution_remove_other',
            },
            { category: 'baseline_schedule' }
          )
        }

        // Create new schedule
        const newSchedule = await createTeacherSchedule({
          teacher_id,
          day_of_week_id,
          time_slot_id,
          classroom_id: target_classroom_id,
          is_floater: false,
        })

        // Log the creation
        await createTeacherScheduleAuditLog(
          {
            teacher_schedule_id: newSchedule.id,
            teacher_id,
            teacher_name: teacherName ?? undefined,
            action: 'created',
            action_details: {
              after: {
                classroom_id: target_classroom_id,
                is_floater: false,
              },
            },
            added_to_classroom_id: target_classroom_id,
            added_to_classroom_name: targetClassroomName ?? undefined,
            added_to_day_id: day_of_week_id,
            added_to_day_name: dayName ?? undefined,
            added_to_time_slot_id: time_slot_id,
            added_to_time_slot_code: timeSlotCode ?? undefined,
            reason: 'conflict_resolution_remove_other',
          },
          { category: 'baseline_schedule' }
        )

        results.deleted = deletedIds
        results.created = newSchedule
        break
      }

      case 'cancel': {
        // Just log that we canceled adding the teacher
        await createTeacherScheduleAuditLog(
          {
            teacher_id,
            teacher_name: teacherName ?? undefined,
            action: 'conflict_resolved',
            action_details: {
              canceled: true,
              would_have_added_to_classroom_id: target_classroom_id,
            },
            added_to_classroom_id: target_classroom_id,
            added_to_classroom_name: targetClassroomName ?? undefined,
            added_to_day_id: day_of_week_id,
            added_to_day_name: dayName ?? undefined,
            added_to_time_slot_id: time_slot_id,
            added_to_time_slot_code: timeSlotCode ?? undefined,
            reason: 'conflict_resolution_cancel',
          },
          { category: 'baseline_schedule' }
        )
        break
      }

      case 'mark_floater': {
        // Mark all conflicting schedules as floaters, create new one as floater
        const updatedSchedules: TeacherSchedule[] = []

        for (const conflictingSchedule of conflictingSchedules) {
          const updated = await updateTeacherSchedule(conflictingSchedule.id, {
            is_floater: true,
          })
          if (updated) {
            updatedSchedules.push(updated)
          }

          // Log the update
          const conflictClass = conflictingSchedule as { classroom?: { name?: string } }
          await createTeacherScheduleAuditLog(
            {
              teacher_schedule_id: conflictingSchedule.id,
              teacher_id,
              teacher_name: teacherName ?? undefined,
              action: 'updated',
              action_details: {
                before: {
                  classroom_id: conflictingSchedule.classroom_id,
                  is_floater: false,
                },
                after: {
                  classroom_id: conflictingSchedule.classroom_id,
                  is_floater: true,
                },
              },
              removed_from_classroom_name: conflictClass?.classroom?.name ?? undefined,
              removed_from_day_name: dayName ?? undefined,
              removed_from_time_slot_code: timeSlotCode ?? undefined,
              reason: 'conflict_resolution_mark_floater',
            },
            { category: 'baseline_schedule' }
          )
        }

        // Create new schedule as floater
        const newSchedule = await createTeacherSchedule({
          teacher_id,
          day_of_week_id,
          time_slot_id,
          classroom_id: target_classroom_id,
          is_floater: true,
        })

        // Log the creation
        await createTeacherScheduleAuditLog(
          {
            teacher_schedule_id: newSchedule.id,
            teacher_id,
            teacher_name: teacherName ?? undefined,
            action: 'created',
            action_details: {
              after: {
                classroom_id: target_classroom_id,
                is_floater: true,
              },
            },
            added_to_classroom_id: target_classroom_id,
            added_to_classroom_name: targetClassroomName ?? undefined,
            added_to_day_id: day_of_week_id,
            added_to_day_name: dayName ?? undefined,
            added_to_time_slot_id: time_slot_id,
            added_to_time_slot_code: timeSlotCode ?? undefined,
            reason: 'conflict_resolution_mark_floater',
          },
          { category: 'baseline_schedule' }
        )

        results.created = newSchedule
        results.updated = updatedSchedules
        break
      }
    }

    return NextResponse.json(results, { status: 200 })
  } catch (error) {
    return createErrorResponse(
      error,
      'Failed to resolve conflict',
      500,
      'POST /api/teacher-schedules/resolve-conflict'
    )
  }
}
