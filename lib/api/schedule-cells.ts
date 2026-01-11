import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type ScheduleCell = Database['public']['Tables']['schedule_cells']['Row']

export interface ScheduleCellWithDetails extends ScheduleCell {
  classroom?: { id: string; name: string }
  day_of_week?: { id: string; name: string; day_number: number }
  time_slot?: { id: string; code: string; name: string | null; default_start_time: string | null; default_end_time: string | null }
  class_groups?: Array<{ id: string; name: string; min_age: number | null; max_age: number | null; required_ratio: number; preferred_ratio: number | null }>
}

type ScheduleCellClassGroupJoin = {
  class_group: ScheduleCellWithDetails['class_groups'] extends Array<infer T> ? T | null : never
}

type ScheduleCellRaw = Omit<ScheduleCellWithDetails, 'class_groups'> & {
  schedule_cell_class_groups?: ScheduleCellClassGroupJoin[]
  class_groups?: ScheduleCellWithDetails['class_groups']
}

export interface ScheduleCellFilters {
  classroom_id?: string
  day_of_week_id?: string
  time_slot_id?: string
  is_active?: boolean
}

/**
 * Get a single schedule cell by classroom, day, and time slot
 */
export async function getScheduleCell(
  classroomId: string,
  dayOfWeekId: string,
  timeSlotId: string
): Promise<ScheduleCellWithDetails | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('schedule_cells')
    .select(`
      *,
      classroom:classrooms(id, name),
      day_of_week:days_of_week(id, name, day_number),
      time_slot:time_slots(id, code, name, default_start_time, default_end_time),
      schedule_cell_class_groups(
        class_group:class_groups(id, name, min_age, max_age, required_ratio, preferred_ratio, is_active, order)
      )
    `)
    .eq('classroom_id', classroomId)
    .eq('day_of_week_id', dayOfWeekId)
    .eq('time_slot_id', timeSlotId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No row found
      return null
    }
    throw error
  }

  // Transform the nested structure to flatten class_groups array
  const cell = data as ScheduleCellRaw
  const flattened: ScheduleCellWithDetails = {
    ...cell,
    class_groups: cell.schedule_cell_class_groups
      ? cell.schedule_cell_class_groups
          .map((j) => j.class_group)
          .filter((cg): cg is NonNullable<typeof cg> => cg !== null)
      : [],
  }
  delete (flattened as ScheduleCellRaw).schedule_cell_class_groups
  return flattened
}

/**
 * Get multiple schedule cells with optional filters
 */
export async function getScheduleCells(
  filters?: ScheduleCellFilters
): Promise<ScheduleCellWithDetails[]> {
  const supabase = await createClient()
  let query = supabase
    .from('schedule_cells')
    .select(`
      *,
      classroom:classrooms(id, name),
      day_of_week:days_of_week(id, name, day_number),
      time_slot:time_slots(id, code, name, default_start_time, default_end_time),
      schedule_cell_class_groups(
        class_group:class_groups(id, name, min_age, max_age, required_ratio, preferred_ratio, is_active, order)
      )
    `)
    .order('classroom_id', { ascending: true })
    .order('day_of_week_id', { ascending: true })
    .order('time_slot_id', { ascending: true })

  if (filters?.classroom_id) {
    query = query.eq('classroom_id', filters.classroom_id)
  }
  if (filters?.day_of_week_id) {
    query = query.eq('day_of_week_id', filters.day_of_week_id)
  }
  if (filters?.time_slot_id) {
    query = query.eq('time_slot_id', filters.time_slot_id)
  }
  if (filters?.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active)
  }

  const { data, error } = await query

  if (error) throw error

  // Transform the nested structure to flatten class_groups array
  return (data || []).map((cell) => {
    const raw = cell as ScheduleCellRaw
    const flattened: ScheduleCellWithDetails = {
      ...raw,
      class_groups: raw.schedule_cell_class_groups
        ? raw.schedule_cell_class_groups
            .map((j) => j.class_group)
            .filter((cg): cg is NonNullable<typeof cg> => cg !== null)
        : [],
    }
    delete (flattened as ScheduleCellRaw).schedule_cell_class_groups
    return flattened
  }) as ScheduleCellWithDetails[]
}

/**
 * Create a new schedule cell with class groups
 */
export async function createScheduleCell(cell: {
  classroom_id: string
  day_of_week_id: string
  time_slot_id: string
  is_active?: boolean
  class_group_ids?: string[]
  enrollment_for_staffing?: number | null
  notes?: string | null
}): Promise<ScheduleCell> {
  // Create the schedule cell
  const { data: cellData, error: cellError } = await supabase
    .from('schedule_cells')
    .insert({
      classroom_id: cell.classroom_id,
      day_of_week_id: cell.day_of_week_id,
      time_slot_id: cell.time_slot_id,
      is_active: cell.is_active ?? true,
      enrollment_for_staffing: cell.enrollment_for_staffing ?? null,
      notes: cell.notes ?? null,
    })
    .select()
    .single()

  if (cellError) throw cellError

  // Create class group associations if provided
  if (cell.class_group_ids && cell.class_group_ids.length > 0) {
    const joinRows = cell.class_group_ids.map(class_group_id => ({
      schedule_cell_id: cellData.id,
      class_group_id,
    }))

    const { error: joinError } = await supabase
      .from('schedule_cell_class_groups')
      .insert(joinRows)

    if (joinError) throw joinError
  }

  return cellData as ScheduleCell
}

/**
 * Update an existing schedule cell with class groups
 */
export async function updateScheduleCell(
  id: string,
  updates: Partial<Omit<ScheduleCell, 'id' | 'created_at' | 'updated_at'>> & { class_group_ids?: string[] }
): Promise<ScheduleCell> {
  const supabase = await createClient()
  
  // Extract class_group_ids if present
  const { class_group_ids, ...cellUpdates } = updates

  // Update the schedule cell
  const { data, error } = await supabase
    .from('schedule_cells')
    .update(cellUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  // Update class group associations if provided
  if (class_group_ids !== undefined) {
    // Delete existing associations
    const { error: deleteError } = await supabase
      .from('schedule_cell_class_groups')
      .delete()
      .eq('schedule_cell_id', id)

    if (deleteError) throw deleteError

    // Insert new associations
    if (class_group_ids.length > 0) {
      const joinRows = class_group_ids.map(class_group_id => ({
        schedule_cell_id: id,
        class_group_id,
      }))

      const { error: insertError } = await supabase
        .from('schedule_cell_class_groups')
        .insert(joinRows)

      if (insertError) throw insertError
    }
  }

  return data as ScheduleCell
}

/**
 * Upsert a schedule cell (create if doesn't exist, update if it does)
 */
export async function upsertScheduleCell(cell: {
  classroom_id: string
  day_of_week_id: string
  time_slot_id: string
  is_active?: boolean
  class_group_ids?: string[]
  enrollment_for_staffing?: number | null
  notes?: string | null
}): Promise<ScheduleCell> {
  // First try to find existing cell
  const existing = await getScheduleCell(
    cell.classroom_id,
    cell.day_of_week_id,
    cell.time_slot_id
  )

  if (existing) {
    const existingClassGroupIds = existing.class_groups?.map(cg => cg.id) || []
    return await updateScheduleCell(existing.id, {
      is_active: cell.is_active ?? existing.is_active,
      class_group_ids: cell.class_group_ids ?? existingClassGroupIds,
      enrollment_for_staffing: cell.enrollment_for_staffing ?? existing.enrollment_for_staffing,
      notes: cell.notes ?? existing.notes,
    })
  } else {
    return await createScheduleCell(cell)
  }
}

/**
 * Delete a schedule cell (soft delete by setting is_active to false)
 */
export async function deleteScheduleCell(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('schedule_cells')
    .update({ is_active: false })
    .eq('id', id)

  if (error) throw error
}

/**
 * Bulk update multiple schedule cells (for multi-day apply feature)
 * Optimized to use batch operations instead of sequential processing
 */
export async function bulkUpdateScheduleCells(
  updates: Array<{
    classroom_id: string
    day_of_week_id: string
    time_slot_id: string
    is_active?: boolean
    class_group_ids?: string[]
    enrollment_for_staffing?: number | null
    notes?: string | null
  }>
): Promise<ScheduleCell[]> {
  const supabase = await createClient()

  if (updates.length === 0) {
    return []
  }

  // Batch fetch existing cells
  const { data: existingCells, error: fetchError } = await supabase
    .from('schedule_cells')
    .select('*')
    .in('classroom_id', [...new Set(updates.map(u => u.classroom_id))])
    .in('day_of_week_id', [...new Set(updates.map(u => u.day_of_week_id))])
    .in('time_slot_id', [...new Set(updates.map(u => u.time_slot_id))])

  if (fetchError) {
    throw fetchError
  }

  // Create a map of existing cells for quick lookup
  const existingMap = new Map<string, ScheduleCell>()
  existingCells?.forEach(cell => {
    const key = `${cell.classroom_id}|${cell.day_of_week_id}|${cell.time_slot_id}`
    existingMap.set(key, cell)
  })

  // Prepare cells to upsert (without class_group_ids)
  const cellsToUpsert = updates.map(update => {
    return {
      classroom_id: update.classroom_id,
      day_of_week_id: update.day_of_week_id,
      time_slot_id: update.time_slot_id,
      is_active: update.is_active !== undefined ? update.is_active : true,
      enrollment_for_staffing: update.enrollment_for_staffing !== undefined ? update.enrollment_for_staffing : null,
      notes: update.notes !== undefined ? update.notes : null,
    }
  })

  // Batch upsert all cells at once
  const { data: upsertedCells, error: upsertError } = await supabase
    .from('schedule_cells')
    .upsert(cellsToUpsert, {
      onConflict: 'classroom_id,day_of_week_id,time_slot_id',
      ignoreDuplicates: false,
    })
    .select()

  if (upsertError) {
    throw upsertError
  }

  // Update class group associations for each cell
  for (let i = 0; i < updates.length; i++) {
    const update = updates[i]
    const cell = upsertedCells.find(
      c => c.classroom_id === update.classroom_id &&
           c.day_of_week_id === update.day_of_week_id &&
           c.time_slot_id === update.time_slot_id
    )

    if (cell && update.class_group_ids !== undefined) {
      // Delete existing associations
      await supabase
        .from('schedule_cell_class_groups')
        .delete()
        .eq('schedule_cell_id', cell.id)

      // Insert new associations
      if (update.class_group_ids.length > 0) {
        const joinRows = update.class_group_ids.map(class_group_id => ({
          schedule_cell_id: cell.id,
          class_group_id,
        }))

        await supabase
          .from('schedule_cell_class_groups')
          .insert(joinRows)
      }
    }
  }

  return upsertedCells as ScheduleCell[]
}
