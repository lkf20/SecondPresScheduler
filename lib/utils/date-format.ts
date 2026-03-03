import { parseLocalDate } from '@/lib/utils/date'

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const FULL_DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]
export const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export const formatShortDate = (dateString: string) => {
  const date = parseLocalDate(dateString)
  const dayName = DAY_NAMES[date.getDay()]
  const month = MONTH_NAMES[date.getMonth()]
  const day = date.getDate()
  return `${dayName} ${month} ${day}`
}

export const formatAbsenceDateRange = (startDate: string, endDate?: string | null): string => {
  const start = formatShortDate(startDate)
  if (endDate && endDate !== startDate) {
    const end = formatShortDate(endDate)
    return `${start} - ${end}`
  }
  return start
}

/** Format ISO timestamp for "Last contacted" (e.g. "Monday Feb 4 at 2:15pm"). */
export function formatLastContactedDateTime(timestamp: string): string {
  const d = new Date(timestamp)
  const weekday = FULL_DAY_NAMES[d.getDay()]
  const month = MONTH_NAMES[d.getMonth()]
  const day = d.getDate()
  const hours = d.getHours()
  const minutes = d.getMinutes()
  const ampm = hours >= 12 ? 'pm' : 'am'
  const h = hours % 12 || 12
  const m = minutes.toString().padStart(2, '0')
  return `${weekday} ${month} ${day} at ${h}:${m}${ampm}`
}
