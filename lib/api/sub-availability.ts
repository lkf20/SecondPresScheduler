import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type SubAvailability = Database['public']['Tables']['sub_availability']['Row']
type SubAvailabilityException = Database['public']['Tables']['sub_availability_exceptions']['Row']

export async function getSubAvailability(subId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sub_availability')
    .select('*, day_of_week:days_of_week(*), time_slot:time_slots(*)')
    .eq('sub_id', subId)

  if (error) throw error
  return data as any[]
}

export async function upsertSubAvailability(subId: string, availability: {
  day_of_week_id: string
  time_slot_id: string
  available: boolean
}) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sub_availability')
    .upsert({
      sub_id: subId,
      ...availability,
    }, {
      onConflict: 'sub_id,day_of_week_id,time_slot_id',
    })
    .select()
    .single()

  if (error) throw error
  return data as SubAvailability
}

export async function getSubAvailabilityExceptions(subId: string, filters?: { start_date?: string; end_date?: string }) {
  const supabase = await createClient()
  let query = supabase
    .from('sub_availability_exceptions')
    .select('*, time_slot:time_slots(*)')
    .eq('sub_id', subId)
    .order('date', { ascending: false })

  if (filters?.start_date) {
    query = query.gte('date', filters.start_date)
  }
  if (filters?.end_date) {
    query = query.lte('date', filters.end_date)
  }

  const { data, error } = await query

  if (error) throw error
  return data as any[]
}

export async function createSubAvailabilityException(exception: {
  sub_id: string
  date: string
  time_slot_id: string
  available: boolean
}) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sub_availability_exceptions')
    .insert(exception)
    .select()
    .single()

  if (error) throw error
  return data as SubAvailabilityException
}

export async function deleteSubAvailabilityException(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('sub_availability_exceptions').delete().eq('id', id)

  if (error) throw error
}



