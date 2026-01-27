'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import WeeklyScheduleGridNew from '@/components/schedules/WeeklyScheduleGridNew'
import FilterPanel, { type FilterState } from '@/components/schedules/FilterPanel'
import WeekPicker from '@/components/schedules/WeekPicker'
import ErrorMessage from '@/components/shared/ErrorMessage'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Filter, RefreshCw } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useWeeklySchedule } from '@/lib/hooks/use-weekly-schedule'
import { useScheduleSettings } from '@/lib/hooks/use-schedule-settings'
import { useFilterOptions } from '@/lib/hooks/use-filter-options'
import { invalidateWeeklySchedule } from '@/lib/utils/invalidation'
import { useSchool } from '@/lib/contexts/SchoolContext'

// Calculate Monday of current week as ISO string for query key
function getWeekStartISO(): string {
  const today = new Date()
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  const monday = new Date(today.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().split('T')[0]
}

export default function WeeklySchedulePage() {
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const schoolId = useSchool()
  const focusClassroomId = searchParams.get('classroom_id')
  const focusDayId = searchParams.get('day_of_week_id')
  const focusTimeSlotId = searchParams.get('time_slot_id')
  const hasAppliedFocusRef = useRef(false)

  // Week state - initialize from localStorage or use current week
  const [weekStartISO, setWeekStartISO] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const savedWeek = localStorage.getItem('weekly-schedule-week')
      if (savedWeek) {
        return savedWeek
      }
    }
    return getWeekStartISO()
  })

  // Save week to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('weekly-schedule-week', weekStartISO)
    }
  }, [weekStartISO])

  // React Query hooks
  const {
    data: scheduleData = [],
    isLoading: isLoadingSchedule,
    isFetching: isFetchingSchedule,
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

  const loading = isLoadingSchedule || isLoadingSettings || isLoadingFilters
  const error = scheduleError
    ? scheduleError instanceof Error
      ? scheduleError.message
      : 'Failed to load weekly schedule'
    : null

  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [filters, setFilters] = useState<FilterState | null>(() => {
    // Load filters from localStorage on mount
    if (typeof window !== 'undefined') {
      const savedFilters = localStorage.getItem('weekly-schedule-filters')
      if (savedFilters) {
        try {
          const parsed = JSON.parse(savedFilters)
          // Ensure layout defaults to 'days-x-classrooms' if not set
          // Ensure displayMode defaults to 'all-scheduled-staff' if not set
          return {
            ...parsed,
            layout: parsed.layout || 'days-x-classrooms',
            displayMode: parsed.displayMode || 'all-scheduled-staff',
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
        const savedFilters = localStorage.getItem('weekly-schedule-filters')
        if (savedFilters) {
          try {
            const parsed = JSON.parse(savedFilters)
            setFilters({
              ...parsed,
              layout: parsed.layout || 'days-x-classrooms',
              displayMode: parsed.displayMode || 'all-scheduled-staff',
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
        displayMode: 'all-scheduled-staff',
        layout: 'days-x-classrooms', // Default layout
      })
    }
  }, [
    filters,
    availableDays,
    availableTimeSlots,
    availableClassrooms,
    selectedDayIds,
  ])

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
      displayMode: prev?.displayMode ?? 'all-scheduled-staff',
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

  // Save filters to localStorage whenever they change (with debounce to avoid excessive writes)
  useEffect(() => {
    if (filters && typeof window !== 'undefined') {
      try {
        localStorage.setItem('weekly-schedule-filters', JSON.stringify(filters))
      } catch (e) {
        console.error('Error saving filters to localStorage:', e)
      }
    }
  }, [filters])

  // Handle refresh - invalidate React Query cache
  const handleRefresh = () => {
    if (schoolId) {
      invalidateWeeklySchedule(queryClient, schoolId)
      queryClient.invalidateQueries({ queryKey: ['scheduleSettings', schoolId] })
    }
  }

  // Apply filters to data
  const filteredData = useMemo(() => {
    if (!filters) return scheduleData

    console.log('[WeeklySchedulePage] Filtering with displayMode:', filters.displayMode)
    console.log('[WeeklySchedulePage] Total scheduleData classrooms:', scheduleData.length)

    const result = scheduleData
      .filter(classroom => filters.selectedClassroomIds.includes(classroom.classroom_id))
      .map(classroom => ({
        ...classroom,
        days: classroom.days
          .filter(day => filters.selectedDayIds.includes(day.day_of_week_id))
          .map(day => ({
            ...day,
            time_slots: day.time_slots
              .filter(slot => filters.selectedTimeSlotIds.includes(slot.time_slot_id))
              .filter(slot => {
                // In Absences mode, we ONLY want slots that actually contain absences.
                // Do this before scheduleCell/staffing checks, since those checks can otherwise
                // "let through" lots of inactive/missing slots via displayFilters.inactive.
                if (filters.displayMode === 'absences') {
                  const hasAbsence = slot.absences && slot.absences.length > 0

                  if (hasAbsence) {
                    console.log('[WeeklySchedulePage] Absences filter - Slot passed:', {
                      weekStartISO,
                      classroom: classroom.classroom_name,
                      day: day.day_name,
                      timeSlot: slot.time_slot_code || slot.time_slot_id,
                      absencesCount: slot.absences?.length || 0,
                      absences: slot.absences?.map(a => ({
                        teacher_id: a.teacher_id,
                        teacher_name: a.teacher_name,
                        has_sub: a.has_sub,
                      })),
                    })
                  }

                  return hasAbsence
                }

                // In Subs mode, ONLY show slots that actually have a substitute assignment for this week.
                // Don't rely on class_id filtering since sub assignments may not have a class_id.
                if (filters.displayMode === 'substitutes-only') {
                  return (slot.assignments || []).some(a => a.is_substitute === true)
                }

                // In Permanent staff mode, ONLY show slots that have at least one non-floater, non-substitute teacher.
                // (This matches the chip intent: show where permanent staff are scheduled.)
                if (filters.displayMode === 'permanent-only') {
                  return (slot.assignments || []).some(
                    a => !!a.teacher_id && !a.is_floater && a.is_substitute !== true
                  )
                }

                // In Coverage Issues mode, ONLY show slots that are below required/preferred staffing.
                // Important: do this before "inactive" checks so we don't accidentally include lots of
                // inactive/missing scheduleCell slots via displayFilters.inactive.
                if (filters.displayMode === 'coverage-issues') {
                  const scheduleCell = slot.schedule_cell
                  if (!scheduleCell) return false
                  if (!scheduleCell.is_active) return false
                  if (
                    !scheduleCell.class_groups ||
                    scheduleCell.class_groups.length === 0 ||
                    !scheduleCell.enrollment_for_staffing
                  ) {
                    return false
                  }

                  const classGroups = scheduleCell.class_groups
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

                  // Count all teachers assigned to this classroom/day/time slot for coverage
                  // Teachers are assigned to classrooms, not specific class groups
                  // All teachers in the assignments array are already filtered by classroom_id in the API
                  // Exclude floaters from coverage counts
                  const coverageAssignments = (slot.assignments || []).filter(a => {
                    if (!a.teacher_id) return false
                    if (a.is_floater) return false
                    // Include all regular teachers and substitutes assigned to this classroom
                    return true
                  })

                  const assignedCount = coverageAssignments.length
                  const belowRequired =
                    requiredTeachers !== undefined && assignedCount < requiredTeachers
                  const belowPreferred =
                    preferredTeachers !== undefined && assignedCount < preferredTeachers

                  return belowRequired || belowPreferred
                }

                const scheduleCell = slot.schedule_cell
                if (!scheduleCell) return filters.displayFilters.inactive

                const isInactive = !scheduleCell.is_active
                if (isInactive) return filters.displayFilters.inactive

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
                const slotAssignments = slot.assignments.filter(
                  a => a.teacher_id && !a.is_substitute // Count regular teachers, exclude substitutes (they're counted separately)
                )
                const assignedCount = slotAssignments.length

                const belowRequired =
                  requiredTeachers !== undefined && assignedCount < requiredTeachers
                const belowPreferred =
                  preferredTeachers !== undefined && assignedCount < preferredTeachers
                const fullyStaffed =
                  requiredTeachers !== undefined &&
                  assignedCount >= requiredTeachers &&
                  (preferredTeachers === undefined || assignedCount >= preferredTeachers)

                // (absences/subs/permanent-only/coverage-issues modes handled above)

                if (belowRequired) return filters.displayFilters.belowRequired
                if (belowPreferred) return filters.displayFilters.belowPreferred
                if (fullyStaffed) return filters.displayFilters.fullyStaffed
                return false
              }),
          })),
      }))
      .filter(classroom => classroom.days.length > 0)

    // Debug: Log filtered results for substitutes mode
    if (filters.displayMode === 'substitutes-only') {
      const totalFilteredSlots = result.reduce((sum, classroom) => {
        return (
          sum +
          classroom.days.reduce((daySum, day) => {
            return daySum + day.time_slots.length
          }, 0)
        )
      }, 0)
      console.log('[WeeklySchedulePage] Filtered results for substitutes-only:', {
        totalFilteredClassrooms: result.length,
        totalFilteredSlots,
        classrooms: result.map(c => ({
          name: c.classroom_name,
          days: c.days.map(d => ({
            day: d.day_name,
            timeSlots: d.time_slots.map(ts => ({
              code: ts.time_slot_code,
              hasSubstitute: ts.assignments?.some(a => a.is_substitute === true) || false,
              substituteNames:
                ts.assignments?.filter(a => a.is_substitute === true).map(a => a.teacher_name) ||
                [],
            })),
          })),
        })),
      })
    }

    return result
  }, [scheduleData, filters, weekStartISO])

  // Base data for chip counts: apply only day/time/classroom selections, but NOT displayMode.
  // This keeps chip counts stable and non-confusing when a displayMode is selected.
  const baseDataForCounts = useMemo(() => {
    if (!filters) return scheduleData

    return scheduleData
      .filter(classroom => filters.selectedClassroomIds.includes(classroom.classroom_id))
      .map(classroom => ({
        ...classroom,
        days: classroom.days
          .filter(day => filters.selectedDayIds.includes(day.day_of_week_id))
          .map(day => ({
            ...day,
            time_slots: day.time_slots.filter(slot =>
              filters.selectedTimeSlotIds.includes(slot.time_slot_id)
            ),
          })),
      }))
  }, [scheduleData, filters])

  const displayModeCounts = useMemo(() => {
    let all = 0
    let permanent = 0
    let subs = 0
    let absences = 0
    let coverageIssues = 0

    baseDataForCounts.forEach(classroom => {
      classroom.days.forEach(day => {
        day.time_slots.forEach(slot => {
          // Total slots (cells)
          all += 1

          // Permanent staff: at least one non-floater, non-sub assignment
          if (
            (slot.assignments || []).some(
              a => !!a.teacher_id && !a.is_floater && a.is_substitute !== true
            )
          ) {
            permanent += 1
          }

          // Subs: at least one substitute assignment
          if ((slot.assignments || []).some(a => a.is_substitute === true)) {
            subs += 1
          }

          // Absences: any absence on the slot
          if (slot.absences && slot.absences.length > 0) {
            absences += 1
          }

          // Coverage issues: below required or preferred
          const scheduleCell = slot.schedule_cell
          if (
            scheduleCell &&
            scheduleCell.is_active &&
            scheduleCell.class_groups &&
            scheduleCell.class_groups.length > 0 &&
            scheduleCell.enrollment_for_staffing
          ) {
            const classGroupForRatio = scheduleCell.class_groups.reduce((lowest, current) => {
              const currentMinAge = current.min_age ?? Infinity
              const lowestMinAge = lowest.min_age ?? Infinity
              return currentMinAge < lowestMinAge ? current : lowest
            })

            const requiredTeachers = classGroupForRatio.required_ratio
              ? Math.ceil(scheduleCell.enrollment_for_staffing / classGroupForRatio.required_ratio)
              : undefined
            const preferredTeachers = classGroupForRatio.preferred_ratio
              ? Math.ceil(scheduleCell.enrollment_for_staffing / classGroupForRatio.preferred_ratio)
              : undefined

            const classGroupIds = scheduleCell.class_groups.map(cg => cg.id)
            const coverageAssignments = (slot.assignments || []).filter(a => {
              if (!a.teacher_id) return false
              if (a.is_floater) return false
              if (a.is_substitute === true) return true
              const classGroupId = a.class_group_id ?? a.class_id
              return !!classGroupId && classGroupIds.includes(classGroupId)
            })

            const assignedCount = coverageAssignments.length
            const belowRequired = requiredTeachers !== undefined && assignedCount < requiredTeachers
            const belowPreferred =
              preferredTeachers !== undefined && assignedCount < preferredTeachers

            if (belowRequired || belowPreferred) {
              coverageIssues += 1
            }
          }
        })
      })
    })

    return { all, permanent, subs, absences, coverageIssues }
  }, [baseDataForCounts])

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

    // Total possible slots should reflect the actual schedule grid data for the week,
    // not a theoretical cartesian product (which can include combinations that don't exist).
    const totalActualForWeek = scheduleData
      .filter(classroom => filters?.selectedClassroomIds?.includes(classroom.classroom_id) ?? true)
      .reduce((sum, classroom) => {
        return (
          sum +
          classroom.days
            .filter(day => filters?.selectedDayIds?.includes(day.day_of_week_id) ?? true)
            .reduce((daySum, day) => {
              return (
                daySum +
                day.time_slots.filter(
                  slot => filters?.selectedTimeSlotIds?.includes(slot.time_slot_id) ?? true
                ).length
              )
            }, 0)
        )
      }, 0)

    return {
      shown: totalShown,
      total: totalActualForWeek,
    }
  }, [filteredData, scheduleData, filters])

  const handleTodayClick = () => {
    setWeekStartISO(getWeekStartISO())
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Weekly Schedule</h1>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleRefresh}
                      disabled={isFetchingSchedule}
                      className="h-10 w-10 p-0 text-slate-500 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${isFetchingSchedule ? 'animate-spin' : ''}`}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Refresh schedule</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <WeekPicker
              weekStartISO={weekStartISO}
              onWeekChange={setWeekStartISO}
              onTodayClick={handleTodayClick}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setFilterPanelOpen(true)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Views & Filters
          </Button>
        </div>
        <p className="text-muted-foreground">View staffing by classroom, day, and time slot</p>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <WeeklyScheduleGridNew
            data={filteredData}
            selectedDayIds={filters?.selectedDayIds ?? selectedDayIds}
            layout={filters?.layout ?? 'days-x-classrooms'}
            onRefresh={handleRefresh}
            onFilterPanelOpenChange={setFilterPanelOpen}
            filterPanelOpen={filterPanelOpen}
            allowCardClick={false}
            displayModeCounts={displayModeCounts}
            displayMode={filters?.displayMode ?? 'all-scheduled-staff'}
            onDisplayModeChange={mode => {
              setFilters(prev => {
                if (prev) {
                  return { ...prev, displayMode: mode }
                }
                // If filters is null, initialize with defaults
                return {
                  selectedDayIds:
                    selectedDayIds.length > 0 ? selectedDayIds : availableDays.map(d => d.id),
                  selectedTimeSlotIds: availableTimeSlots.map(ts => ts.id),
                  selectedClassroomIds: availableClassrooms.map(c => c.id),
                  displayFilters: {
                    belowRequired: true,
                    belowPreferred: true,
                    fullyStaffed: true,
                    inactive: true,
                  },
                  displayMode: mode,
                  layout: 'days-x-classrooms' as const,
                }
              })
            }}
            slotCounts={slotCounts}
            initialSelectedCell={
              focusClassroomId && focusDayId && focusTimeSlotId
                ? {
                    classroomId: focusClassroomId,
                    dayId: focusDayId,
                    timeSlotId: focusTimeSlotId,
                  }
                : null
            }
          />
          <FilterPanel
            isOpen={filterPanelOpen}
            onClose={() => {
              setFilterPanelOpen(false)
            }}
            onFiltersChange={newFilters => {
              setFilters(newFilters)
            }}
            availableDays={availableDays}
            availableTimeSlots={availableTimeSlots}
            availableClassrooms={availableClassrooms}
            selectedDayIdsFromSettings={selectedDayIds}
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
                    layout: 'days-x-classrooms',
                  }
            }
          />
        </>
      )}
    </div>
  )
}
