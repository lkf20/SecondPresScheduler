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
