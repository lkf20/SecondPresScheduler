import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { expandDateRangeWithTimeZone, toDateStringISO } from '@/lib/utils/date'

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
  classroom_id: string | null
  classroom_name: string | null
  days_of_week: { name: string | null; day_number: number | null } | null
  time_slots: { code: string | null; name: string | null } | null
}

type TeacherScheduleRow = {
  day_of_week_id: string | null
  time_slot_id: string | null
  classroom_id?: string | null
  classroom?: { name?: string | null } | Array<{ name?: string | null }> | null
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
  const schoolId = timeOffRequest?.school_id
  if (!schoolId) throw new Error('school_id is required to create time off shifts')

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

export type ValidateShiftsClassroomResult =
  | { valid: true }
  | {
      valid: false
      missingShifts: Array<{ day_of_week_id: string; time_slot_id: string }>
    }

/**
 * Validates that the teacher has a baseline schedule row with a non-null classroom_id
 * for each (day_of_week_id, time_slot_id) in the given shifts, in the same school.
 * Used to reject time off creation when we would otherwise create coverage shifts
 * with "Unknown (needs review)" classroom.
 */
export async function validateShiftsHaveClassroom(
  teacherId: string,
  schoolId: string,
  shifts: Array<{ day_of_week_id: string; time_slot_id: string }>
): Promise<ValidateShiftsClassroomResult> {
  if (shifts.length === 0) return { valid: true }

  const supabase = await createClient()
  const { data: scheduleRows, error } = await supabase
    .from('teacher_schedules')
    .select('day_of_week_id, time_slot_id')
    .eq('teacher_id', teacherId)
    .eq('school_id', schoolId)
    .not('classroom_id', 'is', null)

  if (error) throw error

  const validKeys = new Set(
    (scheduleRows || []).map(
      (row: { day_of_week_id: string; time_slot_id: string }) =>
        `${row.day_of_week_id}|${row.time_slot_id}`
    )
  )

  const missingShifts = shifts.filter(s => !validKeys.has(`${s.day_of_week_id}|${s.time_slot_id}`))

  if (missingShifts.length === 0) return { valid: true }
  return { valid: false, missingShifts }
}

export async function getTeacherScheduledShifts(
  teacherId: string,
  startDate: string,
  endDate: string,
  timeZone: string = 'UTC'
) {
  const supabase = await createClient()

  // Get teacher's schedule (day_of_week + time_slot combinations)
  // Try without !inner first to see if that's the issue
  const { data: schedule, error: scheduleError } = await supabase
    .from('teacher_schedules')
    .select(
      `
      day_of_week_id, 
      time_slot_id, 
      classroom_id,
      classroom:classrooms(name),
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

  if (!schedule || schedule.length === 0) {
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

      let classroomName: string | null = null
      if (entry.classroom) {
        const c = Array.isArray(entry.classroom) ? entry.classroom[0] : entry.classroom
        classroomName = (c?.name as string) ?? null
      }

      return {
        day_of_week_id: entry.day_of_week_id,
        time_slot_id: entry.time_slot_id,
        classroom_id: entry.classroom_id ?? null,
        classroom_name: classroomName,
        days_of_week: daysOfWeek,
        time_slots: timeSlots,
      }
    })
    .filter((entry): entry is TeacherScheduleEntry => entry !== null)

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

  // Generate all dates in the range (inclusive of both start and end dates)
  const result: Array<{
    date: string
    day_of_week_id: string
    day_name: string
    day_number: number
    time_slot_id: string
    time_slot_code: string
    time_slot_name: string | null
    classroom_id: string | null
    classroom_name: string | null
  }> = []

  const expandedDates = expandDateRangeWithTimeZone(startDate, endDate, timeZone)

  expandedDates.forEach(entry => {
    const shiftsForDay = scheduleByDayNumber.get(entry.day_number)

    if (shiftsForDay && shiftsForDay.length > 0) {
      shiftsForDay.forEach(shift => {
        result.push({
          date: entry.date,
          day_of_week_id: shift.day_of_week_id,
          day_name: shift.days_of_week?.name || entry.day_name || '',
          day_number: entry.day_number,
          time_slot_id: shift.time_slot_id,
          time_slot_code: shift.time_slots?.code || '',
          time_slot_name: shift.time_slots?.name || null,
          classroom_id: shift.classroom_id ?? null,
          classroom_name: shift.classroom_name ?? null,
        })
      })
    }
  })

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
    const key = `${toDateStringISO(assignment.date)}::${assignment.time_slot_id}`
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
    const key = `${toDateStringISO(shift.date)}::${shift.time_slot_id}`
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
