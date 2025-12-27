import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type TimeSlot = Database['public']['Tables']['time_slots']['Row']

export async function getTimeSlots() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('time_slots')
    .select('*')
    .order('display_order', { ascending: true })

  if (error) throw error
  return data as TimeSlot[]
}

export async function getTimeSlotById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('time_slots')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as TimeSlot
}

export async function createTimeSlot(timeslot: {
  code: string
  name?: string
  default_start_time?: string
  default_end_time?: string
  display_order?: number
}) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('time_slots')
    .insert(timeslot)
    .select()
    .single()

  if (error) throw error
  return data as TimeSlot
}

export async function updateTimeSlot(id: string, updates: Partial<TimeSlot>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('time_slots')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as TimeSlot
}

export async function deleteTimeSlot(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('time_slots').delete().eq('id', id)

  if (error) throw error
}



