import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getScheduleSnapshotData } from '@/lib/api/weekly-schedule'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getScheduleSettings } from '@/lib/api/schedule-settings'
import { expandDateRangeWithTimeZone } from '@/lib/utils/date'

const parseDateParam = (value: string | null) => {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(value + 'T00:00:00')
  if (Number.isNaN(date.getTime())) return null
  return date
}

export async function GET(request: Request) {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json(
        {
          error:
            'User profile not found or missing school_id. Please ensure your profile is set up.',
        },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const date = parseDateParam(dateParam)

    if (!date || !dateParam) {
      return NextResponse.json({ error: 'Missing or invalid date parameter.' }, { status: 400 })
    }

    const scheduleSettings = await getScheduleSettings(schoolId)
    const timeZone = scheduleSettings?.time_zone || 'UTC'
    const expanded = expandDateRangeWithTimeZone(dateParam, dateParam, timeZone)
    const dayNumber = expanded[0]?.day_number
    if (!dayNumber) {
      return NextResponse.json(
        { error: 'Unable to resolve day of week for date.' },
        { status: 500 }
      )
    }
    const supabase = await createClient()
    const dayNumberCandidates = dayNumber === 0 ? [0, 7] : [dayNumber]
    const { data: daysData, error: daysError } = await supabase
      .from('days_of_week')
      .select('id, name, day_number')
      .in('day_number', dayNumberCandidates)

    if (daysError || !daysData || daysData.length === 0) {
      return NextResponse.json(
        { error: 'Unable to resolve day of week for date.' },
        { status: 500 }
      )
    }

    const day = daysData[0]

    const data = await getScheduleSnapshotData({
      schoolId,
      selectedDayIds: [day.id],
      startDateISO: dateParam,
      endDateISO: dateParam,
    })

    return NextResponse.json({
      date: dateParam,
      day_of_week_id: day.id,
      day_name: day.name,
      data,
    })
  } catch (error: any) {
    console.error('Error fetching daily schedule:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      {
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
