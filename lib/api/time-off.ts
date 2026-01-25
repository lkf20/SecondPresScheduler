import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type TimeOffRequest = Database['public']['Tables']['time_off_requests']['Row']
type Teacher = Database['public']['Tables']['staff']['Row']
type TimeOffShift = Database['public']['Tables']['time_off_shifts']['Row']
type TimeOffRequestWithTeacher = TimeOffRequest & { teacher: Teacher }
type TimeOffRequestWithDetails = TimeOffRequestWithTeacher & { shifts: TimeOffShift[] }

export async function getTimeOffRequests(filters?: {
  teacher_id?: string
  start_date?: string
  end_date?: string
  statuses?: Array<'draft' | 'active' | 'cancelled'>
}): Promise<TimeOffRequestWithTeacher[]> {
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
  return (data || []) as TimeOffRequestWithTeacher[]
}

export async function getTimeOffRequestById(id: string): Promise<TimeOffRequestWithDetails> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('time_off_requests')
    .select('*, teacher:staff!time_off_requests_teacher_id_fkey(*), shifts:time_off_shifts(*)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as TimeOffRequestWithDetails
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
  const { data, error } = await supabase.from('time_off_requests').insert(request).select().single()

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
    .update({ status: 'cancelled' })
    .eq('id', id)

  if (error) throw error
}

/**
 * Get active sub assignments for a time off request
 * Finds all active sub assignments linked via coverage_request_shifts
 */
export async function getActiveSubAssignmentsForTimeOffRequest(timeOffRequestId: string) {
  const supabase = await createClient()

  // Get the time off request to find its coverage_request_id
  const { data: timeOffRequest, error: requestError } = await supabase
    .from('time_off_requests')
    .select('id, coverage_request_id, teacher_id')
    .eq('id', timeOffRequestId)
    .single()

  if (requestError) throw requestError
  if (!timeOffRequest?.coverage_request_id) {
    return []
  }

  // Use the helper function to get active sub assignments
  const { getActiveSubAssignmentsByCoverageRequest } = await import('./sub-assignments')
  return await getActiveSubAssignmentsByCoverageRequest(timeOffRequest.coverage_request_id)
}

/**
 * Cancel a time off request with sub-assignment handling
 */
export async function cancelTimeOffRequest(
  timeOffRequestId: string,
  options: {
    keepAssignmentsAsExtraCoverage: boolean
    assignmentIdsToKeep?: string[] // If provided, only keep these specific assignments
  }
) {
  const supabase = await createClient()

  // Get the time off request
  const { data: timeOffRequest, error: requestError } = await supabase
    .from('time_off_requests')
    .select('id, coverage_request_id, teacher_id')
    .eq('id', timeOffRequestId)
    .single()

  if (requestError) throw requestError
  if (!timeOffRequest) {
    throw new Error('Time off request not found')
  }

  const coverageRequestId = timeOffRequest.coverage_request_id
  if (!coverageRequestId) {
    // No coverage request, just cancel the time off request
    await deleteTimeOffRequest(timeOffRequestId)
    return { cancelled: true, assignmentsHandled: 0 }
  }

  // Get active sub assignments for this coverage request
  const activeAssignments = await getActiveSubAssignmentsForTimeOffRequest(timeOffRequestId)

  if (activeAssignments.length === 0) {
    // No assignments, just cancel everything
    await supabase
      .from('coverage_requests')
      .update({ status: 'cancelled' })
      .eq('id', coverageRequestId)

    await supabase
      .from('coverage_request_shifts')
      .update({ status: 'cancelled' })
      .eq('coverage_request_id', coverageRequestId)

    await deleteTimeOffRequest(timeOffRequestId)
    return { cancelled: true, assignmentsHandled: 0 }
  }

  // Determine which assignments to keep
  const assignmentsToKeep = options.assignmentIdsToKeep
    ? activeAssignments.filter(a => options.assignmentIdsToKeep!.includes(a.id))
    : options.keepAssignmentsAsExtraCoverage
      ? activeAssignments
      : []

  const assignmentsToCancel = activeAssignments.filter(
    a => !assignmentsToKeep.some(keep => keep.id === a.id)
  )

  // Cancel assignments that should be cancelled
  if (assignmentsToCancel.length > 0) {
    const assignmentIdsToCancel = assignmentsToCancel.map(a => a.id)
    await supabase
      .from('sub_assignments')
      .update({ status: 'cancelled' })
      .in('id', assignmentIdsToCancel)
  }

  // Handle assignments to keep as extra coverage
  if (assignmentsToKeep.length > 0) {
    // Get the coverage request details
    const { data: coverageRequest, error: crError } = await supabase
      .from('coverage_requests')
      .select('id, teacher_id, school_id')
      .eq('id', coverageRequestId)
      .single()

    if (crError) throw crError
    if (!coverageRequest) {
      throw new Error('Coverage request not found')
    }

    // Get the shifts for the assignments we're keeping
    const shiftIds = assignmentsToKeep
      .map(a => a.coverage_request_shift_id)
      .filter(Boolean) as string[]
    const { data: shiftsToKeep, error: shiftsError } = await supabase
      .from('coverage_request_shifts')
      .select('*')
      .in('id', shiftIds)
      .eq('status', 'active')

    if (shiftsError) throw shiftsError
    if (!shiftsToKeep || shiftsToKeep.length === 0) {
      throw new Error('No active shifts found for assignments to keep')
    }

    // Calculate date range for new coverage request
    const dates = shiftsToKeep.map(s => s.date).sort()
    const startDate = dates[0]
    const endDate = dates[dates.length - 1]

    // Get school_id from the original coverage request
    const schoolId = coverageRequest.school_id || '00000000-0000-0000-0000-000000000001'

    // Create new coverage request for extra coverage
    const { data: newCoverageRequest, error: newCrError } = await supabase
      .from('coverage_requests')
      .insert({
        request_type: 'extra_coverage_manual',
        source_request_id: coverageRequestId, // Point to cancelled coverage request
        teacher_id: coverageRequest.teacher_id,
        start_date: startDate,
        end_date: endDate,
        status: 'open', // Will be updated to 'filled' if all shifts are covered
        total_shifts: shiftsToKeep.length,
        covered_shifts: assignmentsToKeep.length,
        school_id: schoolId,
      })
      .select()
      .single()

    if (newCrError) throw newCrError
    if (!newCoverageRequest) {
      throw new Error('Failed to create new coverage request')
    }

    // Create new coverage_request_shifts for the kept shifts
    const newShiftsData = shiftsToKeep.map(shift => ({
      coverage_request_id: newCoverageRequest.id,
      date: shift.date,
      day_of_week_id: shift.day_of_week_id,
      time_slot_id: shift.time_slot_id,
      classroom_id: shift.classroom_id,
      class_group_id: shift.class_group_id,
      is_partial: shift.is_partial,
      start_time: shift.start_time,
      end_time: shift.end_time,
      status: 'active',
      school_id: schoolId,
    }))

    const { data: newShifts, error: newShiftsError } = await supabase
      .from('coverage_request_shifts')
      .insert(newShiftsData)
      .select()

    if (newShiftsError) throw newShiftsError
    if (!newShifts || newShifts.length !== shiftsToKeep.length) {
      throw new Error('Failed to create all new coverage request shifts')
    }

    // Create a map of old shift ID to new shift ID
    const shiftIdMap = new Map<string, string>()
    shiftsToKeep.forEach((oldShift, index) => {
      if (newShifts[index]) {
        shiftIdMap.set(oldShift.id, newShifts[index].id)
      }
    })

    // Update sub_assignments to point to new shifts and set assignment_kind
    for (const assignment of assignmentsToKeep) {
      const newShiftId = shiftIdMap.get(assignment.coverage_request_shift_id)
      if (!newShiftId) {
        console.error(`No new shift ID found for assignment ${assignment.id}`)
        continue
      }

      await supabase
        .from('sub_assignments')
        .update({
          coverage_request_shift_id: newShiftId,
          assignment_kind: 'extra_coverage',
          status: 'active',
        })
        .eq('id', assignment.id)
    }

    // Update new coverage request status if all shifts are covered
    if (newCoverageRequest.total_shifts === assignmentsToKeep.length) {
      await supabase
        .from('coverage_requests')
        .update({ status: 'filled' })
        .eq('id', newCoverageRequest.id)
    }
  }

  // Mark original coverage request and its shifts as cancelled
  await supabase
    .from('coverage_requests')
    .update({ status: 'cancelled' })
    .eq('id', coverageRequestId)

  await supabase
    .from('coverage_request_shifts')
    .update({ status: 'cancelled' })
    .eq('coverage_request_id', coverageRequestId)

  // Cancel the time off request
  await deleteTimeOffRequest(timeOffRequestId)

  return {
    cancelled: true,
    assignmentsHandled: activeAssignments.length,
    assignmentsCancelled: assignmentsToCancel.length,
    assignmentsKept: assignmentsToKeep.length,
  }
}
