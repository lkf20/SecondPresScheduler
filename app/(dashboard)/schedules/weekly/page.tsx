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
import { Calendar, Filter, RefreshCw } from 'lucide-react'
import TeacherFilterSearch from '@/components/schedules/TeacherFilterSearch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useWeeklySchedule } from '@/lib/hooks/use-weekly-schedule'
import { useScheduleSettings } from '@/lib/hooks/use-schedule-settings'
import { useFilterOptions } from '@/lib/hooks/use-filter-options'
import Link from 'next/link'
import { toast } from 'sonner'
import { invalidateWeeklySchedule } from '@/lib/utils/invalidation'
import { isSlotInactive } from '@/lib/utils/schedule-slot-activity'
import {
  includeNewIdsWhenPreviouslyAllSelected,
  reconcileSelectedIdsWithAvailable,
} from '@/lib/utils/filter-selection'
import { useSchool } from '@/lib/contexts/SchoolContext'
import { getTotalEnrollmentForCalculation } from '@/components/schedules/ScheduleSidePanel'
import type { WeeklyScheduleData } from '@/lib/api/weekly-schedule'
import {
  getEffectiveClassroomIds,
  getEffectiveTimeSlotIds,
  isStaffingNarrowing,
} from '@/lib/schedules/schedule-filter-helpers'

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

  // Week state - default to the current week
  const [weekStartISO, setWeekStartISO] = useState<string>(() => getWeekStartISO())

  // React Query hooks
  const {
    data: scheduleResponse,
    isLoading: isLoadingSchedule,
    isFetching: isFetchingSchedule,
    error: scheduleError,
  } = useWeeklySchedule(weekStartISO)
  const scheduleData = scheduleResponse?.classrooms ?? []
  const schoolClosures = scheduleResponse?.school_closures ?? []
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
      : 'Failed to load weekly schedule'
    : null

  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [teacherFilterId, setTeacherFilterId] = useState<string | null>(null)
  const prevAvailableClassroomIdsRef = useRef<string[] | null>(null)
  const prevAvailableTimeSlotIdsRef = useRef<string[] | null>(null)
  const previousAvailableClassroomsStorageKey = 'weekly-schedule-available-classroom-ids'
  const previousAvailableTimeSlotsStorageKey = 'weekly-schedule-available-time-slot-ids'
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
            slotFilterMode:
              parsed.slotFilterMode ??
              (parsed.displayFilters?.showAll === false ? 'select' : 'all'),
            showInactiveClassrooms: parsed.showInactiveClassrooms ?? true,
            showInactiveTimeSlots: parsed.showInactiveTimeSlots ?? true,
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
        const savedFilters = localStorage.getItem('weekly-schedule-filters')
        if (savedFilters) {
          try {
            const parsed = JSON.parse(savedFilters)
            setFilters({
              ...parsed,
              layout: parsed.layout || 'days-x-classrooms',
              displayMode: parsed.displayMode || 'all-scheduled-staff',
              slotFilterMode:
                parsed.slotFilterMode ??
                (parsed.displayFilters?.showAll === false ? 'select' : 'all'),
              showInactiveClassrooms: parsed.showInactiveClassrooms ?? true,
              showInactiveTimeSlots: parsed.showInactiveTimeSlots ?? true,
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
        showInactiveClassrooms: true,
        showInactiveTimeSlots: true,
        displayFilters: {
          belowRequired: true,
          belowPreferred: true,
          fullyStaffed: true,
          inactive: true,
          viewNotes: false,
        },
        displayMode: 'all-scheduled-staff',
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
      showInactiveClassrooms: prev?.showInactiveClassrooms ?? true,
      showInactiveTimeSlots: prev?.showInactiveTimeSlots ?? true,
      displayFilters: prev?.displayFilters ?? {
        belowRequired: true,
        belowPreferred: true,
        fullyStaffed: true,
        inactive: true,
        viewNotes: false,
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

  // If new time slots appear and user previously had all selected, auto-include newly added IDs.
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
    if (!previousAvailableIds) {
      previousAvailableIds = availableTimeSlotIds
    }

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

  // Handle refresh - invalidate React Query cache
  const handleRefresh = async () => {
    if (!schoolId) return

    await invalidateWeeklySchedule(queryClient, schoolId)
    await queryClient.invalidateQueries({ queryKey: ['scheduleSettings', schoolId] })

    // Force immediate refetch so grid updates right after save actions.
    await queryClient.refetchQueries({
      queryKey: ['weeklySchedule', schoolId],
      type: 'active',
    })
  }

  const handleClosureMarkOpen = async (closureId: string) => {
    try {
      const res = await fetch('/api/settings/calendar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delete_closure_ids: [closureId] }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to mark open')
      }
      toast.success('Closure removed. School is open for this time.')
      await handleRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  const handleClosureMarkOpenForDay = async (date: string) => {
    const closuresForDate = schoolClosures.filter(
      (c: { date: string; id: string }) => c.date === date
    )
    if (closuresForDate.length === 0) {
      toast.info('No closures for this date.')
      return
    }
    const ids = closuresForDate.map((c: { id: string }) => c.id)
    try {
      const res = await fetch('/api/settings/calendar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delete_closure_ids: ids }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to mark open')
      }
      toast.success(
        ids.length === 1
          ? 'Closure removed. School is open for this day.'
          : 'Closures removed. School is open for this day.'
      )
      await handleRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  const handleClosureChangeReason = async (closureId: string, newReason: string) => {
    try {
      const res = await fetch('/api/settings/calendar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          update_closure: { id: closureId, reason: newReason.trim() || null },
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to update reason')
      }
      toast.success('Closure reason updated.')
      await handleRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  // Apply filters to data.
  // Structural filters (days, time slots, classrooms): only limit which rows/columns exist; do not hide
  // a classroom or day just because it has no data. We fill in all selected (classroom, day, slot) so
  // collapse is only applied when slotFilterMode is 'select' and at least one staffing checkbox is unchecked.
  const filteredData = useMemo(() => {
    if (!filters) return scheduleData

    const df = filters.displayFilters
    const slotFilterMode = filters.slotFilterMode ?? 'all'
    const showAllSlots = slotFilterMode === 'all'
    const staffingNarrowing = isStaffingNarrowing(filters)

    const effectiveClassroomIds = getEffectiveClassroomIds(
      filters,
      availableClassrooms as { id: string; is_active?: boolean }[]
    )
    const effectiveTimeSlotIds = getEffectiveTimeSlotIds(
      filters,
      availableTimeSlots as { id: string; is_active?: boolean }[]
    )

    // Build day lookup from filter options for placeholder days
    const dayById = new Map(availableDays.map(d => [d.id, d]))
    const timeSlotById = new Map(
      availableTimeSlots.map(ts => [
        ts.id,
        {
          ...ts,
          default_start_time:
            (ts as { default_start_time?: string | null }).default_start_time ?? null,
          default_end_time: (ts as { default_end_time?: string | null }).default_end_time ?? null,
          is_active: (ts as { is_active?: boolean }).is_active !== false,
        },
      ])
    )

    const result = scheduleData
      .filter(classroom => {
        if (!effectiveClassroomIds.includes(classroom.classroom_id)) return false
        if (showAllSlots) return true
        return df.inactive || classroom.classroom_is_active !== false
      })
      .map(classroom => {
        // Structural fill-in: ensure every selected day exists; for each day, every selected time slot
        const daysWithSlots = filters.selectedDayIds.map(dayId => {
          const dayInfo = dayById.get(dayId)
          const existingDay = classroom.days.find(d => d.day_of_week_id === dayId)
          const existingTimeSlots = existingDay?.time_slots ?? []
          const time_slots = effectiveTimeSlotIds
            .map(slotId => {
              const existing = existingTimeSlots.find(s => s.time_slot_id === slotId)
              if (existing) return existing
              const ts = timeSlotById.get(slotId)
              if (!ts) return null
              return {
                time_slot_id: ts.id,
                time_slot_code: ts.code,
                time_slot_name: ts.name ?? null,
                time_slot_display_order: ts.display_order ?? null,
                time_slot_start_time: ts.default_start_time ?? null,
                time_slot_end_time: ts.default_end_time ?? null,
                time_slot_is_active: ts.is_active,
                assignments: [] as WeeklyScheduleData['assignments'],
                schedule_cell: null as {
                  id: string
                  is_active: boolean
                  enrollment_for_staffing: number | null
                  notes: string | null
                  required_staff_override?: number | null
                  preferred_staff_override?: number | null
                  class_groups?: Array<{
                    id: string
                    name: string
                    is_active?: boolean
                    age_unit: 'months' | 'years'
                    min_age: number | null
                    max_age: number | null
                    required_ratio: number
                    preferred_ratio: number | null
                    enrollment?: number | null
                  }>
                } | null,
              }
            })
            .filter(Boolean) as typeof existingTimeSlots
          return {
            day_of_week_id: dayId,
            day_name: dayInfo?.name ?? '',
            day_number: dayInfo?.day_number ?? 0,
            time_slots,
          }
        })

        const days = daysWithSlots.map(day => ({
          ...day,
          time_slots: day.time_slots.filter(slot => {
            if (
              teacherFilterId &&
              !(slot.assignments || []).some(a => a.teacher_id === teacherFilterId)
            ) {
              return false
            }
            if (showAllSlots) {
              // All slots: only teacher and displayMode apply; show active and inactive
              // (displayMode branches below still apply)
            } else if (!df.inactive && slot.time_slot_is_active === false) {
              return false
            }

            if (filters.displayMode === 'absences') {
              return !!(slot.absences && slot.absences.length > 0)
            }
            if (filters.displayMode === 'substitutes-only') {
              return (slot.assignments || []).some(a => a.is_substitute === true)
            }
            if (filters.displayMode === 'permanent-only') {
              return (slot.assignments || []).some(
                a => !!a.teacher_id && !a.is_floater && a.is_substitute !== true
              )
            }
            if (filters.displayMode === 'coverage-issues') {
              const scheduleCell = slot.schedule_cell
              if (!scheduleCell || !scheduleCell.is_active) return false
              if (
                !scheduleCell.class_groups ||
                scheduleCell.class_groups.length === 0 ||
                scheduleCell.enrollment_for_staffing == null
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
                    (scheduleCell.enrollment_for_staffing ?? 0) / classGroupForRatio.required_ratio
                  )
                : undefined
              const preferredTeachers = classGroupForRatio.preferred_ratio
                ? Math.ceil(
                    (scheduleCell.enrollment_for_staffing ?? 0) /
                      (classGroupForRatio.preferred_ratio ?? 1)
                  )
                : undefined
              const coverageAssignments = (slot.assignments || []).filter(a => {
                if (!a.teacher_id || a.is_floater) return false
                return true
              })
              const assignedCount = coverageAssignments.length
              const belowRequired =
                requiredTeachers !== undefined && assignedCount < requiredTeachers
              const belowPreferred =
                preferredTeachers !== undefined && assignedCount < preferredTeachers
              return belowRequired || belowPreferred
            }

            if (showAllSlots) return true

            if (isSlotInactive(slot)) return df.inactive

            const scheduleCell = slot.schedule_cell
            if (!scheduleCell) return false

            const classGroups = scheduleCell.class_groups ?? []
            const totalEnrollment = getTotalEnrollmentForCalculation(
              classGroups,
              scheduleCell.enrollment_for_staffing ?? null
            )
            if (!classGroups.length || totalEnrollment == null) {
              return false
            }

            const classGroupForRatio = classGroups.reduce((lowest, current) => {
              const currentMinAge = current.min_age ?? Infinity
              const lowestMinAge = lowest.min_age ?? Infinity
              return currentMinAge < lowestMinAge ? current : lowest
            })
            const calculatedRequired = classGroupForRatio.required_ratio
              ? Math.ceil(totalEnrollment / classGroupForRatio.required_ratio)
              : undefined
            const calculatedPreferred = classGroupForRatio.preferred_ratio
              ? Math.ceil(totalEnrollment / (classGroupForRatio.preferred_ratio ?? 1))
              : undefined
            const requiredTeachers =
              scheduleCell.required_staff_override != null
                ? scheduleCell.required_staff_override
                : calculatedRequired
            const preferredTeachers =
              scheduleCell.preferred_staff_override != null
                ? scheduleCell.preferred_staff_override
                : calculatedPreferred
            const slotAssignments = (slot.assignments || []).filter(
              a => a.teacher_id && !a.is_substitute
            )
            const assignedCount = slotAssignments.length
            const belowRequired = requiredTeachers !== undefined && assignedCount < requiredTeachers
            const belowPreferred =
              preferredTeachers !== undefined && assignedCount < preferredTeachers
            const fullyStaffed =
              requiredTeachers !== undefined &&
              assignedCount >= requiredTeachers &&
              (preferredTeachers === undefined || assignedCount >= preferredTeachers)

            if (belowRequired) return df.belowRequired
            if (belowPreferred) return df.belowPreferred
            if (fullyStaffed) return df.fullyStaffed
            return false
          }),
        }))

        return { ...classroom, days }
      })

    if (!staffingNarrowing) {
      return result
    }
    return result
      .map(classroom => ({
        ...classroom,
        days: classroom.days.filter(day => day.time_slots.length > 0),
      }))
      .filter(classroom => classroom.days.length > 0)
  }, [
    scheduleData,
    filters,
    weekStartISO,
    teacherFilterId,
    availableDays,
    availableTimeSlots,
    availableClassrooms,
  ])

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
              const classGroupId = a.class_group_id
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
        <div className="flex items-center gap-4 mb-2">
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
                    <RefreshCw className={`h-4 w-4 ${isFetchingSchedule ? 'animate-spin' : ''}`} />
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
            scheduleDayIdsFromSettings={selectedDayIds}
            weekStartISO={weekStartISO}
            layout={filters?.layout ?? 'days-x-classrooms'}
            onRefresh={handleRefresh}
            onFilterPanelOpenChange={setFilterPanelOpen}
            filterPanelOpen={filterPanelOpen}
            allowCardClick
            readOnly
            leadingFilterContent={
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
                    const defaultDayCount =
                      selectedDayIds.length > 0 ? selectedDayIds.length : availableDays.length
                    const hasActiveFilters =
                      filters.slotFilterMode === 'select' ||
                      !filters.displayFilters.belowRequired ||
                      !filters.displayFilters.belowPreferred ||
                      !filters.displayFilters.fullyStaffed ||
                      !filters.displayFilters.inactive ||
                      !filters.showInactiveClassrooms ||
                      !filters.showInactiveTimeSlots ||
                      filters.displayMode !== 'all-scheduled-staff' ||
                      filters.selectedClassroomIds.length < availableClassrooms.length ||
                      filters.selectedTimeSlotIds.length < availableTimeSlots.length ||
                      filters.selectedDayIds.length < defaultDayCount ||
                      teacherFilterId != null
                    if (!hasActiveFilters) return null
                    return (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-600 hover:text-slate-900"
                        onClick={() => {
                          setTeacherFilterId(null)
                          setFilters(prev =>
                            prev
                              ? {
                                  ...prev,
                                  selectedDayIds:
                                    selectedDayIds.length > 0
                                      ? selectedDayIds
                                      : availableDays.map(d => d.id),
                                  selectedTimeSlotIds: availableTimeSlots.map(ts => ts.id),
                                  selectedClassroomIds: availableClassrooms.map(c => c.id),
                                  displayMode: 'all-scheduled-staff',
                                  slotFilterMode: 'all',
                                  showInactiveClassrooms: true,
                                  showInactiveTimeSlots: true,
                                  displayFilters: {
                                    ...prev.displayFilters,
                                    belowRequired: true,
                                    belowPreferred: true,
                                    fullyStaffed: true,
                                    inactive: false,
                                  },
                                }
                              : prev
                          )
                        }}
                      >
                        Clear all filters
                      </Button>
                    )
                  })()}
              </div>
            }
            trailingFilterContent={
              <Link
                href="/settings/calendar"
                className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
              >
                <Calendar className="h-4 w-4" />
                Manage Calendar
              </Link>
            }
            displayModeCounts={displayModeCounts}
            displayMode={filters?.displayMode ?? 'all-scheduled-staff'}
            showNotes={filters?.displayFilters?.viewNotes ?? false}
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
                  slotFilterMode: 'all',
                  showInactiveClassrooms: true,
                  showInactiveTimeSlots: true,
                  displayFilters: {
                    belowRequired: true,
                    belowPreferred: true,
                    fullyStaffed: true,
                    inactive: true,
                    viewNotes: false,
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
            schoolClosures={schoolClosures}
            onClosureMarkOpen={handleClosureMarkOpen}
            onClosureMarkOpenForDay={handleClosureMarkOpenForDay}
            onClosureChangeReason={handleClosureChangeReason}
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
