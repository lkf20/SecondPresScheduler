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

/** Extended closure with id and reason for UI display */
export interface SchoolClosureWithMeta {
  id: string
  date: string
  time_slot_id: string | null
  reason: string | null
}

/**
 * Returns the matching closure record for a cell (date + time slot), if any.
 * For whole-day closures (time_slot_id=null), returns that closure.
 * For per-slot closures, returns the slot-specific closure.
 * When multiple match (e.g. whole-day), returns the first.
 */
export function getMatchingClosure(
  weekStartISO: string,
  dayNumber: number,
  timeSlotId: string,
  closures: SchoolClosureWithMeta[]
): SchoolClosureWithMeta | null {
  if (closures.length === 0) return null
  const dateISO = getCellDateISO(weekStartISO, dayNumber)
  return (
    closures.find(
      c => c.date === dateISO && (c.time_slot_id === null || c.time_slot_id === timeSlotId)
    ) ?? null
  )
}
