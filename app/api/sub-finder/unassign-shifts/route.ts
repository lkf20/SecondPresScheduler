import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getAuditActorContext, logAuditEvent } from '@/lib/audit/logAuditEvent'

type UnassignScope = 'single' | 'all_for_absence'

type UnassignRequestBody = {
  absence_id?: string
  sub_id?: string
  scope?: UnassignScope
  assignment_id?: string
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
    const absenceId = body.absence_id
    const subId = body.sub_id
    const scope = body.scope
    const assignmentId = body.assignment_id

    if (!absenceId || !subId || (scope !== 'single' && scope !== 'all_for_absence')) {
      return NextResponse.json(
        { error: 'absence_id, sub_id, and scope are required.' },
        { status: 400 }
      )
    }
    if (scope === 'single' && !assignmentId) {
      return NextResponse.json(
        { error: 'assignment_id is required for single removal.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data: timeOffRequest, error: requestError } = await supabase
      .from('time_off_requests')
      .select('id, teacher_id, start_date, end_date, school_id')
      .eq('id', absenceId)
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
      .eq('time_off_request_id', absenceId)

    if (shiftsError) {
      console.error('Failed to load time off shifts', shiftsError)
      return NextResponse.json(
        { error: 'Failed to load shifts for this absence.' },
        { status: 500 }
      )
    }

    const timeOffShiftKeys = new Set(
      (timeOffShifts || []).map(shift => `${shift.date}|${shift.time_slot_id}`)
    )
    const timeOffShiftIds = new Set((timeOffShifts || []).map(shift => shift.id))
    const rangeEnd = timeOffRequest.end_date || timeOffRequest.start_date

    const { data: activeAssignments, error: assignmentsError } = await supabase
      .from('sub_assignments')
      .select('id, teacher_id, sub_id, date, time_slot_id, coverage_request_shift_id, status')
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
      const key = `${assignment.date}|${assignment.time_slot_id}`
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
    if (scope === 'single') {
      const target = matchingAssignments.find(assignment => assignment.id === assignmentId)
      if (!target) {
        return NextResponse.json(
          { error: 'That assignment is no longer active for this time off request.' },
          { status: 409 }
        )
      }
      targetShiftKey = `${target.date}|${target.time_slot_id}`
      targetDate = target.date
      targetTimeSlotId = target.time_slot_id
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

    const { error: updateError } = await supabase
      .from('sub_assignments')
      .update({ status: 'cancelled' })
      .in('id', assignmentIdsToCancel)
      .eq('status', 'active')

    if (updateError) {
      console.error('Failed to cancel sub assignments', updateError)
      return NextResponse.json({ error: 'Failed to remove sub assignment(s).' }, { status: 500 })
    }

    const { actorUserId, actorDisplayName } = await getAuditActorContext()
    await logAuditEvent({
      schoolId,
      actorUserId,
      actorDisplayName,
      action: 'unassign',
      category: 'sub_assignment',
      entityType: 'time_off_request',
      entityId: absenceId,
      details: {
        changed_fields: ['sub_assignments'],
        scope,
        sub_id: subId,
        teacher_id: timeOffRequest.teacher_id,
        assignment_ids: assignmentIdsToCancel,
        removed_count: assignmentIdsToCancel.length,
        time_off_request_id: absenceId,
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

        console.warn('[unassign-shifts Debug] Active assignments remain on target shift', {
          absence_id: absenceId,
          sub_id: subId,
          removed_assignment_id: assignmentId,
          target_shift_key: targetShiftKey,
          remaining_active_on_target_shift: remainingActiveOnTargetShift,
          remaining_assignments: remainingRows || [],
        })
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
