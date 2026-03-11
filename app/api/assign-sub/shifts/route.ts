import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, getErrorMessage } from '@/lib/utils/errors'
import { getTeacherShiftsForAssignSub } from '@/lib/api/coverage-requests'

/**
 * POST /api/assign-sub/shifts
 * Get teacher's scheduled shifts for a date range with time-off info.
 * Does NOT create a coverage request (aligns with Sub Finder pattern).
 */
export async function POST(request: NextRequest) {
  try {
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

    const shifts = await getTeacherShiftsForAssignSub(teacher_id, start_date, effectiveEndDate)

    return NextResponse.json({ shifts })
  } catch (error) {
    console.error('Error fetching assign-sub shifts:', error)
    return createErrorResponse(error, getErrorMessage(error), 500)
  }
}
