import { NextRequest, NextResponse } from 'next/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import {
  getCalendarSettings,
  updateCalendarSettings,
  getSchoolClosuresForDateRange,
  createSchoolClosure,
  createSchoolClosureRange,
  deleteSchoolClosure,
} from '@/lib/api/school-calendar'

/**
 * GET /api/settings/calendar
 * Returns calendar settings (first_day_of_school, last_day_of_school) and optionally
 * school closures for a date range (query params: startDate, endDate).
 */
export async function GET(request: NextRequest) {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json(
        { error: 'User profile not found or missing school_id.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const [settings, closures] = await Promise.all([
      getCalendarSettings(schoolId),
      startDate && endDate
        ? getSchoolClosuresForDateRange(schoolId, startDate, endDate)
        : Promise.resolve([]),
    ])

    return NextResponse.json({
      first_day_of_school: settings?.first_day_of_school ?? null,
      last_day_of_school: settings?.last_day_of_school ?? null,
      school_closures: closures,
    })
  } catch (error: unknown) {
    console.error('Error fetching calendar settings:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch calendar settings' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/settings/calendar
 * Updates calendar settings and/or manages school closures.
 * Body: { first_day_of_school?, last_day_of_school?, add_closure?, delete_closure_ids? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json(
        { error: 'User profile not found or missing school_id.' },
        { status: 403 }
      )
    }

    const body = await request.json()

    if (body.first_day_of_school !== undefined || body.last_day_of_school !== undefined) {
      await updateCalendarSettings(schoolId, {
        first_day_of_school: body.first_day_of_school,
        last_day_of_school: body.last_day_of_school,
      })
    }

    if (Array.isArray(body.delete_closure_ids) && body.delete_closure_ids.length > 0) {
      await Promise.all(
        body.delete_closure_ids.map((id: string) => deleteSchoolClosure(schoolId, id))
      )
    }

    if (body.add_closure && typeof body.add_closure === 'object') {
      const { date, start_date, end_date, time_slot_id, reason } = body.add_closure
      if (start_date != null && end_date != null) {
        if (typeof start_date !== 'string' || typeof end_date !== 'string') {
          return NextResponse.json(
            { error: 'add_closure.start_date and end_date must be strings (YYYY-MM-DD)' },
            { status: 400 }
          )
        }
        if (start_date > end_date) {
          return NextResponse.json(
            { error: 'add_closure.start_date must be on or before end_date' },
            { status: 400 }
          )
        }
        const start = new Date(start_date + 'T12:00:00')
        const end = new Date(end_date + 'T12:00:00')
        const days = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
        if (days > 365) {
          return NextResponse.json({ error: 'Date range cannot exceed 365 days' }, { status: 400 })
        }
        await createSchoolClosureRange(schoolId, start_date, end_date, reason ?? null)
      } else {
        if (!date || typeof date !== 'string') {
          return NextResponse.json({ error: 'add_closure.date is required' }, { status: 400 })
        }
        await createSchoolClosure(schoolId, {
          date,
          time_slot_id: time_slot_id ?? null,
          reason: reason ?? null,
        })
      }
    }

    const [settings, closures] = await Promise.all([
      getCalendarSettings(schoolId),
      getSchoolClosuresForDateRange(
        schoolId,
        new Date().toISOString().slice(0, 10),
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      ),
    ])

    return NextResponse.json({
      first_day_of_school: settings?.first_day_of_school ?? null,
      last_day_of_school: settings?.last_day_of_school ?? null,
      school_closures: closures,
    })
  } catch (error: unknown) {
    console.error('Error updating calendar settings:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update calendar settings' },
      { status: 500 }
    )
  }
}
