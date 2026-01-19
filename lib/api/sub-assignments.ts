import { createClient } from '@/lib/supabase/server'

/**
 * Get active sub assignments (status = 'active')
 */
export async function getActiveSubAssignments(filters?: {
  sub_id?: string
  teacher_id?: string
  date?: string
  start_date?: string
  end_date?: string
  coverage_request_shift_id?: string
}) {
  const supabase = await createClient()
  let query = supabase
    .from('sub_assignments')
    .select('*')
    .eq('status', 'active')
    .order('date', { ascending: true })
    .order('time_slot_id', { ascending: true })

  if (filters?.sub_id) {
    query = query.eq('sub_id', filters.sub_id)
  }
  if (filters?.teacher_id) {
    query = query.eq('teacher_id', filters.teacher_id)
  }
  if (filters?.date) {
    query = query.eq('date', filters.date)
  }
  if (filters?.start_date) {
    query = query.gte('date', filters.start_date)
  }
  if (filters?.end_date) {
    query = query.lte('date', filters.end_date)
  }
  if (filters?.coverage_request_shift_id) {
    query = query.eq('coverage_request_shift_id', filters.coverage_request_shift_id)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

/**
 * Get active sub assignments by coverage request shifts
 * Finds all active sub assignments linked to active shifts in a coverage request
 */
export async function getActiveSubAssignmentsByCoverageRequest(
  coverageRequestId: string
) {
  const supabase = await createClient()

  // First get active shifts for this coverage request
  const { data: shifts, error: shiftsError } = await supabase
    .from('coverage_request_shifts')
    .select('id')
    .eq('coverage_request_id', coverageRequestId)
    .eq('status', 'active')

  if (shiftsError) throw shiftsError
  if (!shifts || shifts.length === 0) return []

  const shiftIds = shifts.map((s) => s.id)

  // Get active sub assignments for these shifts
  const { data, error } = await supabase
    .from('sub_assignments')
    .select(`
      *,
      sub:staff!sub_assignments_sub_id_fkey(id, first_name, last_name, display_name),
      coverage_request_shift:coverage_request_shifts!sub_assignments_coverage_request_shift_id_fkey(
        id,
        date,
        day_of_week_id,
        time_slot_id,
        classroom_id,
        days_of_week(name),
        time_slots(code, name),
        classrooms(name)
      )
    `)
    .eq('status', 'active')
    .in('coverage_request_shift_id', shiftIds)
    .order('date', { ascending: true })
    .order('time_slot_id', { ascending: true })

  if (error) throw error
  return data || []
}
