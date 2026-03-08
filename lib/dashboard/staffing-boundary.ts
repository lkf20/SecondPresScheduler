import { parseLocalDate } from '@/lib/utils/date'

/**
 * Last day of staffing lookahead. Use whichever comes sooner: start + 12 weeks or this date.
 * TODO: Replace with last day of school from School Calendar Settings when available.
 */
export const STAFFING_BOUNDARY_DAY = '2026-05-14'

export const STAFFING_LOOKAHEAD_DAYS = 84 // 12 weeks

/**
 * Returns the end date for staffing lookahead: min(startDate + 12 weeks, STAFFING_BOUNDARY_DAY).
 */
export function getStaffingEndDate(startDate: string): string {
  const start = parseLocalDate(startDate)
  const endFromWeeks = new Date(start)
  endFromWeeks.setDate(endFromWeeks.getDate() + STAFFING_LOOKAHEAD_DAYS)
  const endFromWeeksStr =
    endFromWeeks.getFullYear() +
    '-' +
    String(endFromWeeks.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(endFromWeeks.getDate()).padStart(2, '0')
  return endFromWeeksStr <= STAFFING_BOUNDARY_DAY ? endFromWeeksStr : STAFFING_BOUNDARY_DAY
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
 * and spans 12+ weeks; "X weeks" when capped by the boundary (weeks to May 14) or when the run is shorter.
 */
export function getStaffingWeeksLabel(dateStart: string, dateEnd: string): string {
  const start = parseLocalDate(dateStart)
  const end = parseLocalDate(dateEnd)
  if (dateEnd >= STAFFING_BOUNDARY_DAY) {
    const boundary = parseLocalDate(STAFFING_BOUNDARY_DAY)
    const diffTime = boundary.getTime() - start.getTime()
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
 */
export function getStaffingWeeksNumber(dateStart: string, dateEnd: string): number {
  const start = parseLocalDate(dateStart)
  const end =
    dateEnd <= STAFFING_BOUNDARY_DAY
      ? parseLocalDate(dateEnd)
      : parseLocalDate(STAFFING_BOUNDARY_DAY)
  const diffTime = end.getTime() - start.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(0, Math.ceil(diffDays / 7))
}
