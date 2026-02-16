import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import { expandDateRangeWithTimeZone, parseLocalDate } from '@/lib/utils/date'
import { getScheduleSettings } from '@/lib/api/schedule-settings'

type FlexAssignmentPayload = {
  staff_id: string
  start_date: string
  end_date: string
  classroom_ids: string[]
  time_slot_ids: string[]
  day_of_week_ids?: string[]
  notes?: string | null
  shifts?: Array<{
    date: string
    time_slot_id: string
    classroom_id: string
  }>
}

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function POST(request: NextRequest) {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json({ error: 'Missing school context.' }, { status: 403 })
    }

    const body = (await request.json()) as FlexAssignmentPayload
    const {
      staff_id,
      start_date,
      end_date,
      classroom_ids,
      time_slot_ids,
      day_of_week_ids,
      notes,
      shifts,
    } = body

    if (!staff_id || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'staff_id, start_date, end_date are required.' },
        { status: 400 }
      )
    }
    if (!Array.isArray(classroom_ids) || classroom_ids.length === 0) {
      return NextResponse.json({ error: 'classroom_ids is required.' }, { status: 400 })
    }
    if (!Array.isArray(time_slot_ids) || time_slot_ids.length === 0) {
      return NextResponse.json({ error: 'time_slot_ids is required.' }, { status: 400 })
    }

    const startDate = parseLocalDate(start_date)
    const endDate = parseLocalDate(end_date)
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid start_date or end_date.' }, { status: 400 })
    }
    if (startDate > endDate) {
      return NextResponse.json({ error: 'start_date must be before end_date.' }, { status: 400 })
    }

    if (classroom_ids.length === 0 || time_slot_ids.length === 0) {
      return NextResponse.json(
        { error: 'At least one classroom and time slot is required.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const scheduleSettings = await getScheduleSettings(schoolId)
    const timeZone = scheduleSettings?.time_zone || 'UTC'

    const { data: daysOfWeekRows, error: daysError } = await supabase
      .from('days_of_week')
      .select('id, day_number')

    if (daysError) {
      return NextResponse.json({ error: daysError.message }, { status: 500 })
    }

    const dayNumberToId = new Map<number, string>()
    ;(daysOfWeekRows || []).forEach(row => {
      if (typeof row.day_number === 'number') {
        dayNumberToId.set(row.day_number, row.id)
      }
    })

    const selectedDayIds = Array.isArray(day_of_week_ids) ? new Set(day_of_week_ids) : null

    const { data: eventRow, error: eventError } = await supabase
      .from('staffing_events')
      .insert({
        school_id: schoolId,
        event_type: 'flex_assignment',
        staff_id,
        start_date,
        end_date,
        notes: notes ?? null,
        status: 'active',
      })
      .select('id')
      .single()

    if (eventError || !eventRow) {
      return NextResponse.json(
        { error: eventError?.message || 'Failed to create event.' },
        { status: 500 }
      )
    }

    const shiftRows: Array<{
      school_id: string
      staffing_event_id: string
      staff_id: string
      date: string
      day_of_week_id: string | null
      time_slot_id: string
      classroom_id: string
      status: 'active'
    }> = []

    if (Array.isArray(shifts) && shifts.length > 0) {
      for (const shift of shifts) {
        const shiftDate = parseLocalDate(shift.date)
        if (Number.isNaN(shiftDate.getTime())) continue
        const dayNumber = shiftDate.getDay()
        const normalizedDayNumber = dayNumber === 0 ? 7 : dayNumber
        const dayOfWeekId = dayNumberToId.get(normalizedDayNumber) ?? null
        shiftRows.push({
          school_id: schoolId,
          staffing_event_id: eventRow.id,
          staff_id,
          date: shift.date,
          day_of_week_id: dayOfWeekId,
          time_slot_id: shift.time_slot_id,
          classroom_id: shift.classroom_id,
          status: 'active',
        })
      }
    } else {
      const dates = expandDateRangeWithTimeZone(start_date, end_date, timeZone)
      for (const entry of dates) {
        const dayOfWeekId = dayNumberToId.get(entry.day_number) ?? null
        if (!selectedDayIds || (dayOfWeekId && selectedDayIds.has(dayOfWeekId))) {
          for (const timeSlotId of time_slot_ids) {
            for (const classroomId of classroom_ids) {
              shiftRows.push({
                school_id: schoolId,
                staffing_event_id: eventRow.id,
                staff_id,
                date: entry.date,
                day_of_week_id: dayOfWeekId,
                time_slot_id: timeSlotId,
                classroom_id: classroomId,
                status: 'active',
              })
            }
          }
        }
      }
    }

    if (shiftRows.length === 0) {
      return NextResponse.json(
        { error: 'No shifts matched the selected filters.' },
        { status: 400 }
      )
    }

    const { error: shiftsError } = await supabase.from('staffing_event_shifts').insert(shiftRows)

    if (shiftsError) {
      if (shiftsError.code === '23505') {
        return NextResponse.json(
          {
            error:
              'Flex assignment conflicts with an existing active assignment for this staff member.',
          },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: shiftsError.message }, { status: 500 })
    }

    return NextResponse.json({
      id: eventRow.id,
      shift_count: shiftRows.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
