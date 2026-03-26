import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTimeOffRequestById } from '@/lib/api/time-off'
import { createErrorResponse, getErrorMessage } from '@/lib/utils/errors'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getSchoolClosuresForDateRange } from '@/lib/api/school-calendar'
import { isSlotClosedOnDate } from '@/lib/utils/school-closures'
import { toDateStringISO } from '@/lib/utils/date'

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
    const requestStartDate = toDateStringISO((timeOffRequest as any).start_date)
    const requestEndDate = toDateStringISO(
      (timeOffRequest as any).end_date || (timeOffRequest as any).start_date
    )
    const isWithinRequestRange = (date: string) => {
      const dateISO = toDateStringISO(date)
      if (!requestStartDate || !requestEndDate) return true
      return dateISO >= requestStartDate && dateISO <= requestEndDate
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
      .select(
        'id, date, time_slot_id, classroom_id, time_slots:time_slot_id(code), classrooms(name)'
      )
      .eq('coverage_request_id', coverageRequestId)
      .eq('status', 'active')

    if (shiftsError) {
      console.error('Error fetching coverage_request_shifts:', shiftsError)
      return createErrorResponse('Failed to fetch coverage request shifts', 500)
    }

    const coverageRequestShiftsInRange = (coverageRequestShifts || []).filter((shift: any) =>
      isWithinRequestRange(shift.date)
    )

    if (coverageRequestShiftsInRange.length === 0) {
      return NextResponse.json({
        assigned_shifts: [],
        remaining_shift_keys: [],
        remaining_shift_count: 0,
        total_shifts: 0,
      })
    }

    // Exclude shifts on school closed days (e.g. snow day added after assignment)
    const dateRangeStart = coverageRequestShiftsInRange.reduce(
      (min: string, s: any) => (s.date && (!min || s.date < min) ? s.date : min),
      ''
    )
    const dateRangeEnd = coverageRequestShiftsInRange.reduce(
      (max: string, s: any) => (s.date && (!max || s.date > max) ? s.date : max),
      ''
    )
    const schoolId = await getUserSchoolId()
    const schoolClosures =
      schoolId && dateRangeStart && dateRangeEnd
        ? await getSchoolClosuresForDateRange(schoolId, dateRangeStart, dateRangeEnd)
        : []
    const closureList = schoolClosures.map(c => ({ date: c.date, time_slot_id: c.time_slot_id }))
    const openShifts =
      closureList.length > 0
        ? coverageRequestShiftsInRange.filter(
            (s: any) => !isSlotClosedOnDate(toDateStringISO(s.date), s.time_slot_id, closureList)
          )
        : coverageRequestShiftsInRange

    const buildCoverageShiftKey = (shift: {
      id?: string
      date: string
      time_slots?: { code?: string | null } | null
      classroom_id?: string | null
    }) => {
      const timeSlotCode = shift.time_slots?.code || ''
      const classroomToken = (shift.classroom_id || '').trim()
      return classroomToken
        ? `${shift.date}|${timeSlotCode}|${classroomToken}`
        : `${shift.date}|${timeSlotCode}|shift:${shift.id || ''}`
    }

    const coverageShiftRows = openShifts.map((shift: any) => ({
      key: buildCoverageShiftKey(shift),
      simpleKey: `${shift.date}|${shift.time_slots?.code || ''}`,
      simpleIdKey: `${shift.date}|${shift.time_slot_id || ''}`,
      time_slot_id: shift.time_slot_id ?? null,
      classroom_id: shift.classroom_id ?? null,
      classroom_name: Array.isArray(shift.classrooms)
        ? (shift.classrooms[0]?.name ?? null)
        : (shift.classrooms?.name ?? null),
      date: shift.date as string,
      time_slot_code: shift.time_slots?.code || '',
    }))
    const coverageShiftKeySet = new Set(coverageShiftRows.map(s => s.key))
    const coverageRowsBySimpleKey = new Map<string, typeof coverageShiftRows>()
    coverageShiftRows.forEach(row => {
      if (!coverageRowsBySimpleKey.has(row.simpleKey)) {
        coverageRowsBySimpleKey.set(row.simpleKey, [])
      }
      coverageRowsBySimpleKey.get(row.simpleKey)!.push(row)
    })
    const coverageRowsBySimpleIdKey = new Map<string, typeof coverageShiftRows>()
    coverageShiftRows.forEach(row => {
      if (!coverageRowsBySimpleIdKey.has(row.simpleIdKey)) {
        coverageRowsBySimpleIdKey.set(row.simpleIdKey, [])
      }
      coverageRowsBySimpleIdKey.get(row.simpleIdKey)!.push(row)
    })

    // Get all sub_assignments for this teacher that match the coverage request shifts
    const { data: subAssignments, error: assignmentsError } = await supabase
      .from('sub_assignments')
      .select(
        `
        date,
        time_slot_id,
        classroom_id,
        classrooms(name),
        time_slots:time_slots(code),
        days_of_week:day_of_week_id(name)
      `
      )
      .eq('teacher_id', coverageRequest.teacher_id)
      .eq('assignment_type', 'Substitute Shift')
      .eq('status', 'active')

    if (assignmentsError) {
      console.error('Error fetching sub_assignments:', assignmentsError)
      return createErrorResponse('Failed to fetch assigned shifts', 500)
    }

    // Filter sub_assignments to only include those that match coverage_request_shifts (and are not on closed days)
    const matchingAssignments = (subAssignments || [])
      .map((assignment: any) => {
        const timeSlotCode = assignment.time_slots?.code || ''
        const classroomToken = (assignment.classroom_id || '').trim()
        const detailedKey = classroomToken
          ? `${assignment.date}|${timeSlotCode}|${classroomToken}`
          : `${assignment.date}|${timeSlotCode}|shift:`
        const simpleKey = `${assignment.date}|${timeSlotCode}`
        const simpleIdKey = `${assignment.date}|${assignment.time_slot_id || ''}`
        const exactMatch = coverageShiftKeySet.has(detailedKey)
        if (exactMatch) {
          return { assignment, matchedKey: detailedKey }
        }
        if (assignment.time_slot_id) {
          const idCandidates = coverageRowsBySimpleIdKey.get(simpleIdKey) || []
          if (classroomToken) {
            const idExact = idCandidates.find(row => row.classroom_id === classroomToken)
            if (idExact) return { assignment, matchedKey: idExact.key }
          }
          if (idCandidates.length === 1) {
            return { assignment, matchedKey: idCandidates[0].key }
          }
        }
        const simpleCandidates = coverageRowsBySimpleKey.get(simpleKey) || []
        if (classroomToken) {
          const simpleExact = simpleCandidates.find(row => row.classroom_id === classroomToken)
          if (simpleExact) return { assignment, matchedKey: simpleExact.key }
        }
        if (simpleCandidates.length === 1) {
          return { assignment, matchedKey: simpleCandidates[0].key }
        }
        return null
      })
      .filter(
        (
          value
        ): value is {
          assignment: any
          matchedKey: string
        } => Boolean(value)
      )

    // Format the assigned shifts
    const assignedShifts = matchingAssignments.map(({ assignment }) => ({
      date: assignment.date,
      time_slot_code: assignment.time_slots?.code || '',
      day_name: assignment.days_of_week?.name || '',
      classroom_id: assignment.classroom_id ?? null,
      classroom_name: Array.isArray(assignment.classrooms)
        ? (assignment.classrooms[0]?.name ?? null)
        : (assignment.classrooms?.name ?? null),
    }))
    const assignedShiftKeys = new Set(matchingAssignments.map(({ matchedKey }) => matchedKey))
    const remainingShiftKeys = coverageShiftRows
      .map(shift => shift.key)
      .filter(key => !assignedShiftKeys.has(key))

    return NextResponse.json({
      assigned_shifts: assignedShifts,
      remaining_shift_keys: remainingShiftKeys,
      remaining_shift_count: remainingShiftKeys.length,
      total_shifts: coverageShiftRows.length,
    })
  } catch (error) {
    console.error('Error fetching assigned shifts:', error)
    return createErrorResponse(getErrorMessage(error), 500)
  }
}
