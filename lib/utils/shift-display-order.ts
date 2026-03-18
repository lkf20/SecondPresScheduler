/**
 * Shared sort for shift details so shifts display in settings order everywhere:
 * date → day_of_week.display_order → time_slot.display_order
 * (AGENTS.md: "Order by database sort order")
 */

export interface ShiftDetailWithOrder {
  date: string
  day_display_order?: number | null
  time_slot_display_order?: number | null
  time_slot_code?: string | null
}

/**
 * Sorts shift details by date, then day display_order, then time_slot display_order.
 * When display_order is missing, preserve input order (stable) instead of
 * silently reordering alphabetically by time_slot_code.
 */
export function sortShiftDetailsByDisplayOrder<T extends ShiftDetailWithOrder>(shifts: T[]): T[] {
  return shifts
    .map((shift, index) => ({ shift, index }))
    .sort((a, b) => {
      const shiftA = a.shift
      const shiftB = b.shift

      const dateA = shiftA.date
      const dateB = shiftB.date
      if (dateA !== dateB) return dateA < dateB ? -1 : 1

      const dayA = shiftA.day_display_order ?? 999
      const dayB = shiftB.day_display_order ?? 999
      if (dayA !== dayB) return dayA - dayB

      const slotA = shiftA.time_slot_display_order ?? 999
      const slotB = shiftB.time_slot_display_order ?? 999
      if (slotA !== slotB) return slotA - slotB

      return a.index - b.index
    })
    .map(item => item.shift)
}
