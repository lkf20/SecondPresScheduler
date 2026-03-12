import { NextRequest, NextResponse } from 'next/server'
import { getTeacherTimeOffShifts } from '@/lib/api/time-off-shifts'

// Always run on demand so shift table sees latest time_off_shifts after edits
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const teacherId = searchParams.get('teacher_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const excludeRequestId = searchParams.get('exclude_request_id') || undefined

    if (!teacherId || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 })
    }

    const shifts = await getTeacherTimeOffShifts(teacherId, startDate, endDate, excludeRequestId)

    return NextResponse.json({ shifts }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
