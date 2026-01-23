import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type DayOfWeek = Database['public']['Tables']['days_of_week']['Row']

export async function getDaysOfWeek() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('days_of_week')
    .select('*')
    .order('day_number', { ascending: true })

  if (error) throw error

  // If table is empty, return null so we can handle it
  if (!data || data.length === 0) {
    return null
  }

  return data as DayOfWeek[]
}

export async function ensureDaysOfWeekSeeded() {
  const supabase = await createClient()

  // Check if days exist
  const { data: existingDays } = await supabase.from('days_of_week').select('id').limit(1)

  if (existingDays && existingDays.length > 0) {
    return // Already seeded
  }

  // Seed the days
  const daysToInsert = [
    { name: 'Monday', day_number: 1, display_order: 1 },
    { name: 'Tuesday', day_number: 2, display_order: 2 },
    { name: 'Wednesday', day_number: 3, display_order: 3 },
    { name: 'Thursday', day_number: 4, display_order: 4 },
    { name: 'Friday', day_number: 5, display_order: 5 },
    { name: 'Saturday', day_number: 6, display_order: 6 },
    { name: 'Sunday', day_number: 7, display_order: 7 },
  ]

  const { error } = await supabase.from('days_of_week').insert(daysToInsert)

  if (error) {
    // If insert fails (e.g., due to RLS), log but don't throw
    console.warn('Could not auto-seed days_of_week:', error.message)
  }
}
