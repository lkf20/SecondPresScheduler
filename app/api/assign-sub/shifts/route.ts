import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, getErrorMessage } from '@/lib/utils/errors'
import { getTeacherShiftsForAssignSub } from '@/lib/api/coverage-requests'
import { getSchoolClosuresForDateRange } from '@/lib/api/school-calendar'
import { isSlotClosedOnDate } from '@/lib/utils/school-closures'
import { getUserSchoolId } from '@/lib/utils/auth'

/**
 * POST /api/assign-sub/shifts
 * Get teacher's scheduled shifts for a date range with time-off info.
 * Marks shifts on school-closed days/slots with school_closure: true (show for context, not assignable).
 * Does NOT create a coverage request (aligns with Sub Finder pattern).
 */
export async function POST(request: NextRequest) {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return createErrorResponse(
        new Error('User profile not found or missing school_id'),
        'User profile not found or missing school_id',
        403
      )
    }

    const body = await request.json()
    const { teacher_id, start_date, end_date } = body

    if (!teacher_id || !start_date) {
      return createErrorResponse(
        new Error('Missing required fields: teacher_id, start_date'),
        'Missing required fields: teacher_id, start_date',
        400
      )
    }

    const effectiveEndDate = end_date || start_date

    const rawShifts = await getTeacherShiftsForAssignSub(teacher_id, start_date, effectiveEndDate)
    const schoolClosures = await getSchoolClosuresForDateRange(
      schoolId,
      start_date,
      effectiveEndDate
    )
    const closureList = schoolClosures.map(c => ({ date: c.date, time_slot_id: c.time_slot_id }))

    const shifts = rawShifts.map(shift => ({
      ...shift,
      school_closure: isSlotClosedOnDate(shift.date, shift.time_slot_id, closureList),
    }))

    return NextResponse.json({ shifts })
  } catch (error) {
    console.error('Error fetching assign-sub shifts:', error)
    return createErrorResponse(error, getErrorMessage(error), 500)
  }
}
