import { createClient } from '@/lib/supabase/server'

export interface ScheduleSettings {
  id: string
  selected_day_ids: string[]
  created_at: string
  updated_at: string
}

export async function getScheduleSettings(): Promise<ScheduleSettings | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('schedule_settings')
    .select('*')
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
  let selectedDayIds: string[] = []
  if (data.selected_day_ids) {
    if (Array.isArray(data.selected_day_ids)) {
      selectedDayIds = data.selected_day_ids
    } else if (typeof data.selected_day_ids === 'string') {
      // If it's a string, try to parse it as JSON
      try {
        selectedDayIds = JSON.parse(data.selected_day_ids)
      } catch (e) {
        console.warn('Failed to parse selected_day_ids as JSON:', e)
        selectedDayIds = []
      }
    }
  }

  return {
    ...data,
    selected_day_ids: selectedDayIds,
  } as ScheduleSettings
}

export async function updateScheduleSettings(selectedDayIds: string[]): Promise<ScheduleSettings> {
  const supabase = await createClient()
  
  // Check if settings exist
  const existing = await getScheduleSettings()
  
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
      selected_day_ids: (data.selected_day_ids as any) || [],
    } as ScheduleSettings
  } else {
    // Create new
    const { data, error } = await supabase
      .from('schedule_settings')
      .insert({
        selected_day_ids: selectedDayIds,
      })
      .select()
      .single()

    if (error) throw error
    return {
      ...data,
      selected_day_ids: (data.selected_day_ids as any) || [],
    } as ScheduleSettings
  }
}

