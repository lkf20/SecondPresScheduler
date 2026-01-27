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
  let legacyClassId = mapping.class_id

  if (!legacyClassId) {
    const { data: classGroup, error: classGroupError } = await supabase
      .from('class_groups')
      .select('id, name')
      .eq('id', mapping.class_group_id)
      .single()

    if (classGroupError) throw classGroupError

    const { data: legacyClass, error: legacyClassError } = await supabase
      .from('classes')
      .select('id')
      .eq('name', classGroup.name)
      .single()

    if (legacyClassError) throw legacyClassError
    legacyClassId = legacyClass.id
  }

  const payload = {
    ...mapping,
    class_id: legacyClassId,
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
  const missingLegacyIds = mappings.filter(mapping => !mapping.class_id)
  const uniqueClassGroupIds = Array.from(
    new Set(missingLegacyIds.map(mapping => mapping.class_group_id))
  )

  let classGroupIdToLegacyId = new Map<string, string>()
  if (uniqueClassGroupIds.length > 0) {
    const { data: classGroups, error: classGroupsError } = await supabase
      .from('class_groups')
      .select('id, name')
      .in('id', uniqueClassGroupIds)

    if (classGroupsError) throw classGroupsError

    const classGroupNames = Array.from(
      new Set((classGroups || []).map(cg => cg.name).filter(Boolean))
    )

    const { data: classes, error: classesError } = await supabase
      .from('classes')
      .select('id, name')
      .in('name', classGroupNames)

    if (classesError) throw classesError

    const classNameToId = new Map((classes || []).map(cls => [cls.name, cls.id]))
    classGroupIdToLegacyId = new Map(
      (classGroups || [])
        .map(cg => {
          const legacyId = classNameToId.get(cg.name)
          return legacyId ? [cg.id, legacyId] : null
        })
        .filter((entry): entry is [string, string] => Boolean(entry))
    )
  }

  const payload = mappings.map(mapping => {
    const legacyClassId =
      mapping.class_id ?? classGroupIdToLegacyId.get(mapping.class_group_id)
    if (!legacyClassId) {
      throw new Error(`No legacy class found for class_group_id ${mapping.class_group_id}`)
    }
    return {
      ...mapping,
      class_id: legacyClassId,
    }
  })
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
