import { createClient } from '@/lib/supabase/server'

export interface ScheduleSettings {
  id: string
  selected_day_ids: string[]
  created_at: string
  updated_at: string
}

const normalizeSelectedDayIds = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string')
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed)
        ? parsed.filter((entry): entry is string => typeof entry === 'string')
        : []
    } catch (error) {
      console.warn('Failed to parse selected_day_ids as JSON:', error)
    }
  }
  return []
}

export async function getScheduleSettings(schoolId: string): Promise<ScheduleSettings | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('schedule_settings')
    .select('*')
    .eq('school_id', schoolId)
    .limit(1)
    .single()

  if (error) {
    // If no row exists, return null (will create on first update)
    if (error.code === 'PGRST116') {
      return null
    }
    // If table doesn't exist yet (migration not run), return null gracefully
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      console.warn('schedule_settings table does not exist yet. Please run migration 020_add_schedule_settings.sql')
      return null
    }
    throw error
  }

  // Ensure selected_day_ids is always an array
  const selectedDayIds = normalizeSelectedDayIds(data.selected_day_ids)

  return {
    ...data,
    selected_day_ids: selectedDayIds,
  } as ScheduleSettings
}

export async function updateScheduleSettings(schoolId: string, selectedDayIds: string[]): Promise<ScheduleSettings> {
  const supabase = await createClient()
  
  // Check if settings exist
  const existing = await getScheduleSettings(schoolId)
  
  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from('schedule_settings')
      .update({
        selected_day_ids: selectedDayIds,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) throw error
    return {
      ...data,
      selected_day_ids: normalizeSelectedDayIds(data.selected_day_ids),
    } as ScheduleSettings
  } else {
    // Create new
    const { data, error } = await supabase
      .from('schedule_settings')
      .insert({
        school_id: schoolId,
        selected_day_ids: selectedDayIds,
      })
      .select()
      .single()

    if (error) throw error
    return {
      ...data,
      selected_day_ids: normalizeSelectedDayIds(data.selected_day_ids),
    } as ScheduleSettings
  }
}
