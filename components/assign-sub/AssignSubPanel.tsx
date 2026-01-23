'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
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
import { AlertTriangle, Info, X, ExternalLink } from 'lucide-react'
import { parseLocalDate } from '@/lib/utils/date'
import SearchableSelect, { type SearchableSelectOption } from '@/components/shared/SearchableSelect'
import DatePickerInput from '@/components/ui/date-picker-input'
import { getPanelBackgroundClasses } from '@/lib/utils/colors'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

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
  classroom_name?: string | null
  time_slot_code?: string
  day_name?: string
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
}

export default function AssignSubPanel({ isOpen, onClose }: AssignSubPanelProps) {
  const router = useRouter()
  const [teacherId, setTeacherId] = useState<string | null>(null)
  const [subId, setSubId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [selectedShiftIds, setSelectedShiftIds] = useState<Set<string>>(new Set())
  const [shifts, setShifts] = useState<Shift[]>([])
  const [coverageRequestId, setCoverageRequestId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [subs, setSubs] = useState<Sub[]>([])
  const [subQualifications, setSubQualifications] = useState<Qualification[]>([])
  const [teacherClasses, setTeacherClasses] = useState<string[]>([])
  const [createTimeOffForMissing, setCreateTimeOffForMissing] = useState(false)
  const isInitialMountRef = useRef(true)

  // Get display name helper
  const getDisplayName = (
    person:
      | { display_name?: string | null; first_name?: string | null; last_name?: string | null }
      | null
      | undefined,
    fallback = 'Unknown'
  ) => {
    if (!person) return fallback
    const name = (
      person.display_name || `${person.first_name ?? ''} ${person.last_name ?? ''}`
    ).trim()
    return name || fallback
  }

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
  }, [])

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
  }, [])

  // Fetch shifts when teacher and dates are selected
  useEffect(() => {
    if (!teacherId || !startDate || isInitialMountRef.current) {
      isInitialMountRef.current = false
      return
    }

    const fetchShifts = async () => {
      setLoading(true)
      try {
        const effectiveEndDate = endDate || startDate
        const response = await fetch('/api/coverage-requests/ensure-for-quick-assign', {
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
        setCoverageRequestId(data.coverage_request_id)

        // Fetch timeslots once for lookup
        const timeslotsResponse = await fetch('/api/timeslots').catch(() => null)

        const timeslots = timeslotsResponse?.ok ? await timeslotsResponse.json() : []

        const timeslotsMap = new Map(
          timeslots.map((t: { id: string; code: string }) => [t.id, t.code])
        )

        // Create a map of time slot code to display_order for sorting
        const timeSlotOrderMap = new Map<string, number>()
        timeslots.forEach((slot: { code?: string; display_order?: number }) => {
          if (slot.code) {
            timeSlotOrderMap.set(slot.code, slot.display_order ?? 999)
          }
        })

        // Fetch shift details with day/time slot names
        const shiftDetails = await Promise.all(
          data.coverage_request_shifts.map(
            async (shift: {
              id: string
              date: string
              day_of_week_id: string
              time_slot_id: string
              classroom_id?: string | null
              time_off_request_id?: string | null
            }) => {
              // Fetch classroom name if available
              let classroomName = null
              if (shift.classroom_id) {
                const classroomResponse = await fetch(
                  `/api/classrooms/${shift.classroom_id}`
                ).catch(() => null)
                if (classroomResponse?.ok) {
                  const classroomData = await classroomResponse.json()
                  classroomName = classroomData.name || null
                }
              }

              // Get day name from date
              const date = parseLocalDate(shift.date)
              const dayNames = [
                'Sunday',
                'Monday',
                'Tuesday',
                'Wednesday',
                'Thursday',
                'Friday',
                'Saturday',
              ]
              const dayName = dayNames[date.getDay()]

              return {
                ...shift,
                day_name: dayName,
                time_slot_code: timeslotsMap.get(shift.time_slot_id) || '',
                classroom_name: classroomName,
              }
            }
          )
        )

        // Sort shifts: earliest date first, then by time slot display_order from settings
        const sortedShifts = shiftDetails.sort((a, b) => {
          // First, sort by date (earliest first)
          const dateCompare = a.date.localeCompare(b.date)
          if (dateCompare !== 0) return dateCompare

          // Then, sort by time slot display_order
          const aOrder = timeSlotOrderMap.get(a.time_slot_code) ?? 999
          const bOrder = timeSlotOrderMap.get(b.time_slot_code) ?? 999
          return aOrder - bOrder
        })

        setShifts(sortedShifts)
        setSelectedShiftIds(new Set()) // Reset selections
      } catch (error) {
        console.error('Error fetching shifts:', error)
        toast.error('Failed to load shifts')
        setShifts([])
      } finally {
        setLoading(false)
      }
    }

    fetchShifts()
  }, [teacherId, startDate, endDate])

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

  // Check conflicts when sub and shifts are available
  useEffect(() => {
    if (!subId || !coverageRequestId || shifts.length === 0) return

    const checkConflicts = async () => {
      try {
        const response = await fetch('/api/sub-finder/check-conflicts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sub_id: subId,
            coverage_request_id: coverageRequestId,
            shift_ids: shifts.map(s => s.id),
          }),
        })

        if (!response.ok) {
          console.error('Failed to check conflicts')
          return
        }

        const conflictData: ConflictEntry[] = await response.json()
        // Update shifts with conflict status
        setShifts(prevShifts =>
          prevShifts.map(shift => {
            const conflict = conflictData.find(c => c.shift_id === shift.id)
            if (!conflict) return shift
            return {
              ...shift,
              status: conflict.status,
              conflict_message: conflict.message,
            }
          })
        )
      } catch (error) {
        console.error('Error checking conflicts:', error)
      }
    }

    checkConflicts()
  }, [subId, coverageRequestId, shifts.length])

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = parseLocalDate(dateString)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]
    const dayName = dayNames[date.getDay()]
    const month = monthNames[date.getMonth()]
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
  }, [teachers])

  // Sub options for SearchableSelect
  const subOptions: SearchableSelectOption[] = useMemo(() => {
    return subs.map(sub => ({
      id: sub.id,
      label: getDisplayName(sub),
    }))
  }, [subs])

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

  // Default shift selection: checked if has_time_off AND sub is available
  useEffect(() => {
    if (!subId || shifts.length === 0) {
      setSelectedShiftIds(new Set())
      return
    }

    // For now, default to selecting shifts with time off
    // TODO: Add availability check
    const defaultSelected = new Set<string>()
    shifts.forEach(shift => {
      if (shift.has_time_off) {
        defaultSelected.add(shift.id)
      }
    })
    setSelectedShiftIds(defaultSelected)
  }, [subId, shifts])

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const selectedShifts = shifts.filter(s => selectedShiftIds.has(s.id))
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

  // Handle shift toggle
  const handleShiftToggle = (shiftId: string) => {
    setSelectedShiftIds(prev => {
      const next = new Set(prev)
      if (next.has(shiftId)) {
        next.delete(shiftId)
      } else {
        next.add(shiftId)
      }
      return next
    })
  }

  // Handle assign
  const handleAssign = async () => {
    if (!coverageRequestId || !subId || selectedShiftIds.size === 0) {
      toast.error('Please select a teacher, sub, and at least one shift')
      return
    }

    setSubmitting(true)
    try {
      // First, create time off requests for shifts without time off if checkbox is checked
      const selectedShifts = shifts.filter(s => selectedShiftIds.has(s.id))
      const shiftsWithoutTimeOff = selectedShifts.filter(s => !s.has_time_off)

      if (createTimeOffForMissing && shiftsWithoutTimeOff.length > 0 && teacherId) {
        // Create time off request

        const timeOffResponse = await fetch('/api/time-off', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teacher_id: teacherId,
            start_date: shiftsWithoutTimeOff[0].date,
            end_date: shiftsWithoutTimeOff[shiftsWithoutTimeOff.length - 1].date,
            shift_selection_mode: 'select_shifts',
            reason: 'Other', // Generic reason for quick assign
            shifts: shiftsWithoutTimeOff.map(s => ({
              date: s.date,
              day_of_week_id: s.day_of_week_id,
              time_slot_id: s.time_slot_id,
            })),
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

        await timeOffResponse.json()
      }

      // Assign shifts
      const assignResponse = await fetch('/api/sub-finder/assign-shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coverage_request_id: coverageRequestId,
          sub_id: subId,
          selected_shift_ids: Array.from(selectedShiftIds),
        }),
      })

      if (!assignResponse.ok) {
        const errorData = await assignResponse.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to assign shifts')
      }

      const sub = subs.find(s => s.id === subId)
      const teacher = teachers.find(t => t.id === teacherId)
      const subName = getDisplayName(sub)
      const teacherName = getDisplayName(teacher)
      const shiftCount = selectedShiftIds.size

      toast.success(
        `Assigned ${subName} to ${shiftCount} shift${shiftCount !== 1 ? 's' : ''} for ${teacherName}${
          createTimeOffForMissing && shiftsWithoutTimeOff.length > 0
            ? `. Time off request created for ${shiftsWithoutTimeOff.length} shift${shiftsWithoutTimeOff.length !== 1 ? 's' : ''}.`
            : ''
        }`
      )

      // Close panel and refresh
      // Server-side revalidation will update all pages
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

  // Reset form when panel closes
  useEffect(() => {
    if (!isOpen) {
      setTeacherId(null)
      setSubId(null)
      setStartDate('')
      setEndDate('')
      setSelectedShiftIds(new Set())
      setShifts([])
      setCoverageRequestId(null)
      setCreateTimeOffForMissing(false)
      isInitialMountRef.current = true
    }
  }, [isOpen])

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
                <Label htmlFor="teacher-select">Teacher</Label>
                <SearchableSelect
                  options={teacherOptions}
                  value={teacherId}
                  onValueChange={setTeacherId}
                  placeholder="Search or select a teacher..."
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sub-select">Sub to assign</Label>
                <SearchableSelect
                  options={subOptions}
                  value={subId}
                  onValueChange={setSubId}
                  placeholder="Search or select a substitute..."
                  className="w-full"
                />
                {/* Qualifications Badges */}
                {selectedSub && relevantQualifications.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {relevantQualifications.map(qual => {
                      const qualName = qual.qualification?.name || 'Unknown'
                      return (
                        <Badge
                          key={qual.id}
                          variant="outline"
                          className="text-xs bg-slate-50 text-slate-600 border-slate-200"
                        >
                          Qualified for {qualName}
                        </Badge>
                      )
                    })}
                  </div>
                )}
                {selectedSub &&
                  relevantQualifications.length === 0 &&
                  subQualifications.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {subQualifications
                        .filter(qual => {
                          const qualName = qual.qualification?.name || ''
                          return !teacherClasses.some(className => {
                            const classNameLower = className.toLowerCase()
                            const qualNameLower = qualName.toLowerCase()
                            return (
                              qualNameLower.includes(classNameLower) ||
                              classNameLower.includes(qualNameLower)
                            )
                          })
                        })
                        .map(qual => {
                          const qualName = qual.qualification?.name || 'Unknown'
                          return (
                            <Badge
                              key={qual.id}
                              variant="outline"
                              className="text-xs bg-amber-50 text-amber-700 border-amber-200"
                            >
                              Not marked qualified for {qualName}
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
                <Label htmlFor="start-date">Start date</Label>
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
                <Label>Shifts</Label>
                <div className="space-y-2 border rounded-lg p-4 bg-white">
                  {shifts.map(shift => {
                    const isSelected = selectedShiftIds.has(shift.id)
                    return (
                      <div
                        key={shift.id}
                        className="flex items-start gap-3 py-2 border-b last:border-b-0"
                      >
                        <Checkbox
                          id={`shift-${shift.id}`}
                          checked={isSelected}
                          onCheckedChange={() => handleShiftToggle(shift.id)}
                          className="mt-1"
                        />
                        <div className="flex-1 space-y-1">
                          <label
                            htmlFor={`shift-${shift.id}`}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {formatShiftLabel(shift)}
                          </label>
                          {/* Status badges */}
                          <div className="flex flex-wrap gap-2">
                            {!shift.has_time_off && (
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
                                No absence recorded - this will be extra coverage
                              </span>
                            )}
                            {shift.status === 'unavailable' && (
                              <Badge
                                variant="outline"
                                className="text-xs"
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
                            )}
                            {shift.status === 'conflict_teaching' && (
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
                                Conflict: Assigned to {shift.classroom_name || 'classroom'}
                              </Badge>
                            )}
                            {shift.status === 'conflict_sub' && (
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
                                Conflict: {shift.conflict_message || 'Assigned to sub'}
                              </Badge>
                            )}
                          </div>
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

            {/* Summary Section */}
            {(summaryStats.noTimeOffCount > 0 || summaryStats.conflictCount > 0) && (
              <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/40 p-4">
                {summaryStats.noTimeOffCount > 0 && (
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-amber-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-amber-800">
                        {summaryStats.noTimeOffCount} of {summaryStats.totalSelected} selected
                        shifts {summaryStats.noTimeOffCount === 1 ? 'does' : 'do'} not have a time
                        off request for this teacher.
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <Checkbox
                          id="create-time-off"
                          checked={createTimeOffForMissing}
                          onCheckedChange={checked => setCreateTimeOffForMissing(checked === true)}
                        />
                        <Label
                          htmlFor="create-time-off"
                          className="text-sm font-normal cursor-pointer text-amber-800"
                        >
                          {summaryStats.noTimeOffCount === 1
                            ? 'Create a time off request for this 1 shift.'
                            : `Create a time off request for these ${summaryStats.noTimeOffCount} shifts.`}
                        </Label>
                      </div>
                    </div>
                  </div>
                )}
                {summaryStats.conflictCount > 0 && (
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                    <p className="text-sm text-amber-800">
                      {summaryStats.conflictCount} selected shift
                      {summaryStats.conflictCount !== 1 ? 's' : ''} override
                      {summaryStats.conflictCount === 1 ? 's' : ''} the sub&apos;s availability or
                      existing assignment.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex justify-end gap-4 pt-6 pb-8 border-t mt-6">
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
                disabled={submitting || selectedShiftIds.size === 0 || !coverageRequestId || !subId}
              >
                {submitting
                  ? 'Assigning...'
                  : `Assign ${selectedShiftIds.size} shift${selectedShiftIds.size !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
