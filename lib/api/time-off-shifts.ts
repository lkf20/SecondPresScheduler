import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type TimeOffShift = Database['public']['Tables']['time_off_shifts']['Row']

export async function getTimeOffShifts(requestId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('time_off_shifts')
    .select('*, time_slot:time_slots(*), day_of_week:days_of_week(*)')
    .eq('time_off_request_id', requestId)
    .order('date', { ascending: true })
    .order('time_slot_id', { ascending: true })

  if (error) throw error
  return data as any[]
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
  const scheduleByDayNumber = new Map<number, any[]>()
  schedule.forEach((entry: any) => {
    const dayNumber = entry.days_of_week?.day_number
    if (dayNumber !== undefined) {
      if (!scheduleByDayNumber.has(dayNumber)) {
        scheduleByDayNumber.set(dayNumber, [])
      }
      scheduleByDayNumber.get(dayNumber)!.push(entry)
    }
  })

  // Generate all dates in the range
  const start = new Date(startDate)
  const end = new Date(endDate)
  const result: Array<{
    date: string
    day_of_week_id: string
    day_name: string
    day_number: number
    time_slot_id: string
    time_slot_code: string
    time_slot_name: string | null
  }> = []
  
  const currentDate = new Date(start)
  while (currentDate <= end) {
    const dayNumber = currentDate.getDay()
    const shiftsForDay = scheduleByDayNumber.get(dayNumber)
    
    // Only include dates where teacher has scheduled shifts
    if (shiftsForDay && shiftsForDay.length > 0) {
      const dateStr = currentDate.toISOString().split('T')[0]
      const firstShift = shiftsForDay[0]
      
      shiftsForDay.forEach((shift: any) => {
        result.push({
          date: dateStr,
          day_of_week_id: shift.day_of_week_id,
          day_name: shift.days_of_week?.name || '',
          day_number: dayNumber,
          time_slot_id: shift.time_slot_id,
          time_slot_code: shift.time_slots?.code || '',
          time_slot_name: shift.time_slots?.name || null,
        })
      })
    }
    
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return result
}

