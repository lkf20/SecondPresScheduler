import { NextResponse } from 'next/server'
import { getScheduleSnapshotData } from '@/lib/api/weekly-schedule'
import { getSchoolClosuresForDateRange } from '@/lib/api/school-calendar'
import { getUserSchoolId } from '@/lib/utils/auth'
import { filterActiveDailyScheduleData, resolveDailyScheduleDay } from '@/lib/api/daily-schedule'

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

    const dayResolution = await resolveDailyScheduleDay(schoolId, dateParam, date)
    if (dayResolution.noSchedule) {
      return NextResponse.json({
        date: dateParam,
        day_of_week_id: null,
        day_name: null,
        data: [],
        school_closures: [],
        no_schedule: true,
        no_schedule_message: dayResolution.message,
        next_scheduled_date: dayResolution.nextScheduledDate,
        next_scheduled_day_name: dayResolution.nextScheduledDayName,
      })
    }

    const [data, schoolClosures] = await Promise.all([
      getScheduleSnapshotData({
        schoolId,
        selectedDayIds: [dayResolution.dayId],
        startDateISO: dateParam,
        endDateISO: dateParam,
      }),
      getSchoolClosuresForDateRange(schoolId, dateParam, dateParam),
    ])

    const filteredData = filterActiveDailyScheduleData(data || [])

    return NextResponse.json({
      date: dateParam,
      day_of_week_id: dayResolution.dayId,
      day_name: dayResolution.dayName,
      data: filteredData,
      school_closures: schoolClosures,
      no_schedule: false,
    })
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error fetching daily schedule:', error)
    }
    return NextResponse.json(
      {
        error: error?.message || 'Failed to fetch daily schedule.',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
