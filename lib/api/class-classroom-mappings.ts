import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type ClassClassroomMapping = Database['public']['Tables']['class_classroom_mappings']['Row']

export interface ClassClassroomMappingWithDetails extends ClassClassroomMapping {
  class_group?: { id: string; name: string }
  /** @deprecated Use class_group instead. */
  class?: { id: string; name: string }
  classroom?: { id: string; name: string }
  day_of_week?: { id: string; name: string; day_number: number }
  time_slot?: { id: string; code: string; name: string | null }
}

export async function getClassClassroomMappings(filters?: {
  day_of_week_id?: string
  time_slot_id?: string
  class_group_id?: string
  /** @deprecated Use class_group_id instead. */
  class_id?: string
  classroom_id?: string
}) {
  const supabase = await createClient()
  let query = supabase
    .from('class_classroom_mappings')
    .select(
      `
      *,
      class_group:class_groups(id, name),
      classroom:classrooms(id, name),
      day_of_week:days_of_week(id, name, day_number),
      time_slot:time_slots(id, code, name)
    `
    )
    .order('day_of_week_id', { ascending: true })
    .order('time_slot_id', { ascending: true })

  if (filters?.day_of_week_id) {
    query = query.eq('day_of_week_id', filters.day_of_week_id)
  }
  if (filters?.time_slot_id) {
    query = query.eq('time_slot_id', filters.time_slot_id)
  }
  if (filters?.class_group_id) {
    query = query.eq('class_group_id', filters.class_group_id)
  } else if (filters?.class_id) {
    query = query.eq('class_id', filters.class_id)
  }
  if (filters?.classroom_id) {
    query = query.eq('classroom_id', filters.classroom_id)
  }

  const { data, error } = await query

  if (error) throw error
  return data as ClassClassroomMappingWithDetails[]
}

export async function createClassClassroomMapping(mapping: {
  class_group_id: string
  /** @deprecated Use class_group_id instead. */
  class_id?: string
  classroom_id: string
  day_of_week_id: string
  time_slot_id: string
}) {
  const supabase = await createClient()
  const payload = {
    ...mapping,
    class_id: mapping.class_id ?? mapping.class_group_id,
  }
  const { data, error } = await supabase
    .from('class_classroom_mappings')
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data as ClassClassroomMapping
}

export async function bulkCreateClassClassroomMappings(
  mappings: Array<{
    class_group_id: string
    /** @deprecated Use class_group_id instead. */
    class_id?: string
    classroom_id: string
    day_of_week_id: string
    time_slot_id: string
  }>
) {
  const supabase = await createClient()
  const payload = mappings.map(mapping => ({
    ...mapping,
    class_id: mapping.class_id ?? mapping.class_group_id,
  }))
  const { data, error } = await supabase.from('class_classroom_mappings').insert(payload).select()

  if (error) throw error
  return data as ClassClassroomMapping[]
}

export async function deleteClassClassroomMapping(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('class_classroom_mappings').delete().eq('id', id)

  if (error) throw error
}

export async function deleteClassClassroomMappingsByDayTime(dayId: string, timeSlotId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('class_classroom_mappings')
    .delete()
    .eq('day_of_week_id', dayId)
    .eq('time_slot_id', timeSlotId)

  if (error) throw error
}

export async function copyMappingsToOtherDays(
  sourceDayId: string,
  targetDayIds: string[],
  timeSlotId: string
) {
  // Get all mappings for source day/time
  const sourceMappings = await getClassClassroomMappings({
    day_of_week_id: sourceDayId,
    time_slot_id: timeSlotId,
  })

  // Create mappings for each target day
  const newMappings: Array<{
    class_group_id: string
    classroom_id: string
    day_of_week_id: string
    time_slot_id: string
  }> = []

  for (const targetDayId of targetDayIds) {
    for (const mapping of sourceMappings) {
      const classGroupId = mapping.class_group_id ?? mapping.class_id
      if (!classGroupId) continue
      newMappings.push({
        class_group_id: classGroupId,
        classroom_id: mapping.classroom_id,
        day_of_week_id: targetDayId,
        time_slot_id: timeSlotId,
      })
    }
  }

  if (newMappings.length > 0) {
    return await bulkCreateClassClassroomMappings(newMappings)
  }

  return []
}
