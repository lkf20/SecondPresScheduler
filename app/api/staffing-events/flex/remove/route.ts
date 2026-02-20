import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'

type RemoveScope = 'single_shift' | 'weekday' | 'all_shifts'

export async function GET(request: NextRequest) {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json({ error: 'Missing school context.' }, { status: 403 })
    }

    const eventId = request.nextUrl.searchParams.get('event_id')
    const classroomId = request.nextUrl.searchParams.get('classroom_id')
    const timeSlotId = request.nextUrl.searchParams.get('time_slot_id')

    if (!eventId) {
      return NextResponse.json({ error: 'event_id is required.' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: eventRow, error: eventError } = await supabase
      .from('staffing_events')
      .select('id, staff_id, start_date, end_date')
      .eq('id', eventId)
      .eq('school_id', schoolId)
      .maybeSingle()

    if (eventError) {
      return NextResponse.json({ error: eventError.message }, { status: 500 })
    }
    if (!eventRow) {
      return NextResponse.json({ error: 'Flex assignment not found.' }, { status: 404 })
    }

    let shiftsQuery = supabase
      .from('staffing_event_shifts')
      .select('day_of_week_id')
      .eq('school_id', schoolId)
      .eq('staffing_event_id', eventId)
      .eq('status', 'active')

    if (classroomId) {
      shiftsQuery = shiftsQuery.eq('classroom_id', classroomId)
    }
    if (timeSlotId) {
      shiftsQuery = shiftsQuery.eq('time_slot_id', timeSlotId)
    }

    const { data: shiftRows, error: shiftsError } = await shiftsQuery
    if (shiftsError) {
      return NextResponse.json({ error: shiftsError.message }, { status: 500 })
    }

    const uniqueDayIds = Array.from(
      new Set((shiftRows || []).map(row => row.day_of_week_id).filter(Boolean))
    ) as string[]

    let weekdays: string[] = []
    if (uniqueDayIds.length > 0) {
      const { data: dayRows, error: dayError } = await supabase
        .from('days_of_week')
        .select('id, name, day_number')
        .in('id', uniqueDayIds)
        .order('day_number', { ascending: true })

      if (dayError) {
        return NextResponse.json({ error: dayError.message }, { status: 500 })
      }

      weekdays = (dayRows || []).map(row => row.name)
    }

    return NextResponse.json({
      start_date: eventRow.start_date,
      end_date: eventRow.end_date,
      weekdays,
      matching_shift_count: (shiftRows || []).length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json({ error: 'Missing school context.' }, { status: 403 })
    }

    const body = (await request.json()) as {
      event_id?: string
      scope?: RemoveScope
      date?: string
      day_of_week_id?: string
      classroom_id?: string
      time_slot_id?: string
    }

    const eventId = body.event_id
    const scope = body.scope
    const date = body.date
    const dayOfWeekId = body.day_of_week_id
    const classroomId = body.classroom_id
    const timeSlotId = body.time_slot_id

    if (!eventId || !scope) {
      return NextResponse.json({ error: 'event_id and scope are required.' }, { status: 400 })
    }

    if ((scope === 'single_shift' || scope === 'weekday') && (!classroomId || !timeSlotId)) {
      return NextResponse.json(
        { error: 'classroom_id and time_slot_id are required for this scope.' },
        { status: 400 }
      )
    }

    if (scope === 'single_shift' && !date) {
      return NextResponse.json({ error: 'date is required for single_shift.' }, { status: 400 })
    }

    if (scope === 'weekday' && !dayOfWeekId) {
      return NextResponse.json(
        { error: 'day_of_week_id is required for weekday scope.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data: eventRow, error: eventError } = await supabase
      .from('staffing_events')
      .select('id')
      .eq('id', eventId)
      .eq('school_id', schoolId)
      .maybeSingle()

    if (eventError) {
      return NextResponse.json({ error: eventError.message }, { status: 500 })
    }
    if (!eventRow) {
      return NextResponse.json({ error: 'Flex assignment not found.' }, { status: 404 })
    }

    let cancelQuery = supabase
      .from('staffing_event_shifts')
      .update({ status: 'cancelled' })
      .eq('school_id', schoolId)
      .eq('staffing_event_id', eventId)
      .eq('status', 'active')

    if (scope === 'single_shift') {
      cancelQuery = cancelQuery
        .eq('date', date!)
        .eq('classroom_id', classroomId!)
        .eq('time_slot_id', timeSlotId!)
    }

    if (scope === 'weekday') {
      cancelQuery = cancelQuery
        .eq('day_of_week_id', dayOfWeekId!)
        .eq('classroom_id', classroomId!)
        .eq('time_slot_id', timeSlotId!)
    }

    const { data: cancelledRows, error: cancelError } = await cancelQuery.select('id')

    if (cancelError) {
      return NextResponse.json({ error: cancelError.message }, { status: 500 })
    }

    if (!cancelledRows || cancelledRows.length === 0) {
      return NextResponse.json(
        { error: 'No matching active shifts were found to remove.' },
        { status: 404 }
      )
    }

    const { count: activeShiftCount, error: remainingError } = await supabase
      .from('staffing_event_shifts')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('staffing_event_id', eventId)
      .eq('status', 'active')

    if (remainingError) {
      return NextResponse.json({ error: remainingError.message }, { status: 500 })
    }

    if ((activeShiftCount || 0) === 0) {
      const { error: eventCancelError } = await supabase
        .from('staffing_events')
        .update({ status: 'cancelled' })
        .eq('id', eventId)
        .eq('school_id', schoolId)

      if (eventCancelError) {
        return NextResponse.json({ error: eventCancelError.message }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      removed_count: cancelledRows.length,
      remaining_active_shifts: activeShiftCount || 0,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
