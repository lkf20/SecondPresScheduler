import { z } from 'zod'

/**
 * Validation schemas for teacher schedules API
 */

export const teacherScheduleFiltersSchema = z.object({
  teacher_id: z.string().uuid().optional(),
})

export const createTeacherScheduleSchema = z.object({
  teacher_id: z.string().uuid({ message: 'teacher_id must be a valid UUID' }),
  day_of_week_id: z.string().uuid({ message: 'day_of_week_id must be a valid UUID' }),
  time_slot_id: z.string().uuid({ message: 'time_slot_id must be a valid UUID' }),
  class_id: z.string().uuid({ message: 'class_id must be a valid UUID' }),
  classroom_id: z.string().uuid({ message: 'classroom_id must be a valid UUID' }),
  is_floater: z.boolean().optional().default(false),
})

export const checkConflictsSchema = z.object({
  checks: z.array(z.object({
    teacher_id: z.string().uuid({ message: 'teacher_id must be a valid UUID' }),
    day_of_week_id: z.string().uuid({ message: 'day_of_week_id must be a valid UUID' }),
    time_slot_id: z.string().uuid({ message: 'time_slot_id must be a valid UUID' }),
    classroom_id: z.string().uuid({ message: 'classroom_id must be a valid UUID' }),
  })).min(1, { message: 'At least one check is required' }),
})

export const resolveConflictSchema = z.object({
  teacher_id: z.string().uuid({ message: 'teacher_id must be a valid UUID' }),
  day_of_week_id: z.string().uuid({ message: 'day_of_week_id must be a valid UUID' }),
  time_slot_id: z.string().uuid({ message: 'time_slot_id must be a valid UUID' }),
  resolution: z.enum(['remove_other', 'cancel', 'mark_floater']),
  target_classroom_id: z.string().uuid({ message: 'target_classroom_id must be a valid UUID' }),
  target_class_id: z.string().uuid({ message: 'target_class_id must be a valid UUID' }),
  conflicting_schedule_id: z.string().uuid({ message: 'conflicting_schedule_id must be a valid UUID' }).optional(),
})

