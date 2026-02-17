import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createErrorResponse, getErrorMessage } from '@/lib/utils/errors'
import { getAuditActorContext, logAuditEvent } from '@/lib/audit/logAuditEvent'
import { revalidatePath } from 'next/cache'

// See docs/data-lifecycle.md: sub_assignments lifecycle
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

    if (
      !coverage_request_id ||
      !sub_id ||
      !selected_shift_ids ||
      !Array.isArray(selected_shift_ids)
    ) {
      return createErrorResponse(
        'Missing required fields: coverage_request_id, sub_id, selected_shift_ids',
        400
      )
    }

    const supabase = await createClient()

    const reconcileCoverageRequestCounters = async (coverageRequestId: string) => {
      const [
        { count: totalActiveShifts, error: totalError },
        { data: coveredRows, error: coveredError },
      ] = await Promise.all([
        supabase
          .from('coverage_request_shifts')
          .select('id', { count: 'exact', head: true })
          .eq('coverage_request_id', coverageRequestId)
          .eq('status', 'active'),
        supabase
          .from('sub_assignments')
          .select(
            'coverage_request_shift_id, coverage_request_shifts!inner(coverage_request_id, status)'
          )
          .eq('status', 'active')
          .eq('coverage_request_shifts.coverage_request_id', coverageRequestId)
          .eq('coverage_request_shifts.status', 'active'),
      ])

      if (totalError) throw totalError
      if (coveredError) throw coveredError

      const total = totalActiveShifts || 0
      const coveredDistinct = new Set(
        (coveredRows || [])
          .map((row: any) => row.coverage_request_shift_id)
          .filter((value: unknown): value is string => Boolean(value))
      ).size
      const covered = Math.min(coveredDistinct, total)

      const { error: updateError } = await supabase
        .from('coverage_requests')
        .update({
          total_shifts: total,
          covered_shifts: covered,
          status: total > 0 && covered === total ? 'filled' : 'open',
          updated_at: new Date().toISOString(),
        })
        .eq('id', coverageRequestId)
        .in('status', ['open', 'filled'])

      if (updateError) throw updateError
    }

    // Get active coverage_request to get teacher_id
    // The coverage_requests table has teacher_id directly, and source_request_id for time_off requests
    const { data: coverageRequest, error: coverageError } = await supabase
      .from('coverage_requests')
      .select('teacher_id, source_request_id, request_type, school_id')
      .eq('id', coverage_request_id)
      .in('status', ['open', 'filled']) // Only active coverage requests
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

    const uniqueSelectedShiftIds = Array.from(
      new Set(
        selected_shift_ids.filter((value: unknown): value is string => typeof value === 'string')
      )
    )
    console.log('[assign-shifts Debug] incoming request', {
      coverage_request_id,
      sub_id,
      selected_shift_ids,
      unique_selected_shift_ids: uniqueSelectedShiftIds,
    })

    // Get active coverage_request_shifts for the selected shifts
    const { data: coverageRequestShifts, error: shiftsError } = await supabase
      .from('coverage_request_shifts')
      .select('id, date, day_of_week_id, time_slot_id, classroom_id')
      .eq('coverage_request_id', coverage_request_id)
      .eq('status', 'active') // Only active shifts
      .in('id', uniqueSelectedShiftIds)

    if (shiftsError) {
      console.error('Error fetching coverage_request_shifts:', shiftsError)
      return createErrorResponse('Failed to fetch shift details', 500)
    }

    if (!coverageRequestShifts || coverageRequestShifts.length === 0) {
      return createErrorResponse('No valid shifts found for assignment', 404)
    }
    console.log('[assign-shifts Debug] resolved active shifts', {
      resolved_count: coverageRequestShifts.length,
      resolved_shift_ids: coverageRequestShifts.map((shift: any) => shift.id),
    })

    // Prevent duplicate/overlapping active assignments on the same shift.
    // Scope to resolved active shifts for this coverage request to avoid stale client payloads.
    const targetShiftIds = coverageRequestShifts
      .map((shift: any) => shift.id)
      .filter((value: unknown): value is string => Boolean(value))

    const { data: existingAssignments, error: existingAssignmentsError } = await supabase
      .from('sub_assignments')
      .select('id, coverage_request_shift_id')
      .eq('status', 'active')
      .in('coverage_request_shift_id', targetShiftIds)

    if (existingAssignmentsError) {
      return createErrorResponse('Failed to validate existing assignments', 500)
    }

    const blockedShiftIds = new Set(
      (existingAssignments || [])
        .map((assignment: any) => assignment.coverage_request_shift_id)
        .filter((value: unknown): value is string => Boolean(value))
    )
    const assignableCoverageRequestShifts = coverageRequestShifts.filter(
      (shift: any) => !blockedShiftIds.has(shift.id)
    )
    console.log('[assign-shifts Debug] dedupe + blocking', {
      blocked_shift_ids: Array.from(blockedShiftIds),
      blocked_count: blockedShiftIds.size,
      assignable_shift_ids: assignableCoverageRequestShifts.map((shift: any) => shift.id),
      assignable_count: assignableCoverageRequestShifts.length,
    })

    if (assignableCoverageRequestShifts.length === 0) {
      const blockedCount = blockedShiftIds.size
      return createErrorResponse(
        `Some selected shifts are already assigned (${blockedCount} shift${blockedCount === 1 ? '' : 's'}). Please unassign first or select uncovered shifts.`,
        409
      )
    }

    const shiftsNeedingClassroom = assignableCoverageRequestShifts.filter(
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
    const requestSchoolId = coverageRequest.school_id || '00000000-0000-0000-0000-000000000001'
    const { actorUserId, actorDisplayName } = await getAuditActorContext()
    const assignments = assignableCoverageRequestShifts.map((shift: any) => {
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
        coverage_request_shift_id: shift.id, // Required: link to coverage_request_shift
        is_partial: false,
        partial_start_time: null,
        partial_end_time: null,
        notes: null,
        status: 'active', // Default status
        assignment_kind: 'absence_coverage', // Default assignment kind
        school_id: requestSchoolId,
      }
    })

    // Heal stale counters before inserting, then retry once if constraint violation persists.
    await reconcileCoverageRequestCounters(coverage_request_id)

    const insertAssignments = () => supabase.from('sub_assignments').insert(assignments).select()
    let { data: createdAssignments, error: insertError } = await insertAssignments()

    if (
      insertError?.message?.includes('coverage_requests_counters_check') ||
      insertError?.details?.includes('coverage_requests_counters_check')
    ) {
      await reconcileCoverageRequestCounters(coverage_request_id)
      const retryResult = await insertAssignments()
      createdAssignments = retryResult.data
      insertError = retryResult.error
    }

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
    console.log('[assign-shifts Debug] insert result', {
      created_count: createdAssignments?.length || 0,
      created_assignment_ids: (createdAssignments || []).map((assignment: any) => assignment.id),
    })

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
        .in('coverage_request_shift_id', uniqueSelectedShiftIds)
        .eq('substitute_contact_id', substituteContact.id)

      // Log any overridden shifts
      if (shiftOverrides) {
        for (const override of shiftOverrides) {
          if (override.override_availability) {
            await logAuditEvent({
              schoolId: requestSchoolId,
              actorUserId,
              actorDisplayName,
              action: 'assign',
              category: 'coverage',
              entityType: 'sub_contact_shift_override',
              entityId: override.coverage_request_shift_id,
              details: {
                changed_fields: ['override_availability'],
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
      const shiftIds = assignableCoverageRequestShifts.map((s: any) => s.id)
      const { data: shiftDetails } = await supabase
        .from('coverage_request_shifts')
        .select(
          `
          id,
          date,
          time_slot_id,
          time_slots:time_slots(code),
          days_of_week:day_of_week_id(name)
        `
        )
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

    // Revalidate all pages that might show this data
    revalidatePath('/dashboard')
    revalidatePath('/time-off')
    revalidatePath('/schedules/weekly')
    revalidatePath('/sub-finder')
    revalidatePath('/reports')

    await logAuditEvent({
      schoolId: requestSchoolId,
      actorUserId,
      actorDisplayName,
      action: 'assign',
      category: 'sub_assignment',
      entityType: 'coverage_request',
      entityId: coverage_request_id,
      details: {
        changed_fields: ['sub_assignments'],
        sub_id,
        teacher_id: teacherId,
        assignment_ids: (createdAssignments || []).map((assignment: any) => assignment.id),
        shift_ids: uniqueSelectedShiftIds,
      },
    })

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
