import { createClient } from '@/lib/supabase/server'
import { getScheduleSettings } from '@/lib/api/schedule-settings'
import { expandDateRangeWithTimeZone } from '@/lib/utils/date'
import type { WeeklyScheduleDataByClassroom } from '@/lib/api/weekly-schedule'

const normalizeDayNumber = (dayNumber: number) => (dayNumber === 0 ? 7 : dayNumber)

const toIsoDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const addDays = (date: Date, amount: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

export type DailyScheduleDayResolution =
  | {
      timeZone: string
      noSchedule: true
      message: string
      nextScheduledDate: string | null
      nextScheduledDayName: string | null
    }
  | {
      timeZone: string
      noSchedule: false
      dayId: string
      dayName: string
    }

export async function resolveDailyScheduleDay(
  schoolId: string,
  dateISO: string,
  parsedDate: Date
): Promise<DailyScheduleDayResolution> {
  const scheduleSettings = await getScheduleSettings(schoolId)
  const timeZone = scheduleSettings?.time_zone || 'UTC'
  const selectedDayIds = scheduleSettings?.selected_day_ids ?? []

  const supabase = await createClient()
  const { data: configuredDays, error: configuredDaysError } = await supabase
    .from('days_of_week')
    .select('id, name, day_number')
    .in('id', selectedDayIds)

  if (configuredDaysError) {
    throw new Error('Failed to load configured school days.')
  }

  const expanded = expandDateRangeWithTimeZone(dateISO, dateISO, timeZone)
  const dayNumber = expanded[0]?.day_number
  if (!dayNumber) {
    throw new Error('Unable to resolve day of week for date.')
  }

  const normalizedCurrentDayNumber = normalizeDayNumber(dayNumber)
  const selectedDays = (configuredDays || []).map(day => ({
    ...day,
    normalized_day_number: normalizeDayNumber(day.day_number ?? 0),
  }))
  const day = selectedDays.find(d => d.normalized_day_number === normalizedCurrentDayNumber)

  if (!day) {
    const selectedDayNumbers = new Set(selectedDays.map(d => d.normalized_day_number))
    let nextScheduledDate: string | null = null
    let nextScheduledDayName: string | null = null

    if (selectedDayNumbers.size > 0) {
      for (let offset = 1; offset <= 7; offset += 1) {
        const candidateDayNumber = ((normalizedCurrentDayNumber - 1 + offset) % 7) + 1
        if (selectedDayNumbers.has(candidateDayNumber)) {
          const nextDate = addDays(parsedDate, offset)
          nextScheduledDate = toIsoDate(nextDate)
          const nextDay = selectedDays.find(d => d.normalized_day_number === candidateDayNumber)
          nextScheduledDayName = nextDay?.name ?? null
          break
        }
      }
    }

    return {
      timeZone,
      noSchedule: true,
      message:
        "No schedule is configured for this date. This day isn't included in your school's schedule.",
      nextScheduledDate,
      nextScheduledDayName,
    }
  }

  return {
    timeZone,
    noSchedule: false,
    dayId: day.id,
    dayName: day.name,
  }
}

export const filterActiveDailyScheduleData = (
  data: WeeklyScheduleDataByClassroom[]
): WeeklyScheduleDataByClassroom[] =>
  (data || [])
    .filter(classroom => classroom.classroom_is_active !== false)
    .map(classroom => ({
      ...classroom,
      days: classroom.days.map(dayEntry => ({
        ...dayEntry,
        time_slots: dayEntry.time_slots.filter(timeSlot => timeSlot.time_slot_is_active !== false),
      })),
    }))
