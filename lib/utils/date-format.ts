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
