import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getAuditActorContext, logAuditEvent } from '@/lib/audit/logAuditEvent'
import { getStaffDisplayName } from '@/lib/utils/staff-display-name'
import { toDateStringISO } from '@/lib/utils/date'
import { reconcileCoverageRequestCounters } from '@/lib/api/coverage-request-counters'

type UnassignScope = 'single' | 'all_for_absence'

type UnassignRequestBody = {
  absence_id?: string
  /** Optional: when absence_id is coverage_request_id, use this to resolve to time_off_request_id */
  coverage_request_id?: string
  sub_id?: string
  scope?: UnassignScope
  assignment_id?: string
  coverage_request_shift_id?: string
}

export async function POST(request: NextRequest) {
  try {
    const isDev = process.env.NODE_ENV !== 'production'
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json(
        {
          error:
            'User profile not found or missing school_id. Please ensure your profile is set up.',
        },
        { status: 403 }
      )
    }

    const body = (await request.json()) as UnassignRequestBody
    const absenceId = body.absence_id ?? body.coverage_request_id
    const subId = body.sub_id
    const scope = body.scope
    const assignmentId = body.assignment_id
    const coverageRequestShiftId = body.coverage_request_shift_id

    if (!absenceId || !subId || (scope !== 'single' && scope !== 'all_for_absence')) {
      return NextResponse.json(
        { error: 'absence_id (or coverage_request_id), sub_id, and scope are required.' },
        { status: 400 }
      )
    }
    if (scope === 'single' && !assignmentId && !coverageRequestShiftId) {
      return NextResponse.json(
        {
          error: 'assignment_id or coverage_request_shift_id is required for single removal.',
        },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Resolve absence_id to time_off_request_id: try as time_off_request first, then as coverage_request
    let timeOffRequestId: string
    const { data: timeOffRequestRow, error: torError } = await supabase
      .from('time_off_requests')
      .select('id, teacher_id, start_date, end_date, school_id')
      .eq('id', absenceId)
      .single()

    if (torError || !timeOffRequestRow) {
      const { data: coverageRow, error: crError } = await supabase
        .from('coverage_requests')
        .select('source_request_id, school_id')
        .eq('id', absenceId)
        .single()

      if (crError || !coverageRow?.source_request_id) {
        return NextResponse.json(
          { error: 'Time off request or coverage request not found.' },
          { status: 404 }
        )
      }
      if (coverageRow.school_id !== schoolId) {
        return NextResponse.json(
          { error: 'You do not have access to this request.' },
          { status: 403 }
        )
      }
      timeOffRequestId = coverageRow.source_request_id
    } else {
      if (timeOffRequestRow.school_id !== schoolId) {
        return NextResponse.json(
          { error: 'You do not have access to this request.' },
          { status: 403 }
        )
      }
      timeOffRequestId = timeOffRequestRow.id
    }

    const { data: timeOffRequest, error: requestError } = await supabase
      .from('time_off_requests')
      .select('id, teacher_id, start_date, end_date, school_id')
      .eq('id', timeOffRequestId)
      .single()

    if (requestError || !timeOffRequest) {
      return NextResponse.json({ error: 'Time off request not found.' }, { status: 404 })
    }
    if (timeOffRequest.school_id !== schoolId) {
      return NextResponse.json(
        { error: 'You do not have access to this request.' },
        { status: 403 }
      )
    }

    const { data: timeOffShifts, error: shiftsError } = await supabase
      .from('time_off_shifts')
      .select('id, date, time_slot_id')
      .eq('time_off_request_id', timeOffRequestId)

    if (shiftsError) {
      console.error('Failed to load time off shifts', shiftsError)
      return NextResponse.json(
        { error: 'Failed to load shifts for this absence.' },
        { status: 500 }
      )
    }

    const timeOffShiftKeys = new Set(
      (timeOffShifts || []).map(shift => `${toDateStringISO(shift.date)}|${shift.time_slot_id}`)
    )
    const timeOffShiftIds = new Set((timeOffShifts || []).map(shift => shift.id))
    const rangeEnd = timeOffRequest.end_date || timeOffRequest.start_date

    const { data: activeAssignments, error: assignmentsError } = await supabase
      .from('sub_assignments')
      .select(
        'id, teacher_id, sub_id, date, time_slot_id, coverage_request_shift_id, status, is_partial'
      )
      .eq('teacher_id', timeOffRequest.teacher_id)
      .eq('sub_id', subId)
      .eq('status', 'active')
      .gte('date', timeOffRequest.start_date)
      .lte('date', rangeEnd)

    if (assignmentsError) {
      console.error('Failed to load active assignments', assignmentsError)
      return NextResponse.json({ error: 'Failed to load active assignments.' }, { status: 500 })
    }

    const matchingAssignments = (activeAssignments || []).filter(assignment => {
      const key = `${toDateStringISO(assignment.date)}|${assignment.time_slot_id}`
      return (
        timeOffShiftKeys.has(key) ||
        (assignment.coverage_request_shift_id
          ? timeOffShiftIds.has(assignment.coverage_request_shift_id)
          : false)
      )
    })

    let assignmentIdsToCancel: string[] = []
    let targetShiftKey: string | null = null
    let targetDate: string | null = null
    let targetTimeSlotId: string | null = null
    let targetCoverageRequestId: string | null = null
    if (scope === 'single') {
      // When coverage_request_shift_id is used (no explicit assignment_id), check for
      // multiple active assignments. If more than one exists, require assignment_id.
      if (!assignmentId && coverageRequestShiftId) {
        const matchingByShift = matchingAssignments.filter(
          a => a.coverage_request_shift_id === coverageRequestShiftId
        )
        if (matchingByShift.length > 1) {
          return NextResponse.json(
            {
              error:
                'Multiple active assignments exist for this shift. Provide assignment_id to specify which one to remove.',
            },
            { status: 400 }
          )
        }
      }

      const target = matchingAssignments.find(assignment => {
        if (assignmentId && assignment.id === assignmentId) return true
        if (
          coverageRequestShiftId &&
          assignment.coverage_request_shift_id === coverageRequestShiftId
        ) {
          return true
        }
        return false
      })
      if (!target) {
        return NextResponse.json(
          { error: 'That assignment is no longer active for this time off request.' },
          { status: 409 }
        )
      }
      targetShiftKey = `${toDateStringISO(target.date)}|${target.time_slot_id}`
      targetDate = target.date
      targetTimeSlotId = target.time_slot_id
      targetCoverageRequestId = target.coverage_request_shift_id
        ? await (async () => {
            const { data } = await supabase
              .from('coverage_request_shifts')
              .select('coverage_request_id')
              .eq('id', target.coverage_request_shift_id)
              .maybeSingle()
            return data?.coverage_request_id ?? null
          })()
        : null
      assignmentIdsToCancel = [target.id]
    } else {
      assignmentIdsToCancel = matchingAssignments.map(assignment => assignment.id)
      if (assignmentIdsToCancel.length === 0) {
        return NextResponse.json(
          { error: 'No active assignments found for this sub on this time off request.' },
          { status: 409 }
        )
      }
    }

    // Track was_partial for audit log before cancellation
    const cancelledAssignments = matchingAssignments.filter(a =>
      assignmentIdsToCancel.includes(a.id)
    )
    const wasPartialFlags = cancelledAssignments.map((a: any) => a.is_partial === true)
    const anyWasPartial = wasPartialFlags.some(Boolean)

    const { error: updateError } = await supabase
      .from('sub_assignments')
      .update({ status: 'cancelled' })
      .in('id', assignmentIdsToCancel)
      .eq('status', 'active')

    if (updateError) {
      console.error('Failed to cancel sub assignments', updateError)
      return NextResponse.json({ error: 'Failed to remove sub assignment(s).' }, { status: 500 })
    }

    // Reconcile covered_shifts and status after cancellation (safety net for trigger edge cases).
    // For 'single' scope we use the coverage_request_id resolved from the target shift.
    // For 'all_for_absence' we resolve it from the time-off request's coverage request.
    const coverageReqIdToReconcile: string | null = (() => {
      if (scope === 'single') return targetCoverageRequestId
      // For all_for_absence, resolve from the time_off_request's linked coverage_request
      return null // resolved below if available
    })()

    if (coverageReqIdToReconcile) {
      try {
        await reconcileCoverageRequestCounters(supabase, coverageReqIdToReconcile)
      } catch (reconcileErr) {
        console.error('Failed to reconcile coverage request counters after unassign:', reconcileErr)
        // Non-fatal: continue
      }
    } else if (scope === 'all_for_absence') {
      // Resolve via time_off_request -> coverage_request
      try {
        const { data: crRow } = await supabase
          .from('coverage_requests')
          .select('id')
          .eq('source_request_id', timeOffRequestId)
          .maybeSingle()
        if (crRow?.id) {
          await reconcileCoverageRequestCounters(supabase, crRow.id)
        }
      } catch (reconcileErr) {
        console.error('Failed to reconcile coverage request counters after unassign:', reconcileErr)
        // Non-fatal: continue
      }
    }

    // Count remaining partials on the target shift (for audit + client)
    let remainingPartialsOnShift = 0
    if (scope === 'single' && targetCoverageRequestId) {
      const targetAssignment = cancelledAssignments[0]
      if (targetAssignment?.coverage_request_shift_id) {
        const { count } = await supabase
          .from('sub_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('coverage_request_shift_id', targetAssignment.coverage_request_shift_id)
          .eq('status', 'active')
          .eq('is_partial', true)
        remainingPartialsOnShift = count ?? 0
      }
    }

    const { data: staffRows } = await supabase
      .from('staff')
      .select('id, first_name, last_name, display_name')
      .in('id', [timeOffRequest.teacher_id, subId])
    const staffById = new Map((staffRows ?? []).map(row => [row.id, row]))
    const teacherName = staffById.has(timeOffRequest.teacher_id)
      ? getStaffDisplayName(staffById.get(timeOffRequest.teacher_id)!)
      : null
    const subName = staffById.has(subId) ? getStaffDisplayName(staffById.get(subId)!) : null

    const { actorUserId, actorDisplayName } = await getAuditActorContext()
    await logAuditEvent({
      schoolId,
      actorUserId,
      actorDisplayName,
      action: 'unassign',
      category: 'sub_assignment',
      entityType: 'time_off_request',
      entityId: timeOffRequestId,
      details: {
        changed_fields: ['sub_assignments'],
        scope,
        sub_id: subId,
        sub_name: subName ?? undefined,
        teacher_id: timeOffRequest.teacher_id,
        teacher_name: teacherName ?? undefined,
        assignment_ids: assignmentIdsToCancel,
        removed_count: assignmentIdsToCancel.length,
        was_partial: anyWasPartial,
        remaining_partials_on_shift: remainingPartialsOnShift,
        time_off_request_id: timeOffRequestId,
        ...(absenceId !== timeOffRequestId && { coverage_request_id: absenceId }),
        target_shift_key: targetShiftKey,
      },
    })

    let remainingActiveOnTargetShift: number | null = null
    if (scope === 'single' && targetDate && targetTimeSlotId) {
      const { count } = await supabase
        .from('sub_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', timeOffRequest.teacher_id)
        .eq('date', targetDate)
        .eq('time_slot_id', targetTimeSlotId)
        .eq('status', 'active')
      remainingActiveOnTargetShift = count ?? 0

      if (isDev && remainingActiveOnTargetShift > 0) {
        const { data: remainingRows } = await supabase
          .from('sub_assignments')
          .select('id, sub_id, coverage_request_shift_id, assignment_kind, assignment_type')
          .eq('teacher_id', timeOffRequest.teacher_id)
          .eq('date', targetDate)
          .eq('time_slot_id', targetTimeSlotId)
          .eq('status', 'active')
          .limit(10)
      }
    }

    return NextResponse.json({
      success: true,
      removed_count: assignmentIdsToCancel.length,
      scope,
      target_shift_key: targetShiftKey,
      remaining_active_on_target_shift: remainingActiveOnTargetShift,
    })
  } catch (error) {
    console.error('Error unassigning sub shifts:', error)
    return NextResponse.json({ error: 'Failed to unassign sub shift(s).' }, { status: 500 })
  }
}
