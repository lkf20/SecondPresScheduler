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
import { getUserSchoolId } from '@/lib/utils/auth'
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

    // Fetch the conflicting schedule(s) to get full details for audit log (floater or permanent)
    const { data: conflictingSchedules, error: fetchError } = await supabase
      .from('teacher_schedules')
      .select(
        '*, classroom:classrooms(name), day_of_week:days_of_week(name), time_slot:time_slots(code)'
      )
      .eq('teacher_id', teacher_id)
      .eq('day_of_week_id', day_of_week_id)
      .eq('time_slot_id', time_slot_id)
      .neq('classroom_id', target_classroom_id)

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
        // Keep teacher in both cells as floater: update conflicting row(s) to is_floater true,
        // then create a new row in the target classroom as floater (DB allows one row per teacher/day/slot/classroom).
        const updatedSchedules: TeacherSchedule[] = []

        for (const conflictingSchedule of conflictingSchedules) {
          const conflictRow = conflictingSchedule as {
            classroom?: { name?: string }
            is_floater?: boolean
          }
          const updated = await updateTeacherSchedule(
            conflictingSchedule.id,
            { is_floater: true },
            undefined
          )
          if (updated) {
            updatedSchedules.push(updated)
          }

          await createTeacherScheduleAuditLog(
            {
              teacher_schedule_id: conflictingSchedule.id,
              teacher_id,
              teacher_name: teacherName ?? undefined,
              action: 'updated',
              action_details: {
                before: {
                  classroom_id: conflictingSchedule.classroom_id,
                  is_floater: conflictRow.is_floater ?? false,
                },
                after: {
                  classroom_id: conflictingSchedule.classroom_id,
                  is_floater: true,
                },
                reason: 'conflict_resolution_mark_floater',
              },
              added_to_classroom_id: conflictingSchedule.classroom_id,
              added_to_classroom_name: conflictRow?.classroom?.name ?? undefined,
              added_to_day_id: day_of_week_id,
              added_to_day_name: dayName ?? undefined,
              added_to_time_slot_id: time_slot_id,
              added_to_time_slot_code: timeSlotCode ?? undefined,
              reason: 'conflict_resolution_mark_floater',
            },
            { category: 'baseline_schedule' }
          )
        }

        // Teacher may already have a row in target (e.g. added to cell then conflict resolved).
        // If so, update it to is_floater; otherwise create.
        const schoolId =
          (conflictingSchedules[0] as { school_id?: string }).school_id ??
          (await getUserSchoolId())
        let existingInTarget: { id: string; is_floater: boolean | null } | null = null
        if (schoolId) {
          const { data } = await supabase
            .from('teacher_schedules')
            .select('id, is_floater')
            .eq('teacher_id', teacher_id)
            .eq('day_of_week_id', day_of_week_id)
            .eq('time_slot_id', time_slot_id)
            .eq('classroom_id', target_classroom_id)
            .eq('school_id', schoolId)
            .maybeSingle()
          existingInTarget = data as typeof existingInTarget
        }

        let newSchedule: TeacherSchedule
        if (existingInTarget) {
          const updated = await updateTeacherSchedule(
            existingInTarget.id,
            { is_floater: true },
            schoolId ?? undefined
          )
          if (!updated) throw new Error('Failed to update teacher schedule to floater')
          newSchedule = updated
          await createTeacherScheduleAuditLog(
            {
              teacher_schedule_id: existingInTarget.id,
              teacher_id,
              teacher_name: teacherName ?? undefined,
              action: 'updated',
              action_details: {
                before: { classroom_id: target_classroom_id, is_floater: existingInTarget.is_floater ?? false },
                after: { classroom_id: target_classroom_id, is_floater: true },
                reason: 'conflict_resolution_mark_floater',
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
        } else {
          newSchedule = await createTeacherSchedule({
            teacher_id,
            day_of_week_id,
            time_slot_id,
            classroom_id: target_classroom_id,
            is_floater: true,
            school_id: schoolId ?? undefined,
          })
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
        }

        results.updated = updatedSchedules
        results.created = newSchedule
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
