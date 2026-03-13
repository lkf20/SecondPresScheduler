import { NextRequest, NextResponse } from 'next/server'
import { getTeacherScheduledShifts } from '@/lib/api/time-off-shifts'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getScheduleSettings } from '@/lib/api/schedule-settings'
import { getSchoolClosuresForDateRange } from '@/lib/api/school-calendar'
import { isSlotClosedOnDate } from '@/lib/utils/school-closures'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'start_date and end_date query parameters are required' },
        { status: 400 }
      )
    }

    const schoolId = await getUserSchoolId()
    const scheduleSettings = schoolId ? await getScheduleSettings(schoolId) : null
    const timeZone = scheduleSettings?.time_zone || 'UTC'
    const rawShifts = await getTeacherScheduledShifts(id, startDate, endDate, timeZone)

    const closureList =
      schoolId != null
        ? (await getSchoolClosuresForDateRange(schoolId, startDate, endDate)).map(c => ({
            date: c.date,
            time_slot_id: c.time_slot_id,
          }))
        : []
    const closures = closureList

    const shifts = rawShifts.map(shift => ({
      ...shift,
      school_closure: isSlotClosedOnDate(shift.date, shift.time_slot_id, closures),
    }))

    return NextResponse.json(shifts)
  } catch (error: any) {
    console.error('[API /teachers/[id]/scheduled-shifts] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
