import { createClient } from '@/lib/supabase/server'
import { getTeacherScheduledShifts } from './time-off-shifts'
import { parseLocalDate } from '@/lib/utils/date'

export interface CoverageRequestWithShifts {
  coverage_request_id: string
  coverage_request_shifts: Array<{
    id: string
    date: string
    day_of_week_id: string
    time_slot_id: string
    classroom_id: string | null
    has_time_off: boolean
    time_off_request_id: string | null
  }>
}

/**
 * Ensure a coverage request exists for quick assign
 * Reuses existing coverage_requests or creates new ones
 */
export async function ensureCoverageRequestForQuickAssign(
  teacherId: string,
  startDate: string,
  endDate: string
): Promise<CoverageRequestWithShifts> {
  const supabase = await createClient()

  console.log('[ensureCoverageRequestForQuickAssign] Input:', { teacherId, startDate, endDate })

  // First, check for existing coverage_requests for this teacher and date range
  // Look for requests that overlap with our date range
  const { data: existingRequests, error: existingError } = await supabase
    .from('coverage_requests')
    .select('id, start_date, end_date, request_type')
    .eq('teacher_id', teacherId)
    .eq('status', 'open')
    .lte('start_date', endDate)
    .gte('end_date', startDate)

  if (existingError) {
    console.error('Error checking for existing coverage requests:', existingError)
    throw existingError
  }

  console.log('[ensureCoverageRequestForQuickAssign] Existing requests:', existingRequests?.length || 0)

  // If we find an existing request that covers our date range, reuse it
  let coverageRequestId: string | null = null
  if (existingRequests && existingRequests.length > 0) {
    // Use the first matching request (could be enhanced to find best match)
    coverageRequestId = existingRequests[0].id
    console.log('[ensureCoverageRequestForQuickAssign] Reusing existing coverage request:', coverageRequestId)
  }

  // Get teacher's scheduled shifts for the date range
  // Fetch schedule with classroom_id
  const { data: schedule, error: scheduleError } = await supabase
    .from('teacher_schedules')
    .select(`
      day_of_week_id, 
      time_slot_id,
      classroom_id,
      days_of_week(name, day_number), 
      time_slots(code, name)
    `)
    .eq('teacher_id', teacherId)
    .not('day_of_week_id', 'is', null)
    .not('time_slot_id', 'is', null)

  if (scheduleError) {
    console.error('Error fetching teacher schedule:', scheduleError)
    throw scheduleError
  }

  console.log('[ensureCoverageRequestForQuickAssign] Raw schedule entries:', schedule?.length || 0)
  console.log('[ensureCoverageRequestForQuickAssign] Schedule data:', schedule)

  if (!schedule || schedule.length === 0) {
    console.log('[ensureCoverageRequestForQuickAssign] No schedule found for teacher')
    // If no scheduled shifts, still create a coverage request but with no shifts
    if (!coverageRequestId) {
      const { data: newRequest, error: createError } = await supabase
        .from('coverage_requests')
        .insert({
          request_type: 'manual_coverage',
          teacher_id: teacherId,
          start_date: startDate,
          end_date: endDate,
          status: 'open',
          total_shifts: 0,
          covered_shifts: 0,
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating coverage request:', createError)
        throw createError
      }

      coverageRequestId = newRequest.id
    }

    return {
      coverage_request_id: coverageRequestId,
      coverage_request_shifts: [],
    }
  }

  // Transform schedule data similar to getTeacherScheduledShifts
  const transformedSchedule = schedule.map((entry: any) => {
    let daysOfWeek = null
    if (entry.days_of_week) {
      if (Array.isArray(entry.days_of_week) && entry.days_of_week.length > 0) {
        daysOfWeek = {
          name: entry.days_of_week[0]?.name ?? null,
          day_number: entry.days_of_week[0]?.day_number ?? null,
        }
      } else if (typeof entry.days_of_week === 'object' && entry.days_of_week.name !== undefined) {
        daysOfWeek = {
          name: entry.days_of_week.name ?? null,
          day_number: entry.days_of_week.day_number ?? null,
        }
      }
    }
    
    let timeSlots = null
    if (entry.time_slots) {
      if (Array.isArray(entry.time_slots) && entry.time_slots.length > 0) {
        timeSlots = {
          code: entry.time_slots[0]?.code ?? null,
          name: entry.time_slots[0]?.name ?? null,
        }
      } else if (typeof entry.time_slots === 'object' && entry.time_slots.code !== undefined) {
        timeSlots = {
          code: entry.time_slots.code ?? null,
          name: entry.time_slots.name ?? null,
        }
      }
    }
    
    return {
      day_of_week_id: entry.day_of_week_id,
      time_slot_id: entry.time_slot_id,
      classroom_id: entry.classroom_id,
      days_of_week: daysOfWeek,
      time_slots: timeSlots,
    }
  })

  // Create a map of day_number to schedule entries
  const scheduleByDayNumber = new Map<number, typeof transformedSchedule>()
  transformedSchedule.forEach((entry) => {
    const dayNumber = entry.days_of_week?.day_number
    if (typeof dayNumber === 'number') {
      if (!scheduleByDayNumber.has(dayNumber)) {
        scheduleByDayNumber.set(dayNumber, [])
      }
      scheduleByDayNumber.get(dayNumber)!.push(entry)
    }
  })

  // Generate all dates in the range and build shifts
  const parseDateStr = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number)
    return { year, month, day }
  }

  const getDayOfWeek = (dateStr: string) => {
    const { year, month, day } = parseDateStr(dateStr)
    const date = new Date(year, month - 1, day)
    const jsDay = date.getDay()
    return jsDay === 0 ? 7 : jsDay
  }

  const compareDates = (date1: string, date2: string) => {
    if (date1 < date2) return -1
    if (date1 > date2) return 1
    return 0
  }

  // Build a map of date -> shifts for that date
  const shiftsByDate = new Map<string, Array<{ day_of_week_id: string; time_slot_id: string; classroom_id: string | null }>>()

  console.log('[ensureCoverageRequestForQuickAssign] Schedule by day number:', Array.from(scheduleByDayNumber.entries()).map(([day, shifts]) => ({ day, count: shifts.length })))

  let currentDateStr = startDate
  let dateCount = 0
  while (compareDates(currentDateStr, endDate) <= 0) {
    dateCount++
    const dayNumber = getDayOfWeek(currentDateStr)
    const shiftsForDay = scheduleByDayNumber.get(dayNumber)
    
    console.log(`[ensureCoverageRequestForQuickAssign] Date ${dateCount}: ${currentDateStr}, day_number: ${dayNumber}, found shifts: ${shiftsForDay?.length || 0}`)
    
    if (shiftsForDay && shiftsForDay.length > 0) {
      if (!shiftsByDate.has(currentDateStr)) {
        shiftsByDate.set(currentDateStr, [])
      }
      shiftsForDay.forEach((shift) => {
        shiftsByDate.get(currentDateStr)!.push({
          day_of_week_id: shift.day_of_week_id,
          time_slot_id: shift.time_slot_id,
          classroom_id: shift.classroom_id,
        })
      })
      console.log(`[ensureCoverageRequestForQuickAssign] Added ${shiftsForDay.length} shifts for ${currentDateStr}`)
    }
    
    // Move to next day
    const { year, month, day } = parseDateStr(currentDateStr)
    const nextDate = new Date(year, month - 1, day + 1)
    const nextYear = nextDate.getFullYear()
    const nextMonth = String(nextDate.getMonth() + 1).padStart(2, '0')
    const nextDay = String(nextDate.getDate()).padStart(2, '0')
    currentDateStr = `${nextYear}-${nextMonth}-${nextDay}`
  }

  console.log('[ensureCoverageRequestForQuickAssign] Total shifts by date:', shiftsByDate.size)
  console.log('[ensureCoverageRequestForQuickAssign] Shifts by date map:', Array.from(shiftsByDate.entries()).map(([date, shifts]) => ({ date, count: shifts.length })))

  // Check which shifts already have time off requests
  const timeOffShiftsMap = new Map<string, { time_off_request_id: string }>()

  // Get all dates in range
  const dates: string[] = []
  const start = parseLocalDate(startDate)
  const end = parseLocalDate(endDate)
  const current = new Date(start)

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0]
    dates.push(dateStr)
    current.setDate(current.getDate() + 1)
  }

  // Check for time off requests for this teacher in the date range
  const { data: timeOffRequests } = await supabase
    .from('time_off_requests')
    .select('id, start_date, end_date, coverage_request_id')
    .eq('teacher_id', teacherId)
    .lte('start_date', endDate)
    .gte('end_date', startDate)

  if (timeOffRequests && timeOffRequests.length > 0) {
    // Get time off shifts for these requests
    const requestIds = timeOffRequests.map((req) => req.id)
    const { data: timeOffShifts } = await supabase
      .from('time_off_shifts')
      .select('time_off_request_id, date, day_of_week_id, time_slot_id')
      .in('time_off_request_id', requestIds)

    if (timeOffShifts) {
      for (const toShift of timeOffShifts) {
        const key = `${toShift.date}|${toShift.day_of_week_id}|${toShift.time_slot_id}`
        timeOffShiftsMap.set(key, {
          time_off_request_id: toShift.time_off_request_id,
        })
      }
    }
  }

  // If we have an existing coverage request, check if it has shifts for our date range
  if (coverageRequestId) {
    const { data: existingShifts, error: shiftsError } = await supabase
      .from('coverage_request_shifts')
      .select('id, date, day_of_week_id, time_slot_id, classroom_id')
      .eq('coverage_request_id', coverageRequestId)
      .gte('date', startDate)
      .lte('date', endDate)

    if (shiftsError) {
      console.error('Error fetching existing shifts:', shiftsError)
      throw shiftsError
    }

    // Build a set of existing shift keys
    const existingShiftKeys = new Set(
      (existingShifts || []).map((s) => `${s.date}|${s.day_of_week_id}|${s.time_slot_id}`)
    )

    // Find shifts that need to be added
    const shiftsToAdd: Array<{
      coverage_request_id: string
      date: string
      day_of_week_id: string
      time_slot_id: string
      classroom_id: string | null
    }> = []

    for (const [date, shifts] of shiftsByDate.entries()) {
      for (const shift of shifts) {
        const key = `${date}|${shift.day_of_week_id}|${shift.time_slot_id}`
        if (!existingShiftKeys.has(key)) {
          shiftsToAdd.push({
            coverage_request_id: coverageRequestId,
            date,
            day_of_week_id: shift.day_of_week_id,
            time_slot_id: shift.time_slot_id,
            classroom_id: shift.classroom_id,
          })
        }
      }
    }

    // Add missing shifts
    if (shiftsToAdd.length > 0) {
      const { error: insertError } = await supabase
        .from('coverage_request_shifts')
        .insert(shiftsToAdd)

      if (insertError) {
        console.error('Error adding shifts to existing coverage request:', insertError)
        throw insertError
      }
    }

    // Fetch all shifts (existing + newly added)
    const { data: allShifts, error: fetchError } = await supabase
      .from('coverage_request_shifts')
      .select('id, date, day_of_week_id, time_slot_id, classroom_id')
      .eq('coverage_request_id', coverageRequestId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('time_slot_id', { ascending: true })

    if (fetchError) {
      console.error('Error fetching all shifts:', fetchError)
      throw fetchError
    }

    // Map shifts with time off info
    const shiftsWithTimeOff = (allShifts || []).map((shift) => {
      const key = `${shift.date}|${shift.day_of_week_id}|${shift.time_slot_id}`
      const timeOffInfo = timeOffShiftsMap.get(key)
      return {
        id: shift.id,
        date: shift.date,
        day_of_week_id: shift.day_of_week_id,
        time_slot_id: shift.time_slot_id,
        classroom_id: shift.classroom_id,
        has_time_off: !!timeOffInfo,
        time_off_request_id: timeOffInfo?.time_off_request_id || null,
      }
    })

    return {
      coverage_request_id: coverageRequestId,
      coverage_request_shifts: shiftsWithTimeOff,
    }
  }

  // Create new coverage request
  const shiftsToCreate: Array<{
    date: string
    day_of_week_id: string
    time_slot_id: string
    classroom_id: string | null
  }> = []

  for (const [date, shifts] of shiftsByDate.entries()) {
    for (const shift of shifts) {
      shiftsToCreate.push({
        date,
        day_of_week_id: shift.day_of_week_id,
        time_slot_id: shift.time_slot_id,
        classroom_id: shift.classroom_id,
      })
    }
  }

  console.log('[ensureCoverageRequestForQuickAssign] Shifts to create:', shiftsToCreate.length)
  if (shiftsToCreate.length === 0) {
    console.log('[ensureCoverageRequestForQuickAssign] WARNING: No shifts to create! This might indicate a date matching issue.')
  }

  const { data: newRequest, error: createError } = await supabase
    .from('coverage_requests')
    .insert({
      request_type: 'manual_coverage',
      teacher_id: teacherId,
      start_date: startDate,
      end_date: endDate,
      status: 'open',
      total_shifts: shiftsToCreate.length,
      covered_shifts: 0,
    })
    .select()
    .single()

  if (createError) {
    console.error('Error creating coverage request:', createError)
    throw createError
  }

  coverageRequestId = newRequest.id

  // Create coverage_request_shifts
  const shiftsData = shiftsToCreate.map((shift) => ({
    coverage_request_id: coverageRequestId,
    date: shift.date,
    day_of_week_id: shift.day_of_week_id,
    time_slot_id: shift.time_slot_id,
    classroom_id: shift.classroom_id,
  }))

  const { data: createdShifts, error: shiftsError } = await supabase
    .from('coverage_request_shifts')
    .insert(shiftsData)
    .select('id, date, day_of_week_id, time_slot_id, classroom_id')

  if (shiftsError) {
    console.error('Error creating coverage request shifts:', shiftsError)
    throw shiftsError
  }

  // Map shifts with time off info
  const shiftsWithTimeOff = (createdShifts || []).map((shift) => {
    const key = `${shift.date}|${shift.day_of_week_id}|${shift.time_slot_id}`
    const timeOffInfo = timeOffShiftsMap.get(key)
    return {
      id: shift.id,
      date: shift.date,
      day_of_week_id: shift.day_of_week_id,
      time_slot_id: shift.time_slot_id,
      classroom_id: shift.classroom_id,
      has_time_off: !!timeOffInfo,
      time_off_request_id: timeOffInfo?.time_off_request_id || null,
    }
  })

  return {
    coverage_request_id: coverageRequestId,
    coverage_request_shifts: shiftsWithTimeOff,
  }
}
