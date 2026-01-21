import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createErrorResponse } from '@/lib/utils/errors'

const toDateString = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const today = new Date()
    const startDate = searchParams.get('start_date') || toDateString(today)
    const endDate = searchParams.get('end_date') || toDateString(addDays(today, 14))

    const supabase = await createClient()

    const { data: timeOffRequests, error: requestsError } = await supabase
      .from('time_off_requests')
      .select('id, teacher_id, start_date, end_date')
      .lte('start_date', endDate)
      .gte('end_date', startDate)

    if (requestsError) {
      return createErrorResponse(requestsError, 'Failed to fetch time off requests', 500)
    }

    const absenceCount = timeOffRequests?.length ?? 0
    if (!timeOffRequests || timeOffRequests.length === 0) {
      return NextResponse.json({
        range: { start_date: startDate, end_date: endDate },
        absences: 0,
        uncovered_shifts: 0,
        partially_covered_shifts: 0,
        scheduled_subs: 0,
      })
    }

    const requestIds = timeOffRequests.map((request) => request.id)
    const teacherIds = Array.from(new Set(timeOffRequests.map((request) => request.teacher_id)))
    const requestTeacherMap = new Map(
      timeOffRequests.map((request) => [request.id, request.teacher_id])
    )

    const { data: timeOffShifts, error: shiftsError } = await supabase
      .from('time_off_shifts')
      .select('id, time_off_request_id, date, time_slot_id')
      .in('time_off_request_id', requestIds)
      .gte('date', startDate)
      .lte('date', endDate)

    if (shiftsError) {
      return createErrorResponse(shiftsError, 'Failed to fetch time off shifts', 500)
    }

    const { data: subAssignments, error: assignmentsError } = await supabase
      .from('sub_assignments')
      .select('id, teacher_id, date, time_slot_id, is_partial')
      .in('teacher_id', teacherIds)
      .gte('date', startDate)
      .lte('date', endDate)

    if (assignmentsError) {
      return createErrorResponse(assignmentsError, 'Failed to fetch sub assignments', 500)
    }

    const assignmentMap = new Map<
      string,
      { hasFull: boolean; hasPartial: boolean; assignmentIds: Set<string> }
    >()

    ;(subAssignments || []).forEach((assignment) => {
      const key = `${assignment.teacher_id}|${assignment.date}|${assignment.time_slot_id}`
      if (!assignmentMap.has(key)) {
        assignmentMap.set(key, {
          hasFull: false,
          hasPartial: false,
          assignmentIds: new Set<string>(),
        })
      }
      const entry = assignmentMap.get(key)
      if (!entry) return
      entry.assignmentIds.add(assignment.id)
      if (assignment.is_partial) {
        entry.hasPartial = true
      } else {
        entry.hasFull = true
      }
    })

    let uncoveredCount = 0
    let partiallyCoveredCount = 0
    const scheduledAssignments = new Set<string>()

    ;(timeOffShifts || []).forEach((shift) => {
      const teacherId = requestTeacherMap.get(shift.time_off_request_id)
      if (!teacherId) return
      const key = `${teacherId}|${shift.date}|${shift.time_slot_id}`
      const entry = assignmentMap.get(key)

      if (!entry) {
        uncoveredCount += 1
        return
      }

      entry.assignmentIds.forEach((id) => scheduledAssignments.add(id))

      if (entry.hasFull) {
        return
      }

      if (entry.hasPartial) {
        partiallyCoveredCount += 1
        return
      }

      uncoveredCount += 1
    })

    return NextResponse.json({
      range: { start_date: startDate, end_date: endDate },
      absences: absenceCount,
      uncovered_shifts: uncoveredCount,
      partially_covered_shifts: partiallyCoveredCount,
      scheduled_subs: scheduledAssignments.size,
    })
  } catch (error) {
    return createErrorResponse(error, 'Failed to build dashboard summary', 500)
  }
}
