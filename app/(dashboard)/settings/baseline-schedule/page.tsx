'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import WeeklyScheduleGridNew from '@/components/schedules/WeeklyScheduleGridNew'
import FilterPanel, { type FilterState } from '@/components/schedules/FilterPanel'
import ErrorMessage from '@/components/shared/ErrorMessage'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Filter } from 'lucide-react'
import Link from 'next/link'
import { useWeeklySchedule } from '@/lib/hooks/use-weekly-schedule'
import { useScheduleSettings } from '@/lib/hooks/use-schedule-settings'
import { useFilterOptions } from '@/lib/hooks/use-filter-options'
import { invalidateWeeklySchedule } from '@/lib/utils/invalidation'
import { isSlotInactive } from '@/lib/utils/schedule-slot-activity'
import { useSchool } from '@/lib/contexts/SchoolContext'

// Calculate Monday of current week as ISO string for query key
function formatLocalISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getWeekStartISO(): string {
  const today = new Date()
  const monday = new Date(today)
  const day = today.getDay()
  const diff = day === 0 ? -6 : 1 - day // Monday-based week start
  monday.setDate(today.getDate() + diff)
  return formatLocalISODate(monday)
}

export default function BaselineSchedulePage() {
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const schoolId = useSchool()
  const focusClassroomId = searchParams.get('classroom_id')
  const focusDayId = searchParams.get('day_of_week_id')
  const focusTimeSlotId = searchParams.get('time_slot_id')
  const hasAppliedFocusRef = useRef(false)

  // Always use current week for baseline schedule (no week picker)
  const weekStartISO = getWeekStartISO()

  // React Query hooks
  const {
    data: scheduleData = [],
    isLoading: isLoadingSchedule,
    error: scheduleError,
  } = useWeeklySchedule(weekStartISO)
  const { data: scheduleSettings, isLoading: isLoadingSettings } = useScheduleSettings()
  const { data: filterOptions, isLoading: isLoadingFilters } = useFilterOptions()

  const selectedDayIds = useMemo(
    () => scheduleSettings?.selected_day_ids || [],
    [scheduleSettings?.selected_day_ids]
  )
  const availableDays = useMemo(() => filterOptions?.days || [], [filterOptions?.days])
  const availableTimeSlots = useMemo(
    () => filterOptions?.timeSlots || [],
    [filterOptions?.timeSlots]
  )
  const availableClassrooms = useMemo(
    () => filterOptions?.classrooms || [],
    [filterOptions?.classrooms]
  )
  const availableClassroomIds = useMemo(
    () => availableClassrooms.map(c => c.id),
    [availableClassrooms]
  )

  const loading = isLoadingSchedule || isLoadingSettings || isLoadingFilters
  const error = scheduleError
    ? scheduleError instanceof Error
      ? scheduleError.message
      : 'Failed to load baseline schedule'
    : null

  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const prevAvailableClassroomIdsRef = useRef<string[] | null>(null)
  const previousAvailableClassroomsStorageKey = 'baseline-schedule-available-classroom-ids'
  const [filters, setFilters] = useState<FilterState | null>(() => {
    // Load filters from localStorage on mount (using separate key for baseline schedule)
    if (typeof window !== 'undefined') {
      const savedFilters = localStorage.getItem('baseline-schedule-filters')
      if (savedFilters) {
        try {
          const parsed = JSON.parse(savedFilters)
          // Ensure layout defaults to 'days-x-classrooms' if not set
          // Always enforce 'permanent-only' for baseline schedule
          return {
            ...parsed,
            layout: parsed.layout || 'days-x-classrooms',
            displayMode: 'permanent-only',
          }
        } catch (e) {
          console.error('Error parsing saved filters:', e)
        }
      }
    }
    return null
  })

  // Initialize filters with default layout if null (ensures layout is always set)
  const hasInitializedFilters = useRef(false)
  useEffect(() => {
    if (hasInitializedFilters.current) return
    if (
      filters === null &&
      availableDays.length > 0 &&
      availableTimeSlots.length > 0 &&
      availableClassrooms.length > 0
    ) {
      hasInitializedFilters.current = true
      // Load from localStorage again in case it was set between renders
      if (typeof window !== 'undefined') {
        const savedFilters = localStorage.getItem('baseline-schedule-filters')
        if (savedFilters) {
          try {
            const parsed = JSON.parse(savedFilters)
            setFilters({
              ...parsed,
              layout: parsed.layout || 'days-x-classrooms',
              displayMode: 'permanent-only', // Always enforce permanent-only for baseline schedule
            })
            return
          } catch (e) {
            console.error('Error parsing saved filters:', e)
          }
        }
      }
      // If no saved filters, initialize with defaults
      setFilters({
        selectedDayIds: selectedDayIds.length > 0 ? selectedDayIds : availableDays.map(d => d.id),
        selectedTimeSlotIds: availableTimeSlots.map(ts => ts.id),
        selectedClassroomIds: availableClassrooms.map(c => c.id),
        displayFilters: {
          belowRequired: true,
          belowPreferred: true,
          fullyStaffed: true,
          inactive: true,
        },
        displayMode: 'permanent-only', // Baseline schedule only shows permanent teachers
        layout: 'days-x-classrooms', // Default layout
      })
    }
  }, [filters, availableDays, availableTimeSlots, availableClassrooms, selectedDayIds])

  useEffect(() => {
    if (!focusClassroomId || !focusDayId || !focusTimeSlotId) return
    if (hasAppliedFocusRef.current) return
    if (
      availableDays.length === 0 ||
      availableTimeSlots.length === 0 ||
      availableClassrooms.length === 0
    ) {
      return
    }

    setFilters(prev => ({
      selectedDayIds: [focusDayId],
      selectedTimeSlotIds: [focusTimeSlotId],
      selectedClassroomIds: [focusClassroomId],
      displayFilters: prev?.displayFilters ?? {
        belowRequired: true,
        belowPreferred: true,
        fullyStaffed: true,
        inactive: true,
      },
      displayMode: 'permanent-only', // Baseline schedule only shows permanent teachers
      layout: prev?.layout ?? 'days-x-classrooms',
    }))
    hasAppliedFocusRef.current = true
  }, [
    focusClassroomId,
    focusDayId,
    focusTimeSlotId,
    availableDays.length,
    availableTimeSlots.length,
    availableClassrooms.length,
  ])

  // Normalize selected classroom IDs against current available classrooms.
  // This repairs stale localStorage selections (e.g., deleted classroom IDs lingering)
  // that can otherwise hide newly added classrooms.
  useEffect(() => {
    if (!filters || availableClassroomIds.length === 0) return

    const availableSet = new Set(availableClassroomIds)
    const validSelected = filters.selectedClassroomIds.filter(id => availableSet.has(id))
    const hadInvalidIds = validSelected.length !== filters.selectedClassroomIds.length
    if (!hadInvalidIds) return

    const nextSelected =
      filters.selectedClassroomIds.length >= availableClassroomIds.length
        ? availableClassroomIds
        : validSelected

    const isSame =
      nextSelected.length === filters.selectedClassroomIds.length &&
      nextSelected.every(id => filters.selectedClassroomIds.includes(id))
    if (isSame) return

    setFilters(prev => (prev ? { ...prev, selectedClassroomIds: nextSelected } : prev))
  }, [availableClassroomIds, filters])

  // Save filters to localStorage whenever they change (using separate key for baseline schedule)
  useEffect(() => {
    if (filters && typeof window !== 'undefined') {
      try {
        localStorage.setItem('baseline-schedule-filters', JSON.stringify(filters))
      } catch (e) {
        console.error('Error saving filters to localStorage:', e)
      }
    }
  }, [filters])

  // If new classrooms appear and user previously had all currently-available classrooms selected,
  // auto-include newly added classroom IDs so they immediately appear.
  useEffect(() => {
    if (!filters) return
    if (availableClassroomIds.length === 0) {
      return
    }

    let previousAvailableIds = prevAvailableClassroomIdsRef.current
    if (!previousAvailableIds && typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem(previousAvailableClassroomsStorageKey)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed)) {
            previousAvailableIds = parsed.filter((id): id is string => typeof id === 'string')
          }
        }
      } catch (e) {
        console.error('Error parsing previous available classrooms:', e)
      }
    }
    if (!previousAvailableIds) {
      previousAvailableIds = availableClassroomIds
    }

    const previousAvailableSet = new Set(previousAvailableIds)
    const selectedSet = new Set(filters.selectedClassroomIds)

    const hadAllPreviouslyAvailableSelected =
      previousAvailableIds.length > 0 && previousAvailableIds.every(id => selectedSet.has(id))

    const newlyAddedIds = availableClassroomIds.filter(id => !previousAvailableSet.has(id))

    if (hadAllPreviouslyAvailableSelected && newlyAddedIds.length > 0) {
      setFilters(prev => {
        if (!prev) return prev
        const prevSelectedSet = new Set(prev.selectedClassroomIds)
        const stillMissing = newlyAddedIds.filter(id => !prevSelectedSet.has(id))
        if (stillMissing.length === 0) return prev
        return {
          ...prev,
          selectedClassroomIds: [...prev.selectedClassroomIds, ...stillMissing],
        }
      })
    }

    prevAvailableClassroomIdsRef.current = availableClassroomIds
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(
          previousAvailableClassroomsStorageKey,
          JSON.stringify(availableClassroomIds)
        )
      } catch (e) {
        console.error('Error saving previous available classrooms:', e)
      }
    }
  }, [availableClassroomIds, filters?.selectedClassroomIds])

  // Handle refresh - invalidate React Query cache
  const handleRefresh = () => {
    if (schoolId) {
      invalidateWeeklySchedule(queryClient, schoolId)
      queryClient.invalidateQueries({ queryKey: ['scheduleSettings', schoolId] })
    }
  }

  // Handle filter changes - ensure displayMode is always permanent-only for baseline schedule
  const handleFiltersChange = useCallback((newFilters: FilterState) => {
    setFilters({ ...newFilters, displayMode: 'permanent-only' })
  }, [])

  // Apply filters to data
  const filteredData = useMemo(() => {
    if (!filters) return scheduleData

    return scheduleData
      .filter(
        classroom =>
          filters.selectedClassroomIds.includes(classroom.classroom_id) &&
          (filters.displayFilters.inactive || classroom.classroom_is_active !== false)
      )
      .map(classroom => ({
        ...classroom,
        days: classroom.days
          .filter(day => filters.selectedDayIds.includes(day.day_of_week_id))
          .map(day => ({
            ...day,
            time_slots: day.time_slots
              .filter(slot => filters.selectedTimeSlotIds.includes(slot.time_slot_id))
              .filter(slot => {
                if (!filters.displayFilters.inactive && slot.time_slot_is_active === false) {
                  return false
                }

                if (isSlotInactive(slot)) return filters.displayFilters.inactive

                const scheduleCell = slot.schedule_cell
                if (!scheduleCell) return false

                // Calculate staffing status
                if (
                  !scheduleCell.class_groups ||
                  scheduleCell.class_groups.length === 0 ||
                  !scheduleCell.enrollment_for_staffing
                ) {
                  return filters.displayFilters.inactive
                }

                // Get class group data from schedule_cell (use the one with lowest min_age for ratio calculation)
                const classGroups = scheduleCell.class_groups
                if (!classGroups || classGroups.length === 0) {
                  return filters.displayFilters.inactive
                }

                // Find class group with lowest min_age for ratio calculation
                const classGroupForRatio = classGroups.reduce((lowest, current) => {
                  const currentMinAge = current.min_age ?? Infinity
                  const lowestMinAge = lowest.min_age ?? Infinity
                  return currentMinAge < lowestMinAge ? current : lowest
                })

                const requiredTeachers = classGroupForRatio.required_ratio
                  ? Math.ceil(
                      scheduleCell.enrollment_for_staffing / classGroupForRatio.required_ratio
                    )
                  : undefined
                const preferredTeachers = classGroupForRatio.preferred_ratio
                  ? Math.ceil(
                      scheduleCell.enrollment_for_staffing / classGroupForRatio.preferred_ratio
                    )
                  : undefined

                // Count all teachers assigned to this classroom/day/time slot
                // Teachers are assigned to classrooms, not specific class groups
                // All teachers in the assignments array are already filtered by classroom_id in the API
                const assignedCount = slot.assignments.filter(
                  a => a.teacher_id && !a.is_substitute // Count regular teachers, exclude substitutes (they're counted separately)
                ).length

                const belowRequired =
                  requiredTeachers !== undefined && assignedCount < requiredTeachers
                const belowPreferred =
                  preferredTeachers !== undefined && assignedCount < preferredTeachers
                const fullyStaffed =
                  requiredTeachers !== undefined &&
                  assignedCount >= requiredTeachers &&
                  (preferredTeachers === undefined || assignedCount >= preferredTeachers)

                if (belowRequired) return filters.displayFilters.belowRequired
                if (belowPreferred) return filters.displayFilters.belowPreferred
                if (fullyStaffed) return filters.displayFilters.fullyStaffed
                return false
              }),
          })),
      }))
      .filter(classroom => classroom.days.length > 0)
  }, [scheduleData, filters])

  // Calculate slot counts for display
  const slotCounts = useMemo(() => {
    // Count actual slots currently shown
    const totalShown = filteredData.reduce((sum, classroom) => {
      return (
        sum +
        classroom.days.reduce((daySum, day) => {
          return daySum + day.time_slots.length
        }, 0)
      )
    }, 0)

    // Calculate total slots if all filters were selected
    // Only use days that are selected in Settings (not all available days)
    const totalIfAllSelected =
      selectedDayIds.length * availableTimeSlots.length * availableClassrooms.length

    return {
      shown: totalShown,
      total: totalIfAllSelected,
    }
  }, [filteredData, selectedDayIds.length, availableTimeSlots, availableClassrooms])

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
      </div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Baseline Schedule</h1>
          <p className="text-muted-foreground mt-2">
            Manage staffing by classroom, day, and time slot
          </p>
        </div>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="mb-4 flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setFilterPanelOpen(true)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Views & Filters
            </Button>
            <p className="text-sm text-muted-foreground italic">
              Showing {slotCounts.shown} of {slotCounts.total} slots
            </p>
          </div>
          <WeeklyScheduleGridNew
            data={filteredData}
            selectedDayIds={filters?.selectedDayIds ?? selectedDayIds}
            weekStartISO={weekStartISO}
            displayMode={filters?.displayMode ?? 'permanent-only'}
            layout={filters?.layout ?? 'days-x-classrooms'}
            onRefresh={handleRefresh}
            onFilterPanelOpenChange={setFilterPanelOpen}
            filterPanelOpen={filterPanelOpen}
            initialSelectedCell={
              focusClassroomId && focusDayId && focusTimeSlotId
                ? {
                    classroomId: focusClassroomId,
                    dayId: focusDayId,
                    timeSlotId: focusTimeSlotId,
                  }
                : null
            }
            showLegendSubstitutes={false}
            showFilterChips={false}
          />
          <FilterPanel
            isOpen={filterPanelOpen}
            onClose={() => {
              setFilterPanelOpen(false)
            }}
            onFiltersChange={handleFiltersChange}
            availableDays={availableDays}
            availableTimeSlots={availableTimeSlots}
            availableClassrooms={availableClassrooms}
            selectedDayIdsFromSettings={selectedDayIds}
            hideStaffSection={true}
            slotCounts={slotCounts}
            initialFilters={
              filters
                ? {
                    selectedDayIds: filters.selectedDayIds,
                    selectedTimeSlotIds: filters.selectedTimeSlotIds,
                    selectedClassroomIds: filters.selectedClassroomIds,
                    displayFilters: filters.displayFilters,
                    displayMode: filters.displayMode,
                    layout: filters.layout,
                  }
                : {
                    selectedDayIds: selectedDayIds,
                    displayMode: 'permanent-only',
                    layout: 'days-x-classrooms',
                  }
            }
          />
        </>
      )}
    </div>
  )
}
