import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type TimeOffShift = Database['public']['Tables']['time_off_shifts']['Row']
type DayOfWeek = Database['public']['Tables']['days_of_week']['Row']
type TimeSlot = Database['public']['Tables']['time_slots']['Row']
type SubAssignment = Database['public']['Tables']['sub_assignments']['Row']

type TimeOffShiftWithDetails = TimeOffShift & {
  time_slot: TimeSlot | null
  day_of_week: DayOfWeek | null
}

type TeacherScheduleEntry = {
  day_of_week_id: string
  time_slot_id: string
  days_of_week: { name: string | null; day_number: number | null } | null
  time_slots: { code: string | null; name: string | null } | null
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
  const shiftData = shifts.map((shift) => ({
    time_off_request_id: requestId,
    date: shift.date,
    day_of_week_id: shift.day_of_week_id,
    time_slot_id: shift.time_slot_id,
    is_partial: shift.is_partial ?? false,
    start_time: shift.start_time || null,
    end_time: shift.end_time || null,
  }))

  const { data, error } = await supabase
    .from('time_off_shifts')
    .insert(shiftData)
    .select()

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
  
  // Get teacher's schedule (day_of_week + time_slot combinations)
  const { data: schedule, error: scheduleError } = await supabase
    .from('teacher_schedules')
    .select(`
      day_of_week_id, 
      time_slot_id, 
      days_of_week!inner(name, day_number), 
      time_slots!inner(code, name)
    `)
    .eq('teacher_id', teacherId)

  if (scheduleError) throw scheduleError
  if (!schedule || schedule.length === 0) return []

  // Create a map of day_number to schedule entries for quick lookup
  const scheduleByDayNumber = new Map<number, TeacherScheduleEntry[]>()
  ;(schedule as TeacherScheduleEntry[]).forEach((entry) => {
    const dayNumber = entry.days_of_week?.day_number
    if (typeof dayNumber === 'number') {
      if (!scheduleByDayNumber.has(dayNumber)) {
        scheduleByDayNumber.set(dayNumber, [])
      }
      scheduleByDayNumber.get(dayNumber)!.push(entry)
    }
  })

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
  
  // Get day of week from a date string (0 = Sunday, 1 = Monday, etc.)
  const getDayOfWeek = (dateStr: string) => {
    const { year, month, day } = parseDateStr(dateStr)
    // Create date in local timezone, month is 0-indexed
    const date = new Date(year, month - 1, day)
    return date.getDay()
  }
  
  // Compare date strings (YYYY-MM-DD format allows string comparison)
  const compareDates = (date1: string, date2: string) => {
    if (date1 < date2) return -1
    if (date1 > date2) return 1
    return 0
  }
  
  // Iterate through all dates from start to end (inclusive)
  let currentDateStr = startDate
  
  while (compareDates(currentDateStr, endDate) <= 0) {
    const dayNumber = getDayOfWeek(currentDateStr)
    const shiftsForDay = scheduleByDayNumber.get(dayNumber)
    
    // Only include dates where teacher has scheduled shifts
    if (shiftsForDay && shiftsForDay.length > 0) {
      shiftsForDay.forEach((shift) => {
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
  return data as Array<{
    date: string
    time_slot_id: string
    time_off_request_id: string
    time_off_requests: {
      id: string
      start_date: string
      end_date: string | null
      reason: string | null
      teacher_id: string
    }
  }>
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

  const dates = shifts.map((shift) => shift.date).sort()
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

  const assignmentMap = new Map<
    string,
    { full: boolean; partial: boolean }
  >()
  ;(assignments as SubAssignment[] | null || []).forEach((assignment) => {
    const key = `${assignment.date}::${assignment.time_slot_id}`
    const entry = assignmentMap.get(key) || { full: false, partial: false }
    const isPartial =
      assignment.is_partial || assignment.assignment_type === 'Partial Sub Shift'
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

  shifts.forEach((shift) => {
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
