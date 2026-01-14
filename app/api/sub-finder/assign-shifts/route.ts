import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createErrorResponse, getErrorMessage } from '@/lib/utils/errors'
import { createAuditLog } from '@/lib/api/audit-logs'
import { revalidatePath } from 'next/cache'

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

    console.log('Assign shifts request:', {
      coverage_request_id,
      sub_id,
      selected_shift_ids_count: selected_shift_ids.length,
    })

    // Get coverage_request to get teacher_id
    // The coverage_requests table has teacher_id directly, and source_request_id for time_off requests
    const { data: coverageRequest, error: coverageError } = await supabase
      .from('coverage_requests')
      .select('teacher_id, source_request_id, request_type')
      .eq('id', coverage_request_id)
      .single()

    if (coverageError) {
      console.error('Error fetching coverage_request:', {
        error: coverageError,
        code: coverageError.code,
        message: coverageError.message,
        details: coverageError.details,
        hint: coverageError.hint,
        coverage_request_id,
      })
      return createErrorResponse(
        `Coverage request not found: ${coverageError.message || 'Database error'}`,
        404
      )
    }

    if (!coverageRequest) {
      console.error('Coverage request not found:', { coverage_request_id })
      return createErrorResponse('Coverage request not found', 404)
    }

    // Get teacher_id directly from coverage_request (it's stored there)
    const teacherId = (coverageRequest as any).teacher_id
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

    const shiftsNeedingClassroom = coverageRequestShifts.filter(
      (shift: any) => !shift.classroom_id
    )
    const fallbackClassroomMap = new Map<string, string>()
    if (shiftsNeedingClassroom.length > 0) {
      const { data: schedules, error: scheduleError } = await supabase
        .from('teacher_schedules')
        .select('day_of_week_id, time_slot_id, classroom_id')
        .eq('teacher_id', teacherId)

      if (scheduleError) {
        console.error('Error fetching teacher schedules for classroom fallback:', scheduleError)
        return createErrorResponse('Failed to resolve classroom for assignment', 500)
      }

      ;(schedules || []).forEach((schedule: any) => {
        if (!schedule.classroom_id) return
        const key = `${schedule.day_of_week_id}|${schedule.time_slot_id}`
        fallbackClassroomMap.set(key, schedule.classroom_id)
      })
    }

    // Create sub_assignments for each selected shift
    const assignments = coverageRequestShifts.map((shift: any) => {
      const fallbackKey = `${shift.day_of_week_id}|${shift.time_slot_id}`
      const resolvedClassroomId = shift.classroom_id || fallbackClassroomMap.get(fallbackKey)
      if (!resolvedClassroomId) {
        throw new Error('Missing classroom assignment for selected shifts')
      }
      return {
        sub_id,
        teacher_id: teacherId,
        date: shift.date,
        day_of_week_id: shift.day_of_week_id,
        time_slot_id: shift.time_slot_id,
        assignment_type: 'Substitute Shift' as const,
        classroom_id: resolvedClassroomId,
        is_partial: false,
        partial_start_time: null,
        partial_end_time: null,
        notes: null,
      }
    })

    // Insert sub_assignments
    const { data: createdAssignments, error: insertError } = await supabase
      .from('sub_assignments')
      .insert(assignments)
      .select()

    if (insertError) {
      console.error('Error creating sub_assignments:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
      })
      return createErrorResponse(
        `Failed to create assignments: ${insertError.message || 'Database error'}`,
        500
      )
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

    revalidatePath('/dashboard')

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
