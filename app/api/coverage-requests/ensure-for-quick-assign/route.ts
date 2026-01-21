import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, getErrorMessage } from '@/lib/utils/errors'
import { ensureCoverageRequestForQuickAssign } from '@/lib/api/coverage-requests'

/**
 * POST /api/coverage-requests/ensure-for-quick-assign
 * Ensure a coverage request exists for quick assign
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { teacher_id, start_date, end_date } = body


    if (!teacher_id || !start_date) {
      return createErrorResponse(new Error('Missing required fields: teacher_id, start_date'), 'Missing required fields: teacher_id, start_date', 400)
    }

    // Default end_date to start_date if not provided
    const effectiveEndDate = end_date || start_date


    const result = await ensureCoverageRequestForQuickAssign(
      teacher_id,
      start_date,
      effectiveEndDate
    )


    return NextResponse.json(result)
  } catch (error) {
    console.error('Error ensuring coverage request:', error)
    return createErrorResponse(error, getErrorMessage(error), 500)
  }
}
