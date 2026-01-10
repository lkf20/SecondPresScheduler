import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type TimeOffRequest = Database['public']['Tables']['time_off_requests']['Row']

export async function getTimeOffRequests(filters?: {
  teacher_id?: string
  start_date?: string
  end_date?: string
  statuses?: Array<'draft' | 'active' | 'deleted'>
}) {
  const supabase = await createClient()
  let query = supabase
    .from('time_off_requests')
    .select('*, teacher:staff!time_off_requests_teacher_id_fkey(*)')
    .order('start_date', { ascending: false })

  if (filters?.statuses && filters.statuses.length > 0) {
    query = query.in('status', filters.statuses)
  } else {
    query = query.eq('status', 'active')
  }

  if (filters?.teacher_id) {
    query = query.eq('teacher_id', filters.teacher_id)
  }
  if (filters?.start_date) {
    query = query.gte('start_date', filters.start_date)
  }
  if (filters?.end_date) {
    query = query.lte('end_date', filters.end_date)
  }

  const { data, error } = await query

  if (error) throw error
  return data as any[]
}

export async function getTimeOffRequestById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('time_off_requests')
    .select('*, teacher:staff!time_off_requests_teacher_id_fkey(*), shifts:time_off_shifts(*)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as any
}

export async function createTimeOffRequest(request: {
  teacher_id: string
  start_date: string
  end_date: string
  reason?: string
  notes?: string
  shift_selection_mode?: string
  status?: string
}) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('time_off_requests')
    .insert(request)
    .select()
    .single()

  if (error) throw error
  return data as TimeOffRequest
}

export async function updateTimeOffRequest(id: string, updates: Partial<TimeOffRequest>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('time_off_requests')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as TimeOffRequest
}

export async function deleteTimeOffRequest(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('time_off_requests')
    .update({ status: 'deleted' })
    .eq('id', id)

  if (error) throw error
}

