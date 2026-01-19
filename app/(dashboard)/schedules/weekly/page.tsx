'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import WeeklyScheduleGridNew from '@/components/schedules/WeeklyScheduleGridNew'
import FilterPanel, { type FilterState } from '@/components/schedules/FilterPanel'
import ErrorMessage from '@/components/shared/ErrorMessage'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Filter } from 'lucide-react'
import { useWeeklySchedule } from '@/lib/hooks/use-weekly-schedule'
import { useScheduleSettings } from '@/lib/hooks/use-schedule-settings'
import { useFilterOptions } from '@/lib/hooks/use-filter-options'
import { invalidateWeeklySchedule } from '@/lib/utils/invalidation'
import { useSchool } from '@/lib/contexts/SchoolContext'
import type { WeeklyScheduleDataByClassroom } from '@/lib/api/weekly-schedule'
import type { Database } from '@/types/database'

type DayOfWeek = Database['public']['Tables']['days_of_week']['Row']
type TimeSlot = Database['public']['Tables']['time_slots']['Row']
type Classroom = Database['public']['Tables']['classrooms']['Row']

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
  const weekStartISO = getWeekStartISO()
  
  // React Query hooks
  const { data: scheduleData = [], isLoading: isLoadingSchedule, error: scheduleError } = useWeeklySchedule(weekStartISO)
  const { data: scheduleSettings, isLoading: isLoadingSettings } = useScheduleSettings()
  const { data: filterOptions, isLoading: isLoadingFilters } = useFilterOptions()
  
  const selectedDayIds = scheduleSettings?.selected_day_ids || []
  const availableDays = filterOptions?.days || []
  const availableTimeSlots = filterOptions?.timeSlots || []
  const availableClassrooms = filterOptions?.classrooms || []
  
  const loading = isLoadingSchedule || isLoadingSettings || isLoadingFilters
  const error = scheduleError ? (scheduleError instanceof Error ? scheduleError.message : 'Failed to load weekly schedule') : null
  
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [filters, setFilters] = useState<FilterState | null>(() => {
    // Load filters from localStorage on mount
    if (typeof window !== 'undefined') {
      const savedFilters = localStorage.getItem('weekly-schedule-filters')
      if (savedFilters) {
        try {
          const parsed = JSON.parse(savedFilters)
          // Ensure layout defaults to 'classrooms-x-days' if not set
          return {
            ...parsed,
            layout: parsed.layout || 'classrooms-x-days',
          }
        } catch (e) {
          console.error('Error parsing saved filters:', e)
        }
      }
    }
    return null
  })

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

    setFilters((prev) => ({
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
      layout: prev?.layout ?? 'classrooms-x-days',
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

  // Save filters to localStorage whenever they change
  useEffect(() => {
    if (filters && typeof window !== 'undefined') {
      localStorage.setItem('weekly-schedule-filters', JSON.stringify(filters))
    }
  }, [filters])
  
  // Handle refresh - invalidate React Query cache
  const handleRefresh = () => {
    if (schoolId) {
      invalidateWeeklySchedule(queryClient, schoolId)
      queryClient.invalidateQueries({ queryKey: ['scheduleSettings', schoolId] })
    }
  }

  // Sort days - only show days selected in Settings > Days and Time Slots
  const sortedDays = useMemo(() => {
    const filtered =
      selectedDayIds.length > 0
        ? availableDays.filter(day => selectedDayIds.includes(day.id))
        : availableDays
    return filtered.sort((a, b) => {
      const aNum = a.day_number === 0 ? 7 : a.day_number
      const bNum = b.day_number === 0 ? 7 : b.day_number
      return aNum - bNum
    })
  }, [availableDays, selectedDayIds])

  // Apply filters to data
  const filteredData = useMemo(() => {
    if (!filters) return scheduleData

    return scheduleData
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

                // Get class group IDs for filtering assignments
                const classGroupIds = classGroups.map(cg => cg.id)
                const assignedCount = slot.assignments.filter(
                  a => a.teacher_id && a.class_id && classGroupIds.includes(a.class_id)
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
      sortedDays.length * availableTimeSlots.length * availableClassrooms.length

    return {
      shown: totalShown,
      total: totalIfAllSelected,
    }
  }, [filteredData, sortedDays, availableTimeSlots, availableClassrooms])

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Weekly Schedule</h1>
          <p className="text-muted-foreground mt-2">
            Manage staffing by classroom, day, and time slot
          </p>
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

      {error && <ErrorMessage message={error} className="mb-6" />}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="mb-4">
            <p className="text-sm text-muted-foreground italic">
              Showing {slotCounts.shown} of {slotCounts.total} slots
            </p>
          </div>
          <WeeklyScheduleGridNew
            data={filteredData}
            selectedDayIds={filters?.selectedDayIds ?? selectedDayIds}
            layout={filters?.layout ?? 'classrooms-x-days'}
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
            initialFilters={{
              selectedDayIds: selectedDayIds,
              layout: filters?.layout ?? 'classrooms-x-days',
            }}
          />
        </>
      )}
    </div>
  )
}
