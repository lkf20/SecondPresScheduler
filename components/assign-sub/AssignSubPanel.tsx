'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertTriangle, Check, Info, X, ExternalLink } from 'lucide-react'
import { CreateTimeOffRequestCard } from '@/components/time-off/CreateTimeOffRequestCard'
import { parseLocalDate } from '@/lib/utils/date'
import { DAY_NAMES, MONTH_NAMES, FULL_DAY_NAMES } from '@/lib/utils/date-format'
import SearchableSelect, { type SearchableSelectOption } from '@/components/shared/SearchableSelect'
import DatePickerInput from '@/components/ui/date-picker-input'
import { getPanelBackgroundClasses } from '@/lib/utils/colors'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useSchool } from '@/lib/contexts/SchoolContext'
import { clearDataHealthCache } from '@/lib/dashboard/data-health-cache'
import { invalidateSubAssignment } from '@/lib/utils/invalidation'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useDisplayNameFormat } from '@/lib/hooks/use-display-name-format'
import { getStaffDisplayName } from '@/lib/utils/staff-display-name'

interface Teacher {
  id: string
  first_name?: string | null
  last_name?: string | null
  display_name?: string | null
}

interface Sub {
  id: string
  first_name?: string | null
  last_name?: string | null
  display_name?: string | null
  can_change_diapers?: boolean | null
  can_lift_children?: boolean | null
  can_assist_with_toileting?: boolean | null
}

interface Shift {
  id: string
  date: string
  day_of_week_id: string
  time_slot_id: string
  classroom_id: string | null
  has_time_off: boolean
  time_off_request_id: string | null
  status?: 'available' | 'unavailable' | 'conflict_teaching' | 'conflict_sub'
  conflict_message?: string
  /** When conflict_teaching: room the sub is already assigned to (from their teaching schedule) */
  conflict_teaching_classroom_name?: string
  classroom_name?: string | null
  time_slot_code?: string
  day_name?: string
  /** True when this shift falls on a school-closed day/slot; show for context but not assignable */
  school_closure?: boolean
  /** For Change sub: coverage request shift id (when has_time_off). */
  coverage_request_shift_id?: string
  /** When shift is already assigned. */
  assignment_id?: string
  assigned_sub_id?: string
  assigned_sub_name?: string
}

interface Qualification {
  id: string
  qualification_id: string
  qualification?: {
    id: string
    name: string
    category?: string | null
  } | null
}

interface ConflictEntry {
  shift_id: string
  status: Shift['status']
  message?: string | null
}

interface AssignSubPanelProps {
  isOpen: boolean
  onClose: () => void
  /** Pre-fill when opening from e.g. Weekly Schedule cell panel */
  initialTeacherId?: string
  initialStartDate?: string
  initialEndDate?: string
}

export default function AssignSubPanel({
  isOpen,
  onClose,
  initialTeacherId: initialTeacherIdProp,
  initialStartDate: initialStartDateProp,
  initialEndDate: initialEndDateProp,
}: AssignSubPanelProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const schoolId = useSchool()
  const [teacherId, setTeacherId] = useState<string | null>(null)
  const [subId, setSubId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [selectedShiftIds, setSelectedShiftIds] = useState<Set<string>>(new Set())
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [subs, setSubs] = useState<Sub[]>([])
  const [subQualifications, setSubQualifications] = useState<Qualification[]>([])
  const [teacherClasses, setTeacherClasses] = useState<string[]>([])
  const [timeOffReason, setTimeOffReason] = useState<string>('Sick Day')
  const [timeOffNotes, setTimeOffNotes] = useState<string>('')
  const [subNotes, setSubNotes] = useState<string>('')
  const [changeSubShifts, setChangeSubShifts] = useState<Shift[] | null>(null)
  const [changeSubNewSubId, setChangeSubNewSubId] = useState<string | null>(null)
  const [changeSubSubmitting, setChangeSubSubmitting] = useState(false)
  const [assignAsFloater, setAssignAsFloater] = useState(false)
  const { format: displayNameFormat } = useDisplayNameFormat()
  const isInitialMountRef = useRef(true)
  const appliedInitialRef = useRef(false)
  const shiftIdsKey = useMemo(() => shifts.map(shift => shift.id).join('|'), [shifts])

  // Get display name helper
  const getDisplayName = useCallback(
    (
      person:
        | { display_name?: string | null; first_name?: string | null; last_name?: string | null }
        | null
        | undefined,
      fallback = 'Unknown'
    ) => {
      if (!person) return fallback
      const name = getStaffDisplayName(
        {
          first_name: person.first_name ?? '',
          last_name: person.last_name ?? '',
          display_name: person.display_name ?? null,
        },
        displayNameFormat
      )
      return name || fallback
    },
    [displayNameFormat]
  )

  // Fetch teachers
  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const response = await fetch('/api/teachers')
        if (!response.ok) throw new Error('Failed to fetch teachers')
        const data = await response.json()
        const sorted = (data as Teacher[])
          .filter(t => (t as Teacher & { active?: boolean }).active !== false)
          .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)))
        setTeachers(sorted)
      } catch (error) {
        console.error('Error fetching teachers:', error)
        setTeachers([])
      }
    }
    fetchTeachers()
  }, [getDisplayName])

  // Fetch subs
  useEffect(() => {
    const fetchSubs = async () => {
      try {
        const response = await fetch('/api/subs')
        if (!response.ok) throw new Error('Failed to fetch subs')
        const data = await response.json()
        const sorted = (data as Sub[])
          .filter(s => (s as Sub & { active?: boolean }).active !== false)
          .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)))
        setSubs(sorted)
      } catch (error) {
        console.error('Error fetching subs:', error)
        setSubs([])
      }
    }
    fetchSubs()
  }, [getDisplayName])

  const fetchShifts = useCallback(async () => {
    if (!teacherId || !startDate) return
    setLoading(true)
    try {
      const effectiveEndDate = endDate || startDate
      const response = await fetch('/api/assign-sub/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: teacherId,
          start_date: startDate,
          end_date: effectiveEndDate,
        }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to fetch shifts')
      }
      const data = await response.json()
      const rawShifts = data.shifts || []
      const timeslotsResponse = await fetch('/api/timeslots').catch(() => null)
      const timeslots = timeslotsResponse?.ok ? await timeslotsResponse.json() : []
      const timeSlotOrderMap = new Map<string, number>()
      timeslots.forEach((slot: { code?: string; display_order?: number }) => {
        if (slot.code) timeSlotOrderMap.set(slot.code, slot.display_order ?? 999)
      })
      const shiftDetails = await Promise.all(
        rawShifts.map(async (shift: Record<string, unknown>) => {
          let classroomName: string | null = null
          if (shift.classroom_id) {
            const classroomResponse = await fetch(`/api/classrooms/${shift.classroom_id}`).catch(
              () => null
            )
            if (classroomResponse?.ok) {
              const classroomData = await classroomResponse.json()
              classroomName = classroomData.name ?? null
            }
          }
          const date = parseLocalDate(shift.date as string)
          const dayName = FULL_DAY_NAMES[date.getDay()]
          return { ...shift, day_name: dayName, classroom_name: classroomName }
        })
      )
      const sortedShifts = shiftDetails.sort((a: Shift, b: Shift) => {
        const dateCompare = (a.date as string).localeCompare(b.date as string)
        if (dateCompare !== 0) return dateCompare
        const aOrder = timeSlotOrderMap.get((a.time_slot_code as string) ?? '') ?? 999
        const bOrder = timeSlotOrderMap.get((b.time_slot_code as string) ?? '') ?? 999
        return aOrder - bOrder
      })
      setShifts(sortedShifts)
      setSelectedShiftIds(new Set())
    } catch (error) {
      console.error('Error fetching shifts:', error)
      toast.error('Failed to load shifts')
      setShifts([])
    } finally {
      setLoading(false)
    }
  }, [teacherId, startDate, endDate])

  // Fetch shifts when teacher and dates are selected
  useEffect(() => {
    if (!teacherId || !startDate || isInitialMountRef.current) {
      isInitialMountRef.current = false
      return
    }
    fetchShifts()
  }, [teacherId, startDate, endDate, fetchShifts])

  // Fetch sub qualifications when sub is selected
  useEffect(() => {
    if (!subId) {
      setSubQualifications([])
      return
    }

    const fetchQualifications = async () => {
      try {
        const response = await fetch(`/api/subs/${subId}/qualifications`)
        if (!response.ok) throw new Error('Failed to fetch qualifications')
        const data = await response.json()
        setSubQualifications(data || [])
      } catch (error) {
        console.error('Error fetching qualifications:', error)
        setSubQualifications([])
      }
    }

    fetchQualifications()
  }, [subId])

  // Fetch teacher's classes when teacher is selected (for filtering qualifications)
  useEffect(() => {
    if (!teacherId) {
      setTeacherClasses([])
      return
    }

    const fetchTeacherClasses = async () => {
      try {
        const response = await fetch(
          `/api/teachers/${teacherId}/scheduled-shifts?start_date=${startDate || '2025-01-01'}&end_date=${endDate || '2025-12-31'}`
        )
        if (!response.ok) throw new Error('Failed to fetch teacher classes')
        const data = await response.json()
        // Extract unique class names from shifts
        const classNames = new Set<string>()
        data.forEach((shift: { class_name?: string }) => {
          if (shift.class_name) classNames.add(shift.class_name)
        })
        setTeacherClasses(Array.from(classNames))
      } catch (error) {
        console.error('Error fetching teacher classes:', error)
        setTeacherClasses([])
      }
    }

    if (startDate) {
      fetchTeacherClasses()
    }
  }, [teacherId, startDate, endDate])

  // Check conflicts when sub and shifts are available (no coverage request; use shifts array)
  useEffect(() => {
    if (!subId || !teacherId || shifts.length === 0) return

    const checkConflicts = async () => {
      try {
        const response = await fetch('/api/sub-finder/check-conflicts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sub_id: subId,
            teacher_id: teacherId,
            shifts: shifts.map(s => ({
              date: s.date,
              time_slot_id: s.time_slot_id,
              day_of_week_id: s.day_of_week_id,
              classroom_id: s.classroom_id ?? null,
            })),
          }),
        })

        if (!response.ok) {
          console.error('Failed to check conflicts')
          return
        }

        const conflictData: Array<{
          shift_key: string
          status: Shift['status']
          message?: string
          conflict_classroom_name?: string
        }> = await response.json()
        const byKey = new Map(conflictData.map(c => [c.shift_key, c]))

        setShifts(prevShifts =>
          prevShifts.map(shift => {
            const key = `${shift.date}|${shift.time_slot_id}`
            const conflict = byKey.get(key)
            if (!conflict) return shift
            return {
              ...shift,
              status: conflict.status,
              conflict_message: conflict.message ?? undefined,
              conflict_teaching_classroom_name:
                conflict.status === 'conflict_teaching' && conflict.conflict_classroom_name
                  ? conflict.conflict_classroom_name
                  : undefined,
            }
          })
        )
      } catch (error) {
        console.error('Error checking conflicts:', error)
      }
    }

    checkConflicts()
  }, [subId, teacherId, shiftIdsKey])

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = parseLocalDate(dateString)
    const dayName = DAY_NAMES[date.getDay()]
    const month = MONTH_NAMES[date.getMonth()]
    const day = date.getDate()
    return `${dayName} ${month} ${day}`
  }

  // Format shift label
  const formatShiftLabel = (shift: Shift) => {
    const dateLabel = formatDate(shift.date)
    const timeSlot = shift.time_slot_code || ''
    const classroom = shift.classroom_name || 'Classroom unavailable'
    return `${dateLabel} • ${timeSlot} • ${classroom}`
  }

  // Teacher options for SearchableSelect
  const teacherOptions: SearchableSelectOption[] = useMemo(() => {
    return teachers.map(teacher => ({
      id: teacher.id,
      label: getDisplayName(teacher),
    }))
  }, [teachers, getDisplayName])

  // Sub options for SearchableSelect
  const subOptions: SearchableSelectOption[] = useMemo(() => {
    return subs.map(sub => ({
      id: sub.id,
      label: getDisplayName(sub),
    }))
  }, [subs, getDisplayName])

  // Filter qualifications by teacher's classes
  const relevantQualifications = useMemo(() => {
    if (teacherClasses.length === 0 || subQualifications.length === 0) return subQualifications

    // Filter qualifications to only show those relevant to the teacher's classes
    // This is a simplified check - in a real system, you'd match qualification names to class names
    return subQualifications.filter(qual => {
      const qualName = qual.qualification?.name || ''
      const qualNameLower = qualName.toLowerCase()
      // Check if qualification name matches any of the teacher's classes
      return teacherClasses.some(className => {
        const classNameLower = className.toLowerCase()
        // Match if qualification name contains class name or vice versa
        return qualNameLower.includes(classNameLower) || classNameLower.includes(qualNameLower)
      })
    })
  }, [subQualifications, teacherClasses])

  // Clear shift selection only when the shift list changes (e.g. new teacher/date range).
  // Do not clear when subId changes, so the user can select shifts then pick a sub and assign.
  useEffect(() => {
    if (shifts.length === 0) {
      setSelectedShiftIds(new Set())
      return
    }
    setSelectedShiftIds(new Set())
  }, [shiftIdsKey])

  // Calculate summary stats (exclude school-closure shifts from assignable counts)
  const summaryStats = useMemo(() => {
    const selectedShifts = shifts.filter(s => selectedShiftIds.has(s.id) && !s.school_closure)
    const noTimeOffCount = selectedShifts.filter(s => !s.has_time_off).length
    const conflictCount = selectedShifts.filter(
      s =>
        s.status === 'unavailable' ||
        s.status === 'conflict_teaching' ||
        s.status === 'conflict_sub'
    ).length
    return {
      totalSelected: selectedShifts.length,
      noTimeOffCount,
      conflictCount,
    }
  }, [shifts, selectedShiftIds])

  // Group shifts by (date, time_slot_id) for display (floater = multiple classrooms per slot)
  const shiftGroups = useMemo(() => {
    const bySlot = new Map<string, Shift[]>()
    for (const shift of shifts) {
      const key = `${shift.date}|${shift.time_slot_id}`
      if (!bySlot.has(key)) bySlot.set(key, [])
      bySlot.get(key)!.push(shift)
    }
    return Array.from(bySlot.entries()).map(([slotKey, groupShifts]) => ({
      slotKey,
      shifts: groupShifts.sort((a, b) =>
        (a.classroom_name ?? '').localeCompare(b.classroom_name ?? '')
      ),
    }))
  }, [shifts])

  // Handle shift toggle (single id)
  const handleShiftToggle = (shiftId: string) => {
    setSelectedShiftIds(prev => {
      const next = new Set(prev)
      if (next.has(shiftId)) next.delete(shiftId)
      else next.add(shiftId)
      return next
    })
  }

  // Handle toggle for a group (e.g. floater slot): select all or deselect all
  const handleShiftGroupToggle = (groupShifts: Shift[]) => {
    const ids = groupShifts.map(s => s.id)
    const allSelected = ids.every(id => selectedShiftIds.has(id))
    setSelectedShiftIds(prev => {
      const next = new Set(prev)
      if (allSelected) ids.forEach(id => next.delete(id))
      else ids.forEach(id => next.add(id))
      return next
    })
  }

  // Handle assign (no coverage request up front; create time off if needed, then get coverage request per absence)
  const handleAssign = async () => {
    if (!teacherId || !subId || selectedShiftIds.size === 0) {
      toast.error('Please select a teacher, sub, and at least one shift')
      return
    }

    setSubmitting(true)
    try {
      const selectedShifts = shifts.filter(s => selectedShiftIds.has(s.id) && !s.school_closure)
      if (selectedShifts.length === 0) {
        toast.error(
          'No assignable shifts selected. Shifts on school-closed days cannot be assigned.'
        )
        setSubmitting(false)
        return
      }
      const shiftsWithoutTimeOff = selectedShifts.filter(s => !s.has_time_off)

      if (shiftsWithoutTimeOff.length > 0 && !timeOffReason?.trim()) {
        toast.error('Please select a reason for the time off request.')
        setSubmitting(false)
        return
      }

      let createdTimeOffRequestId: string | null = null

      if (shiftsWithoutTimeOff.length > 0 && teacherId) {
        // One time_off_shift per (date, slot); floater has multiple shifts per slot but API expects unique (date, day_of_week_id, time_slot_id)
        const uniqueSlots = Array.from(
          new Map(
            shiftsWithoutTimeOff.map(s => [
              `${s.date}|${s.day_of_week_id}|${s.time_slot_id}`,
              {
                date: s.date,
                day_of_week_id: s.day_of_week_id,
                time_slot_id: s.time_slot_id,
              },
            ])
          ).values()
        )
        const timeOffResponse = await fetch('/api/time-off', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teacher_id: teacherId,
            start_date: shiftsWithoutTimeOff[0].date,
            end_date: shiftsWithoutTimeOff[shiftsWithoutTimeOff.length - 1].date,
            shift_selection_mode: 'select_shifts',
            reason: timeOffReason,
            notes: timeOffNotes || null,
            shifts: uniqueSlots,
          }),
        })

        if (!timeOffResponse.ok) {
          let errorMessage = 'Failed to create time off request'
          try {
            const errorData = await timeOffResponse.json()
            console.error('[AssignSubPanel] Time off request creation failed:', {
              status: timeOffResponse.status,
              statusText: timeOffResponse.statusText,
              errorData,
            })
            errorMessage = errorData.error || errorData.message || errorMessage
          } catch (e) {
            console.error('[AssignSubPanel] Failed to parse error response:', e)
            errorMessage = `Failed to create time off request (${timeOffResponse.status} ${timeOffResponse.statusText})`
          }
          throw new Error(errorMessage)
        }

        const timeOffData = await timeOffResponse.json()
        createdTimeOffRequestId = timeOffData?.id ?? null
      }

      // Group selected shifts by time_off_request_id (use created id for shifts we just created time off for)
      const getTimeOffRequestId = (s: Shift) =>
        s.has_time_off ? s.time_off_request_id : createdTimeOffRequestId

      const shiftsByTimeOffRequest = new Map<string | null, Shift[]>()
      for (const s of selectedShifts) {
        const torId = getTimeOffRequestId(s)
        if (!shiftsByTimeOffRequest.has(torId)) {
          shiftsByTimeOffRequest.set(torId, [])
        }
        shiftsByTimeOffRequest.get(torId)!.push(s)
      }

      let totalAssigned = 0

      for (const [timeOffRequestId, shiftsInGroup] of shiftsByTimeOffRequest) {
        if (!timeOffRequestId) {
          toast.error(
            'One or more selected shifts have no time off request and could not be assigned.'
          )
          continue
        }

        const covRes = await fetch(`/api/sub-finder/coverage-request/${timeOffRequestId}`)
        if (!covRes.ok) {
          console.error('[AssignSubPanel] Failed to get coverage request for', timeOffRequestId)
          toast.error('Failed to resolve coverage for absence.')
          continue
        }
        const covData = await covRes.json()
        const coverageRequestId = covData.coverage_request_id
        const shiftMap = covData.shift_map || {}

        const coverageRequestShiftIds: string[] = []
        const isFloaterShiftIds = new Set<string>()
        for (const s of shiftsInGroup) {
          const keyWithClass = `${s.date}|${s.time_slot_code ?? ''}|${s.classroom_id ?? ''}`
          const keySimple = `${s.date}|${s.time_slot_code ?? ''}`
          const id = shiftMap[keyWithClass] ?? shiftMap[keySimple]
          if (id) {
            coverageRequestShiftIds.push(id)
            const slotKey = `${s.date}|${s.time_slot_id}`
            const group = shiftGroups.find(g => g.slotKey === slotKey)
            const isFloaterSlot = group ? group.shifts.length > 1 : false
            const isConflictWithOverride =
              assignAsFloater && (s.status === 'conflict_teaching' || s.status === 'conflict_sub')
            if (isFloaterSlot || isConflictWithOverride) {
              isFloaterShiftIds.add(id)
            }
          }
        }

        if (coverageRequestShiftIds.length === 0) continue

        if (subId && coverageRequestId) {
          const contactResponse = await fetch(
            `/api/sub-finder/substitute-contacts?coverage_request_id=${coverageRequestId}&sub_id=${subId}`
          )
          if (contactResponse.ok) {
            const contactData = await contactResponse.json()
            await fetch('/api/sub-finder/substitute-contacts', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: contactData.id,
                contact_status: 'confirmed',
                response_status: 'confirmed',
                is_contacted: true,
                notes: subNotes || null,
              }),
            })
          }
        }

        const assignResponse = await fetch('/api/sub-finder/assign-shifts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            coverage_request_id: coverageRequestId,
            sub_id: subId,
            selected_shift_ids: coverageRequestShiftIds,
          }),
        })

        if (!assignResponse.ok) {
          const errorData = await assignResponse.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(errorData.error || 'Failed to assign shifts')
        }
        const loopResult = await assignResponse.json()
        totalAssigned += loopResult?.assignments_created ?? coverageRequestShiftIds.length
      }

      const assignResult = { assignments_created: totalAssigned }

      const sub = subs.find(s => s.id === subId)
      const teacher = teachers.find(t => t.id === teacherId)
      const subName = getDisplayName(sub)
      const teacherName = getDisplayName(teacher)
      const requestedShiftCount = selectedShiftIds.size
      const assignedShiftCount = assignResult?.assignments_created ?? requestedShiftCount
      const skippedShiftCount = Math.max(0, requestedShiftCount - assignedShiftCount)

      toast.success(
        `Assigned ${subName} to ${assignedShiftCount} shift${assignedShiftCount !== 1 ? 's' : ''} for ${teacherName}${
          skippedShiftCount > 0 ? ` (${skippedShiftCount} already assigned and skipped).` : ''
        }${
          shiftsWithoutTimeOff.length > 0
            ? `. Time off request created for ${shiftsWithoutTimeOff.length} shift${shiftsWithoutTimeOff.length !== 1 ? 's' : ''}.`
            : ''
        }`
      )

      // Close panel and refresh; invalidate dashboard data-health cache and React Query so Weekly Schedule and Dashboard update
      clearDataHealthCache()
      await invalidateSubAssignment(queryClient, schoolId)
      onClose()
      router.refresh()
    } catch (error) {
      console.error('Error assigning shifts:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to assign shifts')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle view in Sub Finder
  const handleViewInSubFinder = () => {
    if (!teacherId || !startDate) return
    const effectiveEndDate = endDate || startDate
    router.push(
      `/sub-finder?teacher_id=${teacherId}&start_date=${startDate}&end_date=${effectiveEndDate}&mode=manual`
    )
    onClose()
  }

  // Change sub: unassign current sub(s) and assign new sub for the selected shift(s)
  const handleChangeSubConfirm = async () => {
    if (!changeSubShifts?.length || !changeSubNewSubId) {
      toast.error('Select a sub to assign.')
      return
    }
    const first = changeSubShifts[0]
    const timeOffRequestId = first?.time_off_request_id
    if (!timeOffRequestId) {
      toast.error('This shift has no time off request.')
      setChangeSubShifts(null)
      return
    }
    const covRes = await fetch(`/api/sub-finder/coverage-request/${timeOffRequestId}`)
    if (!covRes.ok) {
      toast.error('Failed to load coverage request.')
      return
    }
    const covData = await covRes.json()
    const coverageRequestId = covData.coverage_request_id
    const shiftMap = covData.shift_map || {}
    const coverageRequestShiftIds: string[] = []
    for (const s of changeSubShifts) {
      const id =
        s.coverage_request_shift_id ??
        shiftMap[`${s.date}|${s.time_slot_code ?? ''}|${s.classroom_id ?? ''}`] ??
        shiftMap[`${s.date}|${s.time_slot_code ?? ''}`]
      if (id) coverageRequestShiftIds.push(id)
    }
    if (coverageRequestShiftIds.length === 0) {
      toast.error('Could not resolve shifts to update.')
      setChangeSubShifts(null)
      return
    }
    setChangeSubSubmitting(true)
    try {
      for (const s of changeSubShifts) {
        if (s.assignment_id && s.assigned_sub_id) {
          const unassignRes = await fetch('/api/sub-finder/unassign-shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              absence_id: timeOffRequestId,
              sub_id: s.assigned_sub_id,
              scope: 'single',
              assignment_id: s.assignment_id,
            }),
          })
          if (!unassignRes.ok) {
            const err = await unassignRes.json().catch(() => ({}))
            throw new Error(err.error || 'Failed to unassign current sub')
          }
        }
      }
      const assignRes = await fetch('/api/sub-finder/assign-shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coverage_request_id: coverageRequestId,
          sub_id: changeSubNewSubId,
          selected_shift_ids: coverageRequestShiftIds,
        }),
      })
      if (!assignRes.ok) {
        const err = await assignRes.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to assign new sub')
      }
      const newSub = subs.find(s => s.id === changeSubNewSubId)
      const newSubName = newSub ? getDisplayName(newSub) : 'Sub'
      toast.success(`Reassigned to ${newSubName}.`)
      setChangeSubShifts(null)
      setChangeSubNewSubId(null)
      clearDataHealthCache()
      await invalidateSubAssignment(queryClient, schoolId)
      fetchShifts()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to change sub')
    } finally {
      setChangeSubSubmitting(false)
    }
  }

  // Reset form when panel closes; apply initial teacher/date once when panel opens with initial props
  useEffect(() => {
    if (!isOpen) {
      setTeacherId(null)
      setSubId(null)
      setStartDate('')
      setEndDate('')
      setSelectedShiftIds(new Set())
      setShifts([])
      setTimeOffReason('Sick Day')
      setTimeOffNotes('')
      setSubNotes('')
      setAssignAsFloater(false)
      isInitialMountRef.current = true
      appliedInitialRef.current = false
      return
    }
    const hasInitial = initialTeacherIdProp ?? initialStartDateProp ?? initialEndDateProp
    if (hasInitial && !appliedInitialRef.current) {
      if (initialTeacherIdProp) setTeacherId(initialTeacherIdProp)
      if (initialStartDateProp) setStartDate(initialStartDateProp)
      if (initialEndDateProp) setEndDate(initialEndDateProp)
      appliedInitialRef.current = true
    }
  }, [isOpen, initialTeacherIdProp, initialStartDateProp, initialEndDateProp])

  const selectedSub = subs.find(s => s.id === subId)

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className={cn(
          'w-full sm:max-w-2xl h-screen flex flex-col p-0',
          getPanelBackgroundClasses()
        )}
      >
        <div className={cn('flex-1 overflow-y-auto px-6 py-6', getPanelBackgroundClasses())}>
          <SheetHeader className="mb-6 pt-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <SheetTitle className="text-3xl font-bold tracking-tight text-slate-900">
                  Assign Sub
                </SheetTitle>
                <SheetDescription>Assign a substitute to shifts for a teacher</SheetDescription>
              </div>
              <SheetClose asChild>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 focus:outline-none ml-4"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </SheetClose>
            </div>
          </SheetHeader>

          <div className="space-y-6">
            {/* Teacher and Sub Selection */}
            <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="teacher-select">
                  Teacher <span className="text-destructive">*</span>
                </Label>
                <SearchableSelect
                  options={teacherOptions}
                  value={teacherId}
                  onValueChange={setTeacherId}
                  placeholder="Search or select a teacher..."
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sub-select">
                  Sub to assign <span className="text-destructive">*</span>
                </Label>
                <SearchableSelect
                  options={subOptions}
                  value={subId}
                  onValueChange={setSubId}
                  placeholder="Search or select a substitute..."
                  className="w-full"
                />
                {/* Capabilities: badges with green check or red X */}
                {selectedSub && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[
                      {
                        key: 'diapers',
                        label: 'Can change diapers',
                        value: selectedSub.can_change_diapers === true,
                      },
                      {
                        key: 'lift',
                        label: 'Can lift children',
                        value: selectedSub.can_lift_children === true,
                      },
                      {
                        key: 'toileting',
                        label: 'Can assist with toileting',
                        value: selectedSub.can_assist_with_toileting === true,
                      },
                    ].map(({ key, label, value }) => (
                      <Badge
                        key={key}
                        variant="outline"
                        className="text-xs inline-flex items-center gap-1.5 font-normal"
                        style={
                          value
                            ? {
                                backgroundColor: 'rgb(240, 253, 244)',
                                borderColor: 'rgb(134, 239, 172)',
                                color: 'rgb(22, 101, 52)',
                              }
                            : {
                                backgroundColor: 'rgb(254, 242, 242)',
                                borderColor: 'rgb(252, 165, 165)',
                                color: 'rgb(153, 27, 27)',
                              }
                        }
                      >
                        {value ? (
                          <Check className="h-3 w-3 shrink-0" />
                        ) : (
                          <X className="h-3 w-3 shrink-0" />
                        )}
                        {label}
                      </Badge>
                    ))}
                  </div>
                )}
                {/* Certifications / qualifications: gray badge with name only; amber only when we have teacher classes and qual doesn't match */}
                {selectedSub && subQualifications.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {subQualifications.map(qual => {
                      const qualName = qual.qualification?.name || 'Unknown'
                      const matchesTeacherClass =
                        teacherClasses.length > 0 &&
                        teacherClasses.some(className => {
                          const classNameLower = className.toLowerCase()
                          const qualNameLower = qualName.toLowerCase()
                          return (
                            qualNameLower.includes(classNameLower) ||
                            classNameLower.includes(qualNameLower)
                          )
                        })
                      const showNotQualified = teacherClasses.length > 0 && !matchesTeacherClass
                      return showNotQualified ? (
                        <Badge
                          key={qual.id}
                          variant="outline"
                          className="text-xs bg-amber-50 text-amber-700 border-amber-200 font-normal"
                        >
                          Not qualified for {qualName}
                        </Badge>
                      ) : (
                        <Badge
                          key={qual.id}
                          variant="outline"
                          className="text-xs font-normal"
                          style={{
                            backgroundColor: 'rgb(248, 250, 252)',
                            borderColor: 'rgb(226, 232, 240)',
                            color: 'rgb(71, 85, 105)',
                          }}
                        >
                          {qualName}
                        </Badge>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Date Range */}
            <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-4">
              <div>
                <Label htmlFor="start-date">
                  Start date <span className="text-destructive">*</span>
                </Label>
                <div className="mt-1">
                  <DatePickerInput
                    value={startDate}
                    onChange={setStartDate}
                    placeholder="Select start date"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="end-date">End date (optional)</Label>
                <div className="mt-1">
                  <DatePickerInput
                    value={endDate}
                    onChange={setEndDate}
                    placeholder="Select end date"
                    allowClear
                  />
                </div>
              </div>
            </div>

            {/* Shifts List */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
                  <p className="text-muted-foreground">Loading shifts...</p>
                </div>
              </div>
            ) : shifts.length > 0 ? (
              <div className="space-y-2">
                <Label>
                  Shifts <span className="text-destructive">*</span>
                </Label>
                {shifts.some(
                  s => s.status === 'conflict_teaching' || s.status === 'conflict_sub'
                ) && (
                  <div
                    className="rounded-lg border-2 p-4 space-y-2"
                    style={{
                      backgroundColor: 'rgb(255, 251, 235)', // amber-50
                      borderColor: 'rgb(251, 191, 36)', // amber-400
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="assign-as-floater"
                        checked={assignAsFloater}
                        onCheckedChange={value => setAssignAsFloater(value === true)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 space-y-1">
                        <label
                          htmlFor="assign-as-floater"
                          className="text-sm font-medium cursor-pointer"
                        >
                          Assign as floater
                        </label>
                        <p className="text-sm text-muted-foreground">
                          Allows assigning this sub to multiple rooms in the same time slot (counts
                          as 0.5 each). Check this to enable conflict shifts below.
                        </p>
                        {assignAsFloater && (
                          <p className="text-sm font-medium text-primary">
                            Sub will cover multiple rooms as floater (0.5 each).
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <div className="space-y-2 border rounded-lg p-4 bg-white">
                  {shiftGroups.map(({ slotKey, shifts: groupShifts }) => {
                    const isFloaterSlot = groupShifts.length > 1
                    const first = groupShifts[0]
                    const allSelected = groupShifts.every(s => selectedShiftIds.has(s.id))
                    const anyDisabled =
                      groupShifts.some(s => s.school_closure) ||
                      (!assignAsFloater &&
                        groupShifts.some(
                          s => s.status === 'conflict_teaching' || s.status === 'conflict_sub'
                        ))
                    const isAssignable = !anyDisabled
                    const hasSchoolClosure = groupShifts.some(s => s.school_closure)
                    const hasSoftWarning = groupShifts.some(s => s.status === 'unavailable')
                    const checkboxId = `shift-${slotKey}`
                    const floaterClassrooms = isFloaterSlot
                      ? groupShifts
                          .map(s => s.classroom_name || 'Unknown classroom')
                          .filter(Boolean)
                      : []
                    const labelText = isFloaterSlot
                      ? `${formatDate(first.date)} • ${first.time_slot_code ?? ''} • ${floaterClassrooms.join(', ')}`
                      : formatShiftLabel(first)
                    const floaterNote =
                      isFloaterSlot && floaterClassrooms.length > 0
                        ? floaterClassrooms.join(' and ')
                        : ''
                    return (
                      <div
                        key={slotKey}
                        className={cn(
                          '-mx-4 flex items-start gap-3 border-b last:border-b-0 px-4 py-2',
                          !isAssignable && '-mt-3 bg-slate-50 pt-5 pb-2 first:mt-0'
                        )}
                      >
                        <Checkbox
                          id={checkboxId}
                          checked={allSelected}
                          onCheckedChange={() =>
                            isFloaterSlot
                              ? handleShiftGroupToggle(groupShifts)
                              : handleShiftToggle(first.id)
                          }
                          disabled={anyDisabled}
                          className="mt-1"
                        />
                        <div className="flex-1 space-y-1">
                          <label
                            htmlFor={checkboxId}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {labelText}
                          </label>
                          {/* Role/context: Floater chip + note */}
                          {isFloaterSlot && (
                            <div className="flex flex-wrap items-center gap-2">
                              {isFloaterSlot && (
                                <Badge
                                  variant="outline"
                                  className="text-xs border-dashed"
                                  style={
                                    {
                                      backgroundColor: 'rgb(243, 232, 255)', // purple-100
                                      borderWidth: '1px',
                                      borderStyle: 'dashed',
                                      borderColor: 'rgb(216, 180, 254)', // purple-300
                                      color: 'rgb(107, 33, 168)', // purple-800
                                    } as React.CSSProperties
                                  }
                                >
                                  Floater
                                </Badge>
                              )}
                              {isFloaterSlot && floaterNote && (
                                <span className="text-xs text-muted-foreground">
                                  Teacher works in {floaterNote} during this shift. Sub will be
                                  assigned to both.
                                </span>
                              )}
                            </div>
                          )}
                          {/* Blocking status: only when not assignable (school closed or conflict) */}
                          {!isAssignable && (
                            <div className="flex flex-wrap gap-2">
                              {hasSchoolClosure && (
                                <Badge
                                  variant="outline"
                                  className="text-xs"
                                  style={
                                    {
                                      backgroundColor: 'rgb(241, 245, 249)', // slate-100
                                      borderWidth: '1px',
                                      borderStyle: 'solid',
                                      borderColor: 'rgb(203, 213, 225)', // slate-300
                                      color: 'rgb(71, 85, 105)', // slate-600
                                    } as React.CSSProperties
                                  }
                                >
                                  School closed
                                </Badge>
                              )}
                              {groupShifts.some(s => s.status === 'conflict_teaching') && (
                                <Badge
                                  variant="outline"
                                  className="text-xs"
                                  style={
                                    {
                                      backgroundColor: 'rgb(254, 242, 242)', // red-50
                                      borderWidth: '1px',
                                      borderStyle: 'solid',
                                      borderColor: 'rgb(252, 165, 165)', // red-300
                                      color: 'rgb(153, 27, 27)', // red-800
                                    } as React.CSSProperties
                                  }
                                >
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Conflict: Assigned to{' '}
                                  {groupShifts.find(s => s.status === 'conflict_teaching')
                                    ?.conflict_teaching_classroom_name ??
                                    groupShifts.find(s => s.status === 'conflict_teaching')
                                      ?.classroom_name ??
                                    'classroom'}
                                </Badge>
                              )}
                              {groupShifts.some(s => s.status === 'conflict_sub') && (
                                <Badge
                                  variant="outline"
                                  className="text-xs"
                                  style={
                                    {
                                      backgroundColor: 'rgb(254, 242, 242)', // red-50
                                      borderWidth: '1px',
                                      borderStyle: 'solid',
                                      borderColor: 'rgb(252, 165, 165)', // red-300
                                      color: 'rgb(153, 27, 27)', // red-800
                                    } as React.CSSProperties
                                  }
                                >
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Conflict:{' '}
                                  {groupShifts.find(s => s.status === 'conflict_sub')
                                    ?.conflict_message || 'Assigned to sub'}
                                </Badge>
                              )}
                            </div>
                          )}
                          {/* Floater override note: when user checked "Assign as floater" and this group has conflict shifts */}
                          {assignAsFloater &&
                            (groupShifts.some(s => s.status === 'conflict_teaching') ||
                              groupShifts.some(s => s.status === 'conflict_sub')) && (
                              <div className="flex flex-wrap gap-2 mt-1">
                                <Badge
                                  variant="outline"
                                  className="text-xs border-dashed"
                                  style={
                                    {
                                      backgroundColor: 'rgb(243, 232, 255)', // purple-100
                                      borderWidth: '1px',
                                      borderStyle: 'dashed',
                                      borderColor: 'rgb(216, 180, 254)', // purple-300
                                      color: 'rgb(107, 33, 168)', // purple-800
                                    } as React.CSSProperties
                                  }
                                >
                                  {groupShifts.some(s => s.status === 'conflict_teaching')
                                    ? `Sub assigned to ${groupShifts.find(s => s.status === 'conflict_teaching')?.conflict_teaching_classroom_name ?? groupShifts.find(s => s.status === 'conflict_teaching')?.classroom_name ?? 'classroom'}. Sub will be assigned as a floater.`
                                    : 'Sub has another assignment. Sub will be assigned as a floater.'}
                                </Badge>
                              </div>
                            )}
                          {/* Currently assigned + Change sub: when assignable and any shift has an assignment */}
                          {isAssignable &&
                            groupShifts.some(s => s.assigned_sub_name || s.assignment_id) && (
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-slate-600"
                                  style={{
                                    backgroundColor: 'rgb(241, 245, 249)',
                                    border: '1px solid rgb(226, 232, 240)',
                                  }}
                                >
                                  Currently:{' '}
                                  {groupShifts.find(s => s.assigned_sub_name)?.assigned_sub_name ??
                                    'Assigned'}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-teal-700 hover:bg-teal-50"
                                  onClick={() => setChangeSubShifts(groupShifts)}
                                >
                                  Change sub
                                </Button>
                              </div>
                            )}
                          {/* Informational: only when assignable */}
                          {isAssignable && (
                            <div className="flex flex-wrap gap-2">
                              {groupShifts.some(s => !s.has_time_off) && (
                                <span
                                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                                  style={
                                    {
                                      backgroundColor: 'rgb(248, 250, 252)', // slate-50
                                      borderWidth: '1px',
                                      borderStyle: 'solid',
                                      borderColor: 'rgb(226, 232, 240)', // slate-200
                                      color: 'rgb(71, 85, 105)', // slate-600
                                    } as React.CSSProperties
                                  }
                                >
                                  <Info className="h-3 w-3" />
                                  No absence recorded yet — a time off request will be created when
                                  you assign
                                </span>
                              )}
                              {groupShifts.some(s => s.status === 'unavailable') && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge
                                        variant="outline"
                                        className="text-xs cursor-help"
                                        style={
                                          {
                                            backgroundColor: 'rgb(255, 251, 235)', // amber-50
                                            borderWidth: '1px',
                                            borderStyle: 'solid',
                                            borderColor: 'rgb(252, 211, 77)', // amber-300
                                            color: 'rgb(146, 64, 14)', // amber-800
                                          } as React.CSSProperties
                                        }
                                      >
                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                        Marked unavailable
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-sm">
                                        Sub is marked as unavailable for this day and time in
                                        Settings → Staff
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          )}
                          {/* Override hint: only when assignable and there is a soft warning */}
                          {isAssignable && hasSoftWarning && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="text-xs text-muted-foreground cursor-help">
                                    You can still assign this shift if needed.
                                  </p>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-sm">Manual override available</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : teacherId && startDate ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No scheduled shifts found for this teacher in the selected date range.</p>
              </div>
            ) : null}

            {/* Summary and Additional Details */}
            {selectedShiftIds.size > 0 && (
              <div className="space-y-4">
                {summaryStats.noTimeOffCount > 0 && (
                  <CreateTimeOffRequestCard
                    idPrefix="assign-sub-time-off"
                    noTimeOffCount={summaryStats.noTimeOffCount}
                    totalSelected={summaryStats.totalSelected}
                    reason={timeOffReason}
                    onReasonChange={setTimeOffReason}
                    notes={timeOffNotes}
                    onNotesChange={setTimeOffNotes}
                  />
                )}

                {summaryStats.conflictCount > 0 && (
                  <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/40 p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                      <p className="text-sm text-amber-800">
                        {summaryStats.conflictCount} selected shift
                        {summaryStats.conflictCount !== 1 ? 's' : ''} override
                        {summaryStats.conflictCount === 1 ? 's' : ''} the sub&apos;s availability or
                        existing assignment.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
                  <Label htmlFor="sub-notes">Notes for Sub (optional)</Label>
                  <Textarea
                    id="sub-notes"
                    value={subNotes}
                    onChange={e => setSubNotes(e.target.value)}
                    placeholder="Add any notes about contacting this sub..."
                    className="resize-none"
                    rows={2}
                  />
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="space-y-3 pt-6 border-t mt-6">
              {!submitting &&
                (selectedShiftIds.size === 0 || !subId || !teacherId || !startDate) && (
                  <p className="text-sm text-amber-800">
                    Select{' '}
                    {(() => {
                      const items = [
                        !teacherId && 'a teacher',
                        !startDate && 'a start date',
                        selectedShiftIds.size === 0 && 'at least one shift',
                        !subId && 'a sub to assign',
                      ].filter(Boolean) as string[]
                      if (items.length === 0) return ''
                      if (items.length === 1) return items[0]
                      return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1]
                    })()}
                    .
                  </p>
                )}
              <div className="flex justify-end gap-4 pb-8">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleViewInSubFinder}
                  disabled={!teacherId || !startDate}
                  className="text-primary hover:text-primary hover:bg-primary/10"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View in Sub Finder
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleAssign}
                  disabled={submitting || selectedShiftIds.size === 0 || !subId}
                >
                  {submitting
                    ? 'Processing...'
                    : summaryStats.noTimeOffCount > 0
                      ? `Create Time Off & Assign Sub`
                      : `Assign ${selectedShiftIds.size} shift${selectedShiftIds.size !== 1 ? 's' : ''}`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>

      {/* Change sub dialog: pick new sub and confirm to unassign current + assign new */}
      <Dialog
        open={changeSubShifts !== null}
        onOpenChange={open => {
          if (!open) {
            setChangeSubShifts(null)
            setChangeSubNewSubId(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change sub</DialogTitle>
            <DialogDescription>
              Select the sub to assign to{' '}
              {changeSubShifts?.length === 1
                ? formatShiftLabel(changeSubShifts[0])
                : `${changeSubShifts?.length ?? 0} shifts`}
              . The current sub will be unassigned.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>New sub</Label>
            <Select
              value={changeSubNewSubId ?? ''}
              onValueChange={v => setChangeSubNewSubId(v || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select sub" />
              </SelectTrigger>
              <SelectContent>
                {subs
                  .filter(s => (s as Sub & { active?: boolean }).active !== false)
                  .map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {getDisplayName(s)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setChangeSubShifts(null)
                setChangeSubNewSubId(null)
              }}
              disabled={changeSubSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleChangeSubConfirm}
              disabled={!changeSubNewSubId || changeSubSubmitting}
            >
              {changeSubSubmitting ? 'Updating...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  )
}
