import { parseLocalDate } from '@/lib/utils/date'

export const STAFFING_LOOKAHEAD_DAYS = 84 // 12 weeks

/** Friday = 5 in getDay(). */
const FRIDAY = 5

/**
 * Returns the last Friday of May for the given year (YYYY-MM-DD).
 * Used as fallback when school calendar has no last_day_of_school set.
 */
export function getDefaultLastDayOfSchool(year: number): string {
  const mayLast = new Date(year, 4, 31) // month 4 = May (May has 31 days)
  while (mayLast.getDay() !== FRIDAY) {
    mayLast.setDate(mayLast.getDate() - 1)
  }
  const y = mayLast.getFullYear()
  const m = String(mayLast.getMonth() + 1).padStart(2, '0')
  const d = String(mayLast.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Returns the effective boundary date for staffing lookahead: lastDayOfSchool when set,
 * otherwise the last Friday of May for the year of startDate.
 */
function getBoundaryDate(startDate: string, lastDayOfSchool?: string | null): string {
  if (lastDayOfSchool) return lastDayOfSchool
  const year = parseLocalDate(startDate).getFullYear()
  return getDefaultLastDayOfSchool(year)
}

/**
 * Returns the end date for staffing lookahead: min(startDate + 12 weeks, boundary).
 * Boundary comes from lastDayOfSchool (e.g. from school calendar) or fallback to last Friday of May.
 */
export function getStaffingEndDate(
  startDate: string,
  lastDayOfSchool?: string | null
): string {
  const boundary = getBoundaryDate(startDate, lastDayOfSchool)
  const start = parseLocalDate(startDate)
  const endFromWeeks = new Date(start)
  endFromWeeks.setDate(endFromWeeks.getDate() + STAFFING_LOOKAHEAD_DAYS)
  const endFromWeeksStr =
    endFromWeeks.getFullYear() +
    '-' +
    String(endFromWeeks.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(endFromWeeks.getDate()).padStart(2, '0')
  return endFromWeeksStr <= boundary ? endFromWeeksStr : boundary
}

/**
 * Returns a label for the number of occurrence-weeks (e.g. number of dates that need coverage).
 * Use this when the shortfall is not continuous so calendar span would overcount.
 */
export function getStaffingWeeksLabelFromCount(occurrenceCount: number): string {
  if (occurrenceCount <= 0) return '0 weeks'
  if (occurrenceCount >= 12) return '12 or more weeks'
  return occurrenceCount === 1 ? '1 week' : `${occurrenceCount} weeks`
}

/**
 * Returns a label for the run length: "12 or more weeks" when the range is not capped by the boundary
 * and spans 12+ weeks; "X weeks" when capped by the boundary or when the run is shorter.
 * lastDayOfSchool: from school calendar, or undefined to use last Friday of May (year of dateStart).
 */
export function getStaffingWeeksLabel(
  dateStart: string,
  dateEnd: string,
  lastDayOfSchool?: string | null
): string {
  const boundary = getBoundaryDate(dateStart, lastDayOfSchool)
  const start = parseLocalDate(dateStart)
  const end = parseLocalDate(dateEnd)
  if (dateEnd >= boundary) {
    const boundaryDate = parseLocalDate(boundary)
    const diffTime = boundaryDate.getTime() - start.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    const weeks = Math.max(1, Math.ceil(diffDays / 7))
    return weeks === 1 ? '1 week' : `${weeks} weeks`
  }
  const diffTime = end.getTime() - start.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  const weeks = Math.max(1, Math.ceil(diffDays / 7))
  if (weeks >= 12) {
    return '12 or more weeks'
  }
  return weeks === 1 ? '1 week' : `${weeks} weeks`
}

/**
 * Returns the numeric number of weeks from dateStart to the effective end (min(dateEnd, boundary)).
 * Used for thresholds (e.g. show long-term card when >= 8 weeks).
 * lastDayOfSchool: from school calendar, or undefined to use last Friday of May (year of dateStart).
 */
export function getStaffingWeeksNumber(
  dateStart: string,
  dateEnd: string,
  lastDayOfSchool?: string | null
): number {
  const boundary = getBoundaryDate(dateStart, lastDayOfSchool)
  const start = parseLocalDate(dateStart)
  const end =
    dateEnd <= boundary ? parseLocalDate(dateEnd) : parseLocalDate(boundary)
  const diffTime = end.getTime() - start.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(0, Math.ceil(diffDays / 7))
}
