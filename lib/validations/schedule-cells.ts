import { z } from 'zod'

/**
 * Validation schemas for schedule cells API
 */

export const scheduleCellFiltersSchema = z.object({
  classroom_id: z.string().uuid().optional(),
  day_of_week_id: z.string().uuid().optional(),
  time_slot_id: z.string().uuid().optional(),
  is_active: z.union([z.literal('true'), z.literal('false')]).optional().transform((val) => val === 'true'),
})

export const createScheduleCellSchema = z.object({
  classroom_id: z.string().uuid({ message: 'classroom_id must be a valid UUID' }),
  day_of_week_id: z.string().uuid({ message: 'day_of_week_id must be a valid UUID' }),
  time_slot_id: z.string().uuid({ message: 'time_slot_id must be a valid UUID' }),
  is_active: z.boolean().optional().default(true),
  class_group_ids: z.array(z.string().uuid()).optional(),
  enrollment_for_staffing: z.number().int().positive().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
})

export const updateScheduleCellSchema = z.object({
  is_active: z.boolean().optional(),
  class_group_ids: z.array(z.string().uuid()).optional(),
  enrollment_for_staffing: z.number().int().positive().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
})

export const bulkUpdateScheduleCellsSchema = z.object({
  updates: z.array(createScheduleCellSchema).min(1, { message: 'At least one update is required' }),
})


