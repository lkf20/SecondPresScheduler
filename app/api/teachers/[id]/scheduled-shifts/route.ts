import { NextRequest, NextResponse } from 'next/server'
import { getTeacherScheduledShifts } from '@/lib/api/time-off-shifts'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getScheduleSettings } from '@/lib/api/schedule-settings'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    console.log('[API /teachers/[id]/scheduled-shifts] Request:', { id, startDate, endDate })

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'start_date and end_date query parameters are required' },
        { status: 400 }
      )
    }

    const schoolId = await getUserSchoolId()
    const scheduleSettings = schoolId ? await getScheduleSettings(schoolId) : null
    const timeZone = scheduleSettings?.time_zone || 'UTC'
    const shifts = await getTeacherScheduledShifts(id, startDate, endDate, timeZone)
    console.log('[API /teachers/[id]/scheduled-shifts] Returning shifts:', shifts.length)
    return NextResponse.json(shifts)
  } catch (error: any) {
    console.error('[API /teachers/[id]/scheduled-shifts] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
