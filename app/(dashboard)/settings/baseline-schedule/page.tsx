'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import WeeklyScheduleGridNew from '@/components/schedules/WeeklyScheduleGridNew'
import FilterPanel, { type FilterState } from '@/components/schedules/FilterPanel'
import ErrorMessage from '@/components/shared/ErrorMessage'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Filter, X } from 'lucide-react'
import TeacherFilterSearch from '@/components/schedules/TeacherFilterSearch'
import Link from 'next/link'
import { useWeeklySchedule } from '@/lib/hooks/use-weekly-schedule'
import { useScheduleSettings } from '@/lib/hooks/use-schedule-settings'
import { useFilterOptions } from '@/lib/hooks/use-filter-options'
import { invalidateWeeklySchedule } from '@/lib/utils/invalidation'
import { weeklyScheduleKey } from '@/lib/utils/query-keys'
import {
  includeNewIdsWhenPreviouslyAllSelected,
  reconcileSelectedIdsWithAvailable,
} from '@/lib/utils/filter-selection'
import { useSchool } from '@/lib/contexts/SchoolContext'
import {
  getClearedScheduleFilters,
  hasActiveScheduleFilters,
} from '@/lib/schedules/schedule-filter-helpers'
import { applyScheduleFilters } from '@/lib/schedules/schedule-filter-data'
import { isNeedsReviewClassroomName } from '@/lib/utils/needs-review-classroom'

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
  const returnToWeekly = searchParams.get('return_to_weekly') === 'true'
  const focusClassroomId = searchParams.get('classroom_id')
  const focusDayId = searchParams.get('day_of_week_id')
  const focusTimeSlotId = searchParams.get('time_slot_id')
  const hasAppliedFocusRef = useRef(false)

  // Always use current week for baseline schedule (no week picker)
  const weekStartISO = getWeekStartISO()

  // React Query hooks
  const {
    data: scheduleResponse,
    isLoading: isLoadingSchedule,
    error: scheduleError,
  } = useWeeklySchedule(weekStartISO)
  // Baseline is permanent (day × slot), not date-based; do not show school closures here (they appear on weekly schedule)
  const scheduleData = useMemo(
    () =>
      (scheduleResponse?.classrooms ?? []).filter(
        classroom => !isNeedsReviewClassroomName(classroom.classroom_name)
      ),
    [scheduleResponse?.classrooms]
  )
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
  const availableTimeSlotIds = useMemo(
    () => availableTimeSlots.map(ts => ts.id),
    [availableTimeSlots]
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
  const [teacherFilterId, setTeacherFilterId] = useState<string | null>(null)
  const prevAvailableClassroomIdsRef = useRef<string[] | null>(null)
  const prevAvailableTimeSlotIdsRef = useRef<string[] | null>(null)
  const previousAvailableClassroomsStorageKey = 'baseline-schedule-available-classroom-ids'
  const previousAvailableTimeSlotsStorageKey = 'baseline-schedule-available-time-slot-ids'
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
            slotFilterMode:
              parsed.slotFilterMode ??
              (parsed.displayFilters?.showAll === false ? 'select' : 'all'),
            showInactiveClassrooms: parsed.showInactiveClassrooms ?? false,
            showInactiveTimeSlots: parsed.showInactiveTimeSlots ?? false,
            displayFilters: {
              ...parsed.displayFilters,
            },
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
              slotFilterMode:
                parsed.slotFilterMode ??
                (parsed.displayFilters?.showAll === false ? 'select' : 'all'),
              showInactiveClassrooms: parsed.showInactiveClassrooms ?? false,
              showInactiveTimeSlots: parsed.showInactiveTimeSlots ?? false,
              displayFilters: {
                ...parsed.displayFilters,
              },
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
        slotFilterMode: 'all',
        showInactiveClassrooms: false,
        showInactiveTimeSlots: false,
        displayFilters: {
          belowRequired: true,
          belowPreferred: true,
          fullyStaffed: true,
          inactive: true,
          viewNotes: false,
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
      slotFilterMode: prev?.slotFilterMode ?? 'all',
      showInactiveClassrooms: prev?.showInactiveClassrooms ?? false,
      showInactiveTimeSlots: prev?.showInactiveTimeSlots ?? false,
      displayFilters: prev?.displayFilters ?? {
        belowRequired: true,
        belowPreferred: true,
        fullyStaffed: true,
        inactive: true,
        viewNotes: false,
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

    const nextSelected = reconcileSelectedIdsWithAvailable(
      filters.selectedClassroomIds,
      availableClassroomIds
    )
    if (nextSelected === filters.selectedClassroomIds) return

    setFilters(prev => (prev ? { ...prev, selectedClassroomIds: nextSelected } : prev))
  }, [availableClassroomIds, filters])

  // Normalize selected time slot IDs against current available time slots.
  useEffect(() => {
    if (!filters || availableTimeSlotIds.length === 0) return

    const nextSelected = reconcileSelectedIdsWithAvailable(
      filters.selectedTimeSlotIds,
      availableTimeSlotIds
    )
    if (nextSelected === filters.selectedTimeSlotIds) return

    setFilters(prev => (prev ? { ...prev, selectedTimeSlotIds: nextSelected } : prev))
  }, [availableTimeSlotIds, filters])

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

    const nextSelected = includeNewIdsWhenPreviouslyAllSelected(
      filters.selectedClassroomIds,
      previousAvailableIds,
      availableClassroomIds
    )
    if (nextSelected !== filters.selectedClassroomIds) {
      setFilters(prev => {
        if (!prev) return prev
        return { ...prev, selectedClassroomIds: nextSelected }
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

  // If new time slots appear and user previously had all currently-available time slots selected,
  // auto-include newly added time slot IDs so they immediately appear.
  useEffect(() => {
    if (!filters) return
    if (availableTimeSlotIds.length === 0) return

    let previousAvailableIds = prevAvailableTimeSlotIdsRef.current
    if (!previousAvailableIds && typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem(previousAvailableTimeSlotsStorageKey)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed)) {
            previousAvailableIds = parsed.filter((id): id is string => typeof id === 'string')
          }
        }
      } catch (e) {
        console.error('Error parsing previous available time slots:', e)
      }
    }
    if (!previousAvailableIds) previousAvailableIds = availableTimeSlotIds

    const nextSelected = includeNewIdsWhenPreviouslyAllSelected(
      filters.selectedTimeSlotIds,
      previousAvailableIds,
      availableTimeSlotIds
    )
    if (nextSelected !== filters.selectedTimeSlotIds) {
      setFilters(prev => {
        if (!prev) return prev
        return { ...prev, selectedTimeSlotIds: nextSelected }
      })
    }

    prevAvailableTimeSlotIdsRef.current = availableTimeSlotIds
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(
          previousAvailableTimeSlotsStorageKey,
          JSON.stringify(availableTimeSlotIds)
        )
      } catch (e) {
        console.error('Error saving previous available time slots:', e)
      }
    }
  }, [availableTimeSlotIds, filters?.selectedTimeSlotIds])

  // Handle refresh - invalidate React Query cache and refetch (used by header refresh button and after baseline cell save).
  // Navigation to weekly when returnToWeekly is true is handled by a separate "Back to Weekly" control, not by refresh.
  const handleRefresh = useCallback(async () => {
    if (schoolId) {
      invalidateWeeklySchedule(queryClient, schoolId)
      queryClient.invalidateQueries({ queryKey: ['scheduleSettings', schoolId] })
      await queryClient.refetchQueries({
        queryKey: weeklyScheduleKey(schoolId, weekStartISO),
      })
    }
  }, [schoolId, weekStartISO, queryClient])

  // Handle filter changes - ensure displayMode is always permanent-only for baseline schedule
  const handleFiltersChange = useCallback((newFilters: FilterState) => {
    setFilters({ ...newFilters, displayMode: 'permanent-only' })
  }, [])

  const filteredData = useMemo(
    () =>
      applyScheduleFilters(scheduleData, filters, {
        teacherFilterId,
        availableDays,
        availableTimeSlots,
        availableClassrooms,
        applyDisplayMode: false,
      }),
    [scheduleData, filters, teacherFilterId, availableDays, availableTimeSlots, availableClassrooms]
  )

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
          <WeeklyScheduleGridNew
            data={filteredData}
            selectedDayIds={filters?.selectedDayIds ?? selectedDayIds}
            scheduleDayIdsFromSettings={selectedDayIds}
            weekStartISO={weekStartISO}
            displayMode={filters?.displayMode ?? 'permanent-only'}
            showNotes={filters?.displayFilters?.viewNotes ?? false}
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
            showLegendTemporaryCoverage={false}
            showFilterChips={false}
            contentBelowLegend={
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setFilterPanelOpen(true)}
                    className="flex items-center gap-2"
                  >
                    <Filter className="h-4 w-4" />
                    Views & Filters
                  </Button>
                  <TeacherFilterSearch
                    value={teacherFilterId}
                    onChange={setTeacherFilterId}
                    placeholder="Filter by teacher"
                  />
                  {filters &&
                    (() => {
                      const defaultDayIds =
                        selectedDayIds.length > 0 ? selectedDayIds : availableDays.map(d => d.id)
                      const defaultDayCount = defaultDayIds.length
                      const active = hasActiveScheduleFilters(filters, {
                        defaultDayCount,
                        totalTimeSlots: availableTimeSlots.length,
                        totalClassrooms: availableClassrooms.length,
                        teacherFilterId,
                      })
                      if (!active) return null
                      return (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-slate-600 hover:text-slate-900"
                          onClick={() => {
                            setTeacherFilterId(null)
                            setFilters(prev =>
                              prev
                                ? getClearedScheduleFilters(prev, {
                                    defaultDayIds,
                                    allTimeSlotIds: availableTimeSlots.map(ts => ts.id),
                                    allClassroomIds: availableClassrooms.map(c => c.id),
                                  })
                                : prev
                            )
                          }}
                        >
                          <X className="h-3.5 w-3.5 shrink-0" />
                          Clear all filters
                        </Button>
                      )
                    })()}
                </div>
                <p className="text-sm text-muted-foreground italic">
                  Showing {slotCounts.shown} of {slotCounts.total} slots
                </p>
              </>
            }
            returnToWeekly={returnToWeekly}
            showDateInHeader={false}
            schoolClosures={[]}
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
