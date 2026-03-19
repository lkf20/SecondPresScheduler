import { NextRequest, NextResponse } from 'next/server'
import {
  createTeacherSchedule,
  deleteTeacherSchedule,
  TeacherScheduleConflictError,
  updateTeacherSchedule,
} from '@/lib/api/schedules'
import { createErrorResponse } from '@/lib/utils/errors'
import { validateRequest } from '@/lib/utils/validation'
import { bulkApplyTeacherSchedulesSchema } from '@/lib/validations/teacher-schedules'
import { getUserSchoolId } from '@/lib/utils/auth'
import { createClient } from '@/lib/supabase/server'

type TargetCell = {
  classroom_id: string
  day_of_week_id: string
  time_slot_id: string
}

type DesiredTeacher = {
  teacher_id: string
  is_floater: boolean
}

type ExistingSchedule = {
  id: string
  teacher_id: string
  classroom_id: string
  day_of_week_id: string
  time_slot_id: string
  school_id: string
  is_floater: boolean
}

type UndoAction =
  | { type: 'created'; scheduleId: string }
  | { type: 'updated'; scheduleId: string; previousIsFloater: boolean }
  | {
      type: 'deleted'
      schedule: {
        teacher_id: string
        classroom_id: string
        day_of_week_id: string
        time_slot_id: string
        school_id: string
        is_floater: boolean
      }
    }

const toCellKey = (cell: TargetCell) =>
  `${cell.classroom_id}|${cell.day_of_week_id}|${cell.time_slot_id}`

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = validateRequest(bulkApplyTeacherSchedulesSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json({ error: 'Missing school context' }, { status: 400 })
    }

    const dedupedCells = new Map<string, TargetCell>()
    for (const cell of validation.data.target_cells) {
      dedupedCells.set(toCellKey(cell), cell)
    }
    const targetCells = [...dedupedCells.values()]

    const dedupedTeachers = new Map<string, DesiredTeacher>()
    for (const teacher of validation.data.teachers) {
      dedupedTeachers.set(teacher.teacher_id, {
        teacher_id: teacher.teacher_id,
        is_floater: teacher.is_floater === true,
      })
    }
    const desiredTeachers = [...dedupedTeachers.values()]

    const classroomIds = [...new Set(targetCells.map(c => c.classroom_id))]
    const dayIds = [...new Set(targetCells.map(c => c.day_of_week_id))]
    const timeSlotIds = [...new Set(targetCells.map(c => c.time_slot_id))]
    const targetCellKeys = new Set(targetCells.map(toCellKey))

    const supabase = await createClient()
    const { data: existingRows, error: existingError } = await supabase
      .from('teacher_schedules')
      .select('id, teacher_id, classroom_id, day_of_week_id, time_slot_id, school_id, is_floater')
      .eq('school_id', schoolId)
      .in('classroom_id', classroomIds)
      .in('day_of_week_id', dayIds)
      .in('time_slot_id', timeSlotIds)

    if (existingError) throw existingError

    const existingByCell = new Map<string, ExistingSchedule[]>()
    for (const row of (existingRows ?? []) as ExistingSchedule[]) {
      const key = toCellKey(row)
      if (!targetCellKeys.has(key)) continue
      const list = existingByCell.get(key) ?? []
      list.push({
        ...row,
        is_floater: row.is_floater === true,
      })
      existingByCell.set(key, list)
    }

    const undoActions: UndoAction[] = []
    let createdCount = 0
    let updatedCount = 0
    let deletedCount = 0

    try {
      for (const cell of targetCells) {
        const key = toCellKey(cell)
        const existingForCell = existingByCell.get(key) ?? []
        const desiredTeacherIds = new Set(desiredTeachers.map(t => t.teacher_id))

        // Create / update first so we avoid destructive changes before safe writes.
        for (const desired of desiredTeachers) {
          const existing = existingForCell.find(e => e.teacher_id === desired.teacher_id)
          if (existing) {
            if (existing.is_floater !== desired.is_floater) {
              await updateTeacherSchedule(existing.id, { is_floater: desired.is_floater }, schoolId)
              undoActions.push({
                type: 'updated',
                scheduleId: existing.id,
                previousIsFloater: existing.is_floater,
              })
              updatedCount += 1
            }
            continue
          }

          const created = await createTeacherSchedule({
            teacher_id: desired.teacher_id,
            classroom_id: cell.classroom_id,
            day_of_week_id: cell.day_of_week_id,
            time_slot_id: cell.time_slot_id,
            is_floater: desired.is_floater,
            school_id: schoolId,
          })
          undoActions.push({ type: 'created', scheduleId: created.id })
          createdCount += 1
        }

        // Delete only after successful create/update.
        for (const existing of existingForCell) {
          if (desiredTeacherIds.has(existing.teacher_id)) continue
          await deleteTeacherSchedule(existing.id, schoolId)
          undoActions.push({
            type: 'deleted',
            schedule: {
              teacher_id: existing.teacher_id,
              classroom_id: existing.classroom_id,
              day_of_week_id: existing.day_of_week_id,
              time_slot_id: existing.time_slot_id,
              school_id: existing.school_id,
              is_floater: existing.is_floater,
            },
          })
          deletedCount += 1
        }
      }
    } catch (error) {
      // Best-effort rollback to avoid partial multi-cell state on failure.
      for (const action of [...undoActions].reverse()) {
        try {
          if (action.type === 'created') {
            await deleteTeacherSchedule(action.scheduleId, schoolId)
          } else if (action.type === 'updated') {
            await updateTeacherSchedule(
              action.scheduleId,
              { is_floater: action.previousIsFloater },
              schoolId
            )
          } else {
            await createTeacherSchedule({
              teacher_id: action.schedule.teacher_id,
              classroom_id: action.schedule.classroom_id,
              day_of_week_id: action.schedule.day_of_week_id,
              time_slot_id: action.schedule.time_slot_id,
              is_floater: action.schedule.is_floater,
              school_id: action.schedule.school_id,
            })
          }
        } catch {
          // Ignore rollback failures; surface original error below.
        }
      }
      throw error
    }

    return NextResponse.json({
      target_cell_count: targetCells.length,
      teacher_count: desiredTeachers.length,
      created_count: createdCount,
      updated_count: updatedCount,
      deleted_count: deletedCount,
    })
  } catch (error) {
    if (error instanceof TeacherScheduleConflictError) {
      return NextResponse.json({ error: error.userMessage }, { status: 409 })
    }
    return createErrorResponse(
      error,
      'Failed to apply teacher schedules in bulk',
      500,
      'PUT /api/teacher-schedules/bulk-apply'
    )
  }
}
