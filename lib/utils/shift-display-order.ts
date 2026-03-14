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
 * Falls back to time_slot_code localeCompare when display_order is missing (e.g. legacy data).
 */
export function sortShiftDetailsByDisplayOrder<T extends ShiftDetailWithOrder>(shifts: T[]): T[] {
  return [...shifts].sort((a, b) => {
    const dateA = a.date
    const dateB = b.date
    if (dateA !== dateB) return dateA < dateB ? -1 : 1
    const dayA = a.day_display_order ?? 999
    const dayB = b.day_display_order ?? 999
    if (dayA !== dayB) return dayA - dayB
    const slotA = a.time_slot_display_order ?? 999
    const slotB = b.time_slot_display_order ?? 999
    if (slotA !== slotB) return slotA - slotB
    return (a.time_slot_code ?? '').localeCompare(b.time_slot_code ?? '')
  })
}
