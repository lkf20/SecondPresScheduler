import { NextRequest, NextResponse } from 'next/server'
import { getTimeOffRequestById, getActiveSubAssignmentsForTimeOffRequest } from '@/lib/api/time-off'
import { getTimeOffShifts } from '@/lib/api/time-off-shifts'
import { createClient } from '@/lib/supabase/server'
import { transformTimeOffCardData } from '@/lib/utils/time-off-card-data'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const requestId = searchParams.get('request_id')

    if (!requestId) {
      return NextResponse.json({ error: 'request_id is required' }, { status: 400 })
    }

    const timeOffRequest = await getTimeOffRequestById(requestId)
    const shifts = await getTimeOffShifts(requestId)
    const timeOffShiftKeys = shifts.map((shift) => `${shift.date}|${shift.time_slot_id}`)

    const assignmentKeys = new Set<string>()
    const assignments: Array<{
      date: string
      time_slot_id: string
      is_partial?: boolean
      assignment_type?: string | null
      sub?: { display_name?: string | null; first_name?: string | null } | null
    }> = []

    if ((timeOffRequest as any)?.coverage_request_id) {
      const coverageAssignments = await getActiveSubAssignmentsForTimeOffRequest(requestId)
      coverageAssignments.forEach((assignment: any) => {
        const coverageShift = assignment.coverage_request_shift
        const shiftDate = coverageShift?.date || assignment.date
        const shiftTimeSlotId = coverageShift?.time_slot_id || assignment.time_slot_id
        if (shiftDate && shiftTimeSlotId) {
          assignmentKeys.add(`${shiftDate}|${shiftTimeSlotId}`)
          assignments.push({
            date: shiftDate,
            time_slot_id: shiftTimeSlotId,
            is_partial: assignment.is_partial,
            assignment_type: assignment.assignment_type || null,
            sub: assignment.sub || null,
          })
        }
      })
    }

    const supabase = await createClient()
    const { data: teacherAssignments } = await supabase
      .from('sub_assignments')
      .select('date, time_slot_id')
      .eq('teacher_id', timeOffRequest.teacher_id)
      .eq('status', 'active')
      .gte('date', timeOffRequest.start_date)
      .lte('date', timeOffRequest.end_date || timeOffRequest.start_date)

    ;(teacherAssignments || []).forEach((assignment) => {
      if (assignment.date && assignment.time_slot_id) {
        const key = `${assignment.date}|${assignment.time_slot_id}`
        if (!assignmentKeys.has(key)) {
          assignmentKeys.add(key)
          assignments.push({
            date: assignment.date,
            time_slot_id: assignment.time_slot_id,
            is_partial: assignment.is_partial,
            assignment_type: assignment.assignment_type || null,
            sub: assignment.sub || null,
          })
        }
      }
    })

    const assignmentKeyList = Array.from(assignmentKeys)
    const overlapKeys = assignmentKeyList.filter((key) => timeOffShiftKeys.includes(key))

    const debugSummary = transformTimeOffCardData(
      {
        id: timeOffRequest.id,
        teacher_id: timeOffRequest.teacher_id,
        start_date: timeOffRequest.start_date,
        end_date: timeOffRequest.end_date,
        reason: timeOffRequest.reason,
        notes: timeOffRequest.notes,
        teacher: (timeOffRequest as any).teacher || null,
      },
      shifts.map((shift) => ({
        id: shift.id,
        date: shift.date,
        day_of_week_id: shift.day_of_week_id,
        time_slot_id: shift.time_slot_id,
        day_of_week: shift.day_of_week,
        time_slot: shift.time_slot,
      })),
      assignments.map((assignment) => ({
        date: assignment.date,
        time_slot_id: assignment.time_slot_id,
        is_partial: assignment.is_partial,
        assignment_type: assignment.assignment_type || null,
        sub: assignment.sub || null,
      })),
      [],
      { includeDetailedShifts: true }
    )

    const debugDetails =
      requestId === '79e63040-e72d-484e-b8bd-6afb639a6874'
        ? {
            shifts: shifts.map((shift) => ({
              date: shift.date,
              time_slot_id: shift.time_slot_id,
              time_slot_code: shift.time_slot?.code || null,
            })),
            assignments: assignmentKeyList.map((key) => {
              const [date, time_slot_id] = key.split('|')
              return { date, time_slot_id }
            }),
          }
        : null

    return NextResponse.json({
      request_id: requestId,
      coverage_request_id: (timeOffRequest as any)?.coverage_request_id || null,
      shifts_count: shifts.length,
      assignments_count: assignmentKeyList.length,
      time_off_shift_keys: timeOffShiftKeys,
      assignment_keys: assignmentKeyList,
      overlap_keys: overlapKeys,
      debug_summary: {
        covered: debugSummary.covered,
        partial: debugSummary.partial,
        uncovered: debugSummary.uncovered,
        total: debugSummary.total,
        shift_details: debugSummary.shift_details,
      },
      debug_details: debugDetails,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load debug data' },
      { status: 500 }
    )
  }
}
