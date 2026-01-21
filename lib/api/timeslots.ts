import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { getUserSchoolId } from '@/lib/utils/auth'

type TimeSlot = Database['public']['Tables']['time_slots']['Row']

export async function getTimeSlots(schoolId?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('time_slots')
    .select('*')
    .order('display_order', { ascending: true })

  // If schoolId is provided, filter by it. Otherwise, get from session.
  const effectiveSchoolId = schoolId || await getUserSchoolId()
  if (effectiveSchoolId) {
    query = query.eq('school_id', effectiveSchoolId)
  }

  const { data, error } = await query
  if (error) throw error
  return data as TimeSlot[]
}

export async function getTimeSlotById(id: string, schoolId?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('time_slots')
    .select('*')
    .eq('id', id)

  const effectiveSchoolId = schoolId || await getUserSchoolId()
  if (effectiveSchoolId) {
    query = query.eq('school_id', effectiveSchoolId)
  }

  const { data, error } = await query.single()

  if (error) throw error
  return data as TimeSlot
}

export async function createTimeSlot(timeslot: {
  code: string
  name?: string
  default_start_time?: string
  default_end_time?: string
  display_order?: number
  school_id?: string
}) {
  const supabase = await createClient()
  
  // Get school_id if not provided
  const schoolId = timeslot.school_id || await getUserSchoolId()
  if (!schoolId) {
    throw new Error('school_id is required to create a time slot')
  }

  const { data, error } = await supabase
    .from('time_slots')
    .insert({ ...timeslot, school_id: schoolId })
    .select()
    .single()

  if (error) throw error
  return data as TimeSlot
}

export async function updateTimeSlot(id: string, updates: Partial<TimeSlot>, schoolId?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('time_slots')
    .update(updates)
    .eq('id', id)

  const effectiveSchoolId = schoolId || await getUserSchoolId()
  if (effectiveSchoolId) {
    query = query.eq('school_id', effectiveSchoolId)
  }

  const { data, error } = await query.select().single()

  if (error) throw error
  return data as TimeSlot
}

export async function deleteTimeSlot(id: string, schoolId?: string) {
  const supabase = await createClient()
  let query = supabase.from('time_slots').delete().eq('id', id)

  const effectiveSchoolId = schoolId || await getUserSchoolId()
  if (effectiveSchoolId) {
    query = query.eq('school_id', effectiveSchoolId)
  }

  const { error } = await query

  if (error) throw error
}



