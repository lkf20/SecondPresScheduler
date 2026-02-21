'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, CornerDownRight, Pencil, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
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
import { Checkbox } from '@/components/ui/checkbox'
import DatePickerInput from '@/components/ui/date-picker-input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import TimeOffForm from '@/components/time-off/TimeOffForm'
import SlotStatusToggle from './SlotStatusToggle'
import ClassGroupMultiSelect from './ClassGroupMultiSelect'
import EnrollmentInput from './EnrollmentInput'
import TeacherMultiSelect from './TeacherMultiSelect'
import MultiDayApplySelector from './MultiDayApplySelector'
import UnsavedChangesDialog from './UnsavedChangesDialog'
import ConflictBanner, { type Conflict, type ConflictResolution } from './ConflictBanner'
import type { ScheduleCellWithDetails } from '@/lib/api/schedule-cells'
import type { WeeklyScheduleData } from '@/lib/api/weekly-schedule'
import { getClassroomPillStyle } from '@/lib/utils/classroom-style'
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
  staffingColorValues,
} from '@/lib/utils/colors'
import { useDisplayNameFormat } from '@/lib/hooks/use-display-name-format'
import { getStaffDisplayName } from '@/lib/utils/staff-display-name'
import { parseLocalDate } from '@/lib/utils/date'
import { toast } from 'sonner'

interface Teacher {
  id: string
  name: string
  teacher_id?: string
  is_floater?: boolean
}

type FlexRemovalScope = 'single_shift' | 'weekday' | 'all_shifts'

type FlexRemovalContext = {
  start_date: string
  end_date: string
  weekdays: string[]
  matching_shift_count: number
}

type ClassGroupWithMeta = ClassGroup & {
  is_active?: boolean | null
}

type SelectedCellData = WeeklyScheduleData & {
  absences?: Array<{
    teacher_id: string
    teacher_name: string
    has_sub: boolean
    is_partial: boolean
    time_off_request_id?: string | null
  }>
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
  classroomColor?: string | null
  selectedDayIds: string[] // Days that are in the weekly schedule
  selectedCellData?: SelectedCellData // Full cell data from the grid
  onSave?: () => void | Promise<void>
  weekStartISO?: string
  readOnly?: boolean
}

export const mapAssignmentsToTeachers = (
  assignments?: WeeklyScheduleData['assignments']
): Teacher[] => {
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

export const formatFlexWeekdayList = (days: string[]) => {
  if (days.length === 0) return ''
  const pluralized = days.map(day => (day.endsWith('s') ? day : `${day}s`))
  if (pluralized.length === 1) return pluralized[0]
  if (pluralized.length === 2) return `${pluralized[0]} and ${pluralized[1]}`
  return `${pluralized.slice(0, -1).join(', ')}, and ${pluralized[pluralized.length - 1]}`
}

export const buildFlexRemovalDialogCopy = ({
  teacherName,
  classroomName,
  dayName,
  context,
}: {
  teacherName: string
  classroomName: string
  dayName: string
  context: FlexRemovalContext | null
}) => {
  const isSingleShift = (context?.matching_shift_count || 0) <= 1
  const weekdayText = formatFlexWeekdayList(context?.weekdays || [])
  const singleWeekday = context?.weekdays?.[0] || ''
  const startLabel = context?.start_date
    ? parseLocalDate(context.start_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : 'selected start date'
  const endLabel = context?.end_date
    ? parseLocalDate(context.end_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : 'selected end date'

  let summary = `${teacherName} is assigned as flex staff to ${classroomName}.`
  if (isSingleShift && startLabel === endLabel && singleWeekday) {
    summary = `${teacherName} is assigned as flex staff to ${classroomName} on ${singleWeekday}, ${startLabel}.`
  } else if (weekdayText) {
    summary = `${teacherName} is assigned as flex staff to ${classroomName} on ${weekdayText} from ${startLabel} to ${endLabel}.`
  }

  return {
    summary,
    isSingleShift,
    showPrompt: !isSingleShift,
    showWeekdayOption: !isSingleShift && (context?.weekdays?.length || 0) > 1,
    weekdayScopeLabel: `All ${dayName} shifts`,
  }
}

export const calculateScheduledStaffCount = ({
  readOnly,
  assignments,
  selectedTeacherCount,
}: {
  readOnly: boolean
  assignments?: WeeklyScheduleData['assignments']
  selectedTeacherCount: number
}) => {
  if (!readOnly) {
    return selectedTeacherCount
  }

  const uniqueAssignmentKeys = new Set<string>()
  ;(assignments || []).forEach(assignment => {
    const key = assignment.id
      ? `${assignment.id}`
      : `${assignment.teacher_id}|${assignment.is_substitute ? 'sub' : 'staff'}|${
          assignment.classroom_id
        }`
    uniqueAssignmentKeys.add(key)
  })
  return uniqueAssignmentKeys.size
}

export const buildStaffingSummary = ({
  requiredTeachers,
  preferredTeachers,
  scheduledStaffCount,
}: {
  requiredTeachers?: number
  preferredTeachers?: number
  scheduledStaffCount: number
}) => {
  const required = requiredTeachers ?? null
  const preferred = preferredTeachers ?? null
  const scheduled = scheduledStaffCount

  if (required !== null && scheduled < required) {
    return {
      status: 'below_required' as const,
      label: `Below Required by ${required - scheduled}`,
    }
  }

  if (preferred !== null && scheduled < preferred) {
    return {
      status: 'below_preferred' as const,
      label: `Below Preferred by ${preferred - scheduled}`,
    }
  }

  if (required !== null || preferred !== null) {
    return {
      status: 'adequate' as const,
      label: 'On Target',
    }
  }

  return {
    status: null,
    label: 'No staffing target',
  }
}

const compareByTeacherName = (a: { teacher_name: string }, b: { teacher_name: string }) =>
  (a.teacher_name || 'Unknown').localeCompare(b.teacher_name || 'Unknown')

export const sortAbsencesByTeacherName = (
  absences: NonNullable<SelectedCellData['absences']> = []
) => [...absences].sort(compareByTeacherName)

export const sortAssignmentsForPanel = (assignments: WeeklyScheduleData['assignments'] = []) => {
  const permanentAssignments = assignments
    .filter(
      assignment => !assignment.is_substitute && !assignment.is_flexible && !assignment.is_floater
    )
    .sort(compareByTeacherName)

  const flexAssignments = assignments
    .filter(
      assignment => !assignment.is_substitute && assignment.is_flexible && !assignment.is_floater
    )
    .sort(compareByTeacherName)

  const floaterAssignments = assignments
    .filter(assignment => !assignment.is_substitute && assignment.is_floater)
    .sort(compareByTeacherName)

  return {
    permanentAssignments,
    flexAssignments,
    floaterAssignments,
  }
}

export const buildFindSubLink = ({
  absences,
  assignments,
}: {
  absences?: SelectedCellData['absences']
  assignments?: WeeklyScheduleData['assignments']
}) => {
  const absenceForCell =
    absences?.find(
      (absence: {
        teacher_id: string
        teacher_name: string
        has_sub: boolean
        is_partial: boolean
        time_off_request_id?: string | null
      }) => absence.time_off_request_id
    ) ?? null

  const primaryTeacher =
    assignments?.find(assignment => !assignment.is_substitute && !assignment.is_flexible) ?? null

  if (absenceForCell?.time_off_request_id) {
    return `/sub-finder?absence_id=${absenceForCell.time_off_request_id}`
  }
  if (primaryTeacher?.teacher_id) {
    return `/sub-finder?teacher_id=${primaryTeacher.teacher_id}`
  }
  return '/sub-finder'
}

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
  classroomColor = null,
  selectedDayIds,
  selectedCellData,
  onSave,
  weekStartISO,
  readOnly = false,
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
  const { format: displayNameFormat } = useDisplayNameFormat()
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
  const [classrooms, setClassrooms] = useState<ClassroomWithAllowedClasses[]>([])
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [conflictResolutions, setConflictResolutions] = useState<Map<string, ConflictResolution>>(
    new Map()
  )
  const router = useRouter()
  const [flexStartDate, setFlexStartDate] = useState<string>('')
  const [flexEndDate, setFlexEndDate] = useState<string>('')
  const [flexClassroomIds, setFlexClassroomIds] = useState<string[]>([classroomId])
  const [flexTimeSlotIds, setFlexTimeSlotIds] = useState<string[]>([timeSlotId])
  const [flexSaving, setFlexSaving] = useState(false)
  const [flexError, setFlexError] = useState<string | null>(null)
  const [panelMode, setPanelMode] = useState<'cell' | 'timeOff' | 'editCell' | 'flex'>('cell')
  const [timeOffTeacherId, setTimeOffTeacherId] = useState<string | null>(null)
  const [timeOffTeacherName, setTimeOffTeacherName] = useState<string | null>(null)
  const [showBaselineEditDialog, setShowBaselineEditDialog] = useState(false)
  const [showClassGroupEditDialog, setShowClassGroupEditDialog] = useState(false)
  const [showRemoveFlexDialog, setShowRemoveFlexDialog] = useState(false)
  const [flexRemoveTarget, setFlexRemoveTarget] = useState<
    WeeklyScheduleData['assignments'][number] | null
  >(null)
  const [flexRemoveContext, setFlexRemoveContext] = useState<FlexRemovalContext | null>(null)
  const [flexRemoveLoading, setFlexRemoveLoading] = useState(false)
  const [flexRemoveSubmitting, setFlexRemoveSubmitting] = useState(false)
  const [flexRemoveScope, setFlexRemoveScope] = useState<FlexRemovalScope>('single_shift')
  const [flexAvailability, setFlexAvailability] = useState<
    Array<{ id: string; name: string; availableShiftKeys: string[] }>
  >([])
  const [flexShiftMetrics, setFlexShiftMetrics] = useState<
    Array<{
      date: string
      time_slot_id: string
      time_slot_code: string
      classroom_id: string
      classroom_name: string
      required_staff: number | null
      preferred_staff: number | null
      scheduled_staff: number
      status: 'below_required' | 'below_preferred' | 'ok'
    }>
  >([])
  const [flexDayOptions, setFlexDayOptions] = useState<
    Array<{ id: string; name: string; short_name: string; day_number: number }>
  >([])
  const [flexAvailabilityLoading, setFlexAvailabilityLoading] = useState(false)
  const [flexAvailabilityError, setFlexAvailabilityError] = useState<string | null>(null)
  const [expandedFlexStaffId, setExpandedFlexStaffId] = useState<string | null>(null)
  const [flexAssignModes, setFlexAssignModes] = useState<Record<string, 'all' | 'custom'>>({})
  const [flexSelectedShiftKeys, setFlexSelectedShiftKeys] = useState<Record<string, string[]>>({})
  const [flexApplyThisDayOnly, setFlexApplyThisDayOnly] = useState(true)
  const [flexApplyMultipleDays, setFlexApplyMultipleDays] = useState(false)
  const [flexApplyDayNames, setFlexApplyDayNames] = useState<Set<string>>(
    new Set([dayName.toLowerCase()])
  )
  const [isStaffingTargetsExpanded, setIsStaffingTargetsExpanded] = useState(false)
  const [isFullyAvailableExpanded, setIsFullyAvailableExpanded] = useState(true)
  const [isPartiallyAvailableExpanded, setIsPartiallyAvailableExpanded] = useState(true)
  const [isNotAvailableExpanded, setIsNotAvailableExpanded] = useState(false)
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

  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear()
    const month = `${date.getMonth() + 1}`.padStart(2, '0')
    const day = `${date.getDate()}`.padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const addDays = (date: Date, days: number) => {
    const next = new Date(date.getTime())
    next.setDate(next.getDate() + days)
    return next
  }

  const openTimeOffPanel = (teacherId: string, teacherName?: string | null) => {
    setTimeOffTeacherId(teacherId)
    setTimeOffTeacherName(teacherName ?? null)
    setPanelMode('timeOff')
  }

  useEffect(() => {
    if (!isOpen) return
    setPanelMode('cell')
    setTimeOffTeacherId(null)
    setTimeOffTeacherName(null)
    setShowBaselineEditDialog(false)
    setShowClassGroupEditDialog(false)
    setExpandedFlexStaffId(null)
    setFlexAvailabilityError(null)
    setIsStaffingTargetsExpanded(false)
    setIsFullyAvailableExpanded(true)
    setIsPartiallyAvailableExpanded(true)
    setIsNotAvailableExpanded(false)
    setFlexApplyThisDayOnly(true)
    setFlexApplyMultipleDays(false)
    setFlexApplyDayNames(new Set([dayName.toLowerCase()]))
  }, [isOpen, classroomId, dayId, timeSlotId])

  useEffect(() => {
    if (panelMode !== 'flex') return
    setFlexEndDate(prev => prev || flexStartDate || '')
    setIsStaffingTargetsExpanded(false)
    setIsFullyAvailableExpanded(true)
    setIsPartiallyAvailableExpanded(true)
    setIsNotAvailableExpanded(false)
    setFlexApplyThisDayOnly(true)
    setFlexApplyMultipleDays(false)
    setFlexApplyDayNames(new Set([dayName.toLowerCase()]))
  }, [panelMode, flexStartDate, dayName])

  const dayNameDate = useMemo(() => {
    if (!weekStartISO) return ''
    const base = parseLocalDate(weekStartISO)
    const dayNumber = selectedCellData?.day_number
    const offset = dayNumber ? Math.max(0, dayNumber - 1) : 0
    const target = addDays(base, offset)
    const year = target.getFullYear()
    const month = `${target.getMonth() + 1}`.padStart(2, '0')
    const day = `${target.getDate()}`.padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [weekStartISO, selectedCellData?.day_number])

  const dayNameDateLabel = useMemo(() => {
    if (!dayNameDate) return ''
    const date = parseLocalDate(dayNameDate)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }, [dayNameDate])

  const flexShiftOptions = useMemo(() => {
    if (!flexStartDate || !flexEndDate || flexTimeSlotIds.length === 0) return []
    const start = parseLocalDate(flexStartDate)
    const end = parseLocalDate(flexEndDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return []
    const slotsById = new Map(timeSlots.map(slot => [slot.id, slot.code]))
    const shifts: Array<{ key: string; date: string; time_slot_id: string; label: string }> = []
    const dayNameDateParsed = dayNameDate ? parseLocalDate(dayNameDate) : null
    const cursor = new Date(start.getTime())
    while (cursor <= end) {
      const dateStr = formatLocalDate(cursor)
      const dayNameForDate = cursor.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
      const shouldIncludeDay =
        (flexApplyThisDayOnly &&
          !!dayNameDateParsed &&
          cursor.getDay() === dayNameDateParsed.getDay()) ||
        (flexApplyMultipleDays && flexApplyDayNames.has(dayNameForDate))
      if (shouldIncludeDay) {
        const dayLabel = cursor.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
        flexTimeSlotIds.forEach(timeSlotId => {
          const slotCode = slotsById.get(timeSlotId) || ''
          shifts.push({
            key: `${dateStr}|${timeSlotId}`,
            date: dateStr,
            time_slot_id: timeSlotId,
            label: `${dayLabel} • ${slotCode}`,
          })
        })
      }
      cursor.setDate(cursor.getDate() + 1)
    }
    return shifts
  }, [
    flexStartDate,
    flexEndDate,
    flexTimeSlotIds,
    timeSlots,
    flexApplyThisDayOnly,
    flexApplyMultipleDays,
    flexApplyDayNames,
    dayNameDate,
  ])

  const totalFlexShiftCount = useMemo(() => {
    return flexShiftOptions.length * Math.max(1, flexClassroomIds.length)
  }, [flexShiftOptions.length, flexClassroomIds.length])

  const missingSelectedFlexDays = useMemo(() => {
    if (!flexApplyMultipleDays || flexApplyDayNames.size === 0) return []
    if (!flexStartDate || !flexEndDate) return Array.from(flexApplyDayNames)
    const start = parseLocalDate(flexStartDate)
    const end = parseLocalDate(flexEndDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      return Array.from(flexApplyDayNames)
    }
    const availableDays = new Set<string>()
    const cursor = new Date(start.getTime())
    while (cursor <= end) {
      availableDays.add(cursor.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase())
      cursor.setDate(cursor.getDate() + 1)
    }
    return Array.from(flexApplyDayNames).filter(day => !availableDays.has(day))
  }, [flexApplyMultipleDays, flexApplyDayNames, flexStartDate, flexEndDate])

  const hasInvalidFlexDayRange = missingSelectedFlexDays.length > 0

  const flexRangeDayOptions = useMemo(() => {
    if (!flexStartDate || !flexEndDate) return []
    const start = parseLocalDate(flexStartDate)
    const end = parseLocalDate(flexEndDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return []

    const allowedDays =
      flexDayOptions.length > 0
        ? new Set(flexDayOptions.map(option => option.name.toLowerCase()))
        : null
    const dayNumberMap = new Map(
      flexDayOptions.map(option => [option.name.toLowerCase(), option.day_number])
    )
    const shortNameMap = new Map(
      flexDayOptions.map(option => [option.name.toLowerCase(), option.short_name])
    )
    const fallbackDayNumber: Record<string, number> = {
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
      sunday: 7,
    }

    const seen = new Set<string>()
    const options: Array<{ id: string; name: string; short_name: string; day_number: number }> = []
    const cursor = new Date(start.getTime())
    while (cursor <= end) {
      const fullName = cursor.toLocaleDateString('en-US', { weekday: 'long' })
      const key = fullName.toLowerCase()
      if ((!allowedDays || allowedDays.has(key)) && !seen.has(key)) {
        seen.add(key)
        options.push({
          id: key,
          name: fullName,
          short_name: shortNameMap.get(key) || fullName.slice(0, 3),
          day_number: dayNumberMap.get(key) ?? fallbackDayNumber[key] ?? 99,
        })
      }
      cursor.setDate(cursor.getDate() + 1)
    }

    return options.sort((a, b) => a.day_number - b.day_number)
  }, [flexStartDate, flexEndDate, flexDayOptions])

  const showFlexApplySection = flexRangeDayOptions.length > 1
  const maxFlexSelectableDayCount = flexDayOptions.length > 0 ? flexDayOptions.length : 5
  const showExpandDateRangeHint = flexRangeDayOptions.length < maxFlexSelectableDayCount

  const filteredFlexShiftMetrics = useMemo(() => {
    if (flexShiftMetrics.length === 0) return []
    const allowedKeys = new Set(flexShiftOptions.map(option => option.key))
    return flexShiftMetrics.filter(metric =>
      allowedKeys.has(`${metric.date}|${metric.time_slot_id}`)
    )
  }, [flexShiftMetrics, flexShiftOptions])

  const flexBelowRequiredCount = useMemo(
    () => filteredFlexShiftMetrics.filter(metric => metric.status === 'below_required').length,
    [filteredFlexShiftMetrics]
  )

  const flexBelowPreferredCount = useMemo(
    () => filteredFlexShiftMetrics.filter(metric => metric.status === 'below_preferred').length,
    [filteredFlexShiftMetrics]
  )

  const flexStaffWithCounts = useMemo(() => {
    const selectedShiftKeys = new Set(flexShiftOptions.map(option => option.key))
    const totalCount = flexShiftOptions.length
    return flexAvailability
      .map(staff => {
        const availableShiftKeys = staff.availableShiftKeys.filter(key =>
          selectedShiftKeys.has(key)
        )
        return {
          ...staff,
          availableShiftKeys,
          availableCount: availableShiftKeys.length,
          totalCount,
        }
      })
      .sort((a, b) => b.availableCount - a.availableCount)
  }, [flexAvailability, flexShiftOptions])

  useEffect(() => {
    if (flexRangeDayOptions.length === 0) return

    const validDayKeys = new Set(flexRangeDayOptions.map(option => option.name.toLowerCase()))

    setFlexApplyDayNames(prev => {
      const next = new Set(Array.from(prev).filter(day => validDayKeys.has(day)))
      if (next.size === 0) {
        next.add(flexRangeDayOptions[0].name.toLowerCase())
      }

      const sameSize = next.size === prev.size
      if (sameSize && Array.from(next).every(day => prev.has(day))) {
        return prev
      }
      return next
    })

    if (flexRangeDayOptions.length === 1) {
      setFlexApplyThisDayOnly(false)
      setFlexApplyMultipleDays(true)
    }
  }, [flexRangeDayOptions])

  useEffect(() => {
    if (!isOpen) return
    const baseDate = weekStartISO ? parseLocalDate(weekStartISO) : new Date()
    const startISO = formatLocalDate(baseDate)
    setFlexStartDate(startISO)
    setFlexEndDate(startISO)
    setFlexClassroomIds([classroomId])
    setFlexTimeSlotIds([timeSlotId])
  }, [isOpen, weekStartISO, classroomId, timeSlotId])

  useEffect(() => {
    if (!flexStartDate) return
    if (!flexEndDate) {
      setFlexEndDate(flexStartDate)
      return
    }
    const start = parseLocalDate(flexStartDate)
    const end = parseLocalDate(flexEndDate)
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end < start) {
      setFlexEndDate(flexStartDate)
    }
  }, [flexStartDate, flexEndDate])

  useEffect(() => {
    if (!isOpen || panelMode !== 'flex') return
    if (!flexStartDate || !flexEndDate || flexTimeSlotIds.length === 0) return
    let cancelled = false

    const loadFlexAvailability = async () => {
      try {
        setFlexAvailabilityLoading(true)
        setFlexAvailabilityError(null)
        const response = await fetch('/api/staffing-events/flex/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start_date: flexStartDate,
            end_date: flexEndDate,
            time_slot_ids: flexTimeSlotIds,
            classroom_ids: flexClassroomIds,
          }),
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to load flex availability.')
        }
        if (!cancelled) {
          setFlexAvailability(Array.isArray(data?.staff) ? data.staff : [])
          setFlexShiftMetrics(Array.isArray(data?.shift_metrics) ? data.shift_metrics : [])
          if (Array.isArray(data?.day_options)) {
            setFlexDayOptions(data.day_options)
            if (data.day_options.length > 0 && flexApplyDayNames.size === 0) {
              setFlexApplyDayNames(new Set([String(data.day_options[0].name || '').toLowerCase()]))
            }
          }
        }
      } catch (error) {
        if (!cancelled) {
          setFlexAvailability([])
          setFlexShiftMetrics([])
          setFlexAvailabilityError(
            error instanceof Error ? error.message : 'Failed to load flex availability.'
          )
        }
      } finally {
        if (!cancelled) {
          setFlexAvailabilityLoading(false)
        }
      }
    }

    loadFlexAvailability()
    return () => {
      cancelled = true
    }
  }, [isOpen, panelMode, flexStartDate, flexEndDate, flexTimeSlotIds, flexClassroomIds])

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
        setClassrooms(Array.isArray(data) ? data : [])
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
            getStaffDisplayName(
              {
                first_name: schedule.teacher?.first_name || '',
                last_name: schedule.teacher?.last_name || '',
                display_name: schedule.teacher?.display_name ?? null,
              },
              displayNameFormat
            ) || 'Unknown',
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
  }, [isOpen, classroomId, dayId, timeSlotId, classGroupIds, isLoadingTeachers, displayNameFormat])

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

  const handleCreateFlexAssignment = async (staffId: string, shiftKeys: string[]) => {
    setFlexError(null)
    if (!staffId) {
      setFlexError('Select a flex staff member.')
      return
    }
    if (!flexStartDate || !flexEndDate) {
      setFlexError('Select a start and end date.')
      return
    }
    if (flexClassroomIds.length === 0) {
      setFlexError('Select at least one classroom.')
      return
    }
    if (flexTimeSlotIds.length === 0) {
      setFlexError('Select at least one time slot.')
      return
    }
    if (shiftKeys.length === 0) {
      setFlexError('Select at least one shift to assign.')
      return
    }
    setFlexSaving(true)
    try {
      const shifts = shiftKeys.flatMap(key => {
        const [date, timeSlotId] = key.split('|')
        return flexClassroomIds.map(classroomId => ({
          date,
          time_slot_id: timeSlotId,
          classroom_id: classroomId,
        }))
      })
      const response = await fetch('/api/staffing-events/flex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: staffId,
          start_date: flexStartDate,
          end_date: flexEndDate,
          classroom_ids: flexClassroomIds,
          time_slot_ids: flexTimeSlotIds,
          shifts,
        }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to add flex coverage.')
      }
      try {
        await onSave?.()
      } catch (refreshError) {
        console.error('Failed to refresh after flex assignment:', refreshError)
      }
      const assignedStaffName =
        flexAvailability.find(staff => staff.id === staffId)?.name || 'Staff member'
      const assignedClassroomNames = classrooms
        .filter(room => flexClassroomIds.includes(room.id))
        .map(room => room.name)
      const assignedClassroomLabel =
        assignedClassroomNames.length > 0
          ? assignedClassroomNames.join(', ')
          : classroomName || 'selected classroom'
      setExpandedFlexStaffId(null)
      setPanelMode('cell')
      toast.success(`${assignedStaffName} assigned as flex staff to ${assignedClassroomLabel}`)
    } catch (error) {
      setFlexError(error instanceof Error ? error.message : 'Failed to add flex coverage.')
    } finally {
      setFlexSaving(false)
    }
  }

  const handleCancelFlexAssignment = async (eventId?: string) => {
    if (!eventId) return
    try {
      const response = await fetch(`/api/staffing-events/${eventId}/cancel`, { method: 'POST' })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to remove flex coverage.')
      }
      try {
        await onSave?.()
      } catch (refreshError) {
        console.error('Failed to refresh after flex removal:', refreshError)
      }
    } catch (error) {
      setFlexError(error instanceof Error ? error.message : 'Failed to remove flex coverage.')
    }
  }

  const handleOpenRemoveFlexDialog = async (
    assignment: WeeklyScheduleData['assignments'][number]
  ) => {
    if (!assignment.staffing_event_id) {
      toast.error('Unable to remove this flex assignment. Missing event id.')
      return
    }

    setFlexRemoveTarget(assignment)
    setFlexRemoveScope('single_shift')
    setFlexRemoveContext(null)
    setShowRemoveFlexDialog(true)
    setFlexRemoveLoading(true)

    try {
      const params = new URLSearchParams({
        event_id: assignment.staffing_event_id,
        classroom_id: classroomId,
        time_slot_id: timeSlotId,
      })
      const response = await fetch(`/api/staffing-events/flex/remove?${params.toString()}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to load flex assignment details.')
      }
      const data = await response.json()
      setFlexRemoveContext({
        start_date: data?.start_date || '',
        end_date: data?.end_date || '',
        weekdays: Array.isArray(data?.weekdays) ? data.weekdays : [],
        matching_shift_count: Number(data?.matching_shift_count || 0),
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to load flex assignment details.'
      )
    } finally {
      setFlexRemoveLoading(false)
    }
  }

  const handleConfirmRemoveFlex = async () => {
    if (!flexRemoveTarget?.staffing_event_id) return
    setFlexRemoveSubmitting(true)
    setFlexError(null)

    try {
      const effectiveScope: FlexRemovalScope =
        flexRemoveContext && flexRemoveContext.matching_shift_count <= 1
          ? 'single_shift'
          : flexRemoveScope
      const response = await fetch('/api/staffing-events/flex/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: flexRemoveTarget.staffing_event_id,
          scope: effectiveScope,
          date: dayNameDate,
          day_of_week_id: dayId,
          classroom_id: classroomId,
          time_slot_id: timeSlotId,
        }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to remove flex assignment.')
      }

      try {
        await onSave?.()
      } catch (refreshError) {
        console.error('Failed to refresh after scoped flex removal:', refreshError)
      }

      const teacherName = flexRemoveTarget.teacher_name || 'Staff member'
      const scopeLabel =
        effectiveScope === 'single_shift'
          ? 'this shift'
          : effectiveScope === 'weekday'
            ? `all ${dayName} shifts`
            : 'all shifts'
      toast.success(`${teacherName} removed from ${scopeLabel}`)
      setShowRemoveFlexDialog(false)
      setFlexRemoveTarget(null)
      setFlexRemoveContext(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove flex assignment.'
      toast.error(message)
      setFlexError(message)
    } finally {
      setFlexRemoveSubmitting(false)
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
        class_group_ids: string[]
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
            class_group_ids: classGroupIds,
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

      const deletePromises: Promise<void>[] = []
      const createPromises: Promise<void>[] = []

      log(
        '[ScheduleSidePanel] Starting save - selectedTeachers:',
        selectedTeachers.map(t => ({
          name: t.name,
          teacher_id: t.teacher_id,
          is_floater: t.is_floater ?? false,
        }))
      )
      log('[ScheduleSidePanel] classGroupIds:', classGroupIds)
      if (classroomName === 'Toddler A Room' && dayName === 'Monday' && timeSlotCode === 'AC') {
        console.log('[ScheduleSidePanel][FloaterDebug][SaveInput]', {
          classroom: classroomName,
          day: dayName,
          time_slot: timeSlotCode,
          selected_teachers: selectedTeachers.map(t => ({
            name: t.name,
            teacher_id: t.teacher_id,
            is_floater: t.is_floater ?? false,
          })),
        })
      }

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
          log('[ScheduleSidePanel] Processing cell:', {
            updateDayId,
            updateTimeSlotId,
            currentSchedulesCount: currentSchedules.length,
          })

          const schedulesForThisSlot = currentSchedules

          {
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
                // Create new schedule for this teacher
                const payload = {
                  teacher_id: teacher.teacher_id,
                  day_of_week_id: updateDayId,
                  time_slot_id: updateTimeSlotId,
                  classroom_id: classroomId,
                  is_floater: teacher.is_floater ?? false,
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
                  if (
                    classroomName === 'Toddler A Room' &&
                    dayName === 'Monday' &&
                    timeSlotCode === 'AC'
                  ) {
                    console.log('[ScheduleSidePanel][FloaterDebug][UpdateRequest]', {
                      teacher_name: teacher.name,
                      teacher_id: teacher.teacher_id,
                      schedule_id: teacherScheduleForThisSlot.id,
                      before_is_floater: teacherScheduleForThisSlot.is_floater ?? false,
                      after_is_floater: teacher.is_floater ?? false,
                    })
                  }
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
                      const updatedSchedule = await updateResponse.json().catch(() => null)
                      if (!updatedSchedule?.id) {
                        throw new Error(
                          `Failed to update teacher schedule ${teacherScheduleForThisSlot.id}: empty response`
                        )
                      }
                      if (
                        classroomName === 'Toddler A Room' &&
                        dayName === 'Monday' &&
                        timeSlotCode === 'AC'
                      ) {
                        console.log('[ScheduleSidePanel][FloaterDebug][UpdateResponse]', {
                          teacher_name: teacher.name,
                          teacher_id: teacher.teacher_id,
                          schedule_id: teacherScheduleForThisSlot.id,
                          response_is_floater: updatedSchedule.is_floater ?? false,
                        })
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
        await Promise.resolve(onSave())
      }

      // When launched from the read-only weekly cell panel, return to that panel after baseline save.
      if (readOnly && panelMode === 'editCell') {
        // Preserve the just-saved teacher/floater state in the read-only cell view
        // so we don't momentarily fall back to stale assignment snapshot data.
        const cacheKey = `${classroomId}|${dayId}|${timeSlotId}`
        teacherCacheRef.current.set(cacheKey, selectedTeachers)
        teachersLoadedRef.current = true
        toast.success('Baseline schedule saved')
        setPanelMode('cell')
        return
      }

      // Wait a bit more for refresh to start, then close
      await new Promise(resolve => setTimeout(resolve, 200))
      toast.success('Schedule saved')
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

  const flexAssignments =
    selectedCellData?.assignments?.filter(assignment => assignment.is_flexible) ?? []
  const sortedAbsences = sortAbsencesByTeacherName(selectedCellData?.absences ?? [])
  const {
    permanentAssignments: sortedPermanentAssignments,
    flexAssignments: sortedFlexAssignments,
    floaterAssignments: sortedFloaterAssignments,
  } = sortAssignmentsForPanel(selectedCellData?.assignments ?? [])
  const findSubLink = buildFindSubLink({
    absences: selectedCellData?.absences,
    assignments: selectedCellData?.assignments,
  })

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

  const scheduledStaffCount = useMemo(() => {
    return calculateScheduledStaffCount({
      readOnly,
      assignments: selectedCellData?.assignments,
      selectedTeacherCount: selectedTeachers.length,
    })
  }, [readOnly, selectedCellData?.assignments, selectedTeachers.length])

  const staffingSummary = useMemo(() => {
    return buildStaffingSummary({
      requiredTeachers,
      preferredTeachers,
      scheduledStaffCount,
    })
  }, [requiredTeachers, preferredTeachers, scheduledStaffCount])

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
                {classroomName} • {dayName} • {timeSlotCode}
                {dayNameDateLabel ? ` • ${dayNameDateLabel}` : ''} {timeRange && `(${timeRange})`}
              </SheetTitle>
              <SheetDescription>
                {readOnly
                  ? 'View schedule details and take quick actions'
                  : 'Configure schedule cell settings and assignments'}
              </SheetDescription>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                {staffingSummary.status && (
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold"
                    style={
                      staffingSummary.status === 'below_required'
                        ? {
                            backgroundColor: staffingColorValues.below_required.bg,
                            borderStyle: 'solid',
                            borderWidth: '1px',
                            borderColor: staffingColorValues.below_required.border,
                            color: staffingColorValues.below_required.text,
                          }
                        : staffingSummary.status === 'below_preferred'
                          ? {
                              backgroundColor: staffingColorValues.below_preferred.bg,
                              borderStyle: 'solid',
                              borderWidth: '1px',
                              borderColor: staffingColorValues.below_preferred.border,
                              color: staffingColorValues.below_preferred.text,
                            }
                          : {
                              backgroundColor: 'rgb(220, 252, 231)', // green-100
                              borderStyle: 'solid',
                              borderWidth: '1px',
                              borderColor: 'rgb(34, 197, 94)', // green-500
                              color: 'rgb(22, 101, 52)', // green-800
                            }
                    }
                  >
                    {staffingSummary.label}
                  </span>
                )}
                {!staffingSummary.status && (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-semibold text-slate-600">
                    {staffingSummary.label}
                  </span>
                )}
                <span className="text-slate-600">
                  Required: {requiredTeachers ?? '—'} • Preferred: {preferredTeachers ?? '—'} •
                  Scheduled: {scheduledStaffCount}
                </span>
              </div>
            </SheetHeader>
          </div>

          <div className="px-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">Loading...</div>
              </div>
            ) : (
              <div className="mt-6 space-y-10">
                {panelMode === 'timeOff' && (
                  <div className="space-y-6 pb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Time Off Request
                        </p>
                        <h2 className="text-xl font-semibold text-slate-900">
                          {timeOffTeacherName || 'Add Time Off'}
                        </h2>
                      </div>
                      <Button type="button" variant="outline" onClick={() => setPanelMode('cell')}>
                        Back
                      </Button>
                    </div>
                    <TimeOffForm
                      key={timeOffTeacherId || 'time-off'}
                      onCancel={() => setPanelMode('cell')}
                      onSuccess={() => {
                        setPanelMode('cell')
                        onSave?.()
                      }}
                      hidePageHeader
                      initialTeacherId={timeOffTeacherId || undefined}
                      initialStartDate={dayNameDate}
                      initialEndDate={dayNameDate}
                      initialSelectedShifts={[
                        {
                          date: dayNameDate,
                          day_of_week_id: dayId,
                          time_slot_id: timeSlotId,
                        },
                      ]}
                    />
                  </div>
                )}
                {panelMode === 'flex' && (
                  <div className="space-y-6 pb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Flex Coverage
                        </p>
                        <h2 className="text-xl font-semibold text-slate-900">Add Flex Staff</h2>
                      </div>
                      <Button type="button" variant="outline" onClick={() => setPanelMode('cell')}>
                        Back
                      </Button>
                    </div>

                    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="flex_start_date">
                            Start date <span className="text-amber-600">*</span>
                          </Label>
                          <DatePickerInput
                            id="flex_start_date"
                            value={flexStartDate}
                            onChange={setFlexStartDate}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="flex_end_date">
                            End date <span className="text-amber-600">*</span>
                          </Label>
                          <DatePickerInput
                            id="flex_end_date"
                            value={flexEndDate}
                            onChange={setFlexEndDate}
                            closeOnSelect
                            openToDate={flexStartDate}
                            className={
                              hasInvalidFlexDayRange
                                ? '!border-amber-300 focus-visible:!ring-amber-200'
                                : undefined
                            }
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {classrooms.filter(room => flexClassroomIds.includes(room.id)).length >
                        0 ? (
                          classrooms
                            .filter(room => flexClassroomIds.includes(room.id))
                            .map(room => (
                              <span
                                key={room.id}
                                className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                                style={getClassroomPillStyle(room.color ?? null)}
                              >
                                {room.name}
                              </span>
                            ))
                        ) : (
                          <span
                            className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                            style={getClassroomPillStyle(classroomColor)}
                          >
                            {classroomName || 'Selected classroom'}
                          </span>
                        )}
                        {timeSlots
                          .filter(slot => flexTimeSlotIds.includes(slot.id))
                          .map(slot => (
                            <span
                              key={slot.id}
                              className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                            >
                              {slot.code}
                            </span>
                          ))}
                      </div>

                      {showFlexApplySection && (
                        <div className="space-y-3">
                          <Label>Apply to</Label>
                          <RadioGroup
                            value={flexApplyMultipleDays ? 'multiple' : 'single'}
                            onValueChange={value => {
                              if (value === 'multiple') {
                                setFlexApplyMultipleDays(true)
                                setFlexApplyThisDayOnly(false)
                                const firstRangeDay = flexRangeDayOptions[0]?.name.toLowerCase()
                                setFlexApplyDayNames(
                                  firstRangeDay ? new Set([firstRangeDay]) : new Set()
                                )
                              } else {
                                setFlexApplyThisDayOnly(true)
                                setFlexApplyMultipleDays(false)
                                setFlexApplyDayNames(new Set([dayName.toLowerCase()]))
                              }
                            }}
                            className="gap-2"
                          >
                            <label className="flex items-center gap-2 text-sm">
                              <RadioGroupItem value="single" id="flex-apply-single" />
                              {dayName.endsWith('s') ? `${dayName} only` : `${dayName}s only`}
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <RadioGroupItem value="multiple" id="flex-apply-multiple" />
                              Multiple days of the week
                            </label>
                          </RadioGroup>

                          {flexApplyMultipleDays && (
                            <>
                              <div className="mt-2 ml-6 flex flex-wrap gap-3 text-sm">
                                {flexRangeDayOptions.map(option => {
                                  const label = option.name
                                  const shortLabel = option.short_name || option.name.slice(0, 3)
                                  const key = label.toLowerCase()
                                  return (
                                    <label key={label} className="flex items-center gap-2">
                                      <Checkbox
                                        checked={flexApplyDayNames.has(key)}
                                        onCheckedChange={checked => {
                                          setFlexApplyDayNames(prev => {
                                            const next = new Set(prev)
                                            if (checked) {
                                              next.add(key)
                                            } else {
                                              next.delete(key)
                                            }
                                            return next
                                          })
                                        }}
                                      />
                                      {shortLabel}
                                    </label>
                                  )
                                })}
                              </div>
                              {showExpandDateRangeHint && (
                                <p className="ml-6 text-xs text-slate-500">
                                  To apply to more days, please select a later End date.
                                </p>
                              )}
                              {hasInvalidFlexDayRange && (
                                <p className="ml-6 text-xs text-amber-700">
                                  Multiple days selected. Please choose a date range that contains
                                  these days.
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-1">
                      <p className="text-sm font-medium text-slate-900">
                        {totalFlexShiftCount} {totalFlexShiftCount === 1 ? 'shift' : 'shifts'}{' '}
                        selected
                      </p>
                      <p className="flex items-center gap-1.5 text-xs text-slate-500">
                        Below preferred:{' '}
                        {flexAvailabilityLoading
                          ? '—'
                          : `${flexBelowPreferredCount} ${
                              flexBelowPreferredCount === 1 ? 'shift' : 'shifts'
                            }`}
                        {!flexAvailabilityLoading && flexBelowPreferredCount > 0 && (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        )}
                      </p>
                      <p className="flex items-center gap-1.5 text-xs text-slate-500">
                        Below required:{' '}
                        {flexAvailabilityLoading
                          ? '—'
                          : `${flexBelowRequiredCount} ${
                              flexBelowRequiredCount === 1 ? 'shift' : 'shifts'
                            }`}
                        {!flexAvailabilityLoading && flexBelowRequiredCount > 0 && (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        )}
                      </p>
                      {flexAvailabilityLoading && (
                        <p className="text-xs text-slate-400">Loading staffing targets...</p>
                      )}
                      {filteredFlexShiftMetrics.length > 0 && (
                        <div className="pt-4">
                          <div className="rounded-md border border-slate-200 bg-white">
                            <button
                              type="button"
                              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left"
                              onClick={() => setIsStaffingTargetsExpanded(prev => !prev)}
                            >
                              <span className="text-xs uppercase tracking-wide text-slate-500">
                                Staffing targets
                              </span>
                              {isStaffingTargetsExpanded ? (
                                <ChevronUp className="h-4 w-4 text-slate-500" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-slate-500" />
                              )}
                            </button>
                            {isStaffingTargetsExpanded && (
                              <div className="border-t border-slate-100 p-2">
                                {filteredFlexShiftMetrics.map((metric, index) => (
                                  <div
                                    key={`${metric.date}-${metric.time_slot_id}-${metric.classroom_id}`}
                                    className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                                      index > 0 ? 'border-t border-slate-100' : ''
                                    }`}
                                  >
                                    <div>
                                      <p className="font-medium text-slate-900">
                                        {new Date(`${metric.date}T00:00:00`).toLocaleDateString(
                                          'en-US',
                                          { weekday: 'short', month: 'short', day: 'numeric' }
                                        )}{' '}
                                        • {metric.time_slot_code}
                                      </p>
                                      {metric.classroom_name && (
                                        <p className="text-xs text-slate-500">
                                          {metric.classroom_name}
                                        </p>
                                      )}
                                    </div>
                                    <div className="pt-1 text-right text-xs text-slate-500 space-y-2">
                                      {metric.status !== 'ok' && (
                                        <span
                                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
                                          style={{
                                            backgroundColor:
                                              metric.status === 'below_required'
                                                ? staffingColorValues.below_required.bg
                                                : staffingColorValues.below_preferred.bg,
                                            borderStyle: 'solid',
                                            borderWidth: '1px',
                                            borderColor:
                                              metric.status === 'below_required'
                                                ? staffingColorValues.below_required.border
                                                : staffingColorValues.below_preferred.border,
                                            color:
                                              metric.status === 'below_required'
                                                ? staffingColorValues.below_required.text
                                                : staffingColorValues.below_preferred.text,
                                          }}
                                        >
                                          {metric.status === 'below_required'
                                            ? `Below Required by ${Math.max(
                                                0,
                                                (metric.required_staff ?? 0) -
                                                  metric.scheduled_staff
                                              )}`
                                            : `Below Preferred by ${Math.max(
                                                0,
                                                (metric.preferred_staff ??
                                                  metric.required_staff ??
                                                  0) - metric.scheduled_staff
                                              )}`}
                                        </span>
                                      )}
                                      <p>
                                        Required: {metric.required_staff ?? '—'} • Preferred:{' '}
                                        {metric.preferred_staff ?? metric.required_staff ?? '—'} •
                                        Scheduled: {metric.scheduled_staff}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {flexAvailabilityError && (
                      <p className="text-sm text-destructive">{flexAvailabilityError}</p>
                    )}
                    {flexError && <p className="text-sm text-destructive">{flexError}</p>}

                    {flexAvailabilityLoading ? (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">Loading flex staff...</p>
                        {[1, 2, 3].map(i => (
                          <div
                            key={`flex-loading-${i}`}
                            className="rounded-lg border border-slate-200 bg-white p-4"
                          >
                            <div className="flex items-center justify-between">
                              <div className="space-y-2">
                                <div
                                  className="rounded animate-pulse"
                                  style={{
                                    backgroundColor: '#e5e7eb',
                                    height: '16px',
                                    width: '144px',
                                    display: 'block',
                                  }}
                                />
                                <div
                                  className="rounded animate-pulse"
                                  style={{
                                    backgroundColor: '#e5e7eb',
                                    height: '12px',
                                    width: '192px',
                                    display: 'block',
                                  }}
                                />
                              </div>
                              <div
                                className="rounded-md animate-pulse"
                                style={{
                                  backgroundColor: '#e5e7eb',
                                  height: '32px',
                                  width: '80px',
                                  display: 'block',
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : flexStaffWithCounts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No flex staff found.</p>
                    ) : (
                      <div className="space-y-6">
                        {[
                          {
                            key: 'fully',
                            title: 'Fully available',
                            items: flexStaffWithCounts.filter(
                              staff =>
                                staff.totalCount > 0 && staff.availableCount === staff.totalCount
                            ),
                          },
                          {
                            key: 'partial',
                            title: 'Partially available',
                            items: flexStaffWithCounts.filter(
                              staff =>
                                staff.availableCount > 0 && staff.availableCount < staff.totalCount
                            ),
                          },
                          {
                            key: 'not',
                            title: 'Not available',
                            items: flexStaffWithCounts.filter(staff => staff.availableCount === 0),
                          },
                        ].map(section =>
                          section.items.length > 0 ? (
                            <div key={section.title} className="space-y-3">
                              {section.key === 'fully' ||
                              section.key === 'partial' ||
                              section.key === 'not' ? (
                                <button
                                  type="button"
                                  className="flex w-full items-center justify-between text-left"
                                  onClick={() =>
                                    section.key === 'fully'
                                      ? setIsFullyAvailableExpanded(prev => !prev)
                                      : section.key === 'partial'
                                        ? setIsPartiallyAvailableExpanded(prev => !prev)
                                        : setIsNotAvailableExpanded(prev => !prev)
                                  }
                                >
                                  <span className="text-xs uppercase tracking-wide text-slate-400">
                                    {section.key === 'fully' || section.key === 'not'
                                      ? `${section.title} (${section.items.length})`
                                      : section.title}
                                  </span>
                                  {(
                                    section.key === 'fully'
                                      ? isFullyAvailableExpanded
                                      : section.key === 'partial'
                                        ? isPartiallyAvailableExpanded
                                        : isNotAvailableExpanded
                                  ) ? (
                                    <ChevronUp className="h-4 w-4 text-slate-500" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-slate-500" />
                                  )}
                                </button>
                              ) : (
                                <p className="text-xs uppercase tracking-wide text-slate-400">
                                  {section.title}
                                </p>
                              )}
                              <div
                                className={`space-y-3 ${
                                  section.key === 'fully' && !isFullyAvailableExpanded
                                    ? 'hidden'
                                    : ''
                                } ${
                                  section.key === 'partial' && !isPartiallyAvailableExpanded
                                    ? 'hidden'
                                    : ''
                                } ${
                                  section.key === 'not' && !isNotAvailableExpanded ? 'hidden' : ''
                                }`}
                              >
                                {section.items.map(staff => {
                                  const isExpanded = expandedFlexStaffId === staff.id
                                  const assignMode = flexAssignModes[staff.id] || 'all'
                                  const availableSet = new Set(staff.availableShiftKeys)
                                  const selectedKeys = flexSelectedShiftKeys[staff.id] || []
                                  return (
                                    <div
                                      key={staff.id}
                                      className="rounded-lg border border-slate-200 bg-white p-4"
                                    >
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <p className="text-sm font-medium text-slate-900">
                                            {staff.name}
                                          </p>
                                          <p className="text-xs text-slate-500">
                                            Available for {staff.availableCount}/{staff.totalCount}{' '}
                                            shifts
                                          </p>
                                        </div>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="border bg-white hover:bg-teal-50"
                                          style={{ borderColor: '#0f766e', color: '#0f766e' }}
                                          onClick={() => {
                                            setFlexError(null)
                                            setExpandedFlexStaffId(prev =>
                                              prev === staff.id ? null : staff.id
                                            )
                                            setFlexAssignModes(prev => ({
                                              ...prev,
                                              [staff.id]: prev[staff.id] || 'all',
                                            }))
                                            setFlexSelectedShiftKeys(prev => ({
                                              ...prev,
                                              [staff.id]:
                                                prev[staff.id] || staff.availableShiftKeys,
                                            }))
                                          }}
                                        >
                                          Assign
                                        </Button>
                                      </div>

                                      {isExpanded && (
                                        <div className="mt-4 space-y-3 rounded-md border border-slate-100 bg-slate-50 p-3">
                                          <p className="text-xs uppercase tracking-wide text-slate-400">
                                            Assign to
                                          </p>
                                          <div className="space-y-2">
                                            <label className="flex items-center gap-2 text-sm">
                                              <input
                                                type="radio"
                                                className="h-4 w-4"
                                                style={{ accentColor: '#0f766e' }}
                                                name={`assign-${staff.id}`}
                                                checked={assignMode === 'all'}
                                                onChange={() =>
                                                  setFlexAssignModes(prev => ({
                                                    ...prev,
                                                    [staff.id]: 'all',
                                                  }))
                                                }
                                              />
                                              All available shifts
                                            </label>
                                            <label className="flex items-center gap-2 text-sm">
                                              <input
                                                type="radio"
                                                className="h-4 w-4"
                                                style={{ accentColor: '#0f766e' }}
                                                name={`assign-${staff.id}`}
                                                checked={assignMode === 'custom'}
                                                onChange={() =>
                                                  setFlexAssignModes(prev => ({
                                                    ...prev,
                                                    [staff.id]: 'custom',
                                                  }))
                                                }
                                              />
                                              Select specific shifts
                                            </label>
                                          </div>

                                          {assignMode === 'custom' && (
                                            <div className="space-y-2">
                                              {flexShiftOptions.map(shift => {
                                                const disabled = !availableSet.has(shift.key)
                                                const checked = selectedKeys.includes(shift.key)
                                                return (
                                                  <label
                                                    key={shift.key}
                                                    className={`flex items-center gap-2 text-sm ${
                                                      disabled ? 'text-slate-300' : 'text-slate-700'
                                                    }`}
                                                  >
                                                    <Checkbox
                                                      checked={checked}
                                                      disabled={disabled}
                                                      onCheckedChange={value => {
                                                        setFlexSelectedShiftKeys(prev => {
                                                          const current = new Set(
                                                            prev[staff.id] || []
                                                          )
                                                          if (value) {
                                                            current.add(shift.key)
                                                          } else {
                                                            current.delete(shift.key)
                                                          }
                                                          return {
                                                            ...prev,
                                                            [staff.id]: Array.from(current),
                                                          }
                                                        })
                                                      }}
                                                    />
                                                    {shift.label}
                                                  </label>
                                                )
                                              })}
                                            </div>
                                          )}

                                          <div className="flex justify-end">
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="outline"
                                              className="border bg-white hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-0"
                                              style={{ borderColor: '#0f766e', color: '#0f766e' }}
                                              disabled={flexSaving || hasInvalidFlexDayRange}
                                              onClick={() => {
                                                const keys =
                                                  assignMode === 'all'
                                                    ? staff.availableShiftKeys
                                                    : selectedKeys
                                                handleCreateFlexAssignment(staff.id, keys)
                                              }}
                                            >
                                              {flexSaving ? 'Assigning...' : 'Assign'}
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          ) : null
                        )}
                      </div>
                    )}
                  </div>
                )}
                {panelMode === 'cell' && readOnly && (
                  <div className="space-y-6">
                    <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-900">Absences & Subs</h3>
                      </div>
                      {sortedAbsences.length > 0 ? (
                        <div className="space-y-4">
                          {sortedAbsences.map(
                            (absence: {
                              teacher_id: string
                              teacher_name: string
                              has_sub: boolean
                              is_partial: boolean
                              time_off_request_id?: string | null
                            }) => {
                              const subsForAbsence =
                                selectedCellData?.assignments?.filter(
                                  assignment =>
                                    assignment.is_substitute &&
                                    assignment.absent_teacher_id === absence.teacher_id
                                ) ?? []
                              return (
                                <div key={absence.teacher_id} className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-slate-900">
                                      {absence.teacher_name}
                                    </span>
                                    <div className="flex items-center gap-4">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => router.push('/time-off')}
                                      >
                                        Edit Time Off
                                      </Button>
                                      {!absence.has_sub && (
                                        <Button
                                          type="button"
                                          size="sm"
                                          onClick={() => router.push(findSubLink)}
                                        >
                                          Find Sub
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  {subsForAbsence.length > 0 && (
                                    <div className="space-y-2">
                                      {subsForAbsence.map(sub => (
                                        <div
                                          key={sub.id}
                                          className="flex items-center justify-between rounded-md border border-teal-100 bg-teal-50 px-3 py-2"
                                        >
                                          <div className="flex items-center gap-2">
                                            <CornerDownRight className="h-4 w-4 text-slate-400" />
                                            <span className="text-sm text-teal-700">
                                              {sub.teacher_name}
                                            </span>
                                          </div>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => router.push(findSubLink)}
                                          >
                                            Change Sub
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            }
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No absences for this slot.</p>
                      )}
                    </div>

                    <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-900">Permanent Staff</h3>
                      </div>
                      {sortedPermanentAssignments.length > 0 ? (
                        <div className="space-y-2">
                          {sortedPermanentAssignments.map(assignment => (
                            <div
                              key={assignment.id}
                              className="flex items-center justify-between rounded-md border border-blue-300 bg-blue-100 px-3 py-2"
                              style={{ borderColor: '#93c5fd' }}
                            >
                              <span className="text-sm font-semibold text-blue-800">
                                {assignment.teacher_name}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-8 gap-1.5 rounded-md border-0 bg-white px-3 font-medium text-teal-700 shadow-none hover:bg-teal-50 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-0"
                                style={{
                                  appearance: 'none',
                                  WebkitAppearance: 'none',
                                  border: '0',
                                  boxShadow: 'none',
                                }}
                                onClick={() =>
                                  openTimeOffPanel(
                                    assignment.teacher_id,
                                    assignment.teacher_name || 'Unknown'
                                  )
                                }
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Add Time Off
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No permanent staff assigned.
                        </p>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto px-0 text-sm text-slate-500 hover:text-slate-700"
                        onClick={() => setShowBaselineEditDialog(true)}
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Edit permanent staff
                      </Button>
                    </div>

                    <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-900">Flex Staff</h3>
                        <Button
                          type="button"
                          size="sm"
                          className="h-9 rounded-md px-3.5 shadow-sm hover:opacity-95 focus-visible:outline-none focus-visible:ring-0"
                          style={{ backgroundColor: '#14b8a6', color: '#ffffff' }}
                          onClick={() => setPanelMode('flex')}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Flex Staff
                        </Button>
                      </div>
                      {sortedFlexAssignments.length > 0 ? (
                        <div className="space-y-2">
                          {sortedFlexAssignments.map(assignment => (
                            <div
                              key={assignment.id}
                              className="flex items-center justify-between rounded-md border border-blue-500 border-dashed bg-blue-50 px-3 py-2"
                              style={{ borderColor: '#3b82f6' }}
                            >
                              <span className="text-sm font-semibold text-blue-800">
                                {assignment.teacher_name}
                              </span>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-8 px-2.5 text-red-600 hover:bg-red-50 hover:text-red-700"
                                  onClick={() => {
                                    void handleOpenRemoveFlexDialog(assignment)
                                  }}
                                >
                                  Remove
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-8 gap-1.5 rounded-md bg-white px-3 font-medium text-teal-700 hover:bg-teal-50 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-0"
                                  onClick={() =>
                                    openTimeOffPanel(
                                      assignment.teacher_id,
                                      assignment.teacher_name || 'Unknown'
                                    )
                                  }
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  Add Time Off
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No flex staff assigned.</p>
                      )}
                    </div>

                    <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-900">Floaters</h3>
                      </div>
                      {sortedFloaterAssignments.length > 0 ? (
                        <div className="space-y-2">
                          {sortedFloaterAssignments.map(assignment => (
                            <div
                              key={assignment.id}
                              className="flex items-center justify-between rounded-md border border-purple-300 border-dashed bg-purple-100 px-3 py-2"
                            >
                              <span className="text-sm font-semibold text-purple-800">
                                {assignment.teacher_name}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-8 gap-1.5 rounded-md bg-white px-3 font-medium text-teal-700 hover:bg-teal-50 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-0"
                                onClick={() =>
                                  openTimeOffPanel(
                                    assignment.teacher_id,
                                    assignment.teacher_name || 'Unknown'
                                  )
                                }
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Add Time Off
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No floaters assigned.</p>
                      )}
                    </div>

                    <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-900">
                          Class Groups & Enrollment
                        </h3>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground">Class groups:</span>
                          {classGroups.length > 0 ? (
                            classGroups.map(group => (
                              <span
                                key={group.id}
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700"
                              >
                                {group.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-muted-foreground">None</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Enrollment:</span>
                          <span className="font-medium text-slate-900">
                            {enrollmentForCalculation ?? '—'}
                          </span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto px-0 text-sm text-slate-500 hover:text-slate-700"
                        onClick={() => setShowClassGroupEditDialog(true)}
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Edit class groups & enrollment
                      </Button>
                    </div>
                  </div>
                )}
                {(panelMode === 'editCell' || !readOnly) && (
                  <>
                    {readOnly && panelMode === 'editCell' && (
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-5 py-4">
                        <div className="space-y-1">
                          <p className="text-xs uppercase tracking-wide text-slate-400">
                            Baseline Assignment
                          </p>
                          <h2 className="text-lg font-semibold text-slate-900">
                            Edit Permanent Staff
                          </h2>
                          <p className="text-xs text-slate-500">
                            Changes apply to all {dayName} {timeSlotCode} slots.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setPanelMode('cell')}
                        >
                          Back
                        </Button>
                      </div>
                    )}
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
                  </>
                )}
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
      <Dialog open={showBaselineEditDialog} onOpenChange={setShowBaselineEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit baseline assignment?</DialogTitle>
            <DialogDescription>
              Changes apply to all {dayName} {timeSlotCode} slots, not just{' '}
              {dayNameDateLabel || 'this date'}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBaselineEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowBaselineEditDialog(false)
                setPanelMode('editCell')
              }}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showClassGroupEditDialog} onOpenChange={setShowClassGroupEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit class groups & enrollment?</DialogTitle>
            <DialogDescription>
              Changes apply to all {dayName} {timeSlotCode} slots, not just{' '}
              {dayNameDateLabel || 'this date'}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClassGroupEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowClassGroupEditDialog(false)
                setPanelMode('editCell')
              }}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={showRemoveFlexDialog}
        onOpenChange={open => {
          setShowRemoveFlexDialog(open)
          if (!open) {
            setFlexRemoveTarget(null)
            setFlexRemoveContext(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove flex assignment?</DialogTitle>
            <DialogDescription className="space-y-3">
              <p className="text-base text-slate-700">
                {(() => {
                  return buildFlexRemovalDialogCopy({
                    teacherName: flexRemoveTarget?.teacher_name || 'this staff member',
                    classroomName,
                    dayName,
                    context: flexRemoveContext,
                  }).summary
                })()}
              </p>
              {buildFlexRemovalDialogCopy({
                teacherName: flexRemoveTarget?.teacher_name || 'this staff member',
                classroomName,
                dayName,
                context: flexRemoveContext,
              }).showPrompt && (
                <p>
                  {`Would you like to remove ${flexRemoveTarget?.teacher_name || 'this staff member'} from:`}
                </p>
              )}
            </DialogDescription>
          </DialogHeader>
          {flexRemoveLoading ? (
            <p className="text-sm text-muted-foreground">Loading assignment details...</p>
          ) : (
            <>
              {(() => {
                const removalCopy = buildFlexRemovalDialogCopy({
                  teacherName: flexRemoveTarget?.teacher_name || 'this staff member',
                  classroomName,
                  dayName,
                  context: flexRemoveContext,
                })

                if (removalCopy.isSingleShift) {
                  return null
                }

                return (
                  <RadioGroup
                    value={flexRemoveScope}
                    onValueChange={value => setFlexRemoveScope(value as FlexRemovalScope)}
                    className="gap-3"
                  >
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="single_shift" id="flex-remove-single" />
                      This shift only
                    </label>
                    {removalCopy.showWeekdayOption && (
                      <label className="flex items-center gap-2 text-sm">
                        <RadioGroupItem value="weekday" id="flex-remove-weekday" />
                        {removalCopy.weekdayScopeLabel}
                      </label>
                    )}
                    <label className="flex items-center gap-2 text-sm text-red-700">
                      <RadioGroupItem value="all_shifts" id="flex-remove-all" />
                      All shifts
                    </label>
                  </RadioGroup>
                )
              })()}
            </>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRemoveFlexDialog(false)
              }}
              disabled={flexRemoveSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void handleConfirmRemoveFlex()
              }}
              disabled={flexRemoveLoading || flexRemoveSubmitting || !flexRemoveTarget}
            >
              {flexRemoveSubmitting ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
