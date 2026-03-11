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

/**
 * Normalize a date value to YYYY-MM-DD for consistent keys, comparisons, and API contracts.
 * Use this whenever you build keys from dates (e.g. `${date}|${time_slot_id}`) or compare
 * dates from different sources (DB, API, client). The DB may return date columns as
 * "YYYY-MM-DD" or with a time component (e.g. "2025-03-17T00:00:00.000Z"); using this
 * ensures matching works regardless.
 *
 * @param value - Date string (any parseable format) or Date object
 * @returns YYYY-MM-DD string, or empty string if value is falsy/invalid
 */
export function toDateStringISO(value: string | Date | null | undefined): string {
  if (value == null || value === '') return ''
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
    // ISO or timestamp: "2025-03-17T00:00:00.000Z" -> take first 10 chars
    if (trimmed.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
    try {
      const d = new Date(trimmed)
      if (!Number.isNaN(d.getTime())) {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
      }
    } catch {
      /* fall through */
    }
    return ''
  }
  try {
    const d = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch {
    return ''
  }
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

/**
 * Return the Monday of the week containing the given date (ISO YYYY-MM-DD).
 * Used when weekStartISO must be a Monday for week-boundary and grid calculations.
 */
export function getWeekStartISOFromDate(dateISO: string): string {
  const d = parseLocalDate(dateISO)
  const day = d.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const daysBack = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - daysBack)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dayStr = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dayStr}`
}

/**
 * Get ISO date (YYYY-MM-DD) for a schedule cell given week start (Monday) and day_number.
 * day_number: 1 = Monday, 2 = Tuesday, ..., 7 = Sunday.
 */
export function getCellDateISO(weekStartISO: string, dayNumber: number): string {
  const d = parseLocalDate(weekStartISO)
  d.setDate(d.getDate() + (dayNumber - 1))
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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

/**
 * Today's date in local time as YYYY-MM-DD.
 */
export function getTodayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Tomorrow's date in local time as YYYY-MM-DD.
 */
export function getTomorrowISO(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
