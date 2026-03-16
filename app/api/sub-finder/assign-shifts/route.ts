import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createErrorResponse, getErrorMessage } from '@/lib/utils/errors'
import { getAuditActorContext, logAuditEvent } from '@/lib/audit/logAuditEvent'
import { revalidatePath } from 'next/cache'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getStaffDisplayName } from '@/lib/utils/staff-display-name'
import { toDateStringISO } from '@/lib/utils/date'
import { getSchoolClosuresForDateRange } from '@/lib/api/school-calendar'
import { isSlotClosedOnDate } from '@/lib/utils/school-closures'

const shouldDebugLog =
  process.env.NODE_ENV === 'development' || process.env.SUB_FINDER_DEBUG === 'true'

const logAssignShiftsError = (...args: unknown[]) => {
  if (shouldDebugLog) {
    console.error(...args)
  }
}

// See docs/domain/data-lifecycle.md: sub_assignments lifecycle
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
      allow_non_sub_override = false,
      selected_shift_ids, // Array of coverage_request_shift_ids
      is_floater_shift_ids = [], // Optional: coverage_request_shift_ids to create as floater (legacy)
      resolutions = {}, // Optional: { [coverage_request_shift_id]: 'floater' | 'move' | 'replace' } for conflict/replace resolution
    } = body

    const resolutionsMap =
      typeof resolutions === 'object' && resolutions !== null
        ? (resolutions as Record<string, string>)
        : {}
    const floaterShiftIds = new Set<string>()
    for (const id of Array.isArray(is_floater_shift_ids)
      ? is_floater_shift_ids.filter((v: unknown): v is string => typeof v === 'string')
      : []) {
      floaterShiftIds.add(id)
    }
    for (const [id, r] of Object.entries(resolutionsMap)) {
      if (r === 'floater') floaterShiftIds.add(id)
    }

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
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return createErrorResponse(
        'User profile not found or missing school_id. Please ensure your profile is set up.',
        403
      )
    }

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
      logAssignShiftsError('Error fetching coverage_request:', {
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
      logAssignShiftsError('Coverage request not found:', { coverage_request_id })
      return createErrorResponse('Coverage request not found', 404)
    }

    if (coverageRequest.school_id && coverageRequest.school_id !== schoolId) {
      return createErrorResponse('You do not have access to this coverage request.', 403)
    }

    // Get teacher_id directly from coverage_request (it's stored there)
    const teacherId = (coverageRequest as any).teacher_id
    if (!teacherId) {
      return createErrorResponse('Teacher ID not found in coverage request', 404)
    }
    const requestSchoolId = coverageRequest.school_id || schoolId

    const { data: subRecord, error: subError } = await supabase
      .from('staff')
      .select('id, school_id, first_name, last_name, display_name, active, is_sub')
      .eq('id', sub_id)
      .single()

    if (subError || !subRecord) {
      return createErrorResponse('Sub not found', 404)
    }
    if (subRecord.school_id !== requestSchoolId) {
      return createErrorResponse(
        'School mismatch: this sub cannot be assigned to this coverage request.',
        403
      )
    }
    if (subRecord.active === false) {
      return createErrorResponse('This staff member is inactive and cannot be assigned.', 400)
    }
    const isNonSubOverride = subRecord.is_sub === false
    if (isNonSubOverride && allow_non_sub_override !== true) {
      return createErrorResponse(
        'Non-sub override must be explicitly enabled before assigning this staff member.',
        400
      )
    }

    const subName = getStaffDisplayName(subRecord)
    const { data: teacherRow } = await supabase
      .from('staff')
      .select('first_name, last_name, display_name')
      .eq('id', teacherId)
      .maybeSingle()
    const teacherName = teacherRow ? getStaffDisplayName(teacherRow) : null

    const uniqueSelectedShiftIds = Array.from(
      new Set(
        selected_shift_ids.filter((value: unknown): value is string => typeof value === 'string')
      )
    )

    // Get active coverage_request_shifts for the selected shifts
    const { data: coverageRequestShifts, error: shiftsError } = await supabase
      .from('coverage_request_shifts')
      .select('id, date, day_of_week_id, time_slot_id, classroom_id')
      .eq('coverage_request_id', coverage_request_id)
      .eq('status', 'active') // Only active shifts
      .in('id', uniqueSelectedShiftIds)

    if (shiftsError) {
      logAssignShiftsError('Error fetching coverage_request_shifts:', shiftsError)
      return createErrorResponse('Failed to fetch shift details', 500)
    }

    if (!coverageRequestShifts || coverageRequestShifts.length === 0) {
      return createErrorResponse('No valid shifts found for assignment', 404)
    }

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

    // Include all requested shifts so "replace" (cancel current sub, assign new) works for every selected shift.
    // Conflict resolution (floater/move) is still required when the same sub is double-booked; that is enforced by hasSubCollision below.
    const assignableCoverageRequestShifts = coverageRequestShifts

    // Reject assignment if any selected shift is on a school closed day
    const assignableDates = assignableCoverageRequestShifts.map((s: any) => toDateStringISO(s.date))
    const minDate = assignableDates.sort()[0]
    const maxDate = assignableDates.sort().reverse()[0]
    if (minDate && maxDate) {
      const schoolClosures = await getSchoolClosuresForDateRange(requestSchoolId, minDate, maxDate)
      const closureList = schoolClosures.map(c => ({ date: c.date, time_slot_id: c.time_slot_id }))
      const closedShift = assignableCoverageRequestShifts.find((shift: any) =>
        isSlotClosedOnDate(toDateStringISO(shift.date), shift.time_slot_id, closureList)
      )
      if (closedShift) {
        return createErrorResponse(
          'Cannot assign a sub to a shift on a day when school is closed. Please deselect shifts that fall on closed days.',
          409
        )
      }
    }

    if (
      coverageRequest.request_type === 'time_off' &&
      typeof coverageRequest.source_request_id === 'string'
    ) {
      const { data: sourceRequestShifts, error: sourceShiftsError } = await supabase
        .from('time_off_shifts')
        .select('date, time_slot_id')
        .eq('time_off_request_id', coverageRequest.source_request_id)

      if (sourceShiftsError) {
        return createErrorResponse('Failed to validate source time-off shifts', 500)
      }

      const sourceShiftKeys = new Set(
        (sourceRequestShifts || []).map(
          (shift: any) => `${toDateStringISO(shift.date)}|${shift.time_slot_id}`
        )
      )
      const includesCancelledShift = assignableCoverageRequestShifts.some((shift: any) => {
        const key = `${toDateStringISO(shift.date)}|${shift.time_slot_id}`
        return !sourceShiftKeys.has(key)
      })

      if (includesCancelledShift) {
        return createErrorResponse(
          'One or more selected shifts are no longer active for this time off request.',
          409
        )
      }
    }

    const selectedDates = Array.from(
      new Set(assignableCoverageRequestShifts.map((shift: any) => shift.date).filter(Boolean))
    )
    const selectedTimeSlotIds = Array.from(
      new Set(
        assignableCoverageRequestShifts.map((shift: any) => shift.time_slot_id).filter(Boolean)
      )
    )
    const selectedShiftKeys = new Set(
      assignableCoverageRequestShifts.map(
        (shift: any) => `${toDateStringISO(shift.date)}|${shift.time_slot_id}`
      )
    )
    const resolvedSlotKeys = new Set(
      assignableCoverageRequestShifts
        .filter((shift: any) => {
          const r = resolutionsMap[shift.id]
          return r === 'floater' || r === 'move'
        })
        .map((shift: any) => `${toDateStringISO(shift.date)}|${shift.time_slot_id}`)
    )
    const { data: subScheduleCollisions, error: subCollisionError } = await supabase
      .from('sub_assignments')
      .select('id, date, time_slot_id, is_partial, coverage_request_shift_id')
      .eq('sub_id', sub_id)
      .eq('status', 'active')
      .in('date', selectedDates)
      .in('time_slot_id', selectedTimeSlotIds)

    if (subCollisionError) {
      return createErrorResponse('Failed to validate sub scheduling conflicts', 500)
    }

    const hasSubCollision = (subScheduleCollisions || []).some((assignment: any) => {
      const key = `${toDateStringISO(assignment.date)}|${assignment.time_slot_id}`
      return selectedShiftKeys.has(key) && !resolvedSlotKeys.has(key)
    })
    if (hasSubCollision) {
      return createErrorResponse(
        'Double booking prevented: this sub already has an active assignment for one or more selected shifts.',
        409
      )
    }

    // Resolve conflicts before insert: move = cancel existing sub_assignment; floater = set is_floater on existing and new.
    // When resolution is 'move' with existing sub_assignment (conflict_sub): cancel it so sub is removed from other room, assign here.
    // When resolution is 'move' with no existing sub_assignment (conflict_teaching: sub teaches in other room via teacher_schedules):
    // we cannot remove from teacher_schedules; create full assignment here (is_floater: false).
    const existingBySlotKey = new Map<string, any>()
    for (const a of subScheduleCollisions || []) {
      const key = `${toDateStringISO(a.date)}|${a.time_slot_id}`
      existingBySlotKey.set(key, a)
    }
    for (const shift of assignableCoverageRequestShifts) {
      const key = `${toDateStringISO(shift.date)}|${shift.time_slot_id}`
      const existing = existingBySlotKey.get(key)
      const resolution = resolutionsMap[shift.id]
      if (!existing) continue
      if (resolution === 'move') {
        const { error: cancelErr } = await supabase
          .from('sub_assignments')
          .update({ status: 'cancelled' })
          .eq('id', existing.id)
        if (cancelErr) {
          logAssignShiftsError('Error cancelling assignment for move resolution:', cancelErr)
          return createErrorResponse('Failed to move sub assignment', 500)
        }
        existingBySlotKey.delete(key)
      } else if (resolution === 'floater') {
        const { error: updateErr } = await supabase
          .from('sub_assignments')
          .update({ is_floater: true })
          .eq('id', existing.id)
        if (updateErr) {
          logAssignShiftsError('Error updating assignment to floater:', updateErr)
          return createErrorResponse('Failed to set floater on existing assignment', 500)
        }
      }
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
        logAssignShiftsError(
          'Error fetching teacher schedules for classroom fallback:',
          scheduleError
        )
        return createErrorResponse('Failed to resolve classroom for assignment', 500)
      }

      ;(schedules || []).forEach((schedule: any) => {
        if (!schedule.classroom_id) return
        const key = `${schedule.day_of_week_id}|${schedule.time_slot_id}`
        fallbackClassroomMap.set(key, schedule.classroom_id)
      })
    }

    const shiftsToInsert = assignableCoverageRequestShifts

    // Replace any current sub on these shifts: cancel existing active sub_assignments for each
    // coverage_request_shift_id we're assigning to so we never have multiple subs per shift.
    const shiftIdsWeAreAssigning = new Set(shiftsToInsert.map((s: any) => s.id))
    for (const a of existingAssignments || []) {
      const crShiftId = a.coverage_request_shift_id
      if (crShiftId && shiftIdsWeAreAssigning.has(crShiftId)) {
        const { error: replaceErr } = await supabase
          .from('sub_assignments')
          .update({ status: 'cancelled' })
          .eq('id', a.id)
        if (replaceErr) {
          logAssignShiftsError(
            'Error cancelling existing assignment when replacing sub:',
            replaceErr
          )
          return createErrorResponse('Failed to replace existing sub on shift', 500)
        }
      }
    }

    const { actorUserId, actorDisplayName } = await getAuditActorContext()
    const assignments = shiftsToInsert.map((shift: any) => {
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
        is_floater: floaterShiftIds.has(shift.id),
        partial_start_time: null,
        partial_end_time: null,
        notes: null,
        status: 'active', // Default status
        assignment_kind: 'absence_coverage', // Default assignment kind
        non_sub_override: isNonSubOverride,
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
      logAssignShiftsError('Error creating sub_assignments:', {
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
                sub_name: subName ?? undefined,
                teacher_id: teacherId,
                teacher_name: teacherName ?? undefined,
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

    const shiftCount = createdAssignments?.length ?? assignableCoverageRequestShifts.length
    const sortedDates = Array.from(
      new Set(assignableCoverageRequestShifts.map((s: any) => s.date).filter(Boolean))
    ).sort()
    const formatMonthDay = (dateStr: string) => {
      const [y, m, d] = dateStr.split('-').map(Number)
      const date = new Date(y, (m ?? 1) - 1, d ?? 1)
      const month = date.toLocaleString('en-US', { month: 'long' })
      return `${month} ${date.getDate()}`
    }
    const dateLabel =
      sortedDates.length === 0
        ? ''
        : sortedDates.length === 1
          ? formatMonthDay(sortedDates[0])
          : `${formatMonthDay(sortedDates[0])} – ${formatMonthDay(sortedDates[sortedDates.length - 1])}`
    const summary =
      subName && teacherName
        ? `Assigned ${subName} to cover ${shiftCount} shift${shiftCount !== 1 ? 's' : ''} for ${teacherName}${dateLabel ? ` on ${dateLabel}` : ''}${isNonSubOverride ? ' (non-sub override)' : ''}`
        : undefined

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
        sub_name: subName ?? undefined,
        assignee_is_sub: subRecord.is_sub === true,
        non_sub_override: isNonSubOverride,
        teacher_id: teacherId,
        teacher_name: teacherName ?? undefined,
        assignment_ids: (createdAssignments || []).map((assignment: any) => assignment.id),
        shift_ids: uniqueSelectedShiftIds,
        ...(summary ? { summary } : {}),
      },
    })

    return NextResponse.json({
      success: true,
      assignments_created: createdAssignments?.length || 0,
      assignments: createdAssignments,
      non_sub_override: isNonSubOverride,
      assigned_shifts: assignedShiftDetails,
      assigned_count: assignedShiftDetails.length,
    })
  } catch (error) {
    logAssignShiftsError('Error assigning shifts:', error)
    return createErrorResponse(getErrorMessage(error), 500)
  }
}
