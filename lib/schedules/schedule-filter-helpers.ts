/**
 * Pure helpers for schedule filter logic (weekly and baseline).
 * Used to compute effective classroom/time slot IDs and whether to collapse by staffing.
 */

export interface ScheduleFilterInput {
  selectedClassroomIds: string[]
  selectedTimeSlotIds: string[]
  showInactiveClassrooms?: boolean
  showInactiveTimeSlots?: boolean
  slotFilterMode?: 'all' | 'select'
  displayFilters?: {
    belowRequired: boolean
    belowPreferred: boolean
    fullyStaffed: boolean
    inactive: boolean
  }
}

export interface ItemWithActive {
  id: string
  is_active?: boolean
}

/**
 * When showInactiveClassrooms is false, return only selected classroom IDs that are active.
 * Otherwise return all selected classroom IDs.
 */
export function getEffectiveClassroomIds(
  filters: ScheduleFilterInput,
  availableClassrooms: ItemWithActive[]
): string[] {
  const showInactive = filters.showInactiveClassrooms ?? true
  if (showInactive) return filters.selectedClassroomIds
  const activeIds = new Set(availableClassrooms.filter(c => c.is_active !== false).map(c => c.id))
  return filters.selectedClassroomIds.filter(id => activeIds.has(id))
}

/**
 * When showInactiveTimeSlots is false, return only selected time slot IDs that are active.
 * Otherwise return all selected time slot IDs.
 */
export function getEffectiveTimeSlotIds(
  filters: ScheduleFilterInput,
  availableTimeSlots: ItemWithActive[]
): string[] {
  const showInactive = filters.showInactiveTimeSlots ?? true
  if (showInactive) return filters.selectedTimeSlotIds
  const activeIds = new Set(
    availableTimeSlots.filter(ts => ts.is_active !== false).map(ts => ts.id)
  )
  return filters.selectedTimeSlotIds.filter(id => activeIds.has(id))
}

/**
 * True when we should collapse rows/columns that have no slots matching the staffing checkboxes.
 * When slotFilterMode is 'all' we never collapse. When 'select', we collapse when at least
 * one of belowRequired, belowPreferred, fullyStaffed, or inactive is unchecked.
 */
export function isStaffingNarrowing(filters: ScheduleFilterInput): boolean {
  const slotFilterMode = filters.slotFilterMode ?? 'all'
  if (slotFilterMode === 'all') return false
  const df = filters.displayFilters
  if (!df) return false
  return !df.belowRequired || !df.belowPreferred || !df.fullyStaffed || !df.inactive
}
