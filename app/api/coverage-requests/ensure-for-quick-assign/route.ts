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

    console.log('[API ensure-for-quick-assign] Received request:', { teacher_id, start_date, end_date })

    if (!teacher_id || !start_date) {
      return createErrorResponse('Missing required fields: teacher_id, start_date', 400)
    }

    // Default end_date to start_date if not provided
    const effectiveEndDate = end_date || start_date

    console.log('[API ensure-for-quick-assign] Calling ensureCoverageRequestForQuickAssign with:', {
      teacher_id,
      start_date,
      effectiveEndDate,
    })

    const result = await ensureCoverageRequestForQuickAssign(
      teacher_id,
      start_date,
      effectiveEndDate
    )

    console.log('[API ensure-for-quick-assign] Result:', {
      coverage_request_id: result.coverage_request_id,
      shifts_count: result.coverage_request_shifts.length,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error ensuring coverage request:', error)
    return createErrorResponse(getErrorMessage(error), 500)
  }
}
