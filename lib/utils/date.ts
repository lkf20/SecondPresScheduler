/**
 * Parse a date string as a local date (not UTC)
 * This prevents timezone issues where dates stored as DATE type
 * (without time) get shifted by one day when parsed as UTC
 *
 * @param dateString - Date string in format "YYYY-MM-DD" or ISO format
 * @returns Date object in local timezone
 */
export function parseLocalDate(dateString: string): Date {
  // If the string is in YYYY-MM-DD format, parse it as local date
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number)
    // month is 0-indexed in Date constructor
    return new Date(year, month - 1, day)
  }

  // For other formats, try parsing and then adjust to local
  const date = new Date(dateString)

  // If it's a date-only string that was parsed as UTC, convert to local
  // Check if the date string looks like a date-only format
  if (dateString.includes('T') === false && dateString.includes(' ') === false) {
    // This is likely a date-only string, parse as local
    const [year, month, day] = dateString.split(/[-/]/).map(Number)
    if (year && month && day) {
      return new Date(year, month - 1, day)
    }
  }

  return date
}

const weekdayToDayNumber: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
}

const formatDateUTC = (date: Date) => {
  const year = date.getUTCFullYear()
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${date.getUTCDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const utcMidday = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month - 1, day, 12))

export function expandDateRangeWithTimeZone(
  startDate: string,
  endDate: string,
  timeZone: string
): Array<{ date: string; day_number: number; day_name: string }> {
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number)
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number)
  if (!startYear || !startMonth || !startDay || !endYear || !endMonth || !endDay) {
    return []
  }

  const startUTC = utcMidday(startYear, startMonth, startDay)
  const endUTC = utcMidday(endYear, endMonth, endDay)

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
  })

  const results: Array<{ date: string; day_number: number; day_name: string }> = []
  for (let current = new Date(startUTC); current <= endUTC; ) {
    const dateStr = formatDateUTC(current)
    const dayName = formatter.format(current)
    const dayNumber = weekdayToDayNumber[dayName] ?? 1
    results.push({ date: dateStr, day_number: dayNumber, day_name: dayName })
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000)
  }

  return results
}

export function formatDateISOInTimeZone(
  dateISO: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions
): string {
  const [year, month, day] = dateISO.split('-').map(Number)
  if (!year || !month || !day) return dateISO
  const date = utcMidday(year, month, day)
  return new Intl.DateTimeFormat('en-US', { timeZone, ...options }).format(date)
}
