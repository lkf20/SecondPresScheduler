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
  const showInactive = filters.showInactiveClassrooms ?? false
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
  const showInactive = filters.showInactiveTimeSlots ?? false
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

/** Shape used by hasActiveScheduleFilters and getClearedScheduleFilters (subset of FilterState). */
export interface ScheduleFiltersForClear {
  selectedDayIds: string[]
  selectedTimeSlotIds: string[]
  selectedClassroomIds: string[]
  slotFilterMode?: 'all' | 'select'
  showInactiveClassrooms?: boolean
  showInactiveTimeSlots?: boolean
  displayFilters: {
    belowRequired: boolean
    belowPreferred: boolean
    fullyStaffed: boolean
    inactive: boolean
    viewNotes?: boolean
  }
  displayMode?: string
}

/**
 * True when any schedule filter is narrowed from the "show all" default.
 * Used to decide whether to show the "Clear all filters" button.
 */
export function hasActiveScheduleFilters(
  filters: ScheduleFiltersForClear,
  context: {
    defaultDayCount: number
    totalTimeSlots: number
    totalClassrooms: number
    teacherFilterId: string | null
    /** If set, treat displayMode as a filter; e.g. 'all-scheduled-staff' for weekly. Baseline omits. */
    defaultDisplayMode?: string
  }
): boolean {
  const { defaultDayCount, totalTimeSlots, totalClassrooms, teacherFilterId, defaultDisplayMode } =
    context
  return (
    filters.slotFilterMode === 'select' ||
    !filters.displayFilters.belowRequired ||
    !filters.displayFilters.belowPreferred ||
    !filters.displayFilters.fullyStaffed ||
    !filters.displayFilters.inactive ||
    (filters.showInactiveClassrooms ?? false) ||
    (filters.showInactiveTimeSlots ?? false) ||
    (defaultDisplayMode != null && filters.displayMode !== defaultDisplayMode) ||
    filters.selectedClassroomIds.length < totalClassrooms ||
    filters.selectedTimeSlotIds.length < totalTimeSlots ||
    filters.selectedDayIds.length < defaultDayCount ||
    teacherFilterId != null
  )
}

/**
 * Return filters with all schedule filters reset to "show all" defaults.
 * Used by the "Clear all filters" button on weekly and baseline schedule pages.
 * Preserves extra fields on prev (e.g. layout) so return type is same as prev.
 */
export function getClearedScheduleFilters<T extends ScheduleFiltersForClear>(
  prev: T,
  context: {
    defaultDayIds: string[]
    allTimeSlotIds: string[]
    allClassroomIds: string[]
    /** If set, reset displayMode (e.g. 'all-scheduled-staff' for weekly). Baseline omits. */
    defaultDisplayMode?: string
  }
): T {
  const { defaultDayIds, allTimeSlotIds, allClassroomIds, defaultDisplayMode } = context
  const next = {
    ...prev,
    selectedDayIds: defaultDayIds,
    selectedTimeSlotIds: allTimeSlotIds,
    selectedClassroomIds: allClassroomIds,
    slotFilterMode: 'all' as const,
    showInactiveClassrooms: false,
    showInactiveTimeSlots: false,
    displayFilters: {
      ...prev.displayFilters,
      belowRequired: true,
      belowPreferred: true,
      fullyStaffed: true,
      inactive: true,
      viewNotes: false,
    },
    ...(defaultDisplayMode != null && { displayMode: defaultDisplayMode }),
  }
  return next as T
}
