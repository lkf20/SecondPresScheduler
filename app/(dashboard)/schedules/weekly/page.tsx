'use client'

import { useState, useEffect, useMemo } from 'react'
import WeeklyScheduleGridNew from '@/components/schedules/WeeklyScheduleGridNew'
import FilterPanel, { type FilterState } from '@/components/schedules/FilterPanel'
import ErrorMessage from '@/components/shared/ErrorMessage'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Filter } from 'lucide-react'
import type { WeeklyScheduleDataByClassroom } from '@/lib/api/weekly-schedule'

export default function WeeklySchedulePage() {
  const [data, setData] = useState<WeeklyScheduleDataByClassroom[]>([])
  const [selectedDayIds, setSelectedDayIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
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
            layout: parsed.layout || 'classrooms-x-days'
          }
        } catch (e) {
          console.error('Error parsing saved filters:', e)
        }
      }
    }
    return null
  })
  const [availableDays, setAvailableDays] = useState<any[]>([])
  const [availableTimeSlots, setAvailableTimeSlots] = useState<any[]>([])
  const [availableClassrooms, setAvailableClassrooms] = useState<any[]>([])

  // Save filters to localStorage whenever they change
  useEffect(() => {
    if (filters && typeof window !== 'undefined') {
      localStorage.setItem('weekly-schedule-filters', JSON.stringify(filters))
    }
  }, [filters])

  const fetchData = () => {
    // Fetch schedule settings for selected days first
    fetch('/api/schedule-settings')
      .then(async (r) => {
        if (!r.ok) {
          const text = await r.text()
          throw new Error(`HTTP error! status: ${r.status}, response: ${text.substring(0, 100)}`)
        }
        const contentType = r.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
          const text = await r.text()
          throw new Error(`Expected JSON but got ${contentType}. Response: ${text.substring(0, 100)}`)
        }
        return r.json()
      })
      .then((settings) => {
        const dayIds = settings.selected_day_ids && Array.isArray(settings.selected_day_ids) 
          ? settings.selected_day_ids 
          : []
        setSelectedDayIds(dayIds)
        setSettingsLoaded(true)
        
        // Fetch weekly schedule data after we have selectedDayIds
        // The API will use these to filter, but we also filter in the component as backup
        // Add cache-busting to ensure fresh data
        return fetch(`/api/weekly-schedule?t=${Date.now()}`)
      })
      .then(async (r) => {
        if (!r.ok) {
          const text = await r.text()
          throw new Error(`HTTP error! status: ${r.status}, response: ${text.substring(0, 100)}`)
        }
        const contentType = r.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
          const text = await r.text()
          throw new Error(`Expected JSON but got ${contentType}. Response: ${text.substring(0, 100)}`)
        }
        return r.json()
      })
      .then((data) => {
        setData(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message || 'Failed to load weekly schedule')
        setLoading(false)
        console.error('Error loading weekly schedule:', err)
        // Still mark settings as loaded even if schedule fails
        setSettingsLoaded(true)
      })
  }

  // Fetch filter options
  useEffect(() => {
    const fetchWithErrorHandling = async (url: string) => {
      const r = await fetch(url)
      if (!r.ok) {
        const text = await r.text()
        throw new Error(`HTTP error! status: ${r.status}, response: ${text.substring(0, 100)}`)
      }
      const contentType = r.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await r.text()
        throw new Error(`Expected JSON but got ${contentType}. Response: ${text.substring(0, 100)}`)
      }
      return r.json()
    }

    Promise.all([
      fetchWithErrorHandling('/api/days-of-week'),
      fetchWithErrorHandling('/api/timeslots'),
      fetchWithErrorHandling('/api/classrooms'),
    ])
      .then(([days, timeSlots, classrooms]) => {
        setAvailableDays(days || [])
        setAvailableTimeSlots(timeSlots || [])
        setAvailableClassrooms(classrooms || [])
      })
      .catch((err) => {
        console.error('Error fetching filter options:', err)
        setError(`Failed to load filter options: ${err.message}`)
      })
  }, [])

  useEffect(() => {
    fetchData()
  }, [refreshKey])

  // Sort days - only show days selected in Settings > Days and Time Slots
  const sortedDays = useMemo(() => {
    const filtered = selectedDayIds.length > 0
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
    if (!filters) return data

    return data
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
                if (!scheduleCell.class_groups || scheduleCell.class_groups.length === 0 || !scheduleCell.enrollment_for_staffing) {
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
                  ? Math.ceil(scheduleCell.enrollment_for_staffing / classGroupForRatio.required_ratio)
                  : undefined
                const preferredTeachers = classGroupForRatio.preferred_ratio
                  ? Math.ceil(scheduleCell.enrollment_for_staffing / classGroupForRatio.preferred_ratio)
                  : undefined

                // Get class group IDs for filtering assignments
                const classGroupIds = classGroups.map(cg => cg.id)
                const assignedCount = slot.assignments.filter(a => 
                  a.teacher_id && a.class_id && classGroupIds.includes(a.class_id)
                ).length

                const belowRequired = requiredTeachers !== undefined && assignedCount < requiredTeachers
                const belowPreferred = preferredTeachers !== undefined && assignedCount < preferredTeachers
                const fullyStaffed = requiredTeachers !== undefined && 
                  assignedCount >= requiredTeachers &&
                  (preferredTeachers === undefined || assignedCount >= preferredTeachers)

                if (belowRequired) return filters.displayFilters.belowRequired
                if (belowPreferred) return filters.displayFilters.belowPreferred
                if (fullyStaffed) return filters.displayFilters.fullyStaffed
                return false
              })
          }))
      }))
      .filter(classroom => classroom.days.length > 0)
  }, [data, filters])

  // Calculate slot counts for display
  const slotCounts = useMemo(() => {
    // Count actual slots currently shown
    const totalShown = filteredData.reduce((sum, classroom) => {
      return sum + classroom.days.reduce((daySum, day) => {
        return daySum + day.time_slots.length
      }, 0)
    }, 0)

    // Calculate total slots if all filters were selected
    // Only use days that are selected in Settings (not all available days)
    const totalIfAllSelected = sortedDays.length * 
                               availableTimeSlots.length * 
                               availableClassrooms.length

    return {
      shown: totalShown,
      total: totalIfAllSelected
    }
  }, [filteredData, sortedDays, availableTimeSlots, availableClassrooms])

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Weekly Schedule</h1>
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

      {loading || !settingsLoaded ? (
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
            onRefresh={() => setRefreshKey((prev) => prev + 1)}
            onFilterPanelOpenChange={setFilterPanelOpen}
            filterPanelOpen={filterPanelOpen}
          />
          <FilterPanel
            isOpen={filterPanelOpen}
            onClose={() => {
              setFilterPanelOpen(false)
            }}
            onFiltersChange={(newFilters) => {
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

