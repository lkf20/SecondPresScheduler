'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import SlotStatusToggle from './SlotStatusToggle'
import ClassGroupMultiSelect from './ClassGroupMultiSelect'
import EnrollmentInput from './EnrollmentInput'
import TeacherMultiSelect from './TeacherMultiSelect'
import MultiDayApplySelector from './MultiDayApplySelector'
import UnsavedChangesDialog from './UnsavedChangesDialog'
import ConflictBanner, { type Conflict, type ConflictResolution } from './ConflictBanner'
import type { ScheduleCellWithDetails } from '@/lib/api/schedule-cells'
import type { WeeklyScheduleData } from '@/lib/api/weekly-schedule'
import type {
  TimeSlot,
  ClassGroup,
  ClassroomWithAllowedClasses,
  TeacherSchedule,
} from '@/types/api'
import {
  getPanelBackgroundClasses,
  getPanelHeaderBackgroundClasses,
  panelBackgrounds,
} from '@/lib/utils/colors'

interface Teacher {
  id: string
  name: string
  teacher_id?: string
  is_floater?: boolean
}

type ClassGroupWithMeta = ClassGroup & {
  is_active?: boolean | null
}

type SelectedCellData = WeeklyScheduleData & {
  schedule_cell:
    | (Partial<ScheduleCellWithDetails> & {
        id: string
        is_active: boolean
        enrollment_for_staffing: number | null
        notes: string | null
      })
    | null
}

interface ScheduleSidePanelProps {
  isOpen: boolean
  onClose: () => void
  dayId: string
  dayName: string
  timeSlotId: string
  timeSlotName: string
  timeSlotCode: string
  timeSlotStartTime: string | null
  timeSlotEndTime: string | null
  classroomId: string
  classroomName: string
  selectedDayIds: string[] // Days that are in the weekly schedule
  selectedCellData?: SelectedCellData // Full cell data from the grid
  onSave?: () => void
}

const mapAssignmentsToTeachers = (assignments?: WeeklyScheduleData['assignments']): Teacher[] => {
  if (!assignments) return []
  const seen = new Set<string>()
  return assignments
    .filter(assignment => assignment.teacher_id && !assignment.is_substitute)
    .filter(assignment => {
      if (!assignment.teacher_id) return false
      if (seen.has(assignment.teacher_id)) return false
      seen.add(assignment.teacher_id)
      return true
    })
    .map(assignment => ({
      id: assignment.teacher_id,
      name: assignment.teacher_name || 'Unknown',
      teacher_id: assignment.teacher_id,
      is_floater: assignment.is_floater ?? false,
    }))
}

const debug = false
const log = (...args: unknown[]) => {
  if (debug) {
    console.log(...args)
  }
}

const getScheduleClassGroupId = (schedule: TeacherSchedule) =>
  schedule.class_group_id ?? schedule.class_id ?? null

export default function ScheduleSidePanel({
  isOpen,
  onClose,
  dayId,
  dayName,
  timeSlotId,
  timeSlotCode,
  timeSlotStartTime,
  timeSlotEndTime,
  classroomId,
  classroomName,
  selectedDayIds,
  selectedCellData,
  onSave,
}: ScheduleSidePanelProps) {
  const [cell, setCell] = useState<
    | (Partial<ScheduleCellWithDetails> & {
        id: string
        is_active: boolean
        enrollment_for_staffing: number | null
        notes: string | null
      })
    | null
  >(null)
  const [isActive, setIsActive] = useState(true)
  const [classGroupIds, setClassGroupIds] = useState<string[]>([])
  const [enrollment, setEnrollment] = useState<number | null>(null)
  const [notes, setNotes] = useState<string | null>(null)
  const [selectedTeachers, setSelectedTeachers] = useState<Teacher[]>([])
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(false)
  const [allowedClassGroupIds, setAllowedClassGroupIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false)
  const [applyScope, setApplyScope] = useState<'single' | 'timeSlot' | 'day'>('single')
  const [applyDayIds, setApplyDayIds] = useState<string[]>([dayId])
  const [applyTimeSlotIds, setApplyTimeSlotIds] = useState<string[]>([timeSlotId])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [classGroups, setClassGroups] = useState<ClassGroupWithMeta[]>([])
  const [allAvailableClassGroups, setAllAvailableClassGroups] = useState<ClassGroupWithMeta[]>([])
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [conflictResolutions, setConflictResolutions] = useState<Map<string, ConflictResolution>>(
    new Map()
  )
  // Track the original cell state when first loaded to determine if it was empty
  const originalCellStateRef = useRef<{ isActive: boolean; hasData: boolean } | null>(null)
  // Track if we've loaded initial data to prevent useEffect from clearing classGroups prematurely
  const hasLoadedInitialDataRef = useRef(false)
  // Track the initial classGroupIds to prevent useEffect from running with stale empty state
  const initialClassGroupIdsRef = useRef<string[] | null>(null)
  // Track previous classGroupIds to detect when class groups are removed
  const previousClassGroupIdsRef = useRef<string[]>([])
  // Flag to preserve teachers when class groups are removed
  const preserveTeachersRef = useRef(false)
  // Store teachers in ref so we can preserve them even if state hasn't updated
  const selectedTeachersRef = useRef<Teacher[]>([])
  const teachersLoadedRef = useRef(false)
  const teacherCacheRef = useRef<Map<string, Teacher[]>>(new Map())
  const teacherFetchKeyRef = useRef<string | null>(null)
  const classGroupsRef = useRef<ClassGroupWithMeta[]>([])

  const fallbackTeachers = selectedCellData?.assignments
    ? mapAssignmentsToTeachers(selectedCellData.assignments)
    : []
  const displayTeachers = selectedTeachers.length > 0 ? selectedTeachers : fallbackTeachers

  useEffect(() => {
    if (!isOpen) return
    if (teachersLoadedRef.current) return
    const mappedTeachers = mapAssignmentsToTeachers(selectedCellData?.assignments)
    if (mappedTeachers.length === 0) return

    log('[ScheduleSidePanel] Seeding teachers from selectedCellData.assignments', {
      count: mappedTeachers.length,
    })
    setSelectedTeachers(mappedTeachers)
  }, [isOpen, selectedCellData?.assignments])

  useEffect(() => {
    selectedTeachersRef.current = selectedTeachers
  }, [selectedTeachers])

  useEffect(() => {
    classGroupsRef.current = classGroups
  }, [classGroups])

  // Format time range for header
  const timeRange =
    timeSlotStartTime && timeSlotEndTime ? `${timeSlotStartTime}–${timeSlotEndTime}` : ''

  const normalizeClassGroup = useCallback(
    (cg: {
      id: string
      name: string
      parent_class_id?: string | null
      min_age: number | null
      max_age: number | null
      required_ratio: number
      preferred_ratio: number | null
      is_active?: boolean | null
      order?: number | null
    }): ClassGroupWithMeta => ({
      id: cg.id,
      name: cg.name || '',
      parent_class_id: cg.parent_class_id ?? null,
      min_age: cg.min_age ?? null,
      max_age: cg.max_age ?? null,
      required_ratio: cg.required_ratio ?? 8,
      preferred_ratio: cg.preferred_ratio ?? null,
      is_active: cg.is_active ?? true,
      order: cg.order ?? null,
    }),
    []
  )

  const initializeFromCell = useCallback(
    (
      cellData: Partial<ScheduleCellWithDetails> & {
        id: string
        is_active: boolean
        enrollment_for_staffing: number | null
        notes: string | null
      },
      sourceAssignments?: WeeklyScheduleData['assignments']
    ) => {
      setCell(cellData)
      setIsActive(cellData.is_active ?? true)
      const mappedClassGroupIds = cellData.class_groups?.map(cg => cg.id) || []
      log('[ScheduleSidePanel] Initial load - classGroupIds:', mappedClassGroupIds)
      log('[ScheduleSidePanel] Initial load - cellData.class_groups:', cellData.class_groups)
      initialClassGroupIdsRef.current = mappedClassGroupIds
      previousClassGroupIdsRef.current = mappedClassGroupIds
      preserveTeachersRef.current = false
      setClassGroupIds(mappedClassGroupIds)
      if (cellData.class_groups && cellData.class_groups.length > 0) {
        const mappedClassGroups = cellData.class_groups.map(cg => normalizeClassGroup(cg))
        log('[ScheduleSidePanel] Initial load - mappedClassGroups:', mappedClassGroups)
        setClassGroups(mappedClassGroups)
        hasLoadedInitialDataRef.current = true
      } else {
        log('[ScheduleSidePanel] Initial load - no class groups, setting empty array')
        setClassGroups([])
        hasLoadedInitialDataRef.current = true
      }
      setEnrollment(cellData.enrollment_for_staffing)
      setNotes(cellData.notes)
      const mappedTeachers = mapAssignmentsToTeachers(sourceAssignments)
      if (mappedTeachers.length > 0 && !teachersLoadedRef.current) {
        setSelectedTeachers(mappedTeachers)
      }
      const originallyHadData = !!(
        mappedClassGroupIds.length > 0 || cellData.enrollment_for_staffing !== null
      )
      originalCellStateRef.current = {
        isActive: cellData.is_active ?? true,
        hasData: originallyHadData,
      }
    },
    [normalizeClassGroup]
  )

  // Fetch time slots for 'day' scope
  useEffect(() => {
    if (!isOpen) return

    fetch('/api/timeslots')
      .then(r => r.json())
      .then(data => {
        setTimeSlots(data)
        // Initialize applyTimeSlotIds with all time slots for 'day' scope
        if (applyScope === 'day' && data.length > 0) {
          setApplyTimeSlotIds(data.map((ts: TimeSlot) => ts.id))
        }
      })
      .catch(console.error)
  }, [isOpen, applyScope])

  // Fetch cell data when drawer opens, or use provided selectedCellData
  useEffect(() => {
    if (!isOpen) {
      // Reset the refs when drawer closes
      hasLoadedInitialDataRef.current = false
      initialClassGroupIdsRef.current = null
      preserveTeachersRef.current = false
      teachersLoadedRef.current = false
      return
    }

    setLoading(true)
    hasLoadedInitialDataRef.current = false
    initialClassGroupIdsRef.current = null
    teachersLoadedRef.current = false

    // If selectedCellData is provided and has a schedule_cell, use it
    // Note: selectedCellData structure has schedule_cell nested
    if (selectedCellData?.schedule_cell) {
      const cellData = selectedCellData.schedule_cell
      initializeFromCell(cellData, selectedCellData.assignments)
      setLoading(false)
      return
    }

    // Otherwise fetch from API
    fetch(
      `/api/schedule-cells?classroom_id=${classroomId}&day_of_week_id=${dayId}&time_slot_id=${timeSlotId}`
    )
      .then(r => r.json())
      .then(data => {
        if (data && data.length > 0) {
          const cellData = data[0]
          initializeFromCell(cellData)
        } else {
          // No cell exists, create default
          setIsActive(false)
          initialClassGroupIdsRef.current = []
          previousClassGroupIdsRef.current = []
          preserveTeachersRef.current = false
          setClassGroupIds([])
          setClassGroups([])
          setEnrollment(null)
          setNotes(null)
          hasLoadedInitialDataRef.current = true
          // Store original state - cell was empty and inactive
          originalCellStateRef.current = {
            isActive: false,
            hasData: false,
          }
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching schedule cell:', err)
        setLoading(false)
      })

    // Fetch classroom allowed class groups
    fetch('/api/classrooms')
      .then(r => r.json())
      .then((data: ClassroomWithAllowedClasses[]) => {
        const classroom = data.find(c => c.id === classroomId)
        if (classroom && classroom.allowed_classes) {
          const ids = classroom.allowed_classes
            .map(ac => ac.class_group_id ?? ac.class_group?.id)
            .filter((id): id is string => Boolean(id))
          setAllowedClassGroupIds(ids)
        }
      })
      .catch(console.error)

    // Fetch all class groups (including inactive) for updating classGroups when classGroupIds changes
    fetch('/api/class-groups?includeInactive=true')
      .then(r => r.json())
      .then(data => {
        const items = Array.isArray(data) ? (data as ClassGroupWithMeta[]) : []
        setAllAvailableClassGroups(items)
      })
      .catch(console.error)
  }, [isOpen, classroomId, dayId, timeSlotId, selectedCellData, initializeFromCell])

  // Update classGroups when classGroupIds changes
  useEffect(() => {
    log('[ScheduleSidePanel] useEffect - classGroupIds:', classGroupIds)
    log(
      '[ScheduleSidePanel] useEffect - allAvailableClassGroups.length:',
      allAvailableClassGroups.length
    )
    log('[ScheduleSidePanel] useEffect - current classGroups:', classGroupsRef.current)
    log('[ScheduleSidePanel] useEffect - loading:', loading)
    log('[ScheduleSidePanel] useEffect - hasLoadedInitialData:', hasLoadedInitialDataRef.current)

    // Don't update if we're still loading - wait for initial data to be set
    if (loading) {
      log('[ScheduleSidePanel] useEffect - still loading, skipping update')
      return
    }

    // Don't clear classGroups if we haven't loaded initial data yet
    // This prevents the useEffect from running with stale empty state before initial load completes
    if (!hasLoadedInitialDataRef.current) {
      log('[ScheduleSidePanel] useEffect - initial data not loaded yet, skipping update')
      return
    }

    // If classGroupIds is empty, check if this is stale state or legitimate user action
    if (classGroupIds.length === 0) {
      // If we haven't loaded initial data yet, this is likely stale state - skip
      if (!hasLoadedInitialDataRef.current) {
        log(
          '[ScheduleSidePanel] useEffect - classGroupIds is empty and initial data not loaded, skipping (stale state)'
        )
        return
      }

      // If we have initial classGroupIds but classGroups is also empty, this is likely stale state
      // (happens when useEffect runs with empty classGroupIds before initial data sets it)
      if (
        initialClassGroupIdsRef.current &&
        initialClassGroupIdsRef.current.length > 0 &&
        classGroupsRef.current.length === 0
      ) {
        log(
          '[ScheduleSidePanel] useEffect - classGroupIds is empty, had initial classGroupIds, but classGroups is also empty, skipping (stale state)'
        )
        return
      }

      // If we have classGroups but classGroupIds is empty, check if this matches initial state
      // If initial was also empty, this is fine. If initial had values, this might be stale.
      // But if hasLoadedInitialData is true and we have classGroups, it's likely user removed all
      if (
        initialClassGroupIdsRef.current &&
        initialClassGroupIdsRef.current.length > 0 &&
        classGroupsRef.current.length > 0
      ) {
        // This is likely a legitimate user action - user removed all class groups
        log(
          '[ScheduleSidePanel] useEffect - classGroupIds is empty but we have classGroups, clearing (user removed all)'
        )
        setClassGroups([])
        return
      }

      // Otherwise, clear classGroups
      log('[ScheduleSidePanel] useEffect - classGroupIds is empty, clearing classGroups')
      setClassGroups([])
      return
    }

    // If allAvailableClassGroups hasn't loaded yet, update from existing classGroups
    // This allows immediate updates when user adds/removes class groups
    if (allAvailableClassGroups.length === 0) {
      log(
        '[ScheduleSidePanel] useEffect - allAvailableClassGroups not loaded yet, updating from existing classGroups'
      )
      // Filter existing classGroups to match the new classGroupIds
      const filteredFromExisting = classGroupsRef.current.filter(cg =>
        classGroupIds.includes(cg.id)
      )

      // Check if we're missing any class groups (user added new ones)
      const missingIds = classGroupIds.filter(id => !filteredFromExisting.some(cg => cg.id === id))

      if (missingIds.length > 0) {
        // Fetch missing class groups on demand
        log('[ScheduleSidePanel] useEffect - missing class groups, fetching:', missingIds)
        Promise.all(
          missingIds.map(id =>
            fetch(`/api/class-groups/${id}`)
              .then(r => r.json())
              .catch(() => null)
          )
        ).then(results => {
          const fetchedGroups = results.filter((group): group is ClassGroupWithMeta =>
            Boolean(group)
          )
          const combined = [...filteredFromExisting, ...fetchedGroups]
          // Sort by order, then name
          combined.sort((a, b) => {
            const orderA = a.order ?? Infinity
            const orderB = b.order ?? Infinity
            if (orderA !== orderB) return orderA - orderB
            return a.name.localeCompare(b.name)
          })
          log('[ScheduleSidePanel] useEffect - updating with combined classGroups:', combined)
          setClassGroups(combined)
        })
        // Update immediately with what we have (for removals)
        if (filteredFromExisting.length > 0) {
          setClassGroups(filteredFromExisting)
        }
      } else {
        // No missing class groups, update immediately
        log(
          '[ScheduleSidePanel] useEffect - updating with filtered classGroups:',
          filteredFromExisting
        )
        setClassGroups(filteredFromExisting)
      }
      return
    }

    // Filter allAvailableClassGroups to get the selected ones
    const selectedClassGroups = allAvailableClassGroups.filter(cg => classGroupIds.includes(cg.id))

    log('[ScheduleSidePanel] useEffect - selectedClassGroups:', selectedClassGroups)

    // If no matching class groups found, clear (user removed all)
    if (selectedClassGroups.length === 0) {
      log('[ScheduleSidePanel] useEffect - no matching class groups found, clearing')
      setClassGroups([])
      return
    }

    // Sort by order, then name to preserve settings order
    selectedClassGroups.sort((a, b) => {
      const orderA = a.order ?? Infinity
      const orderB = b.order ?? Infinity
      if (orderA !== orderB) return orderA - orderB
      return a.name.localeCompare(b.name)
    })

    // Always update when allAvailableClassGroups is loaded - this ensures we have full details
    // even if user added a new class group that wasn't in initial data
    log(
      '[ScheduleSidePanel] useEffect - setting classGroups to (from allAvailableClassGroups):',
      selectedClassGroups
    )
    setClassGroups(selectedClassGroups)
  }, [classGroupIds, allAvailableClassGroups, loading])

  // Fetch teacher assignments when classGroupIds changes or drawer opens
  // Fetch directly from teacher-schedules API for immediate, accurate data
  // (Weekly schedule API may be cached or have timing issues after saves)
  useEffect(() => {
    if (!isOpen) return

    if (!hasLoadedInitialDataRef.current) {
      return
    }

    // If we should preserve teachers (class groups were just removed), skip fetching
    log('[ScheduleSidePanel] Teacher fetch useEffect - checking preserve flag', {
      preserveFlag: preserveTeachersRef.current,
      selectedTeachersLength: selectedTeachersRef.current.length,
      selectedTeachersRefLength: selectedTeachersRef.current.length,
      classGroupIds,
      willPreserve: preserveTeachersRef.current && selectedTeachersRef.current.length > 0,
    })

    if (preserveTeachersRef.current && selectedTeachersRef.current.length > 0) {
      log(
        '[ScheduleSidePanel] ✓ Skipping teacher fetch - preserving teachers after class group change',
        {
          previousClassGroupIds: previousClassGroupIdsRef.current,
          currentClassGroupIds: classGroupIds,
          existingTeachersCount: selectedTeachersRef.current.length,
          existingTeachers: selectedTeachersRef.current.map(t => t.name),
          preserveFlag: preserveTeachersRef.current,
        }
      )
      // Reset the flag after preserving (but keep teachers)
      preserveTeachersRef.current = false
      previousClassGroupIdsRef.current = classGroupIds
      teachersLoadedRef.current = true
      return
    }

    const cacheKey = `${classroomId}|${dayId}|${timeSlotId}`
    const cachedTeachers = teacherCacheRef.current.get(cacheKey)
    if (cachedTeachers && cachedTeachers.length > 0 && teachersLoadedRef.current) {
      setSelectedTeachers(cachedTeachers)
      return
    }

    if (teacherFetchKeyRef.current === cacheKey && isLoadingTeachers) {
      return
    }

    teacherFetchKeyRef.current = cacheKey
    log('[ScheduleSidePanel] Fetching teachers', {
      classGroupIds,
      preserveFlag: preserveTeachersRef.current,
      existingTeachersCount: selectedTeachersRef.current.length,
    })

    // Fetch directly from teacher-schedules API for most up-to-date data
    setIsLoadingTeachers(true)
    fetch('/api/teacher-schedules')
      .then(r => {
        if (!r.ok) {
          throw new Error(`Failed to fetch teacher schedules: ${r.status}`)
        }
        return r.json()
      })
      .then((data: TeacherSchedule[]) => {
        // Filter by classroom, day, time slot, and class group (if classGroupIds is set)
        // If we're preserving teachers (class groups were just changed), show all teachers for this location
        // regardless of class group, so they don't disappear from the UI
        const filtered = data.filter(schedule => {
          const matchesLocation =
            schedule.classroom_id === classroomId &&
            schedule.day_of_week_id === dayId &&
            schedule.time_slot_id === timeSlotId

          if (!matchesLocation) return false

          // If preserving teachers (class groups just changed), show all teachers for this location
          if (preserveTeachersRef.current) {
            return true
          }

          // Teachers are assigned to the slot (classroom/day/time), not the class group,
          // so show all teachers for this location regardless of class group.
          return true
        })

        const teachers: Teacher[] = filtered.map(schedule => ({
          id: schedule.id,
          name:
            schedule.teacher?.display_name ||
            `${schedule.teacher?.first_name || ''} ${schedule.teacher?.last_name || ''}`.trim() ||
            'Unknown',
          teacher_id: schedule.teacher_id,
          is_floater: schedule.is_floater ?? false,
        }))

        log('[ScheduleSidePanel] Fetched teachers', {
          classGroupIds,
          fetchedCount: teachers.length,
          filteredCount: filtered.length,
          allDataCount: data.length,
          teachers: teachers.map(t => ({ name: t.name, teacher_id: t.teacher_id })),
          filtered: filtered.map(s => ({
            teacher_id: s.teacher_id,
            class_group_id: getScheduleClassGroupId(s),
            classroom_id: s.classroom_id,
            day: s.day_of_week_id,
            time: s.time_slot_id,
          })),
        })

        if (teachers.length === 0 && selectedTeachersRef.current.length > 0) {
          // Avoid clearing a visible list while data is still stabilizing
          previousClassGroupIdsRef.current = classGroupIds
          preserveTeachersRef.current = false
          teachersLoadedRef.current = true
          setIsLoadingTeachers(false)
          return
        }

        // Update the ref before setting teachers
        previousClassGroupIdsRef.current = classGroupIds
        // Reset preserve flag after fetch completes - teachers are now loaded/updated
        preserveTeachersRef.current = false
        teachersLoadedRef.current = true
        teacherCacheRef.current.set(cacheKey, teachers)
        setIsLoadingTeachers(false)
        setSelectedTeachers(teachers)
      })
      .catch(err => {
        console.error('Error fetching teacher assignments:', err)
        // Don't clear teachers on error if we should preserve them
        if (preserveTeachersRef.current && selectedTeachersRef.current.length > 0) {
          preserveTeachersRef.current = false
          previousClassGroupIdsRef.current = classGroupIds
          setIsLoadingTeachers(false)
          return
        }

        previousClassGroupIdsRef.current = classGroupIds
        preserveTeachersRef.current = false
        teachersLoadedRef.current = true
        setIsLoadingTeachers(false)
        setSelectedTeachers([])
      })
  }, [isOpen, classroomId, dayId, timeSlotId, classGroupIds, isLoadingTeachers])

  // Determine if cell has data (current state)
  const hasData = !!(classGroupIds.length > 0 || enrollment !== null || selectedTeachers.length > 0)

  // Auto-activate cell when class groups, enrollment, or teachers are added (only if inactive and originally empty)
  useEffect(() => {
    // If cell is inactive and originally had no data, and user is now adding data, activate it
    const originalState = originalCellStateRef.current
    if (originalState && !originalState.isActive && !originalState.hasData && hasData) {
      setIsActive(true)
    }
  }, [classGroupIds.length, enrollment, selectedTeachers.length, isActive, hasData])

  // Fields should be disabled if inactive AND has data
  const fieldsDisabled = !isActive && hasData

  // Track unsaved changes
  useEffect(() => {
    if (!isOpen) {
      setHasUnsavedChanges(false)
      return
    }

    const cellClassGroupIds = cell?.class_groups?.map(cg => cg.id) || []
    const hasChanges =
      cell?.is_active !== isActive ||
      JSON.stringify([...cellClassGroupIds].sort()) !== JSON.stringify([...classGroupIds].sort()) ||
      cell?.enrollment_for_staffing !== enrollment ||
      cell?.notes !== notes ||
      selectedTeachers.length !== (cell ? selectedTeachers.length : 0)

    setHasUnsavedChanges(hasChanges)
  }, [isOpen, cell, isActive, classGroupIds, enrollment, notes, selectedTeachers])

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true)
    } else {
      onClose()
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Validate - class groups are always required to save
      if (classGroupIds.length === 0) {
        alert('At least one class group is required to save the cell')
        setSaving(false)
        return
      }

      // Prepare cell data
      const cellData = {
        classroom_id: classroomId,
        day_of_week_id: dayId,
        time_slot_id: timeSlotId,
        is_active: isActive,
        class_group_ids: classGroupIds,
        enrollment_for_staffing: enrollment,
        notes: notes,
      }

      // Determine which days and time slots to update based on scope
      let daysToUpdate: string[] = [dayId]
      let timeSlotsToUpdate: string[] = [timeSlotId]

      if (applyScope === 'timeSlot') {
        // Same time slot across selected days
        daysToUpdate = applyDayIds
        timeSlotsToUpdate = [timeSlotId]
      } else if (applyScope === 'day') {
        // All time slots for the same day
        daysToUpdate = [dayId]
        timeSlotsToUpdate =
          applyTimeSlotIds.length > 0 ? applyTimeSlotIds : timeSlots.map(ts => ts.id)
      } else {
        // Single cell
        daysToUpdate = [dayId]
        timeSlotsToUpdate = [timeSlotId]
      }

      // Update cells for each day/time slot combination
      const updates: Array<{
        classroom_id: string
        day_of_week_id: string
        time_slot_id: string
        is_active: boolean
        enrollment_for_staffing: number | null
        notes: string | null
      }> = []

      for (const updateDayId of daysToUpdate) {
        for (const updateTimeSlotId of timeSlotsToUpdate) {
          updates.push({
            classroom_id: cellData.classroom_id,
            day_of_week_id: updateDayId,
            time_slot_id: updateTimeSlotId,
            is_active: cellData.is_active,
            enrollment_for_staffing: cellData.enrollment_for_staffing,
            notes: cellData.notes,
          })
        }
      }

      // Bulk update cells
      const cellResponse = await fetch('/api/schedule-cells/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })

      if (!cellResponse.ok) {
        throw new Error('Failed to save schedule cells')
      }

      // Update teacher assignments for each day/time slot combination
      // Fetch all schedules once at the start to avoid multiple API calls
      const allSchedulesResponse = await fetch('/api/teacher-schedules')
      if (!allSchedulesResponse.ok) {
        throw new Error('Failed to fetch current teacher schedules')
      }
      const allSchedules = await allSchedulesResponse.json()
      const hasClassAssignments = (allSchedules as TeacherSchedule[]).some(
        schedule => schedule.class_group_id != null || schedule.class_id != null
      )

      const deletePromises: Promise<void>[] = []
      const createPromises: Promise<void>[] = []

      log(
        '[ScheduleSidePanel] Starting save - selectedTeachers:',
        selectedTeachers.map(t => ({ name: t.name, teacher_id: t.teacher_id }))
      )
      log('[ScheduleSidePanel] classGroupIds:', classGroupIds)

      for (const updateDayId of daysToUpdate) {
        for (const updateTimeSlotId of timeSlotsToUpdate) {
          // Filter current schedules for this specific cell
          const currentSchedules = allSchedules.filter(
            (s: TeacherSchedule) =>
              s.classroom_id === classroomId &&
              s.day_of_week_id === updateDayId &&
              s.time_slot_id === updateTimeSlotId
          )

          // Use first class group ID for teacher schedules (teachers are assigned to the slot, not individual class groups)
          // Allow null class group when no class groups are assigned (teachers can exist without class groups)
          const primaryClassGroupId = classGroupIds.length > 0 ? classGroupIds[0] : null

          log('[ScheduleSidePanel] Processing cell:', {
            updateDayId,
            updateTimeSlotId,
            primaryClassGroupId,
            currentSchedulesCount: currentSchedules.length,
          })

          // Filter schedules for this slot
          // If no class assignments exist, use all current schedules for the slot.
          // Otherwise, filter to schedules matching the primary class group (or null when none).
          const schedulesForThisSlot = !hasClassAssignments
            ? currentSchedules
            : primaryClassGroupId
              ? currentSchedules.filter(
                  (s: TeacherSchedule) => getScheduleClassGroupId(s) === primaryClassGroupId
                )
              : currentSchedules.filter(
                  (s: TeacherSchedule) =>
                    getScheduleClassGroupId(s) === null || getScheduleClassGroupId(s) === undefined
                )

          // Update teacher assignments (works for both with and without class groups)
          // Note: This code path should only run when saving, and we validate classGroupIds.length > 0 before saving
          {
            // Update teacher assignments using primary class group
            const newTeacherIds = new Set(selectedTeachers.map(t => t.teacher_id))

            // Remove assignments that are no longer selected
            // For schedules with wrong class group, we'll update them instead of deleting
            for (const schedule of schedulesForThisSlot) {
              if (!newTeacherIds.has(schedule.teacher_id)) {
                log('[ScheduleSidePanel] Deleting schedule - teacher no longer selected:', {
                  teacher_id: schedule.teacher_id,
                  schedule_id: schedule.id,
                })
                deletePromises.push(
                  fetch(`/api/teacher-schedules/${schedule.id}`, {
                    method: 'DELETE',
                  }).then(async deleteResponse => {
                    if (!deleteResponse.ok) {
                      console.error(`Failed to delete teacher schedule ${schedule.id}`)
                      const errorData = await deleteResponse.json().catch(() => ({}))
                      throw new Error(
                        `Failed to delete teacher schedule: ${errorData.error || deleteResponse.statusText}`
                      )
                    }
                    log('[ScheduleSidePanel] Successfully deleted schedule:', schedule.id)
                  })
                )
              }
            }

            // Update schedules that have wrong class group but teacher is still selected
            // This handles the case when class groups change - we update the stored class group, not delete
            // Note: primaryClassGroupId should never be null here because we validate before saving
            if (hasClassAssignments) {
              for (const schedule of currentSchedules) {
                const teacherStillSelected = newTeacherIds.has(schedule.teacher_id)
                const scheduleClassGroupId = getScheduleClassGroupId(schedule)
                const hasWrongClassId = scheduleClassGroupId !== primaryClassGroupId

                if (teacherStillSelected && hasWrongClassId) {
                  // Update the schedule to have the correct class_group_id
                  log('[ScheduleSidePanel] Updating schedule class_group_id:', {
                    teacher_id: schedule.teacher_id,
                    schedule_id: schedule.id,
                    old_class_group_id: scheduleClassGroupId,
                    new_class_group_id: primaryClassGroupId,
                  })
                  createPromises.push(
                    fetch(`/api/teacher-schedules/${schedule.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        class_group_id: primaryClassGroupId,
                      }),
                    }).then(async updateResponse => {
                      if (!updateResponse.ok) {
                        console.error(`Failed to update teacher schedule ${schedule.id}`)
                        const errorData = await updateResponse.json().catch(() => ({}))
                        throw new Error(
                          `Failed to update teacher schedule: ${errorData.error || updateResponse.statusText}`
                        )
                      }
                      log(
                        '[ScheduleSidePanel] Successfully updated schedule class_group_id:',
                        schedule.id
                      )
                    })
                  )
                }
              }
            }

            // Add new assignments
            // For each selected teacher, check if they have a schedule for this slot
            // If not, check if they have a schedule for a different class - if so, delete it first, then create new one
            log(
              '[ScheduleSidePanel] Processing teachers for save:',
              selectedTeachers.length,
              'teachers'
            )
            for (const teacher of selectedTeachers) {
              if (!teacher.teacher_id) {
                console.warn('[ScheduleSidePanel] Teacher missing teacher_id:', teacher)
                continue
              }

              // Check if teacher already has a schedule for this slot with matching class group
              const teacherScheduleForThisSlot = schedulesForThisSlot.find(
                (s: TeacherSchedule) => s.teacher_id === teacher.teacher_id
              )

              log(
                '[ScheduleSidePanel] Teacher:',
                teacher.name,
                'hasSchedule:',
                !!teacherScheduleForThisSlot
              )

              if (!teacherScheduleForThisSlot) {
                // Teacher doesn't have a schedule for this slot with the correct class group
                // Check if they have one with wrong class group - if so, it should have been updated above
                // But if it wasn't (edge case), we'll create a new one
                const teacherScheduleForOtherClass = hasClassAssignments
                  ? currentSchedules.find(
                      (s: TeacherSchedule) =>
                        s.teacher_id === teacher.teacher_id &&
                        getScheduleClassGroupId(s) !== primaryClassGroupId
                    )
                  : undefined

                if (teacherScheduleForOtherClass) {
                  // This schedule should have been updated in the loop above, but if it wasn't,
                  // we'll update it now as a fallback
                  log(
                    '[ScheduleSidePanel] Updating existing schedule with wrong class_group_id (fallback):',
                    teacherScheduleForOtherClass.id
                  )
                  createPromises.push(
                    fetch(`/api/teacher-schedules/${teacherScheduleForOtherClass.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        class_group_id: primaryClassGroupId,
                      }),
                    }).then(async updateResponse => {
                      if (!updateResponse.ok) {
                        console.error(
                          `Failed to update teacher schedule ${teacherScheduleForOtherClass.id}`
                        )
                        const errorData = await updateResponse.json().catch(() => ({}))
                        throw new Error(
                          `Failed to update teacher schedule: ${errorData.error || updateResponse.statusText}`
                        )
                      }
                      log(
                        '[ScheduleSidePanel] Successfully updated schedule (fallback):',
                        teacherScheduleForOtherClass.id
                      )
                    })
                  )
                  continue // Skip creating a new schedule since we're updating the existing one
                }

                // Create new schedule for this teacher
                const payload = {
                  teacher_id: teacher.teacher_id,
                  day_of_week_id: updateDayId,
                  time_slot_id: updateTimeSlotId,
                  classroom_id: classroomId,
                  is_floater: teacher.is_floater ?? false,
                  ...(hasClassAssignments ? { class_group_id: primaryClassGroupId } : {}),
                }
                log('[ScheduleSidePanel] Creating new schedule for teacher:', teacher.name, payload)
                createPromises.push(
                  fetch('/api/teacher-schedules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                  }).then(async createResponse => {
                    if (!createResponse.ok) {
                      const errorData = await createResponse.json().catch(() => ({}))
                      const errorMessage = errorData.error || createResponse.statusText

                      // If it's a duplicate key violation, it's okay - the schedule already exists
                      if (
                        errorMessage.includes('already exists') ||
                        errorMessage.includes('duplicate key')
                      ) {
                        log(
                          `[ScheduleSidePanel] Teacher schedule already exists for teacher ${teacher.teacher_id} in this cell, skipping creation`
                        )
                        return // Silently skip - this is not an error
                      }

                      // For other errors, throw
                      console.error(
                        `[ScheduleSidePanel] Failed to create teacher schedule for teacher ${teacher.teacher_id}`
                      )
                      console.error('[ScheduleSidePanel] Error details:', errorData)
                      throw new Error(`Failed to create teacher schedule: ${errorMessage}`)
                    }
                    const created = await createResponse.json()
                    log('[ScheduleSidePanel] Successfully created schedule:', created)
                    return created
                  })
                )
              } else {
                // Teacher already has a schedule - update floater status if needed
                if (teacherScheduleForThisSlot.is_floater !== (teacher.is_floater ?? false)) {
                  createPromises.push(
                    fetch(`/api/teacher-schedules/${teacherScheduleForThisSlot.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        is_floater: teacher.is_floater ?? false,
                      }),
                    }).then(async updateResponse => {
                      if (!updateResponse.ok) {
                        console.error(
                          `Failed to update teacher schedule ${teacherScheduleForThisSlot.id}`
                        )
                        const errorData = await updateResponse.json().catch(() => ({}))
                        throw new Error(
                          `Failed to update teacher schedule: ${errorData.error || updateResponse.statusText}`
                        )
                      }
                    })
                  )
                }
              }
            }
          }
        }
      }

      // Wait for all delete and create operations to complete
      log(
        '[ScheduleSidePanel] Waiting for',
        deletePromises.length,
        'deletes and',
        createPromises.length,
        'creates'
      )
      await Promise.all([...deletePromises, ...createPromises])
      log('[ScheduleSidePanel] All teacher schedule operations completed')

      setHasUnsavedChanges(false)

      // Wait a moment for database to commit, then refresh and close
      // This ensures the refresh happens after data is saved
      await new Promise(resolve => setTimeout(resolve, 100))

      teacherCacheRef.current.clear()
      teachersLoadedRef.current = false

      if (onSave) {
        onSave()
      }

      // Wait a bit more for refresh to start, then close
      await new Promise(resolve => setTimeout(resolve, 200))
      onClose()
    } catch (error) {
      console.error('Error saving schedule cell:', error)
      const message = error instanceof Error ? error.message : 'Failed to save schedule cell'
      alert(`Failed to save: ${message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    setShowUnsavedDialog(false)
    setHasUnsavedChanges(false)
    onClose()
  }

  const handleApplyScopeChange = (
    scope: 'single' | 'timeSlot' | 'day',
    dayIds: string[],
    timeSlotIds?: string[]
  ) => {
    setApplyScope(scope)
    setApplyDayIds(dayIds)
    if (scope === 'day') {
      // For 'day' scope, use all time slots
      if (timeSlots.length > 0) {
        setApplyTimeSlotIds(timeSlots.map(ts => ts.id))
      } else if (timeSlotIds) {
        setApplyTimeSlotIds(timeSlotIds)
      }
    } else {
      // For other scopes, just use the current time slot
      setApplyTimeSlotIds([timeSlotId])
    }
  }

  const handleConflictResolution = (conflictId: string, resolution: ConflictResolution) => {
    // Store the resolution (synchronous state update)
    setConflictResolutions(prev => {
      const newResolutions = new Map(prev)
      newResolutions.set(conflictId, resolution)
      return newResolutions
    })
  }

  const handleApplyConflictResolutions = async () => {
    if (classGroupIds.length === 0) return

    try {
      const teachersToRemove: string[] = []

      // Resolve each conflict
      for (const conflict of conflicts) {
        const resolution = conflictResolutions.get(conflict.conflicting_schedule_id)
        if (!resolution) continue

        // Only resolve if we have a resolution
        if (resolution === 'cancel') {
          // Remove teacher from selectedTeachers
          teachersToRemove.push(conflict.teacher_id)
        } else {
          // Resolve via API
          const response = await fetch('/api/teacher-schedules/resolve-conflict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              teacher_id: conflict.teacher_id,
              day_of_week_id: conflict.day_of_week_id,
              time_slot_id: conflict.time_slot_id,
              resolution,
              target_classroom_id: conflict.target_classroom_id,
              target_class_group_id: classGroupIds.length > 0 ? classGroupIds[0] : null,
              conflicting_schedule_id: conflict.conflicting_schedule_id,
            }),
          })

          if (!response.ok) {
            throw new Error(
              `Failed to resolve conflict for ${conflict.teacher_name || conflict.teacher_id}`
            )
          }
        }
      }

      // Remove teachers that were canceled
      if (teachersToRemove.length > 0) {
        setSelectedTeachers(prev =>
          prev.filter(t => t.teacher_id && !teachersToRemove.includes(t.teacher_id))
        )
      }

      // Clear conflicts and resolutions
      setConflicts([])
      setConflictResolutions(new Map())
    } catch (error) {
      console.error('Error resolving conflicts:', error)
      const message = error instanceof Error ? error.message : 'Failed to resolve conflicts'
      alert(`Failed to resolve conflicts: ${message}`)
    } finally {
    }
  }

  const handleCancelConflictResolution = () => {
    setConflicts([])
    setConflictResolutions(new Map())
  }

  // Calculate staffing requirements
  // Use enrollment from cell if available, otherwise use enrollment state
  // This ensures consistency with the grid which uses scheduleCell.enrollment_for_staffing
  const enrollmentForCalculation = cell?.enrollment_for_staffing ?? enrollment

  // Find class group with lowest min_age for ratio calculation
  const classGroupForRatio =
    classGroups.length > 0
      ? classGroups.reduce((lowest, current) => {
          const currentMinAge = current.min_age ?? Infinity
          const lowestMinAge = lowest.min_age ?? Infinity
          return currentMinAge < lowestMinAge ? current : lowest
        })
      : null

  // Debug logging
  useEffect(() => {
    log('[ScheduleSidePanel] Render - classGroups:', classGroups)
    log('[ScheduleSidePanel] Render - classGroups.length:', classGroups.length)
    log('[ScheduleSidePanel] Render - classGroupForRatio:', classGroupForRatio)
    log(
      '[ScheduleSidePanel] Render - should show fields?',
      classGroups.length > 0 && classGroupForRatio !== null
    )
  }, [classGroups, classGroupForRatio])

  const requiredTeachers =
    classGroupForRatio && enrollmentForCalculation
      ? Math.ceil(enrollmentForCalculation / classGroupForRatio.required_ratio)
      : undefined
  const preferredTeachers =
    classGroupForRatio && enrollmentForCalculation && classGroupForRatio.preferred_ratio
      ? Math.ceil(enrollmentForCalculation / classGroupForRatio.preferred_ratio)
      : undefined

  return (
    <>
      <Sheet open={isOpen} onOpenChange={handleClose}>
        <SheetContent
          className={`w-full sm:max-w-2xl overflow-y-auto p-0 ${getPanelBackgroundClasses()}`}
        >
          <div
            className={`sticky top-0 z-10 ${getPanelHeaderBackgroundClasses()} ${panelBackgrounds.panelBorder} border-b px-6 pt-6 pb-4`}
          >
            <SheetHeader>
              <SheetTitle>
                {classroomName} • {dayName} • {timeSlotCode} {timeRange && `(${timeRange})`}
              </SheetTitle>
              <SheetDescription>Configure schedule cell settings and assignments</SheetDescription>
            </SheetHeader>
          </div>

          <div className="px-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">Loading...</div>
              </div>
            ) : (
              <div className="mt-6 space-y-10">
                {/* Section A: Slot Status */}
                <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-1">
                  <SlotStatusToggle
                    isActive={isActive}
                    onToggle={newActive => {
                      if (isActive && !newActive) {
                        // Show confirmation when deactivating
                        setShowDeactivateDialog(true)
                      } else {
                        setIsActive(newActive)
                      }
                    }}
                  />
                  <div className="mt-0">
                    {isActive ? (
                      <p className="text-xs text-muted-foreground italic whitespace-nowrap">
                        This slot requires staffing and will be validated
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic whitespace-nowrap">
                        Inactive slots are ignored for staffing and substitutes
                      </p>
                    )}
                  </div>
                </div>

                {/* Section B: Class Group Selection */}
                <div
                  className={`rounded-lg bg-white border border-gray-200 p-6 space-y-2 ${fieldsDisabled ? 'opacity-60' : ''}`}
                >
                  <ClassGroupMultiSelect
                    selectedClassGroupIds={classGroupIds}
                    onSelectionChange={newClassGroupIds => {
                      // Preserve teachers whenever class groups change (added or removed) if we have existing teachers
                      // This prevents teachers from disappearing when class groups are modified
                      const hasExistingTeachers = selectedTeachersRef.current.length > 0
                      const classGroupsChanged =
                        JSON.stringify([...classGroupIds].sort()) !==
                        JSON.stringify([...newClassGroupIds].sort())
                      const shouldPreserve = hasExistingTeachers && classGroupsChanged

                      log('[ScheduleSidePanel] Class groups changed', {
                        previous: classGroupIds,
                        new: newClassGroupIds,
                        hasExistingTeachers,
                        classGroupsChanged,
                        shouldPreserve,
                        currentTeachersCount: selectedTeachers.length,
                        currentTeachersRefCount: selectedTeachersRef.current.length,
                        currentTeachers: selectedTeachers.map(t => t.name),
                        currentTeachersFromRef: selectedTeachersRef.current.map(t => t.name),
                      })

                      preserveTeachersRef.current = shouldPreserve
                      log(
                        '[ScheduleSidePanel] Set preserveTeachersRef to:',
                        shouldPreserve,
                        'with',
                        selectedTeachersRef.current.length,
                        'teachers in ref'
                      )
                      previousClassGroupIdsRef.current = classGroupIds
                      setClassGroupIds(newClassGroupIds)
                    }}
                    allowedClassGroupIds={
                      allowedClassGroupIds.length > 0 ? allowedClassGroupIds : undefined
                    }
                    disabled={fieldsDisabled}
                    existingClassGroups={classGroups as ClassGroup[]}
                  />
                  <div className="pt-2 pb-3 border-b border-gray-200"></div>
                  {isActive && classGroupIds.length === 0 && (
                    <p className="text-sm text-yellow-600">
                      At least one class group is required when slot is active
                    </p>
                  )}

                  {/* Age and Ratios Display */}
                  {classGroups.length > 0 && classGroupForRatio && (
                    <div className="space-y-2 text-sm pt-1">
                      {/* Age Range (from lowest min_age) */}
                      <div className="flex items-center gap-2">
                        <div className="text-muted-foreground">Age (lowest):</div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {classGroupForRatio.min_age !== null &&
                          classGroupForRatio.max_age !== null
                            ? `${classGroupForRatio.min_age}–${classGroupForRatio.max_age} years`
                            : classGroupForRatio.min_age !== null
                              ? `${classGroupForRatio.min_age}+ years`
                              : classGroupForRatio.max_age !== null
                                ? `Up to ${classGroupForRatio.max_age} years`
                                : 'Not specified'}
                        </span>
                      </div>

                      {/* Ratios (from lowest min_age class group) */}
                      <div className="flex items-center gap-2">
                        <div className="text-muted-foreground">Ratios:</div>
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            Required 1:{classGroupForRatio.required_ratio}
                          </span>
                          {classGroupForRatio.preferred_ratio && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                              Preferred 1:{classGroupForRatio.preferred_ratio}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section C: Enrollment */}
                <div
                  className={`rounded-lg bg-white border border-gray-200 p-6 space-y-2 ${fieldsDisabled ? 'opacity-60' : ''}`}
                >
                  <EnrollmentInput
                    value={enrollment}
                    onChange={setEnrollment}
                    disabled={fieldsDisabled}
                  />
                  <div className="pt-2 pb-3 border-b border-gray-200"></div>

                  {/* Required Teachers Preview */}
                  {classGroupForRatio && enrollment !== null && enrollment > 0 && (
                    <div className="text-sm pt-1">
                      <div className="flex items-center gap-2">
                        <div className="text-muted-foreground">Based on enrollment:</div>
                        <div className="flex flex-wrap gap-2">
                          {requiredTeachers !== undefined && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                              Required: {requiredTeachers} Teacher
                              {requiredTeachers !== 1 ? 's' : ''}
                            </span>
                          )}
                          {preferredTeachers !== undefined && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                              Preferred: {preferredTeachers} Teacher
                              {preferredTeachers !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section E: Assigned Teachers */}
                <div
                  className={`rounded-lg bg-white border-l-4 border-l-primary/40 border border-gray-200 p-6 space-y-2 ${fieldsDisabled ? 'opacity-60' : ''}`}
                >
                  <Label className="text-base font-medium text-foreground block mb-6">
                    Assigned Teachers
                  </Label>
                  {isLoadingTeachers && displayTeachers.length === 0 && (
                    <div className="text-sm text-muted-foreground mb-3">
                      Loading assigned teachers…
                    </div>
                  )}
                  <TeacherMultiSelect
                    selectedTeachers={displayTeachers}
                    onTeachersChange={teachers => setSelectedTeachers(teachers)}
                    requiredCount={classGroupIds.length > 0 ? requiredTeachers : undefined}
                    preferredCount={classGroupIds.length > 0 ? preferredTeachers : undefined}
                    disabled={fieldsDisabled}
                  />

                  {/* Warning message when teachers are assigned but no class groups */}
                  {classGroupIds.length === 0 && displayTeachers.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mt-4">
                      <p className="text-sm text-amber-800">
                        Teachers are assigned. Add class groups to filter by qualifications and
                        calculate staffing requirements.
                      </p>
                    </div>
                  )}

                  {/* Conflict Banner */}
                  {conflicts.length > 0 && (
                    <div className="mt-4">
                      <ConflictBanner
                        conflicts={conflicts}
                        onResolution={handleConflictResolution}
                        onApply={handleApplyConflictResolutions}
                        onCancel={handleCancelConflictResolution}
                      />
                    </div>
                  )}
                </div>

                {/* Section F: Notes */}
                <div
                  className={`rounded-lg bg-white border border-gray-200 p-6 space-y-2 ${fieldsDisabled ? 'opacity-60' : ''}`}
                >
                  <Label
                    htmlFor="notes"
                    className="text-base font-medium text-foreground block mb-6"
                  >
                    Notes
                  </Label>
                  <Textarea
                    id="notes"
                    value={notes || ''}
                    onChange={e => setNotes(e.target.value || null)}
                    placeholder="Add notes for baseline planning..."
                    disabled={fieldsDisabled}
                    rows={3}
                  />
                </div>

                {/* Section G: Apply Changes To */}
                <div className="rounded-lg bg-blue-50/30 border-l-4 border-l-blue-500 border border-gray-200 p-6 mt-16">
                  <MultiDayApplySelector
                    currentDayId={dayId}
                    currentDayName={dayName}
                    currentTimeSlotCode={timeSlotCode}
                    currentTimeSlotId={timeSlotId}
                    currentClassroomName={classroomName}
                    selectedDayIds={selectedDayIds}
                    timeSlots={timeSlots}
                    onApplyScopeChange={handleApplyScopeChange}
                  />
                </div>

                {/* Footer Actions */}
                <div className="space-y-2 pt-4 pb-6 border-t">
                  {/* Warning if below required staffing */}
                  {isActive &&
                    classGroups.length > 0 &&
                    enrollment !== null &&
                    enrollment > 0 &&
                    requiredTeachers !== undefined &&
                    selectedTeachers.length < requiredTeachers && (
                      <p className="text-xs text-muted-foreground italic text-right">
                        This slot will be saved below required staffing
                      </p>
                    )}
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={handleClose} disabled={saving}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <UnsavedChangesDialog
        isOpen={showUnsavedDialog}
        onSave={handleSave}
        onDiscard={handleDiscard}
        onCancel={() => setShowUnsavedDialog(false)}
      />

      {/* Deactivation Confirmation Dialog */}
      <Dialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate this slot?</DialogTitle>
            <DialogDescription>
              Deactivating it will ignore this slot for scheduling and coverage.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeactivateDialog(false)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setIsActive(false)
                setShowDeactivateDialog(false)
              }}
            >
              Deactivate slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
