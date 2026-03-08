import { getCellDateISO } from './date'

export interface SchoolClosureForCheck {
  date: string
  time_slot_id: string | null
}

/**
 * Returns true if the given time slot on the given date is closed.
 * Use this when you already have the date (e.g. daily schedule, PDF).
 * A closure with time_slot_id=null means the whole day is closed.
 * A closure with time_slot_id=X means only that slot is closed on that date.
 */
export function isSlotClosedOnDate(
  dateISO: string,
  timeSlotId: string,
  closures: SchoolClosureForCheck[]
): boolean {
  if (closures.length === 0) return false
  return closures.some(
    c => c.date === dateISO && (c.time_slot_id === null || c.time_slot_id === timeSlotId)
  )
}

/**
 * Returns true if the cell (date, timeSlotId) is closed.
 * A closure with time_slot_id=null means the whole day is closed.
 * A closure with time_slot_id=X means only that slot is closed on that date.
 */
export function isCellClosed(
  weekStartISO: string,
  dayNumber: number,
  timeSlotId: string,
  closures: SchoolClosureForCheck[]
): boolean {
  if (closures.length === 0) return false
  const dateISO = getCellDateISO(weekStartISO, dayNumber)
  return isSlotClosedOnDate(dateISO, timeSlotId, closures)
}
