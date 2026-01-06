'use client'

import { useState, useEffect, useRef } from 'react'
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
import type { TimeSlot, ClassGroup, ClassroomWithAllowedClasses, TeacherSchedule } from '@/types/api'

interface Teacher {
  id: string
  name: string
  teacher_id: string
  is_floater?: boolean
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
  selectedCellData?: ScheduleCellWithDetails // Full cell data from the grid
  onSave?: () => void
}

export default function ScheduleSidePanel({
  isOpen,
  onClose,
  dayId,
  dayName,
  timeSlotId,
  timeSlotName,
  timeSlotCode,
  timeSlotStartTime,
  timeSlotEndTime,
  classroomId,
  classroomName,
  selectedDayIds,
  selectedCellData,
  onSave,
}: ScheduleSidePanelProps) {
  const [cell, setCell] = useState<ScheduleCellWithDetails | null>(null)
  const [isActive, setIsActive] = useState(true)
  const [classGroupIds, setClassGroupIds] = useState<string[]>([])
  const [enrollment, setEnrollment] = useState<number | null>(null)
  const [notes, setNotes] = useState<string | null>(null)
  const [selectedTeachers, setSelectedTeachers] = useState<Teacher[]>([])
  const [allowedClassGroupIds, setAllowedClassGroupIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false)
  const [pendingInactive, setPendingInactive] = useState(false)
  const [applyScope, setApplyScope] = useState<'single' | 'timeSlot' | 'day'>('single')
  const [applyDayIds, setApplyDayIds] = useState<string[]>([dayId])
  const [applyTimeSlotIds, setApplyTimeSlotIds] = useState<string[]>([timeSlotId])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [classGroups, setClassGroups] = useState<Array<{ id: string; name: string; min_age: number | null; max_age: number | null; required_ratio: number; preferred_ratio: number | null; is_active?: boolean; order?: number | null }>>([])
  const [allAvailableClassGroups, setAllAvailableClassGroups] = useState<Array<{ id: string; name: string; min_age: number | null; max_age: number | null; required_ratio: number; preferred_ratio: number | null; is_active?: boolean; order?: number | null }>>([])
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [conflictResolutions, setConflictResolutions] = useState<Map<string, ConflictResolution>>(new Map())
  const [resolvingConflicts, setResolvingConflicts] = useState(false)
  // Track the original cell state when first loaded to determine if it was empty
  const originalCellStateRef = useRef<{ isActive: boolean; hasData: boolean } | null>(null)
  // Track if we've loaded initial data to prevent useEffect from clearing classGroups prematurely
  const hasLoadedInitialDataRef = useRef(false)
  // Track the initial classGroupIds to prevent useEffect from running with stale empty state
  const initialClassGroupIdsRef = useRef<string[] | null>(null)
  // Track previous classGroupIds to detect when class groups are removed
  const previousClassGroupIdsRef = useRef<string[]>([])

  // Format time range for header
  const timeRange = timeSlotStartTime && timeSlotEndTime
    ? `${timeSlotStartTime}–${timeSlotEndTime}`
    : ''

  // Fetch time slots for 'day' scope
  useEffect(() => {
    if (!isOpen) return

    fetch('/api/timeslots')
      .then((r) => r.json())
      .then((data) => {
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
      return
    }

    setLoading(true)
    hasLoadedInitialDataRef.current = false
    initialClassGroupIdsRef.current = null
    
    // If selectedCellData is provided and has a schedule_cell, use it
    // Note: selectedCellData structure has schedule_cell nested
    if (selectedCellData && (selectedCellData as any).schedule_cell) {
      const cellData = (selectedCellData as any).schedule_cell
      setCell(cellData)
      setIsActive(cellData.is_active ?? true)
      const classGroupIds = cellData.class_groups?.map((cg: any) => cg.id) || []
      console.log('[ScheduleSidePanel] Initial load - classGroupIds:', classGroupIds)
      console.log('[ScheduleSidePanel] Initial load - cellData.class_groups:', cellData.class_groups)
      initialClassGroupIdsRef.current = classGroupIds
      previousClassGroupIdsRef.current = classGroupIds
      setClassGroupIds(classGroupIds)
      // Set classGroups from cell data initially (will be updated by useEffect when allAvailableClassGroups loads)
      if (cellData.class_groups && cellData.class_groups.length > 0) {
        // Map the class groups, ensuring all fields are present
        const mappedClassGroups = cellData.class_groups.map((cg: any) => ({
          id: cg.id,
          name: cg.name || '',
          min_age: cg.min_age ?? null,
          max_age: cg.max_age ?? null,
          required_ratio: cg.required_ratio ?? 8,
          preferred_ratio: cg.preferred_ratio ?? null,
          is_active: cg.is_active ?? true,
          order: cg.order ?? null,
        }))
        console.log('[ScheduleSidePanel] Initial load - mappedClassGroups:', mappedClassGroups)
        setClassGroups(mappedClassGroups)
        hasLoadedInitialDataRef.current = true
      } else {
        console.log('[ScheduleSidePanel] Initial load - no class groups, setting empty array')
        setClassGroups([])
        hasLoadedInitialDataRef.current = true
      }
      setEnrollment(cellData.enrollment_for_staffing)
      setNotes(cellData.notes)
      // Store original state for auto-activation logic
      const originallyHadData = !!(classGroupIds.length > 0 || cellData.enrollment_for_staffing !== null)
      originalCellStateRef.current = {
        isActive: cellData.is_active ?? true,
        hasData: originallyHadData,
      }
      setLoading(false)
      return
    }
    
    // Otherwise fetch from API
    fetch(`/api/schedule-cells?classroom_id=${classroomId}&day_of_week_id=${dayId}&time_slot_id=${timeSlotId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.length > 0) {
          const cellData = data[0]
          setCell(cellData)
          setIsActive(cellData.is_active ?? true)
          const classGroupIds = cellData.class_groups?.map((cg: any) => cg.id) || []
          console.log('[ScheduleSidePanel] API fetch - classGroupIds:', classGroupIds)
          console.log('[ScheduleSidePanel] API fetch - cellData.class_groups:', cellData.class_groups)
          initialClassGroupIdsRef.current = classGroupIds
          setClassGroupIds(classGroupIds)
          // Set classGroups from cell data initially (will be updated by useEffect when allAvailableClassGroups loads)
          if (cellData.class_groups && cellData.class_groups.length > 0) {
            // Map the class groups, ensuring all fields are present
            const mappedClassGroups = cellData.class_groups.map((cg: any) => ({
              id: cg.id,
              name: cg.name || '',
              min_age: cg.min_age ?? null,
              max_age: cg.max_age ?? null,
              required_ratio: cg.required_ratio ?? 8,
              preferred_ratio: cg.preferred_ratio ?? null,
              is_active: cg.is_active ?? true,
              order: cg.order ?? null,
            }))
            console.log('[ScheduleSidePanel] API fetch - mappedClassGroups:', mappedClassGroups)
            setClassGroups(mappedClassGroups)
            hasLoadedInitialDataRef.current = true
          } else {
            console.log('[ScheduleSidePanel] API fetch - no class groups, setting empty array')
            setClassGroups([])
            hasLoadedInitialDataRef.current = true
          }
          setEnrollment(cellData.enrollment_for_staffing)
          setNotes(cellData.notes)
          // Store original state for auto-activation logic
          const originallyHadData = !!(classGroupIds.length > 0 || cellData.enrollment_for_staffing !== null)
          originalCellStateRef.current = {
            isActive: cellData.is_active ?? true,
            hasData: originallyHadData,
          }
        } else {
          // No cell exists, create default
          setIsActive(false)
          initialClassGroupIdsRef.current = []
          previousClassGroupIdsRef.current = []
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
      .catch((err) => {
        console.error('Error fetching schedule cell:', err)
        setLoading(false)
      })

    // Fetch classroom allowed class groups
    fetch('/api/classrooms')
      .then((r) => r.json())
      .then((data: ClassroomWithAllowedClasses[]) => {
        const classroom = data.find((c) => c.id === classroomId)
        if (classroom && classroom.allowed_classes) {
          const ids = classroom.allowed_classes
            .map((ac) => ac.class?.id)
            .filter((id): id is string => Boolean(id))
          setAllowedClassGroupIds(ids)
        }
      })
      .catch(console.error)

    // Fetch all class groups (including inactive) for updating classGroups when classGroupIds changes
    fetch('/api/class-groups?includeInactive=true')
      .then((r) => r.json())
      .then((data) => {
        setAllAvailableClassGroups(data)
      })
      .catch(console.error)
  }, [isOpen, classroomId, dayId, timeSlotId, selectedCellData])

  // Update classGroups when classGroupIds changes
  useEffect(() => {
    console.log('[ScheduleSidePanel] useEffect - classGroupIds:', classGroupIds)
    console.log('[ScheduleSidePanel] useEffect - allAvailableClassGroups.length:', allAvailableClassGroups.length)
    console.log('[ScheduleSidePanel] useEffect - current classGroups:', classGroups)
    console.log('[ScheduleSidePanel] useEffect - loading:', loading)
    console.log('[ScheduleSidePanel] useEffect - hasLoadedInitialData:', hasLoadedInitialDataRef.current)
    
    // Don't update if we're still loading - wait for initial data to be set
    if (loading) {
      console.log('[ScheduleSidePanel] useEffect - still loading, skipping update')
      return
    }
    
    // Don't clear classGroups if we haven't loaded initial data yet
    // This prevents the useEffect from running with stale empty state before initial load completes
    if (!hasLoadedInitialDataRef.current) {
      console.log('[ScheduleSidePanel] useEffect - initial data not loaded yet, skipping update')
      return
    }
    
    // If classGroupIds is empty, check if this is stale state or legitimate user action
    if (classGroupIds.length === 0) {
      // If we haven't loaded initial data yet, this is likely stale state - skip
      if (!hasLoadedInitialDataRef.current) {
        console.log('[ScheduleSidePanel] useEffect - classGroupIds is empty and initial data not loaded, skipping (stale state)')
        return
      }
      
      // If we have initial classGroupIds but classGroups is also empty, this is likely stale state
      // (happens when useEffect runs with empty classGroupIds before initial data sets it)
      if (initialClassGroupIdsRef.current && initialClassGroupIdsRef.current.length > 0 && classGroups.length === 0) {
        console.log('[ScheduleSidePanel] useEffect - classGroupIds is empty, had initial classGroupIds, but classGroups is also empty, skipping (stale state)')
        return
      }
      
      // If we have classGroups but classGroupIds is empty, check if this matches initial state
      // If initial was also empty, this is fine. If initial had values, this might be stale.
      // But if hasLoadedInitialData is true and we have classGroups, it's likely user removed all
      if (initialClassGroupIdsRef.current && initialClassGroupIdsRef.current.length > 0 && classGroups.length > 0) {
        // This is likely a legitimate user action - user removed all class groups
        console.log('[ScheduleSidePanel] useEffect - classGroupIds is empty but we have classGroups, clearing (user removed all)')
        setClassGroups([])
        return
      }
      
      // Otherwise, clear classGroups
      console.log('[ScheduleSidePanel] useEffect - classGroupIds is empty, clearing classGroups')
      setClassGroups([])
      return
    }

    // If allAvailableClassGroups hasn't loaded yet, update from existing classGroups
    // This allows immediate updates when user adds/removes class groups
    if (allAvailableClassGroups.length === 0) {
      console.log('[ScheduleSidePanel] useEffect - allAvailableClassGroups not loaded yet, updating from existing classGroups')
      // Filter existing classGroups to match the new classGroupIds
      const filteredFromExisting = classGroups.filter(cg => 
        classGroupIds.includes(cg.id)
      )
      
      // Check if we're missing any class groups (user added new ones)
      const missingIds = classGroupIds.filter(id => !filteredFromExisting.some(cg => cg.id === id))
      
      if (missingIds.length > 0) {
        // Fetch missing class groups on demand
        console.log('[ScheduleSidePanel] useEffect - missing class groups, fetching:', missingIds)
        Promise.all(
          missingIds.map(id => 
            fetch(`/api/class-groups/${id}`)
              .then(r => r.json())
              .catch(() => null)
          )
        ).then(results => {
          const fetchedGroups = results.filter(Boolean)
          const combined = [...filteredFromExisting, ...fetchedGroups]
          // Sort by order, then name
          combined.sort((a, b) => {
            const orderA = a.order ?? Infinity
            const orderB = b.order ?? Infinity
            if (orderA !== orderB) return orderA - orderB
            return a.name.localeCompare(b.name)
          })
          console.log('[ScheduleSidePanel] useEffect - updating with combined classGroups:', combined)
          setClassGroups(combined)
        })
        // Update immediately with what we have (for removals)
        if (filteredFromExisting.length > 0) {
          setClassGroups(filteredFromExisting)
        }
      } else {
        // No missing class groups, update immediately
        console.log('[ScheduleSidePanel] useEffect - updating with filtered classGroups:', filteredFromExisting)
        setClassGroups(filteredFromExisting)
      }
      return
    }

    // Filter allAvailableClassGroups to get the selected ones
    const selectedClassGroups = allAvailableClassGroups.filter(cg => 
      classGroupIds.includes(cg.id)
    )
    
    console.log('[ScheduleSidePanel] useEffect - selectedClassGroups:', selectedClassGroups)
    
    // If no matching class groups found, clear (user removed all)
    if (selectedClassGroups.length === 0) {
      console.log('[ScheduleSidePanel] useEffect - no matching class groups found, clearing')
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
    console.log('[ScheduleSidePanel] useEffect - setting classGroups to (from allAvailableClassGroups):', selectedClassGroups)
    setClassGroups(selectedClassGroups)
  }, [classGroupIds, allAvailableClassGroups, loading])

  // Fetch teacher assignments when classGroupIds changes or drawer opens
  // Fetch directly from teacher-schedules API for immediate, accurate data
  // (Weekly schedule API may be cached or have timing issues after saves)
  useEffect(() => {
    if (!isOpen) return

    // Fetch directly from teacher-schedules API for most up-to-date data
    fetch('/api/teacher-schedules')
      .then((r) => {
        if (!r.ok) {
          throw new Error(`Failed to fetch teacher schedules: ${r.status}`)
        }
        return r.json()
      })
      .then((data: TeacherSchedule[]) => {
        // Filter by classroom, day, time slot, and class (if classGroupIds is set)
        const filtered = data.filter((schedule) => {
          const matchesLocation = 
            schedule.classroom_id === classroomId &&
            schedule.day_of_week_id === dayId &&
            schedule.time_slot_id === timeSlotId
          
          // If classGroupIds is set, also filter by class_id (teacher schedules still use single class_id)
          if (classGroupIds.length > 0) {
            return matchesLocation && schedule.class_id && classGroupIds.includes(schedule.class_id)
          }
          
          return matchesLocation
        })
        
        const teachers: Teacher[] = filtered.map((schedule) => ({
          id: schedule.id,
          name: schedule.teacher?.display_name || 
                `${schedule.teacher?.first_name || ''} ${schedule.teacher?.last_name || ''}`.trim() ||
                'Unknown',
          teacher_id: schedule.teacher_id,
          is_floater: schedule.is_floater ?? false,
        }))
        
        // If classGroupIds became empty (was not empty before) and we have existing teachers, preserve them
        // This prevents teachers from being cleared when class groups are removed
        const previousClassGroupIds = previousClassGroupIdsRef.current
        const classGroupsWereRemoved = previousClassGroupIds.length > 0 && classGroupIds.length === 0
        
        if (classGroupsWereRemoved && selectedTeachers.length > 0) {
          // Keep existing teachers when class groups are removed
          previousClassGroupIdsRef.current = classGroupIds
          return
        }
        
        // Update the ref before setting teachers
        previousClassGroupIdsRef.current = classGroupIds
        setSelectedTeachers(teachers)
      })
      .catch((err) => {
        console.error('Error fetching teacher assignments:', err)
        // Don't clear teachers on error if we have existing ones and classGroupIds is empty
        const previousClassGroupIds = previousClassGroupIdsRef.current
        const classGroupsWereRemoved = previousClassGroupIds.length > 0 && classGroupIds.length === 0
        
        if (classGroupsWereRemoved && selectedTeachers.length > 0) {
          previousClassGroupIdsRef.current = classGroupIds
          return
        }
        
        previousClassGroupIdsRef.current = classGroupIds
        setSelectedTeachers([])
      })
  }, [isOpen, classroomId, dayId, timeSlotId, classGroupIds])

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
      (cell?.is_active !== isActive) ||
      (JSON.stringify([...cellClassGroupIds].sort()) !== JSON.stringify([...classGroupIds].sort())) ||
      (cell?.enrollment_for_staffing !== enrollment) ||
      (cell?.notes !== notes) ||
      (selectedTeachers.length !== (cell ? selectedTeachers.length : 0))

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
      // Validate
      if (isActive && classGroupIds.length === 0) {
        alert('At least one class group is required when slot is active')
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
        timeSlotsToUpdate = applyTimeSlotIds.length > 0 ? applyTimeSlotIds : timeSlots.map((ts) => ts.id)
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
        class_id: string | null
        enrollment_for_staffing: number | null
        notes: string | null
      }> = []

      for (const updateDayId of daysToUpdate) {
        for (const updateTimeSlotId of timeSlotsToUpdate) {
          updates.push({
            ...cellData,
            day_of_week_id: updateDayId,
            time_slot_id: updateTimeSlotId,
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
      
      const deletePromises: Promise<void>[] = []
      const createPromises: Promise<void>[] = []

      for (const updateDayId of daysToUpdate) {
        for (const updateTimeSlotId of timeSlotsToUpdate) {
          // Filter current schedules for this specific cell
          const currentSchedules = allSchedules.filter((s: TeacherSchedule) =>
            s.classroom_id === classroomId &&
            s.day_of_week_id === updateDayId &&
            s.time_slot_id === updateTimeSlotId
          )
          
          // Use first class group ID for teacher schedules (teachers are assigned to the slot, not individual class groups)
          const primaryClassGroupId = classGroupIds.length > 0 ? classGroupIds[0] : null
          
          // If classGroupIds is set, filter to schedules matching any of the class groups
          const schedulesForThisSlot = primaryClassGroupId
            ? currentSchedules.filter((s) => s.class_id === primaryClassGroupId)
            : []
          
          // Remove all schedules for this cell if no class groups selected
          if (!primaryClassGroupId) {
            // No class groups selected - remove all teacher schedules for this cell
            for (const schedule of currentSchedules) {
              deletePromises.push(
                fetch(`/api/teacher-schedules/${schedule.id}`, {
                  method: 'DELETE',
                }).then(async (deleteResponse) => {
                  if (!deleteResponse.ok) {
                    console.error(`Failed to delete teacher schedule ${schedule.id}`)
                    const errorData = await deleteResponse.json().catch(() => ({}))
                    throw new Error(`Failed to delete teacher schedule: ${errorData.error || deleteResponse.statusText}`)
                  }
                })
              )
            }
          } else {
            // Class groups are set - update teacher assignments using primary class group
            const currentTeacherIds = new Set(schedulesForThisSlot.map((s) => s.teacher_id))
            const newTeacherIds = new Set(selectedTeachers.map((t) => t.teacher_id))

            // Remove assignments that are no longer selected
            for (const schedule of schedulesForThisSlot) {
              if (!newTeacherIds.has(schedule.teacher_id)) {
                deletePromises.push(
                  fetch(`/api/teacher-schedules/${schedule.id}`, {
                    method: 'DELETE',
                  }).then(async (deleteResponse) => {
                    if (!deleteResponse.ok) {
                      console.error(`Failed to delete teacher schedule ${schedule.id}`)
                      const errorData = await deleteResponse.json().catch(() => ({}))
                      throw new Error(`Failed to delete teacher schedule: ${errorData.error || deleteResponse.statusText}`)
                    }
                  })
                )
              }
            }

            // Add new assignments
            // For each selected teacher, check if they have a schedule for this slot
            // If not, check if they have a schedule for a different class - if so, delete it first, then create new one
            for (const teacher of selectedTeachers) {
              if (!teacher.teacher_id) {
                console.warn('Teacher missing teacher_id:', teacher)
                continue
              }
              
              // Check if teacher already has a schedule for this slot
              const teacherScheduleForThisSlot = schedulesForThisSlot.find(
                (s) => s.teacher_id === teacher.teacher_id
              )
              
              if (!teacherScheduleForThisSlot) {
                // Teacher doesn't have a schedule for this slot - check if they have one for a different class
                const teacherScheduleForOtherClass = currentSchedules.find(
                  (s) => s.teacher_id === teacher.teacher_id && s.class_id !== primaryClassGroupId
                )
                
                // If they have a schedule for a different class, delete it first
                if (teacherScheduleForOtherClass) {
                  deletePromises.push(
                    fetch(`/api/teacher-schedules/${teacherScheduleForOtherClass.id}`, {
                      method: 'DELETE',
                    }).then(async (deleteResponse) => {
                      if (!deleteResponse.ok) {
                        console.error(`Failed to delete teacher schedule ${teacherScheduleForOtherClass.id}`)
                        const errorData = await deleteResponse.json().catch(() => ({}))
                        throw new Error(`Failed to delete teacher schedule: ${errorData.error || deleteResponse.statusText}`)
                      }
                    })
                  )
                }
                
                // Create new schedule for this teacher/class group
                const payload = {
                  teacher_id: teacher.teacher_id,
                  day_of_week_id: updateDayId,
                  time_slot_id: updateTimeSlotId,
                  class_id: primaryClassGroupId,
                  classroom_id: classroomId,
                  is_floater: teacher.is_floater ?? false,
                }
                createPromises.push(
                  fetch('/api/teacher-schedules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                  }).then(async (createResponse) => {
                    if (!createResponse.ok) {
                      const errorData = await createResponse.json().catch(() => ({}))
                      const errorMessage = errorData.error || createResponse.statusText
                      
                      // If it's a duplicate key violation, it's okay - the schedule already exists
                      if (errorMessage.includes('already exists') || errorMessage.includes('duplicate key')) {
                        console.log(`Teacher schedule already exists for teacher ${teacher.teacher_id} in this cell, skipping creation`)
                        return // Silently skip - this is not an error
                      }
                      
                      // For other errors, throw
                      console.error(`Failed to create teacher schedule for teacher ${teacher.teacher_id}`)
                      console.error('Error details:', errorData)
                      throw new Error(`Failed to create teacher schedule: ${errorMessage}`)
                    }
                    await createResponse.json()
                  })
                )
              }
            }
          }
        }
      }

      // Wait for all delete and create operations to complete
      await Promise.all([...deletePromises, ...createPromises])

      setHasUnsavedChanges(false)
      
      // Wait a moment for database to commit, then refresh and close
      // This ensures the refresh happens after data is saved
      await new Promise(resolve => setTimeout(resolve, 100))
      
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

  const handleApplyScopeChange = (scope: 'single' | 'timeSlot' | 'day', dayIds: string[], timeSlotIds?: string[]) => {
    setApplyScope(scope)
    setApplyDayIds(dayIds)
    if (scope === 'day') {
      // For 'day' scope, use all time slots
      if (timeSlots.length > 0) {
        setApplyTimeSlotIds(timeSlots.map((ts) => ts.id))
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
    setConflictResolutions((prev) => {
      const newResolutions = new Map(prev)
      newResolutions.set(conflictId, resolution)
      return newResolutions
    })
  }

  const handleApplyConflictResolutions = async () => {
    if (classGroupIds.length === 0) return

    setResolvingConflicts(true)
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
              target_class_id: primaryClassGroupId,
              conflicting_schedule_id: conflict.conflicting_schedule_id,
            }),
          })

          if (!response.ok) {
            throw new Error(`Failed to resolve conflict for ${conflict.teacher_name || conflict.teacher_id}`)
          }
        }
      }

      // Remove teachers that were canceled
      if (teachersToRemove.length > 0) {
        setSelectedTeachers((prev) => 
          prev.filter((t) => !teachersToRemove.includes(t.teacher_id))
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
      setResolvingConflicts(false)
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
  const classGroupForRatio = classGroups.length > 0
    ? classGroups.reduce((lowest, current) => {
        const currentMinAge = current.min_age ?? Infinity
        const lowestMinAge = lowest.min_age ?? Infinity
        return currentMinAge < lowestMinAge ? current : lowest
      })
    : null

  // Debug logging
  useEffect(() => {
    console.log('[ScheduleSidePanel] Render - classGroups:', classGroups)
    console.log('[ScheduleSidePanel] Render - classGroups.length:', classGroups.length)
    console.log('[ScheduleSidePanel] Render - classGroupForRatio:', classGroupForRatio)
    console.log('[ScheduleSidePanel] Render - should show fields?', classGroups.length > 0 && classGroupForRatio !== null)
  }, [classGroups, classGroupForRatio])
  
  const requiredTeachers = classGroupForRatio && enrollmentForCalculation
    ? Math.ceil(enrollmentForCalculation / classGroupForRatio.required_ratio)
    : undefined
  const preferredTeachers = classGroupForRatio && enrollmentForCalculation && classGroupForRatio.preferred_ratio
    ? Math.ceil(enrollmentForCalculation / classGroupForRatio.preferred_ratio)
    : undefined

  // Debug logging - extract primitives to keep dependency array stable
  const cellEnrollment = cell?.enrollment_for_staffing ?? null
  const classGroupRequiredRatio = classGroupForRatio?.required_ratio ?? null
  const classGroupPreferredRatio = classGroupForRatio?.preferred_ratio ?? null
  const classGroupNames = classGroups.map(cg => cg.name).join(', ')
  const assignedCount = selectedTeachers.length
  
  // Debug logging removed - use browser dev tools if needed
  // Only include primitive source values, not computed values
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Staffing calculation dependencies tracked for reactivity
  }, [isOpen, classGroupIds.length, cellEnrollment, enrollment, classGroupRequiredRatio, classGroupPreferredRatio, assignedCount])

  return (
    <>
      <Sheet open={isOpen} onOpenChange={handleClose}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto bg-gray-50 p-0">
          <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-6 pt-6 pb-4">
            <SheetHeader>
              <SheetTitle>
                {classroomName} • {dayName} • {timeSlotCode} {timeRange && `(${timeRange})`}
              </SheetTitle>
              <SheetDescription>
                Configure schedule cell settings and assignments
              </SheetDescription>
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
                  onToggle={(newActive) => {
                    if (isActive && !newActive) {
                      // Show confirmation when deactivating
                      setShowDeactivateDialog(true)
                      setPendingInactive(true)
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
              <div className={`rounded-lg bg-white border border-gray-200 p-6 space-y-2 ${fieldsDisabled ? 'opacity-60' : ''}`}>
                <ClassGroupMultiSelect
                  selectedClassGroupIds={classGroupIds}
                  onSelectionChange={(newClassGroupIds) => {
                    previousClassGroupIdsRef.current = classGroupIds
                    setClassGroupIds(newClassGroupIds)
                  }}
                  allowedClassGroupIds={allowedClassGroupIds.length > 0 ? allowedClassGroupIds : undefined}
                  disabled={fieldsDisabled}
                  existingClassGroups={classGroups}
                />
                <div className="pt-2 pb-3 border-b border-gray-200"></div>
                {isActive && classGroupIds.length === 0 && (
                  <p className="text-sm text-yellow-600">At least one class group is required when slot is active</p>
                )}
                
                {/* Age and Ratios Display */}
                {classGroups.length > 0 && classGroupForRatio && (
                  <div className="space-y-2 text-sm pt-1">
                    {/* Class Groups List */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-muted-foreground">Class Groups:</div>
                      <div className="flex flex-wrap gap-1">
                        {classGroups.map((cg) => (
                          <span key={cg.id} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            {cg.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    {/* Age Range (from lowest min_age) */}
                    <div className="flex items-center gap-2">
                      <div className="text-muted-foreground">Age (lowest):</div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {classGroupForRatio.min_age !== null && classGroupForRatio.max_age !== null
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
              <div className={`rounded-lg bg-white border border-gray-200 p-6 space-y-2 ${fieldsDisabled ? 'opacity-60' : ''}`}>
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
                            Required: {requiredTeachers} Teacher{requiredTeachers !== 1 ? 's' : ''}
                          </span>
                        )}
                        {preferredTeachers !== undefined && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            Preferred: {preferredTeachers} Teacher{preferredTeachers !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Section E: Assigned Teachers */}
              <div className={`rounded-lg bg-white border-l-4 border-l-primary/40 border border-gray-200 p-6 space-y-2 ${fieldsDisabled ? 'opacity-60' : ''}`}>
                <Label className="text-base font-medium text-foreground block mb-6">Assigned Teachers</Label>
                {classGroupIds.length === 0 ? (
                  <div className="space-y-4">
                    <TeacherMultiSelect
                      selectedTeachers={[]}
                      onTeachersChange={() => {}}
                      requiredCount={undefined}
                      preferredCount={undefined}
                      disabled={true}
                    />
                    <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                      <p className="text-sm text-amber-800">
                        At least one class group must be added first before teachers can be assigned.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <TeacherMultiSelect
                      selectedTeachers={selectedTeachers}
                      onTeachersChange={setSelectedTeachers}
                      requiredCount={requiredTeachers}
                      preferredCount={preferredTeachers}
                      disabled={fieldsDisabled}
                    />
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
                  </>
                )}
              </div>

              {/* Section F: Notes */}
              <div className={`rounded-lg bg-white border border-gray-200 p-6 space-y-2 ${fieldsDisabled ? 'opacity-60' : ''}`}>
                <Label htmlFor="notes" className="text-base font-medium text-foreground block mb-6">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes || ''}
                  onChange={(e) => setNotes(e.target.value || null)}
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
              <div className="space-y-2 pt-4 border-t">
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
                setPendingInactive(false)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setIsActive(false)
                setShowDeactivateDialog(false)
                setPendingInactive(false)
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
