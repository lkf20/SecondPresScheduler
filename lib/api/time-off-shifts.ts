import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type TimeOffShift = Database['public']['Tables']['time_off_shifts']['Row']
type DayOfWeek = Database['public']['Tables']['days_of_week']['Row']
type TimeSlot = Database['public']['Tables']['time_slots']['Row']
type SubAssignment = Database['public']['Tables']['sub_assignments']['Row']

export type TimeOffShiftWithDetails = TimeOffShift & {
  time_slot: TimeSlot | null
  day_of_week: DayOfWeek | null
}

type TeacherScheduleEntry = {
  day_of_week_id: string
  time_slot_id: string
  days_of_week: { name: string | null; day_number: number | null } | null
  time_slots: { code: string | null; name: string | null } | null
}

type TeacherScheduleRow = {
  day_of_week_id: string | null
  time_slot_id: string | null
  days_of_week:
    | { name?: string | null; day_number?: number | null }
    | Array<{ name?: string | null; day_number?: number | null }>
    | null
  time_slots:
    | { code?: string | null; name?: string | null }
    | Array<{ code?: string | null; name?: string | null }>
    | null
}

type TimeOffRequestSummary = {
  id: string
  start_date: string
  end_date: string | null
  reason: string | null
  teacher_id: string
}

type TimeOffShiftRow = {
  date: string
  time_slot_id: string
  time_off_request_id: string
  time_off_requests: TimeOffRequestSummary | TimeOffRequestSummary[] | null
}

type TimeOffShiftWithRequest = {
  date: string
  time_slot_id: string
  time_off_request_id: string
  time_off_requests: TimeOffRequestSummary | null
}

export async function getTimeOffShifts(requestId: string): Promise<TimeOffShiftWithDetails[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('time_off_shifts')
    .select('*, time_slot:time_slots(*), day_of_week:days_of_week(*)')
    .eq('time_off_request_id', requestId)
    .order('date', { ascending: true })
    .order('time_slot_id', { ascending: true })

  if (error) throw error
  return (data || []) as TimeOffShiftWithDetails[]
}

export async function createTimeOffShifts(
  requestId: string,
  shifts: Array<{
    date: string
    day_of_week_id: string
    time_slot_id: string
    is_partial?: boolean
    start_time?: string | null
    end_time?: string | null
  }>
) {
  const supabase = await createClient()
  const { data: timeOffRequest, error: timeOffError } = await supabase
    .from('time_off_requests')
    .select('school_id')
    .eq('id', requestId)
    .single()

  if (timeOffError) throw timeOffError
  const schoolId = timeOffRequest?.school_id || '00000000-0000-0000-0000-000000000001'

  const shiftData = shifts.map(shift => ({
    time_off_request_id: requestId,
    date: shift.date,
    day_of_week_id: shift.day_of_week_id,
    time_slot_id: shift.time_slot_id,
    is_partial: shift.is_partial ?? false,
    start_time: shift.start_time || null,
    end_time: shift.end_time || null,
    school_id: schoolId,
  }))

  const { data, error } = await supabase.from('time_off_shifts').insert(shiftData).select()

  if (error) throw error
  return data as TimeOffShift[]
}

export async function deleteTimeOffShifts(requestId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('time_off_shifts')
    .delete()
    .eq('time_off_request_id', requestId)

  if (error) throw error
}

export async function getTeacherScheduledShifts(
  teacherId: string,
  startDate: string,
  endDate: string
) {
  const supabase = await createClient()

  console.log('[getTeacherScheduledShifts] Input:', { teacherId, startDate, endDate })

  // Get teacher's schedule (day_of_week + time_slot combinations)
  // Try without !inner first to see if that's the issue
  const { data: schedule, error: scheduleError } = await supabase
    .from('teacher_schedules')
    .select(
      `
      day_of_week_id, 
      time_slot_id, 
      days_of_week(name, day_number), 
      time_slots(code, name)
    `
    )
    .eq('teacher_id', teacherId)
    .not('day_of_week_id', 'is', null)
    .not('time_slot_id', 'is', null)

  if (scheduleError) {
    console.error('[getTeacherScheduledShifts] Schedule fetch error:', scheduleError)
    throw scheduleError
  }

  const { data: daysOfWeekRows, error: daysOfWeekError } = await supabase
    .from('days_of_week')
    .select('id, name, day_number')

  if (daysOfWeekError) {
    console.error('[getTeacherScheduledShifts] days_of_week fetch error:', daysOfWeekError)
    throw daysOfWeekError
  }

  const daysOfWeekById = new Map(
    (daysOfWeekRows || []).map(row => [row.id, { name: row.name, day_number: row.day_number }])
  )

  console.log('[getTeacherScheduledShifts] Raw schedule data:', schedule)
  console.log('[getTeacherScheduledShifts] Schedule count:', schedule?.length || 0)

  if (!schedule || schedule.length === 0) {
    console.log('[getTeacherScheduledShifts] No schedule found for teacher')
    return []
  }

  // Transform the data to match TeacherScheduleEntry interface
  // Handle both array and object formats from Supabase
  const transformedSchedule = schedule
    .map((entry: TeacherScheduleRow): TeacherScheduleEntry | null => {
      if (!entry.day_of_week_id || !entry.time_slot_id) {
        return null
      }

      // Handle days_of_week - could be array or object
      let daysOfWeek: TeacherScheduleEntry['days_of_week'] = null
      if (entry.days_of_week) {
        if (Array.isArray(entry.days_of_week) && entry.days_of_week.length > 0) {
          daysOfWeek = {
            name: entry.days_of_week[0]?.name ?? null,
            day_number: entry.days_of_week[0]?.day_number ?? null,
          }
        } else if (!Array.isArray(entry.days_of_week) && 'name' in entry.days_of_week) {
          daysOfWeek = {
            name: entry.days_of_week.name ?? null,
            day_number: entry.days_of_week.day_number ?? null,
          }
        }
      }

      if (!daysOfWeek) {
        const fallback = daysOfWeekById.get(entry.day_of_week_id || '')
        if (fallback) {
          daysOfWeek = {
            name: fallback.name ?? null,
            day_number: fallback.day_number ?? null,
          }
        }
      }

      // Handle time_slots - could be array or object
      let timeSlots: TeacherScheduleEntry['time_slots'] = null
      if (entry.time_slots) {
        if (Array.isArray(entry.time_slots) && entry.time_slots.length > 0) {
          timeSlots = {
            code: entry.time_slots[0]?.code ?? null,
            name: entry.time_slots[0]?.name ?? null,
          }
        } else if (!Array.isArray(entry.time_slots) && 'code' in entry.time_slots) {
          timeSlots = {
            code: entry.time_slots.code ?? null,
            name: entry.time_slots.name ?? null,
          }
        }
      }

      return {
        day_of_week_id: entry.day_of_week_id,
        time_slot_id: entry.time_slot_id,
        days_of_week: daysOfWeek,
        time_slots: timeSlots,
      }
    })
    .filter((entry): entry is TeacherScheduleEntry => entry !== null)

  console.log(
    '[getTeacherScheduledShifts] Transformed schedule entries:',
    transformedSchedule.length
  )
  console.log('[getTeacherScheduledShifts] Sample transformed entry:', transformedSchedule[0])

  // Create a map of day_number to schedule entries for quick lookup
  const scheduleByDayNumber = new Map<number, TeacherScheduleEntry[]>()
  transformedSchedule.forEach(entry => {
    const dayNumber = entry.days_of_week?.day_number
    if (typeof dayNumber === 'number') {
      if (!scheduleByDayNumber.has(dayNumber)) {
        scheduleByDayNumber.set(dayNumber, [])
      }
      scheduleByDayNumber.get(dayNumber)!.push(entry)
    }
  })

  console.log('[getTeacherScheduledShifts] Transformed schedule:', transformedSchedule)
  console.log(
    '[getTeacherScheduledShifts] Schedule by day number:',
    Array.from(scheduleByDayNumber.entries())
  )

  // Generate all dates in the range (inclusive of both start and end dates)
  // Work directly with date strings to avoid timezone issues
  const result: Array<{
    date: string
    day_of_week_id: string
    day_name: string
    day_number: number
    time_slot_id: string
    time_slot_code: string
    time_slot_name: string | null
  }> = []

  // Parse date string to get components
  const parseDateStr = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number)
    return { year, month, day }
  }

  // Get day of week from a date string
  // JavaScript getDay(): 0=Sunday, 1=Monday, ..., 6=Saturday
  // Database day_number: 1=Monday, 2=Tuesday, ..., 6=Saturday, 7=Sunday
  // Convert JavaScript day to database day_number
  const getDayOfWeek = (dateStr: string) => {
    const { year, month, day } = parseDateStr(dateStr)
    // Create date in local timezone, month is 0-indexed
    const date = new Date(year, month - 1, day)
    const jsDay = date.getDay() // 0=Sunday, 1=Monday, ..., 6=Saturday
    // Convert to database format: Sunday (0) -> 7, Monday (1) -> 1, etc.
    return jsDay === 0 ? 7 : jsDay
  }

  // Compare date strings (YYYY-MM-DD format allows string comparison)
  const compareDates = (date1: string, date2: string) => {
    if (date1 < date2) return -1
    if (date1 > date2) return 1
    return 0
  }

  // Iterate through all dates from start to end (inclusive)
  let currentDateStr = startDate
  let dateCount = 0

  console.log('[getTeacherScheduledShifts] Starting date iteration from', startDate, 'to', endDate)

  while (compareDates(currentDateStr, endDate) <= 0) {
    dateCount++
    const dayNumber = getDayOfWeek(currentDateStr)
    const shiftsForDay = scheduleByDayNumber.get(dayNumber)

    console.log(
      `[getTeacherScheduledShifts] Date ${dateCount}: ${currentDateStr}, JS day: ${new Date(parseDateStr(currentDateStr).year, parseDateStr(currentDateStr).month - 1, parseDateStr(currentDateStr).day).getDay()}, DB day_number: ${dayNumber}, Found shifts: ${shiftsForDay?.length || 0}`
    )

    // Only include dates where teacher has scheduled shifts
    if (shiftsForDay && shiftsForDay.length > 0) {
      shiftsForDay.forEach(shift => {
        result.push({
          date: currentDateStr,
          day_of_week_id: shift.day_of_week_id,
          day_name: shift.days_of_week?.name || '',
          day_number: dayNumber,
          time_slot_id: shift.time_slot_id,
          time_slot_code: shift.time_slots?.code || '',
          time_slot_name: shift.time_slots?.name || null,
        })
      })
    }

    // Move to next day by incrementing the date string
    const { year, month, day } = parseDateStr(currentDateStr)
    const nextDate = new Date(year, month - 1, day + 1)
    const nextYear = nextDate.getFullYear()
    const nextMonth = String(nextDate.getMonth() + 1).padStart(2, '0')
    const nextDay = String(nextDate.getDate()).padStart(2, '0')
    currentDateStr = `${nextYear}-${nextMonth}-${nextDay}`
  }

  console.log('[getTeacherScheduledShifts] Final result count:', result.length)
  console.log('[getTeacherScheduledShifts] Final result:', result)

  return result
}

export async function getTeacherTimeOffShifts(
  teacherId: string,
  startDate: string,
  endDate: string,
  excludeRequestId?: string
) {
  const supabase = await createClient()
  let query = supabase
    .from('time_off_shifts')
    .select(
      'date, time_slot_id, time_off_request_id, time_off_requests!inner(id, start_date, end_date, reason, teacher_id)'
    )
    .gte('date', startDate)
    .lte('date', endDate)
    .eq('time_off_requests.teacher_id', teacherId)
    .eq('time_off_requests.status', 'active')

  if (excludeRequestId) {
    query = query.neq('time_off_request_id', excludeRequestId)
  }

  const { data, error } = await query

  if (error) throw error
  if (!data) return []

  // Transform the data to match the expected return type
  return data.map((item: TimeOffShiftRow) => {
    const timeOffRequest = Array.isArray(item.time_off_requests)
      ? (item.time_off_requests[0] ?? null)
      : (item.time_off_requests ?? null)

    return {
      date: item.date,
      time_slot_id: item.time_slot_id,
      time_off_request_id: item.time_off_request_id,
      time_off_requests: timeOffRequest
        ? {
            id: timeOffRequest.id,
            start_date: timeOffRequest.start_date,
            end_date: timeOffRequest.end_date ?? null,
            reason: timeOffRequest.reason ?? null,
            teacher_id: timeOffRequest.teacher_id,
          }
        : null,
    }
  }) as TimeOffShiftWithRequest[]
}

export async function getTimeOffCoverageSummary(request: {
  id: string
  teacher_id: string
  start_date: string
  end_date: string
}) {
  const shifts = await getTimeOffShifts(request.id)
  const total = shifts.length
  if (total === 0) {
    return { total, covered: 0, partial: 0, uncovered: 0 }
  }

  const dates = shifts.map(shift => shift.date).sort()
  const startDate = dates[0]
  const endDate = dates[dates.length - 1]

  const supabase = await createClient()
  const { data: assignments, error } = await supabase
    .from('sub_assignments')
    .select('date, time_slot_id, is_partial, assignment_type')
    .eq('teacher_id', request.teacher_id)
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) throw error

  const assignmentMap = new Map<string, { full: boolean; partial: boolean }>()
  ;((assignments as SubAssignment[] | null) || []).forEach(assignment => {
    const key = `${assignment.date}::${assignment.time_slot_id}`
    const entry = assignmentMap.get(key) || { full: false, partial: false }
    const isPartial = assignment.is_partial || assignment.assignment_type === 'Partial Sub Shift'
    if (isPartial) {
      entry.partial = true
    } else {
      entry.full = true
    }
    assignmentMap.set(key, entry)
  })

  let covered = 0
  let partial = 0
  let uncovered = 0

  shifts.forEach(shift => {
    const key = `${shift.date}::${shift.time_slot_id}`
    const coverage = assignmentMap.get(key)
    if (coverage?.full) {
      covered += 1
    } else if (coverage?.partial) {
      partial += 1
    } else {
      uncovered += 1
    }
  })

  return { total, covered, partial, uncovered }
}
