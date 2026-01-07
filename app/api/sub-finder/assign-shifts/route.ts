import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createErrorResponse, getErrorMessage } from '@/lib/utils/errors'
import { createAuditLog } from '@/lib/api/audit-logs'

/**
 * POST /api/sub-finder/assign-shifts
 * Assign a sub to selected shifts by creating sub_assignments
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      coverage_request_id,
      sub_id,
      selected_shift_ids, // Array of coverage_request_shift_ids
    } = body

    if (!coverage_request_id || !sub_id || !selected_shift_ids || !Array.isArray(selected_shift_ids)) {
      return createErrorResponse(
        'Missing required fields: coverage_request_id, sub_id, selected_shift_ids',
        400
      )
    }

    const supabase = await createClient()

    // Get coverage_request to get teacher_id
    const { data: coverageRequest, error: coverageError } = await supabase
      .from('coverage_requests')
      .select('time_off_request_id, time_off_requests:time_off_request_id(teacher_id)')
      .eq('id', coverage_request_id)
      .single()

    if (coverageError || !coverageRequest) {
      console.error('Error fetching coverage_request:', coverageError)
      return createErrorResponse('Coverage request not found', 404)
    }

    const teacherId = (coverageRequest as any).time_off_requests?.teacher_id
    if (!teacherId) {
      return createErrorResponse('Teacher ID not found in coverage request', 404)
    }

    // Get coverage_request_shifts for the selected shifts
    const { data: coverageRequestShifts, error: shiftsError } = await supabase
      .from('coverage_request_shifts')
      .select('id, date, day_of_week_id, time_slot_id, classroom_id')
      .eq('coverage_request_id', coverage_request_id)
      .in('id', selected_shift_ids)

    if (shiftsError) {
      console.error('Error fetching coverage_request_shifts:', shiftsError)
      return createErrorResponse('Failed to fetch shift details', 500)
    }

    if (!coverageRequestShifts || coverageRequestShifts.length === 0) {
      return createErrorResponse('No valid shifts found for assignment', 404)
    }

    // Create sub_assignments for each selected shift
    const assignments = coverageRequestShifts.map((shift: any) => ({
      sub_id,
      teacher_id: teacherId,
      date: shift.date,
      day_of_week_id: shift.day_of_week_id,
      time_slot_id: shift.time_slot_id,
      assignment_type: 'Substitute Shift' as const,
      classroom_id: shift.classroom_id || null, // Use classroom from coverage_request_shift, or null if unknown
      is_partial: false,
      partial_start_time: null,
      partial_end_time: null,
      notes: null,
    }))

    // Insert sub_assignments
    const { data: createdAssignments, error: insertError } = await supabase
      .from('sub_assignments')
      .insert(assignments)
      .select()

    if (insertError) {
      console.error('Error creating sub_assignments:', insertError)
      return createErrorResponse('Failed to create assignments', 500)
    }

    // Get substitute contact ID to check for overrides
    const { data: substituteContact } = await supabase
      .from('substitute_contacts')
      .select('id')
      .eq('coverage_request_id', coverage_request_id)
      .eq('sub_id', sub_id)
      .single()

    // Get shift overrides to check for overrides
    if (substituteContact) {
      const { data: shiftOverrides } = await supabase
        .from('sub_contact_shift_overrides')
        .select('coverage_request_shift_id, override_availability')
        .in('coverage_request_shift_id', selected_shift_ids)
        .eq('substitute_contact_id', substituteContact.id)

      // Log any overridden shifts
      if (shiftOverrides) {
        for (const override of shiftOverrides) {
          if (override.override_availability) {
            await createAuditLog({
              action: 'override_availability',
              entity_type: 'sub_contact_shift_override',
              entity_id: override.coverage_request_shift_id,
              details: {
                coverage_request_id: coverage_request_id,
                sub_id: sub_id,
                coverage_request_shift_id: override.coverage_request_shift_id,
                reason: 'Director override for unavailable shift',
              },
            })
          }
        }
      }
    }

    // Get assigned shift details for response
    const assignedShiftDetails: Array<{
      coverage_request_shift_id: string
      date: string
      day_name: string
      time_slot_code: string
    }> = []

    if (coverageRequestShifts && createdAssignments) {
      // Get day names and time slot codes
      const shiftIds = coverageRequestShifts.map((s: any) => s.id)
      const { data: shiftDetails } = await supabase
        .from('coverage_request_shifts')
        .select(`
          id,
          date,
          time_slot_id,
          time_slots:time_slots(code),
          days_of_week:day_of_week_id(name)
        `)
        .in('id', shiftIds)

      if (shiftDetails) {
        assignedShiftDetails.push(
          ...shiftDetails.map((shift: any) => ({
            coverage_request_shift_id: shift.id,
            date: shift.date,
            day_name: shift.days_of_week?.name || '',
            time_slot_code: shift.time_slots?.code || '',
          }))
        )
      }
    }

    return NextResponse.json({
      success: true,
      assignments_created: createdAssignments?.length || 0,
      assignments: createdAssignments,
      assigned_shifts: assignedShiftDetails,
      assigned_count: assignedShiftDetails.length,
    })
  } catch (error) {
    console.error('Error assigning shifts:', error)
    return createErrorResponse(getErrorMessage(error), 500)
  }
}

