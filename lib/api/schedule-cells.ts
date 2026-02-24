import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { getUserSchoolId } from '@/lib/utils/auth'

type ScheduleCell = Database['public']['Tables']['schedule_cells']['Row']

export interface ScheduleCellWithDetails extends ScheduleCell {
  classroom?: { id: string; name: string }
  day_of_week?: { id: string; name: string; day_number: number }
  time_slot?: {
    id: string
    code: string
    name: string | null
    default_start_time: string | null
    default_end_time: string | null
  }
  class_groups?: Array<{
    id: string
    name: string
    age_unit: 'months' | 'years'
    min_age: number | null
    max_age: number | null
    required_ratio: number
    preferred_ratio: number | null
  }>
}

type ScheduleCellClassGroupJoin = {
  class_group: ScheduleCellWithDetails['class_groups'] extends Array<infer T> ? T | null : never
}

type ScheduleCellRaw = Omit<ScheduleCellWithDetails, 'class_groups'> & {
  schedule_cell_class_groups?: ScheduleCellClassGroupJoin[]
  class_groups?: ScheduleCellWithDetails['class_groups']
}

async function getSchoolIdMapForClassrooms(classroomIds: string[]): Promise<Map<string, string>> {
  if (classroomIds.length === 0) return new Map()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('classrooms')
    .select('id, school_id')
    .in('id', classroomIds)

  if (error) throw error
  const map = new Map<string, string>()
  ;(data || []).forEach(row => {
    if (row.school_id) {
      map.set(row.id, row.school_id)
    }
  })
  return map
}

async function assertActiveClassrooms(
  classroomIds: string[],
  schoolId: string,
  messagePrefix: string
): Promise<void> {
  if (classroomIds.length === 0) return
  const uniqueIds = [...new Set(classroomIds)]
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('classrooms')
    .select('id, school_id, is_active')
    .in('id', uniqueIds)

  if (error) throw error

  const rowById = new Map((data || []).map(row => [row.id, row]))
  for (const classroomId of uniqueIds) {
    const row = rowById.get(classroomId)
    if (!row || row.school_id !== schoolId || row.is_active === false) {
      throw new Error(
        `${messagePrefix}: classroom is inactive, missing, or belongs to a different school.`
      )
    }
  }
}

async function assertActiveTimeSlots(
  timeSlotIds: string[],
  schoolId: string,
  messagePrefix: string
): Promise<void> {
  if (timeSlotIds.length === 0) return
  const uniqueIds = [...new Set(timeSlotIds)]
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('time_slots')
    .select('id, school_id, is_active')
    .in('id', uniqueIds)

  if (error) throw error

  const rowById = new Map((data || []).map(row => [row.id, row]))
  for (const timeSlotId of uniqueIds) {
    const row = rowById.get(timeSlotId)
    if (!row || row.school_id !== schoolId || row.is_active === false) {
      throw new Error(
        `${messagePrefix}: time slot is inactive, missing, or belongs to a different school.`
      )
    }
  }
}

async function assertActiveClassGroups(
  classGroupIds: string[],
  schoolId: string,
  messagePrefix: string
): Promise<void> {
  if (classGroupIds.length === 0) return
  const uniqueIds = [...new Set(classGroupIds)]
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('class_groups')
    .select('id, school_id, is_active')
    .in('id', uniqueIds)

  if (error) throw error

  const rowById = new Map((data || []).map(row => [row.id, row]))
  for (const classGroupId of uniqueIds) {
    const row = rowById.get(classGroupId)
    if (!row || row.school_id !== schoolId || row.is_active === false) {
      throw new Error(
        `${messagePrefix}: class group is inactive, missing, or belongs to a different school.`
      )
    }
  }
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
    .select(
      `
      *,
      classroom:classrooms(id, name),
      day_of_week:days_of_week(id, name, day_number),
      time_slot:time_slots(id, code, name, default_start_time, default_end_time),
      schedule_cell_class_groups(
        class_group:class_groups(id, name, age_unit, min_age, max_age, required_ratio, preferred_ratio, is_active, order)
      )
    `
    )
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
          .map(j => j.class_group)
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
    .select(
      `
      *,
      classroom:classrooms(id, name),
      day_of_week:days_of_week(id, name, day_number),
      time_slot:time_slots(id, code, name, default_start_time, default_end_time),
      schedule_cell_class_groups(
        class_group:class_groups(id, name, age_unit, min_age, max_age, required_ratio, preferred_ratio, is_active, order)
      )
    `
    )
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
  return (data || []).map(cell => {
    const raw = cell as ScheduleCellRaw
    const flattened: ScheduleCellWithDetails = {
      ...raw,
      class_groups: raw.schedule_cell_class_groups
        ? raw.schedule_cell_class_groups
            .map(j => j.class_group)
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
  school_id?: string
}): Promise<ScheduleCell> {
  const supabase = await createClient()
  let schoolId = cell.school_id || (await getUserSchoolId())
  if (!schoolId) {
    const schoolMap = await getSchoolIdMapForClassrooms([cell.classroom_id])
    schoolId = schoolMap.get(cell.classroom_id) ?? null
  }
  if (!schoolId) {
    throw new Error('school_id is required to create a schedule cell')
  }

  await assertActiveClassrooms([cell.classroom_id], schoolId, 'Cannot create schedule cell')
  await assertActiveTimeSlots([cell.time_slot_id], schoolId, 'Cannot create schedule cell')
  await assertActiveClassGroups(cell.class_group_ids || [], schoolId, 'Cannot create schedule cell')

  // Create the schedule cell
  const { data: cellData, error: cellError } = await supabase
    .from('schedule_cells')
    .insert({
      classroom_id: cell.classroom_id,
      day_of_week_id: cell.day_of_week_id,
      time_slot_id: cell.time_slot_id,
      school_id: schoolId,
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
      school_id: schoolId,
    }))

    const supabase2 = await createClient()
    const { error: joinError } = await supabase2.from('schedule_cell_class_groups').insert(joinRows)

    if (joinError) throw joinError
  }

  return cellData as ScheduleCell
}

/**
 * Update an existing schedule cell with class groups
 */
export async function updateScheduleCell(
  id: string,
  updates: Partial<Omit<ScheduleCell, 'id' | 'created_at' | 'updated_at'>> & {
    class_group_ids?: string[]
  }
): Promise<ScheduleCell> {
  const supabase = await createClient()

  // Extract class_group_ids if present
  const { class_group_ids, ...cellUpdates } = updates

  const { data: existingCell, error: existingCellError } = await supabase
    .from('schedule_cells')
    .select('id, school_id')
    .eq('id', id)
    .single()

  if (existingCellError) throw existingCellError
  const schoolId = existingCell.school_id || (await getUserSchoolId())
  if (!schoolId) throw new Error('school_id is required to update schedule cell')

  if (class_group_ids !== undefined) {
    const { data: existingJoins, error: joinsError } = await supabase
      .from('schedule_cell_class_groups')
      .select('class_group_id')
      .eq('schedule_cell_id', id)
    if (joinsError) throw joinsError

    const existingIds = new Set(
      (existingJoins || []).map(row => row.class_group_id).filter(Boolean)
    )
    const newlyAddedIds = class_group_ids.filter(classGroupId => !existingIds.has(classGroupId))
    await assertActiveClassGroups(
      newlyAddedIds,
      schoolId,
      'Cannot add inactive class group to schedule cell'
    )
  }

  // Update the schedule cell
  const { data, error } = await supabase
    .from('schedule_cells')
    .update(cellUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  const dataSchoolId = data?.school_id || schoolId
  if (!dataSchoolId) throw new Error('school_id is required to update schedule cell class groups')

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
        school_id: dataSchoolId,
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
  school_id?: string
}): Promise<ScheduleCell> {
  // First try to find existing cell
  const existing = await getScheduleCell(cell.classroom_id, cell.day_of_week_id, cell.time_slot_id)

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
  const { error } = await supabase.from('schedule_cells').update({ is_active: false }).eq('id', id)

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
    school_id?: string
  }>
): Promise<ScheduleCell[]> {
  const supabase = await createClient()

  if (updates.length === 0) {
    return []
  }

  const schoolId = updates[0]?.school_id || (await getUserSchoolId())
  const classroomIds = [...new Set(updates.map(u => u.classroom_id))]
  const schoolMap = schoolId
    ? new Map<string, string>()
    : await getSchoolIdMapForClassrooms(classroomIds)

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
    const resolvedSchoolId = update.school_id || schoolId || schoolMap.get(update.classroom_id)
    if (!resolvedSchoolId) {
      throw new Error(
        `school_id is required to update schedule cells (classroom_id: ${update.classroom_id})`
      )
    }
    return {
      classroom_id: update.classroom_id,
      day_of_week_id: update.day_of_week_id,
      time_slot_id: update.time_slot_id,
      school_id: resolvedSchoolId,
      is_active: update.is_active !== undefined ? update.is_active : true,
      enrollment_for_staffing:
        update.enrollment_for_staffing !== undefined ? update.enrollment_for_staffing : null,
      notes: update.notes !== undefined ? update.notes : null,
    }
  })

  // For rows that do not yet exist, prevent linking to inactive classroom/time slot.
  const newRows = updates.filter(update => {
    const key = `${update.classroom_id}|${update.day_of_week_id}|${update.time_slot_id}`
    return !existingMap.has(key)
  })
  if (newRows.length > 0) {
    const newSchoolId = newRows[0]?.school_id || schoolId || schoolMap.get(newRows[0].classroom_id)
    if (!newSchoolId) {
      throw new Error('school_id is required to create schedule cells')
    }
    await assertActiveClassrooms(
      newRows.map(row => row.classroom_id),
      newSchoolId,
      'Cannot create schedule cell'
    )
    await assertActiveTimeSlots(
      newRows.map(row => row.time_slot_id),
      newSchoolId,
      'Cannot create schedule cell'
    )
  }

  // Prevent adding new inactive class-group links in bulk updates.
  const updatesWithClassGroups = updates.filter(update => update.class_group_ids !== undefined)
  if (updatesWithClassGroups.length > 0) {
    const existingCellIds = updatesWithClassGroups
      .map(update => {
        const key = `${update.classroom_id}|${update.day_of_week_id}|${update.time_slot_id}`
        return existingMap.get(key)?.id || null
      })
      .filter((id): id is string => Boolean(id))

    const existingClassGroupIdsByCell = new Map<string, Set<string>>()
    if (existingCellIds.length > 0) {
      const { data: joins, error: joinsError } = await supabase
        .from('schedule_cell_class_groups')
        .select('schedule_cell_id, class_group_id')
        .in('schedule_cell_id', existingCellIds)
      if (joinsError) throw joinsError
      ;(joins || []).forEach(row => {
        if (!existingClassGroupIdsByCell.has(row.schedule_cell_id)) {
          existingClassGroupIdsByCell.set(row.schedule_cell_id, new Set())
        }
        existingClassGroupIdsByCell.get(row.schedule_cell_id)!.add(row.class_group_id)
      })
    }

    const newlyAddedClassGroupIds: string[] = []
    for (const update of updatesWithClassGroups) {
      const key = `${update.classroom_id}|${update.day_of_week_id}|${update.time_slot_id}`
      const existingCell = existingMap.get(key)
      const existingIds = existingCell
        ? existingClassGroupIdsByCell.get(existingCell.id) || new Set<string>()
        : new Set<string>()
      ;(update.class_group_ids || []).forEach(classGroupId => {
        if (!existingIds.has(classGroupId)) newlyAddedClassGroupIds.push(classGroupId)
      })
    }

    if (newlyAddedClassGroupIds.length > 0) {
      const classGroupSchoolId =
        updatesWithClassGroups[0]?.school_id ||
        schoolId ||
        schoolMap.get(updatesWithClassGroups[0].classroom_id)
      if (!classGroupSchoolId) {
        throw new Error('school_id is required to update schedule cell class groups')
      }
      await assertActiveClassGroups(
        newlyAddedClassGroupIds,
        classGroupSchoolId,
        'Cannot add inactive class group to schedule cell'
      )
    }
  }

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
      c =>
        c.classroom_id === update.classroom_id &&
        c.day_of_week_id === update.day_of_week_id &&
        c.time_slot_id === update.time_slot_id
    )

    if (cell && update.class_group_ids !== undefined) {
      // Delete existing associations
      const { error: deleteError } = await supabase
        .from('schedule_cell_class_groups')
        .delete()
        .eq('schedule_cell_id', cell.id)
      if (deleteError) throw deleteError

      // Insert new associations
      if (update.class_group_ids.length > 0) {
        const resolvedSchoolId =
          update.school_id || cell.school_id || schoolId || schoolMap.get(update.classroom_id)
        if (!resolvedSchoolId) {
          throw new Error(
            `school_id is required to update schedule cell class groups (classroom_id: ${update.classroom_id})`
          )
        }
        const joinRows = update.class_group_ids.map(class_group_id => ({
          schedule_cell_id: cell.id,
          class_group_id,
          school_id: resolvedSchoolId,
        }))

        const { error: insertError } = await supabase
          .from('schedule_cell_class_groups')
          .insert(joinRows)
        if (insertError) throw insertError
      }
    }
  }

  return upsertedCells as ScheduleCell[]
}
