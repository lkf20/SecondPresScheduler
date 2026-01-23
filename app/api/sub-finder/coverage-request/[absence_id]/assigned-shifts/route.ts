import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTimeOffRequestById } from '@/lib/api/time-off'
import { createErrorResponse, getErrorMessage } from '@/lib/utils/errors'

/**
 * GET /api/sub-finder/coverage-request/[absence_id]/assigned-shifts
 * Get all assigned shifts for a coverage request (across all subs)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ absence_id: string }> }
) {
  try {
    const { absence_id } = await params

    if (!absence_id) {
      return createErrorResponse('Missing absence_id', 400)
    }

    const supabase = await createClient()

    // Get time off request
    const timeOffRequest = await getTimeOffRequestById(absence_id)
    if (!timeOffRequest) {
      return createErrorResponse('Time off request not found', 404)
    }

    // Get coverage_request_id
    const coverageRequestId = (timeOffRequest as any).coverage_request_id
    if (!coverageRequestId) {
      return createErrorResponse('Coverage request not found for this absence', 404)
    }

    // Get teacher_id from coverage_request
    const { data: coverageRequest, error: crError } = await supabase
      .from('coverage_requests')
      .select('teacher_id')
      .eq('id', coverageRequestId)
      .single()

    if (crError || !coverageRequest) {
      return createErrorResponse('Coverage request not found', 404)
    }

    // Get all coverage_request_shifts for this coverage request to get the date/time_slot combinations
    const { data: coverageRequestShifts, error: shiftsError } = await supabase
      .from('coverage_request_shifts')
      .select('date, time_slot_id, time_slots:time_slot_id(code)')
      .eq('coverage_request_id', coverageRequestId)

    if (shiftsError) {
      console.error('Error fetching coverage_request_shifts:', shiftsError)
      return createErrorResponse('Failed to fetch coverage request shifts', 500)
    }

    if (!coverageRequestShifts || coverageRequestShifts.length === 0) {
      return NextResponse.json({
        assigned_shifts: [],
        remaining_shift_keys: [],
        remaining_shift_count: 0,
        total_shifts: 0,
      })
    }

    // Build a set of date|time_slot_code combinations for this coverage request
    const coverageShiftKeys = new Set<string>()
    coverageRequestShifts.forEach((shift: any) => {
      const timeSlotCode = shift.time_slots?.code || ''
      const key = `${shift.date}|${timeSlotCode}`
      coverageShiftKeys.add(key)
    })

    // Get all sub_assignments for this teacher that match the coverage request shifts
    const { data: subAssignments, error: assignmentsError } = await supabase
      .from('sub_assignments')
      .select(
        `
        date,
        time_slot_id,
        time_slots:time_slots(code),
        days_of_week:day_of_week_id(name)
      `
      )
      .eq('teacher_id', coverageRequest.teacher_id)
      .eq('assignment_type', 'Substitute Shift')

    if (assignmentsError) {
      console.error('Error fetching sub_assignments:', assignmentsError)
      return createErrorResponse('Failed to fetch assigned shifts', 500)
    }

    // Filter sub_assignments to only include those that match coverage_request_shifts
    const matchingAssignments = (subAssignments || []).filter((assignment: any) => {
      const timeSlotCode = assignment.time_slots?.code || ''
      const key = `${assignment.date}|${timeSlotCode}`
      return coverageShiftKeys.has(key)
    })

    // Format the assigned shifts
    const assignedShifts = matchingAssignments.map((assignment: any) => ({
      date: assignment.date,
      time_slot_code: assignment.time_slots?.code || '',
      day_name: assignment.days_of_week?.name || '',
    }))
    const assignedShiftKeys = new Set<string>()
    assignedShifts.forEach(shift => {
      assignedShiftKeys.add(`${shift.date}|${shift.time_slot_code}`)
    })
    const remainingShiftKeys = Array.from(coverageShiftKeys).filter(
      key => !assignedShiftKeys.has(key)
    )

    return NextResponse.json({
      assigned_shifts: assignedShifts,
      remaining_shift_keys: remainingShiftKeys,
      remaining_shift_count: Math.max(0, coverageShiftKeys.size - assignedShiftKeys.size),
      total_shifts: coverageShiftKeys.size,
    })
  } catch (error) {
    console.error('Error fetching assigned shifts:', error)
    return createErrorResponse(getErrorMessage(error), 500)
  }
}
