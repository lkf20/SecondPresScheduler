'use client'

import { useState, useEffect, useRef, useCallback, useMemo, startTransition } from 'react'
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  Pencil,
  Plus,
  UserSearch,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import TimeOffForm from '@/components/time-off/TimeOffForm'
import SlotStatusToggle from './SlotStatusToggle'
import ClassSelector from '@/components/settings/ClassSelector'
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
import { StaffingStatusBadge } from '@/components/ui/staffing-status-badge'
import { useDisplayNameFormat } from '@/lib/hooks/use-display-name-format'
import { cn } from '@/lib/utils'
import { getStaffDisplayName } from '@/lib/utils/staff-display-name'
import { parseLocalDate } from '@/lib/utils/date'
import { getStaffingWeeksLabel } from '@/lib/dashboard/staffing-boundary'
import {
  getSlotInactiveReasons,
  isSlotEffectivelyInactive,
} from '@/lib/utils/schedule-slot-activity'
import { BREAK_COVERAGE_ENABLED } from '@/lib/feature-flags'
import { clearDataHealthCache } from '@/lib/dashboard/data-health-cache'
import { toast } from 'sonner'

interface Teacher {
  id: string
  name: string
  teacher_id?: string
  is_floater?: boolean
  is_flexible?: boolean
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
  enrollment?: number | null
}

type SelectedCellData = WeeklyScheduleData & {
  time_slot_is_active?: boolean
  classroom_is_active?: boolean
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
        required_staff_override?: number | null
        preferred_staff_override?: number | null
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
  selectedDayIds: string[] // Days that are in the weekly schedule (may be view filter)
  /** Day IDs from Settings (Days & Time slots). When set, Apply Changes to shows only these days. */
  scheduleDayIdsFromSettings?: string[]
  selectedCellData?: SelectedCellData // Full cell data from the grid
  onSave?: () => void | Promise<void>
  /** Called when save starts so the grid can disable cell clicks / show overlay. */
  onSaveStart?: () => void
  /** Called when save finishes (success or failure) so the grid can re-enable cell clicks. */
  onSaveEnd?: () => void
  /** Refresh grid data without closing panel (e.g. after applying conflict resolutions). */
  onRefresh?: () => void | Promise<void>
  weekStartISO?: string
  readOnly?: boolean
  /** When true, Save button shows "Save & Return to Weekly Schedule" and parent onSave may navigate back */
  returnToWeekly?: boolean
  /** When false, header omits the calendar date (e.g. "Mar 10"). Use on Baseline Schedule; Weekly shows date. Default true. */
  showDateInHeader?: boolean
  /** When 'flex', panel opens directly in Add Temporary Coverage mode (e.g. from dashboard). Back button becomes Close. */
  initialPanelMode?: 'cell' | 'flex'
  /** When provided with initialPanelMode='flex', pre-fill the flex form date range (e.g. from dashboard grouped slot). */
  initialFlexStartDate?: string
  initialFlexEndDate?: string
  /** When provided with initialPanelMode='flex', show run-length message and suggestion (required vs preferred). */
  initialFlexTargetType?: 'required' | 'preferred'
  /** When opening from dashboard (initialPanelMode='flex'), pass staffing so header shows target and scheduled. */
  initialFlexRequiredStaff?: number
  initialFlexPreferredStaff?: number | null
  initialFlexScheduledStaff?: number
  /** When opening from weekly schedule, the calendar date of the selected cell (YYYY-MM-DD) for save-scope dialog. */
  cellDateISO?: string | null
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
      is_flexible: assignment.is_flexible ?? false,
    }))
}

/** Set NEXT_PUBLIC_DEBUG_SCHEDULE_PANEL=true in .env.local to enable; production stays quiet. */
const log = (...args: unknown[]) => {
  if (
    typeof process !== 'undefined' &&
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_DEBUG_SCHEDULE_PANEL === 'true'
  ) {
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

  let summary = `${teacherName} is assigned for temporary coverage to ${classroomName}.`
  if (isSingleShift && startLabel === endLabel && singleWeekday) {
    summary = `${teacherName} is assigned for temporary coverage to ${classroomName} on ${singleWeekday}, ${startLabel}.`
  } else if (weekdayText) {
    summary = `${teacherName} is assigned for temporary coverage to ${classroomName} on ${weekdayText} from ${startLabel} to ${endLabel}.`
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

  if (preferred !== null && scheduled > preferred) {
    return {
      status: 'above_target' as const,
      label: 'Above Target',
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

export type StaffingWarningStatus =
  | 'below_required'
  | 'below_preferred'
  | 'adequate'
  | 'above_target'

export const buildStaffingWarningMessage = ({
  staffingSummary,
  requiredTeachers,
  preferredTeachers,
  scheduledStaffCount,
  absences = [],
}: {
  staffingSummary: ReturnType<typeof buildStaffingSummary>
  requiredTeachers?: number
  preferredTeachers?: number
  scheduledStaffCount: number
  absences?: Array<{ teacher_name: string; has_sub: boolean }>
}): { message: string; status: StaffingWarningStatus } | null => {
  if (!staffingSummary.status || staffingSummary.status === null) return null
  const status = staffingSummary.status as StaffingWarningStatus
  const absencesWithoutSub = absences.filter(a => !a.has_sub)
  const hasUncoveredAbsences = absencesWithoutSub.length > 0

  if (status === 'adequate') {
    return null // Header badge suffices; no actionable message
  }

  const requiredSuffix = 'extra coverage to meet required target.'
  const preferredSuffix = 'extra coverage to meet preferred target.'

  if (status === 'below_required') {
    if (hasUncoveredAbsences) {
      return {
        message: `Assign subs for uncovered absences or assign ${requiredSuffix}`,
        status,
      }
    }
    return {
      message: `Assign ${requiredSuffix}`,
      status,
    }
  }

  if (status === 'below_preferred') {
    if (hasUncoveredAbsences) {
      return {
        message: `Assign subs for uncovered absences or assign ${preferredSuffix}`,
        status,
      }
    }
    return {
      message: `Assign ${preferredSuffix}`,
      status,
    }
  }

  if (status === 'above_target') {
    return {
      message: 'Extra coverage available to be re-assigned to another slot if needed.',
      status,
    }
  }

  return null
}

export const formatTimeRange = (
  timeSlotStartTime: string | null,
  timeSlotEndTime: string | null
) => (timeSlotStartTime && timeSlotEndTime ? `${timeSlotStartTime}–${timeSlotEndTime}` : '')

export const calculateDayNameDate = (weekStartISO?: string, dayNumber?: number | null) => {
  if (!weekStartISO) return ''
  const base = parseLocalDate(weekStartISO)
  const offset = dayNumber ? Math.max(0, dayNumber - 1) : 0
  const target = new Date(base.getTime())
  target.setDate(target.getDate() + offset)
  const year = target.getFullYear()
  const month = `${target.getMonth() + 1}`.padStart(2, '0')
  const day = `${target.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const formatDayNameDateLabel = (dayNameDate: string) => {
  if (!dayNameDate) return ''
  const date = parseLocalDate(dayNameDate)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const pickClassGroupForRatio = <
  T extends { min_age: number | null; required_ratio: number; preferred_ratio: number | null },
>(
  classGroups: T[]
) =>
  classGroups.length > 0
    ? classGroups.reduce((lowest, current) => {
        const currentMinAge = current.min_age ?? Infinity
        const lowestMinAge = lowest.min_age ?? Infinity
        return currentMinAge < lowestMinAge ? current : lowest
      })
    : null

export const calculateTeacherTargets = ({
  classGroupForRatio,
  enrollmentForCalculation,
}: {
  classGroupForRatio: { required_ratio: number; preferred_ratio: number | null } | null | undefined
  enrollmentForCalculation: number | null
}) => ({
  requiredTeachers:
    classGroupForRatio && enrollmentForCalculation
      ? Math.ceil(enrollmentForCalculation / classGroupForRatio.required_ratio)
      : undefined,
  preferredTeachers:
    classGroupForRatio && enrollmentForCalculation && classGroupForRatio.preferred_ratio
      ? Math.ceil(enrollmentForCalculation / classGroupForRatio.preferred_ratio)
      : undefined,
})

/** Total enrollment for ratio: sum of per-class enrollments if any set, else fallback (e.g. cell enrollment_for_staffing). */
export const getTotalEnrollmentForCalculation = (
  classGroups: Array<{ enrollment?: number | null }>,
  fallbackEnrollment: number | null
): number | null => {
  const hasPerClass = classGroups.some(cg => cg.enrollment != null)
  if (hasPerClass) {
    return classGroups.reduce((sum, cg) => sum + (Number(cg.enrollment) || 0), 0) || null
  }
  return fallbackEnrollment
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

  const flexibleAssignments = assignments.filter(
    assignment => !assignment.is_substitute && assignment.is_flexible && !assignment.is_floater
  )
  const baselineFlexAssignments = flexibleAssignments
    .filter(a => !a.staffing_event_id)
    .sort(compareByTeacherName)
  const temporaryCoverageAssignments = flexibleAssignments
    .filter(a => !!a.staffing_event_id)
    .sort(compareByTeacherName)

  const floaterAssignments = assignments
    .filter(assignment => !assignment.is_substitute && assignment.is_floater)
    .sort(compareByTeacherName)

  return {
    permanentAssignments,
    baselineFlexAssignments,
    temporaryCoverageAssignments,
    floaterAssignments,
  }
}

/** Sort class groups by the order stored in Class Group settings, then by name. */
export const sortClassGroupsBySettingsOrder = <
  T extends { id: string; name: string; order?: number | null },
>(
  groups: T[]
): T[] =>
  [...groups].sort((a, b) => {
    const orderA = a.order ?? Infinity
    const orderB = b.order ?? Infinity
    if (orderA !== orderB) return orderA - orderB
    return (a.name || '').localeCompare(b.name || '')
  })

export const buildFindSubLink = ({
  absences,
  assignments,
  cellDateISO,
}: {
  absences?: SelectedCellData['absences']
  assignments?: WeeklyScheduleData['assignments']
  /** When provided with a primary teacher and no absence, link opens Sub Finder in manual mode with this date (vuln 3). */
  cellDateISO?: string | null
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
    const dateISO = cellDateISO?.trim() || null
    if (dateISO) {
      const params = new URLSearchParams()
      params.set('mode', 'manual')
      params.set('teacher_id', primaryTeacher.teacher_id)
      params.set('start_date', dateISO)
      params.set('end_date', dateISO)
      return `/sub-finder?${params.toString()}`
    }
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
  scheduleDayIdsFromSettings,
  selectedCellData,
  onSave,
  onSaveStart,
  onSaveEnd,
  onRefresh,
  weekStartISO,
  readOnly = false,
  returnToWeekly = false,
  showDateInHeader = true,
  initialPanelMode = 'cell',
  initialFlexStartDate,
  initialFlexEndDate,
  initialFlexTargetType,
  initialFlexRequiredStaff,
  initialFlexPreferredStaff,
  initialFlexScheduledStaff,
  cellDateISO = null,
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
  const [requiredStaffOverride, setRequiredStaffOverride] = useState<number | null>(null)
  const [preferredStaffOverride, setPreferredStaffOverride] = useState<number | null>(null)
  const [notes, setNotes] = useState<string | null>(null)
  const [selectedTeachers, setSelectedTeachers] = useState<Teacher[]>([])
  const [selectedFlexTeachers, setSelectedFlexTeachers] = useState<Teacher[]>([])
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(false)
  const { format: displayNameFormat } = useDisplayNameFormat()
  const [allowedClassGroupIds, setAllowedClassGroupIds] = useState<string[]>([])
  const [allowedClassGroupIdsLoaded, setAllowedClassGroupIdsLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false)
  const [applyScope, setApplyScope] = useState<'single' | 'timeSlot' | 'day'>('single')
  const [applyDayIds, setApplyDayIds] = useState<string[]>([dayId])
  const [applyTimeSlotIds, setApplyTimeSlotIds] = useState<string[]>([timeSlotId])
  /** When Apply would create a conflict in another cell, block save and show this message */
  const [applyConflictError, setApplyConflictError] = useState<string | null>(null)
  /** When save fails from UnsavedChangesDialog (e.g. server 409), show in dialog so user sees it */
  const [saveErrorInDialog, setSaveErrorInDialog] = useState<string | null>(null)
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [classGroups, setClassGroups] = useState<ClassGroupWithMeta[]>([])
  const [enrollmentMode, setEnrollmentMode] = useState<'total' | 'by_class_group'>('total')
  const [allAvailableClassGroups, setAllAvailableClassGroups] = useState<ClassGroupWithMeta[]>([])
  const [classrooms, setClassrooms] = useState<ClassroomWithAllowedClasses[]>([])
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [conflictResolutions, setConflictResolutions] = useState<Map<string, ConflictResolution>>(
    new Map()
  )
  const [conflictResolutionApplying, setConflictResolutionApplying] = useState(false)
  /** After applying "mark as floater" resolution, hold teacher ids so a follow-up effect can set is_floater on chips */
  const pendingFloaterIdsAfterResolutionRef = useRef<Set<string>>(new Set())
  const router = useRouter()
  const [flexStartDate, setFlexStartDate] = useState<string>('')
  const [flexEndDate, setFlexEndDate] = useState<string>('')
  const [flexCategory, setFlexCategory] = useState<'standard' | 'break'>('standard')
  const [flexCoveredStaffId, setFlexCoveredStaffId] = useState<string>('')
  const [flexStartTime, setFlexStartTime] = useState<string>('')
  const [flexEndTime, setFlexEndTime] = useState<string>('')
  const [flexNotes, setFlexNotes] = useState<string>('')
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
  const [editingFlexEventId, setEditingFlexEventId] = useState<string | null>(null)
  const [editingFlexStaffId, setEditingFlexStaffId] = useState<string | null>(null)
  const [editingFlexStaffName, setEditingFlexStaffName] = useState<string | null>(null)
  const [editingFlexCategory, setEditingFlexCategory] = useState<'standard' | 'break' | null>(null)
  const [editFlexShiftCount, setEditFlexShiftCount] = useState<number | null>(null)
  const [showChangeStaffList, setShowChangeStaffList] = useState(false)
  const [showSaveScopeDialog, setShowSaveScopeDialog] = useState(false)
  const [saveScopeDialogMode, setSaveScopeDialogMode] = useState<'scope' | 'confirm_single'>(
    'scope'
  )
  const [pendingFlexSave, setPendingFlexSave] = useState<{
    staffId: string
    shiftKeys: string[]
  } | null>(null)
  const [saveScopeChoice, setSaveScopeChoice] = useState<
    'single_shift' | 'future_shifts' | 'all_shifts'
  >('all_shifts')
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
  const [flexRunInfo, setFlexRunInfo] = useState<{
    belowTarget: boolean
    dateStart?: string
    dateEnd?: string
    weeksLabel?: string
    targetType?: 'required' | 'preferred'
  } | null>(null)
  const [flexRunInfoLoading, setFlexRunInfoLoading] = useState(false)
  const [expandedFlexStaffId, setExpandedFlexStaffId] = useState<string | null>(null)
  const [flexAssignModes, setFlexAssignModes] = useState<Record<string, 'all' | 'custom'>>({})
  const [flexSelectedShiftKeys, setFlexSelectedShiftKeys] = useState<Record<string, string[]>>({})
  const [flexApplyDayNames, setFlexApplyDayNames] = useState<Set<string>>(new Set())
  const [isStaffingTargetsExpanded, setIsStaffingTargetsExpanded] = useState(false)
  const [isFullyAvailableExpanded, setIsFullyAvailableExpanded] = useState(true)
  const [isPartiallyAvailableExpanded, setIsPartiallyAvailableExpanded] = useState(true)
  const [isNotAvailableExpanded, setIsNotAvailableExpanded] = useState(false)
  // Track the original cell state when first loaded to determine if it was empty
  const originalCellStateRef = useRef<{ isActive: boolean; hasData: boolean } | null>(null)
  const initialTeacherCountRef = useRef<number>(0)
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
  /** Prevents duplicate in-flight fetches when effect runs multiple times before state commits */
  const teacherFetchInFlightRef = useRef(false)
  const classGroupsRef = useRef<ClassGroupWithMeta[]>([])
  const unsavedDialogReturnToCellRef = useRef(false)
  /** Track class group count so we only default to by_class_group when user adds a second group */
  const previousClassGroupCountRef = useRef<number>(0)
  /** After applying conflict resolution, preserve current selectedTeachers when grid refresh overwrites cell data */
  const preserveSelectedTeachersAfterConflictRef = useRef(false)
  /** Assignment count when we set the preserve ref; only clear preserve when we see different count (new data from refresh) */
  const assignmentCountWhenPreserveSetRef = useRef<number>(-1)
  /** Cell key we last initialized from; avoid re-running initializeFromCell when selectedCellData reference changes (would overwrite user edits) */
  const lastInitializedCellRef = useRef<string | null>(null)
  /** Last enrollment value set by user (input onChange). Used at save so we persist user's edit even if an effect overwrote state. */
  const enrollmentEditedRef = useRef<number | null | undefined>(undefined)
  /** When cell data effect preserves after conflict, tell teacher fetch effect to skip overwriting this cycle */
  const skipNextTeacherFetchAfterPreserveRef = useRef(false)
  /** After confirming deactivate, save and close the panel (effect runs once state has updated) */
  const pendingDeactivateAndCloseRef = useRef(false)

  useEffect(() => {
    if (!isOpen) return
    if (teachersLoadedRef.current) return
    if (preserveSelectedTeachersAfterConflictRef.current) return
    const mappedTeachers = mapAssignmentsToTeachers(selectedCellData?.assignments)
    if (mappedTeachers.length === 0) return

    log('[ScheduleSidePanel] Seeding teachers from selectedCellData.assignments', {
      count: mappedTeachers.length,
    })
    setSelectedTeachers(mappedTeachers.filter(t => !t.is_flexible))
    setSelectedFlexTeachers(mappedTeachers.filter(t => t.is_flexible))
  }, [isOpen, selectedCellData?.assignments])

  // Combined list for Assigned Teachers UI and save: permanent first, then flex (matches cell display)
  const allAssignedTeachers = useMemo(
    () => [...selectedTeachers, ...selectedFlexTeachers],
    [selectedTeachers, selectedFlexTeachers]
  )

  useEffect(() => {
    selectedTeachersRef.current = allAssignedTeachers
  }, [allAssignedTeachers])

  const handleAssignedTeachersChange = useCallback((teachers: Teacher[]) => {
    setSelectedTeachers(teachers.filter(t => !t.is_flexible))
    setSelectedFlexTeachers(teachers.filter(t => t.is_flexible))
  }, [])

  useEffect(() => {
    classGroupsRef.current = classGroups
  }, [classGroups])

  // Format time range for header
  const timeRange = formatTimeRange(timeSlotStartTime, timeSlotEndTime)

  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear()
    const month = `${date.getMonth() + 1}`.padStart(2, '0')
    const day = `${date.getDate()}`.padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const openTimeOffPanel = (teacherId: string, teacherName?: string | null) => {
    setTimeOffTeacherId(teacherId)
    setTimeOffTeacherName(teacherName ?? null)
    setPanelMode('timeOff')
  }

  /** Navigate to Sub Finder with this teacher and cell date range pre-selected (single day). */
  const openFindSub = useCallback(
    (teacherId: string) => {
      const dateISO = cellDateISO ?? flexStartDate
      if (!dateISO) return
      const params = new URLSearchParams()
      params.set('mode', 'manual')
      params.set('teacher_id', teacherId)
      params.set('start_date', dateISO)
      params.set('end_date', dateISO)
      router.push(`/sub-finder?${params.toString()}`)
    },
    [cellDateISO, flexStartDate, router]
  )

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
    setFlexApplyDayNames(new Set([dayName.toLowerCase()]))
  }, [isOpen, classroomId, dayId, timeSlotId])

  useEffect(() => {
    if (panelMode !== 'flex') return
    setFlexEndDate(prev => prev || flexStartDate || '')
    setIsStaffingTargetsExpanded(false)
    setIsFullyAvailableExpanded(true)
    setIsPartiallyAvailableExpanded(true)
    setIsNotAvailableExpanded(false)
    setFlexApplyDayNames(new Set([dayName.toLowerCase()]))
  }, [panelMode, flexStartDate, dayName])

  const dayNameDate = useMemo(
    () => calculateDayNameDate(weekStartISO, selectedCellData?.day_number),
    [weekStartISO, selectedCellData?.day_number]
  )

  const dayNameDateLabel = useMemo(() => formatDayNameDateLabel(dayNameDate), [dayNameDate])

  const flexShiftOptions = useMemo(() => {
    if (!flexStartDate || !flexEndDate || flexTimeSlotIds.length === 0) return []
    const start = parseLocalDate(flexStartDate)
    const end = parseLocalDate(flexEndDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return []
    const slotsById = new Map(timeSlots.map(slot => [slot.id, slot.code]))
    const shifts: Array<{ key: string; date: string; time_slot_id: string; label: string }> = []
    const cursor = new Date(start.getTime())
    while (cursor <= end) {
      const dateStr = formatLocalDate(cursor)
      const dayNameForDate = cursor.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
      const shouldIncludeDay = flexApplyDayNames.has(dayNameForDate)
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
  }, [flexStartDate, flexEndDate, flexTimeSlotIds, timeSlots, flexApplyDayNames])

  const totalFlexShiftCount = useMemo(() => {
    return flexShiftOptions.length * Math.max(1, flexClassroomIds.length)
  }, [flexShiftOptions.length, flexClassroomIds.length])

  const missingSelectedFlexDays = useMemo(() => {
    if (flexApplyDayNames.size === 0) return []
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
  }, [flexApplyDayNames, flexStartDate, flexEndDate])

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

  const LONG_TERM_WEEKS = 8
  const isLongTermFlex = useMemo(() => {
    if (!flexStartDate || !flexEndDate) return false
    const start = parseLocalDate(flexStartDate)
    const end = parseLocalDate(flexEndDate)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays >= LONG_TERM_WEEKS * 7
  }, [flexStartDate, flexEndDate])

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
    const startDateWeekdayKey = flexStartDate
      ? parseLocalDate(flexStartDate).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
      : ''

    setFlexApplyDayNames(prev => {
      const next = new Set(Array.from(prev).filter(day => validDayKeys.has(day)))
      if (next.size === 0) {
        if (startDateWeekdayKey && validDayKeys.has(startDateWeekdayKey)) {
          next.add(startDateWeekdayKey)
        } else {
          next.add(flexRangeDayOptions[0].name.toLowerCase())
        }
      }

      const sameSize = next.size === prev.size
      if (sameSize && Array.from(next).every(day => prev.has(day))) {
        return prev
      }
      return next
    })
  }, [flexRangeDayOptions, flexStartDate])

  useEffect(() => {
    if (!isOpen) return
    if (initialFlexStartDate && initialFlexEndDate) {
      setFlexStartDate(initialFlexStartDate)
      setFlexEndDate(initialFlexEndDate)
    } else {
      const baseDate = weekStartISO ? parseLocalDate(weekStartISO) : new Date()
      const startISO = formatLocalDate(baseDate)
      setFlexStartDate(startISO)
      setFlexEndDate(startISO)
    }
    setFlexClassroomIds([classroomId])
    setFlexTimeSlotIds([timeSlotId])
    setFlexCategory('standard')
    setFlexCoveredStaffId('')
    setFlexStartTime('')
    setFlexEndTime('')
    setFlexNotes('')
    setEditingFlexEventId(null)
    setEditingFlexStaffId(null)
    setEditingFlexStaffName(null)
    setEditingFlexCategory(null)
    setEditFlexShiftCount(null)
    setShowChangeStaffList(false)
  }, [isOpen, weekStartISO, classroomId, timeSlotId, initialFlexStartDate, initialFlexEndDate])

  // When opened from dashboard (or elsewhere) in flex-only mode, show Add Temporary Coverage immediately
  useEffect(() => {
    if (isOpen && initialPanelMode === 'flex') {
      setPanelMode('flex')
    }
  }, [isOpen, initialPanelMode])

  // When in flex mode from weekly schedule (no initial flex dates), fetch slot run for run-length message
  useEffect(() => {
    if (!isOpen || panelMode !== 'flex' || initialPanelMode === 'flex' || editingFlexEventId) {
      setFlexRunInfo(null)
      return
    }
    const startDate =
      weekStartISO ||
      (() => {
        const d = new Date()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      })()
    let cancelled = false
    setFlexRunInfoLoading(true)
    setFlexRunInfo(null)
    fetch(
      `/api/dashboard/slot-run?classroom_id=${encodeURIComponent(classroomId)}&day_of_week_id=${encodeURIComponent(dayId)}&time_slot_id=${encodeURIComponent(timeSlotId)}&start_date=${encodeURIComponent(startDate)}`
    )
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        if (
          data?.belowTarget &&
          data?.dateStart &&
          data?.dateEnd &&
          data?.weeksLabel &&
          data?.targetType
        ) {
          setFlexRunInfo({
            belowTarget: true,
            dateStart: data.dateStart,
            dateEnd: data.dateEnd,
            weeksLabel: data.weeksLabel,
            targetType: data.targetType,
          })
          setFlexStartDate(data.dateStart)
          setFlexEndDate(data.dateEnd)
        } else {
          setFlexRunInfo({ belowTarget: false })
        }
      })
      .catch(() => {
        if (!cancelled) setFlexRunInfo(null)
      })
      .finally(() => {
        if (!cancelled) setFlexRunInfoLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [
    isOpen,
    panelMode,
    initialPanelMode,
    classroomId,
    dayId,
    timeSlotId,
    weekStartISO,
    editingFlexEventId,
  ])

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
            event_category: flexCategory,
          }),
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to load temporary coverage availability.')
        }
        if (!cancelled) {
          let staffList = Array.isArray(data?.staff) ? data.staff : []
          if (
            editingFlexStaffId &&
            !staffList.some((s: { id: string }) => s.id === editingFlexStaffId)
          ) {
            staffList = [
              {
                id: editingFlexStaffId,
                name: editingFlexStaffName ?? 'Current assignee',
                availableShiftKeys: [],
              },
              ...staffList,
            ]
          }
          setFlexAvailability(staffList)
          setFlexShiftMetrics(Array.isArray(data?.shift_metrics) ? data.shift_metrics : [])
          if (Array.isArray(data?.day_options)) {
            setFlexDayOptions(data.day_options)
            if (data.day_options.length > 0 && flexApplyDayNames.size === 0 && flexStartDate) {
              const startWeekdayKey = parseLocalDate(flexStartDate)
                .toLocaleDateString('en-US', { weekday: 'long' })
                .toLowerCase()
              const inOptions = data.day_options.some(
                (d: { name?: string }) => String(d.name || '').toLowerCase() === startWeekdayKey
              )
              setFlexApplyDayNames(
                new Set([
                  inOptions
                    ? startWeekdayKey
                    : String(data.day_options[0].name || '').toLowerCase(),
                ])
              )
            }
          }
        }
      } catch (error) {
        if (!cancelled) {
          setFlexAvailability([])
          setFlexShiftMetrics([])
          setFlexAvailabilityError(
            error instanceof Error
              ? error.message
              : 'Failed to load temporary coverage availability.'
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
  }, [
    isOpen,
    panelMode,
    flexStartDate,
    flexEndDate,
    flexTimeSlotIds,
    flexClassroomIds,
    flexCategory,
    editingFlexStaffId,
    editingFlexStaffName,
  ])

  const normalizeClassGroup = useCallback(
    (cg: {
      id: string
      name: string
      parent_class_id?: string | null
      age_unit?: 'months' | 'years'
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
      age_unit: cg.age_unit ?? 'years',
      min_age: cg.min_age ?? null,
      max_age: cg.max_age ?? null,
      required_ratio: cg.required_ratio ?? 8,
      preferred_ratio: cg.preferred_ratio ?? null,
      is_active: cg.is_active ?? true,
      order: cg.order ?? null,
      enrollment: (cg as { enrollment?: number | null }).enrollment ?? null,
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
        required_staff_override?: number | null
        preferred_staff_override?: number | null
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
      const hasMultipleClassGroups = (cellData.class_groups?.length ?? 0) > 1
      const hasPerClassEnrollment =
        cellData.class_groups?.some(
          (cg: { enrollment?: number | null }) => cg.enrollment != null
        ) ?? false
      // Use "By class group" only when there are multiple class groups and at least one per-class enrollment is set.
      // If enrollment is stored by total only (no per-class), default to "By total" even with multiple groups.
      setEnrollmentMode(
        hasMultipleClassGroups && hasPerClassEnrollment ? 'by_class_group' : 'total'
      )
      // So the "add second group" effect doesn't overwrite to by_class_group when we're just loading a cell that already has multiple groups
      previousClassGroupCountRef.current = mappedClassGroupIds.length
      setRequiredStaffOverride(cellData.required_staff_override ?? null)
      setPreferredStaffOverride(cellData.preferred_staff_override ?? null)
      setNotes(cellData.notes)
      const mappedTeachers = mapAssignmentsToTeachers(sourceAssignments)
      initialTeacherCountRef.current = mappedTeachers.length
      if (mappedTeachers.length > 0 && !teachersLoadedRef.current) {
        const pending = pendingFloaterIdsAfterResolutionRef.current
        const withPendingFloaters = mappedTeachers.map(t => {
          const match = (t.teacher_id && pending.has(t.teacher_id)) || (t.id && pending.has(t.id))
          return match ? { ...t, is_floater: true } : t
        })
        setSelectedTeachers(withPendingFloaters.filter(t => !t.is_flexible))
        setSelectedFlexTeachers(withPendingFloaters.filter(t => t.is_flexible))
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
      lastInitializedCellRef.current = null
      enrollmentEditedRef.current = undefined
      preserveSelectedTeachersAfterConflictRef.current = false
      preserveTeachersRef.current = false
      teachersLoadedRef.current = false
      teacherFetchInFlightRef.current = false
      pendingFloaterIdsAfterResolutionRef.current = new Set()
      skipNextTeacherFetchAfterPreserveRef.current = false
      assignmentCountWhenPreserveSetRef.current = -1
      return
    }

    const cellKey = `${classroomId}|${dayId}|${timeSlotId}`
    // Only initialize from selectedCellData when we first open this cell. If we've already initialized
    // for this cell, skip so we don't overwrite user edits (e.g. enrollment 5 → 8) when parent re-renders
    // and selectedCellData gets a new object reference with the same stale data.
    if (selectedCellData?.schedule_cell && lastInitializedCellRef.current === cellKey) {
      setLoading(false)
      return
    }

    setLoading(true)
    hasLoadedInitialDataRef.current = false
    initialClassGroupIdsRef.current = null
    // Do not reset teachersLoadedRef here: when selectedCellData gets a new reference (e.g. parent
    // re-render), we must not overwrite selectedTeachers in initializeFromCell or we wipe out
    // teachers the user just added, and the conflict banner never appears.
    preserveTeachersRef.current = false

    // If selectedCellData is provided and has a schedule_cell, use it
    // Note: selectedCellData structure has schedule_cell nested
    if (selectedCellData?.schedule_cell) {
      lastInitializedCellRef.current = cellKey
      enrollmentEditedRef.current = undefined
      const cellData = selectedCellData.schedule_cell
      // After applying conflict resolution we refresh the grid; new cell data has only the resolved assignment.
      // Preserve current selected teachers (including others not yet saved) by not overwriting from assignments.
      // Do not clear preserveSelectedTeachersAfterConflictRef here: clearing it allowed the seeding effect to
      // overwrite selectedTeachers from selectedCellData.assignments (which only has the resolved assignment),
      // dropping unsaved selections. Clear only on panel close or after successful save.
      if (preserveSelectedTeachersAfterConflictRef.current) {
        initializeFromCell(cellData)
        skipNextTeacherFetchAfterPreserveRef.current = true
      } else {
        initializeFromCell(cellData, selectedCellData.assignments)
      }
      setLoading(false)
      return
    }
    lastInitializedCellRef.current = null
    enrollmentEditedRef.current = undefined
    teachersLoadedRef.current = false

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
          initialTeacherCountRef.current = 0
          initialClassGroupIdsRef.current = []
          previousClassGroupIdsRef.current = []
          preserveTeachersRef.current = false
          setClassGroupIds([])
          setClassGroups([])
          setEnrollment(null)
          setRequiredStaffOverride(null)
          setPreferredStaffOverride(null)
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

    // Fetch classrooms list (for display/other use)
    fetch('/api/classrooms')
      .then(r => r.json())
      .then((data: ClassroomWithAllowedClasses[]) => {
        setClassrooms(Array.isArray(data) ? data : [])
      })
      .catch(() => setClassrooms([]))

    // Fetch all class groups (including inactive) for updating classGroups when classGroupIds changes
    fetch('/api/class-groups?includeInactive=true')
      .then(r => r.json())
      .then(data => {
        const items = Array.isArray(data) ? (data as ClassGroupWithMeta[]) : []
        setAllAvailableClassGroups(items)
      })
      .catch(console.error)
  }, [isOpen, classroomId, dayId, timeSlotId, selectedCellData, initializeFromCell])

  // Load allowed class groups for this classroom only when panel opens or classroom changes.
  // Separate effect so we do not reset when selectedCellData or initializeFromCell change (which would make the dropdown show all class groups).
  useEffect(() => {
    if (!isOpen) {
      setAllowedClassGroupIds([])
      setAllowedClassGroupIdsLoaded(false)
      return
    }
    if (!classroomId) {
      setAllowedClassGroupIds([])
      setAllowedClassGroupIdsLoaded(true)
      return
    }
    setAllowedClassGroupIdsLoaded(false)
    fetch(`/api/classrooms/${classroomId}/allowed-classes`)
      .then(res => {
        if (!res.ok) return []
        return res.json()
      })
      .then((ids: unknown) => {
        setAllowedClassGroupIds(
          Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
        )
        setAllowedClassGroupIdsLoaded(true)
      })
      .catch(() => {
        setAllowedClassGroupIds([])
        setAllowedClassGroupIdsLoaded(true)
      })
  }, [isOpen, classroomId])

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

  // When user adds a second (or more) class group, default enrollment to "By class group".
  // Only update the ref when we switch to by_class_group or when count is 1 (user removed to one group).
  // Do not update when count is 0 (stale from init) so we don't overwrite the ref set in initializeFromCell.
  useEffect(() => {
    const count = classGroupIds.length
    if (count > 1 && previousClassGroupCountRef.current <= 1) {
      setEnrollmentMode('by_class_group')
      previousClassGroupCountRef.current = count
    } else if (count === 1) {
      previousClassGroupCountRef.current = 1
    }
  }, [classGroupIds.length])

  // Fetch teacher assignments when classGroupIds changes or drawer opens
  // Fetch directly from teacher-schedules API for immediate, accurate data
  // (Weekly schedule API may be cached or have timing issues after saves)
  useEffect(() => {
    if (!isOpen) return

    if (!hasLoadedInitialDataRef.current) {
      setIsLoadingTeachers(false)
      return
    }

    // Inactive slots have no teacher assignments; don't fetch and don't show loading
    if (!isActive) {
      setIsLoadingTeachers(false)
      return
    }

    // After conflict resolution we called onRefresh(); grid updated. Cell data effect will preserve teachers and set skipNextTeacherFetchAfterPreserveRef.
    // Do not clear preserveSelectedTeachersAfterConflictRef here so the cell data effect (which runs when selectedCellData updates) can see it and skip overwriting.
    if (preserveSelectedTeachersAfterConflictRef.current) {
      previousClassGroupIdsRef.current = classGroupIds
      teachersLoadedRef.current = true
      setIsLoadingTeachers(false)
      return
    }
    // Cell data effect just preserved; skip fetching so we don't overwrite with API data (which may only have the resolved assignment).
    if (skipNextTeacherFetchAfterPreserveRef.current) {
      skipNextTeacherFetchAfterPreserveRef.current = false
      previousClassGroupIdsRef.current = classGroupIds
      teachersLoadedRef.current = true
      setIsLoadingTeachers(false)
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
      setIsLoadingTeachers(false)
      return
    }

    const cacheKey = `${classroomId}|${dayId}|${timeSlotId}`
    const cachedTeachers = teacherCacheRef.current.get(cacheKey)
    if (cachedTeachers && cachedTeachers.length > 0 && teachersLoadedRef.current) {
      setSelectedTeachers(cachedTeachers.filter((t: Teacher) => !t.is_flexible))
      setSelectedFlexTeachers(cachedTeachers.filter((t: Teacher) => t.is_flexible))
      setIsLoadingTeachers(false)
      return
    }

    // Skip if we already have a fetch in flight for this cell (effect can re-run before isLoadingTeachers state commits)
    if (teacherFetchInFlightRef.current && teacherFetchKeyRef.current === cacheKey) {
      return
    }
    if (teacherFetchKeyRef.current === cacheKey && isLoadingTeachers) {
      return
    }

    teacherFetchKeyRef.current = cacheKey
    teacherFetchInFlightRef.current = true
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
        teacherFetchInFlightRef.current = false
        // Clear loading as soon as we have a response (including 0 teachers) so inactive→active doesn't stick on "Loading assigned teachers"
        setIsLoadingTeachers(false)

        // If we just applied conflict resolution and refreshed, an in-flight fetch may complete after.
        // Do not overwrite selectedTeachers with API data (which may only have the resolved assignment).
        if (preserveSelectedTeachersAfterConflictRef.current) return

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
          is_flexible:
            (schedule.teacher as any)?.staff_role_type_assignments?.some(
              (a: any) => a.staff_role_types?.code === 'FLEXIBLE'
            ) ?? false,
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
        const pending = pendingFloaterIdsAfterResolutionRef.current
        const withPendingFloaters = teachers.map(t => {
          const match = (t.teacher_id && pending.has(t.teacher_id)) || (t.id && pending.has(t.id))
          return match ? { ...t, is_floater: true } : t
        })
        setSelectedTeachers(withPendingFloaters.filter(t => !t.is_flexible))
        setSelectedFlexTeachers(withPendingFloaters.filter(t => t.is_flexible))
      })
      .catch(err => {
        teacherFetchInFlightRef.current = false
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
        setSelectedFlexTeachers([])
      })
  }, [
    isOpen,
    isActive,
    classroomId,
    dayId,
    timeSlotId,
    classGroupIds,
    isLoadingTeachers,
    displayNameFormat,
  ])

  // Determine if cell has data (current state)
  const hasData = !!(
    classGroupIds.length > 0 ||
    enrollment !== null ||
    allAssignedTeachers.length > 0
  )

  const parentInactiveReasons = getSlotInactiveReasons({
    schedule_cell: { is_active: true },
    classroom_is_active: selectedCellData?.classroom_is_active,
    time_slot_is_active: selectedCellData?.time_slot_is_active,
  })

  const isParentEffectivelyInactive = isSlotEffectivelyInactive({
    schedule_cell: { is_active: true },
    classroom_is_active: selectedCellData?.classroom_is_active,
    time_slot_is_active: selectedCellData?.time_slot_is_active,
  })

  const effectiveInactiveReasonLabel =
    parentInactiveReasons.length === 0
      ? null
      : parentInactiveReasons
          .map(reason =>
            reason === 'classroom'
              ? 'Classroom is inactive'
              : reason === 'time_slot'
                ? 'Time slot is inactive'
                : null
          )
          .filter(Boolean)
          .join(' • ')

  const effectiveIsActive = isActive && !isParentEffectivelyInactive
  const slotIsInactive = !effectiveIsActive

  // Auto-activate cell when class groups, enrollment, or teachers are added (only if inactive and originally empty)
  useEffect(() => {
    // If cell is inactive and originally had no data, and user is now adding data, activate it
    const originalState = originalCellStateRef.current
    if (originalState && !originalState.isActive && !originalState.hasData && hasData) {
      setIsActive(true)
    }
  }, [classGroupIds.length, enrollment, allAssignedTeachers.length, isActive, hasData])

  // Check for baseline conflicts: teacher already scheduled (non-floater) in another classroom same day/slot
  // Run when editing the cell: on Baseline (!readOnly) we're always in edit form; on Weekly (readOnly) only when panelMode === 'editCell'
  useEffect(() => {
    if (!isOpen || allAssignedTeachers.length === 0 || !dayId || !timeSlotId || !classroomId) {
      setConflicts([])
      return
    }
    if (readOnly && panelMode !== 'editCell') {
      setConflicts([])
      return
    }
    const checks = allAssignedTeachers
      .filter(t => t.teacher_id)
      .map(t => ({
        teacher_id: t.teacher_id!,
        day_of_week_id: dayId,
        time_slot_id: timeSlotId,
        classroom_id: classroomId,
        is_floater: t.is_floater === true,
      }))
    if (checks.length === 0) {
      setConflicts([])
      return
    }
    let cancelled = false
    fetch('/api/teacher-schedules/check-conflicts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checks }),
    })
      .then(r => r.json())
      .then((data: { conflicts?: Conflict[] }) => {
        if (cancelled) return
        const list = Array.isArray(data?.conflicts) ? data.conflicts : []
        const enriched: Conflict[] = list.map(c => ({
          ...c,
          added_as_floater:
            allAssignedTeachers.find(t => t.teacher_id === c.teacher_id)?.is_floater === true,
        }))
        startTransition(() => {
          if (!cancelled) setConflicts(enriched)
        })
      })
      .catch(() => {
        if (!cancelled) startTransition(() => setConflicts([]))
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, readOnly, panelMode, dayId, timeSlotId, classroomId, allAssignedTeachers])

  // After "Keep both — mark as floater" + Apply, ensure chip shows Floater (re-apply in case another effect overwrote selectedTeachers).
  // Do not clear pending here so that when onRefresh() updates selectedCellData and initializeFromCell runs, it can still apply floater state.
  useEffect(() => {
    const pending = pendingFloaterIdsAfterResolutionRef.current
    if (conflicts.length !== 0 || pending.size === 0) return
    const applyFloater = (t: Teacher) => {
      const match = (t.teacher_id && pending.has(t.teacher_id)) || (t.id && pending.has(t.id))
      return match ? { ...t, is_floater: true } : t
    }
    setSelectedTeachers(prev => prev.map(applyFloater))
    setSelectedFlexTeachers(prev => prev.map(applyFloater))
  }, [conflicts.length])

  // Fields should be disabled if parent entities are inactive, or if explicitly inactive with existing data.
  const fieldsDisabled = isParentEffectivelyInactive || (!isActive && hasData) || saving

  // Track unsaved changes
  useEffect(() => {
    if (!isOpen) {
      setHasUnsavedChanges(false)
      return
    }

    const cellClassGroupIds = cell?.class_groups?.map(cg => cg.id) || []
    const classGroupEnrollmentMatch =
      JSON.stringify(
        (cell?.class_groups ?? []).map(cg => ({ id: cg.id, e: cg.enrollment ?? null })).sort()
      ) === JSON.stringify(classGroups.map(cg => ({ id: cg.id, e: cg.enrollment ?? null })).sort())
    const intendedEnrollmentTotal =
      enrollmentMode === 'total'
        ? enrollment
        : getTotalEnrollmentForCalculation(classGroups, enrollment)
    const enrollmentTotalMatch = cell?.enrollment_for_staffing === intendedEnrollmentTotal
    const enrollmentPerClassMatch =
      enrollmentMode === 'total'
        ? (cell?.class_groups ?? []).every(
            (cg: { enrollment?: number | null }) => cg.enrollment == null
          )
        : classGroupEnrollmentMatch
    // When cell is inactive, saved teacher count is 0 (inactive slots have no assignments)
    const savedTeacherCount = isActive ? (initialTeacherCountRef.current ?? 0) : 0
    const teachersMatch = allAssignedTeachers.length === savedTeacherCount
    const hasChanges =
      cell?.is_active !== isActive ||
      JSON.stringify([...cellClassGroupIds].sort()) !== JSON.stringify([...classGroupIds].sort()) ||
      !enrollmentTotalMatch ||
      !enrollmentPerClassMatch ||
      cell?.required_staff_override !== requiredStaffOverride ||
      cell?.preferred_staff_override !== preferredStaffOverride ||
      cell?.notes !== notes ||
      !teachersMatch

    setHasUnsavedChanges(hasChanges)
  }, [
    isOpen,
    cell,
    isActive,
    classGroupIds,
    classGroups,
    enrollment,
    enrollmentMode,
    notes,
    requiredStaffOverride,
    preferredStaffOverride,
    allAssignedTeachers,
  ])

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
      setFlexError('Select a staff member for temporary coverage.')
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
    if (editingFlexEventId) {
      setPendingFlexSave({ staffId, shiftKeys })
      const isSingleShift = (editFlexShiftCount ?? 0) <= 1
      if (isSingleShift) {
        setSaveScopeChoice('single_shift')
        setSaveScopeDialogMode('confirm_single')
        setShowSaveScopeDialog(true)
      } else {
        const todayLocal = new Date(
          new Date().getFullYear(),
          new Date().getMonth(),
          new Date().getDate()
        )
        const hasPastDates = !!flexStartDate && parseLocalDate(flexStartDate) < todayLocal
        setSaveScopeDialogMode('scope')
        if (hasPastDates) {
          setSaveScopeChoice('future_shifts')
        } else {
          setSaveScopeChoice('all_shifts')
        }
        setShowSaveScopeDialog(true)
      }
      setFlexError(null)
      return
    }
    setFlexSaving(true)
    try {
      const shifts = shiftKeys.flatMap(key => {
        const [date, timeSlotId] = key.split('|')
        return flexClassroomIds.map(cid => ({
          date,
          time_slot_id: timeSlotId,
          classroom_id: cid,
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
          event_category: flexCategory,
          covered_staff_id: flexCategory === 'break' ? flexCoveredStaffId || null : null,
          start_time: flexCategory === 'break' ? flexStartTime || null : null,
          end_time: flexCategory === 'break' ? flexEndTime || null : null,
          notes: flexNotes?.trim() || null,
          shifts,
        }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to add temporary coverage.')
      }
      clearDataHealthCache()
      try {
        await onSave?.()
      } catch (refreshError) {
        console.error('Failed to refresh after temporary coverage assignment:', refreshError)
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
      setEditingFlexEventId(null)
      setEditingFlexStaffId(null)
      setEditingFlexStaffName(null)
      setPanelMode('cell')
      toast.success(
        `${assignedStaffName} assigned for temporary coverage to ${assignedClassroomLabel}`
      )
    } catch (error) {
      setFlexError(error instanceof Error ? error.message : 'Failed to add temporary coverage.')
    } finally {
      setFlexSaving(false)
    }
  }

  const handleConfirmSaveScope = async () => {
    if (!pendingFlexSave || !editingFlexEventId) return
    const { staffId, shiftKeys } = pendingFlexSave
    const scopeDate = cellDateISO ?? flexStartDate
    setFlexSaving(true)
    setFlexError(null)
    try {
      const removeBody: {
        event_id: string
        scope: 'single_shift' | 'future_shifts' | 'all_shifts'
        date?: string
        classroom_id?: string
        time_slot_id?: string
      } = {
        event_id: editingFlexEventId,
        scope: saveScopeChoice,
      }
      if (saveScopeChoice === 'single_shift' || saveScopeChoice === 'future_shifts') {
        removeBody.date = scopeDate ?? undefined
        removeBody.classroom_id = classroomId
        removeBody.time_slot_id = timeSlotId
      }
      const removeResponse = await fetch('/api/staffing-events/flex/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(removeBody),
      })
      if (!removeResponse.ok) {
        const errorData = await removeResponse.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to remove existing temporary coverage.')
      }
      const shifts = shiftKeys.flatMap(key => {
        const [date, slotId] = key.split('|')
        return flexClassroomIds.map(cid => ({
          date,
          time_slot_id: slotId,
          classroom_id: cid,
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
          event_category: flexCategory,
          covered_staff_id: flexCategory === 'break' ? flexCoveredStaffId || null : null,
          start_time: flexCategory === 'break' ? flexStartTime || null : null,
          end_time: flexCategory === 'break' ? flexEndTime || null : null,
          notes: flexNotes?.trim() || null,
          shifts,
        }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to add temporary coverage.')
      }
      clearDataHealthCache()
      try {
        await onSave?.()
      } catch (refreshError) {
        console.error('Failed to refresh after temporary coverage assignment:', refreshError)
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
      setShowSaveScopeDialog(false)
      setPendingFlexSave(null)
      setExpandedFlexStaffId(null)
      setEditingFlexEventId(null)
      setEditingFlexStaffId(null)
      setEditingFlexStaffName(null)
      setEditingFlexCategory(null)
      setEditFlexShiftCount(null)
      setShowChangeStaffList(false)
      setPanelMode('cell')
      toast.success(
        `Temporary coverage updated. ${assignedStaffName} assigned to ${assignedClassroomLabel}`
      )
    } catch (error) {
      setFlexError(error instanceof Error ? error.message : 'Failed to update temporary coverage.')
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
        throw new Error(errorData.error || 'Failed to remove temporary coverage.')
      }
      clearDataHealthCache()
      try {
        await onSave?.()
      } catch (refreshError) {
        console.error('Failed to refresh after flex removal:', refreshError)
      }
    } catch (error) {
      setFlexError(error instanceof Error ? error.message : 'Failed to remove temporary coverage.')
    }
  }

  const handleOpenRemoveFlexDialog = async (
    assignment: WeeklyScheduleData['assignments'][number]
  ) => {
    if (!assignment.staffing_event_id) {
      toast.error('Unable to remove this temporary coverage. Missing event id.')
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
        throw new Error(errorData.error || 'Failed to load temporary coverage details.')
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
        error instanceof Error ? error.message : 'Failed to load temporary coverage details.'
      )
    } finally {
      setFlexRemoveLoading(false)
    }
  }

  const handleOpenEditFlex = async (assignment: WeeklyScheduleData['assignments'][number]) => {
    if (!assignment.staffing_event_id) {
      toast.error('Unable to edit this temporary coverage. Missing event id.')
      return
    }
    try {
      const params = new URLSearchParams({
        event_id: assignment.staffing_event_id,
        for_edit: '1',
      })
      const response = await fetch(`/api/staffing-events/flex/remove?${params.toString()}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to load temporary coverage for editing.')
      }
      const data = await response.json()
      setFlexStartDate(data?.start_date ?? '')
      setFlexEndDate(data?.end_date ?? '')
      setFlexCategory(data?.event_category === 'break' ? 'break' : 'standard')
      setFlexCoveredStaffId(data?.covered_staff_id ?? '')
      setFlexStartTime(data?.start_time ?? '')
      setFlexEndTime(data?.end_time ?? '')
      setFlexNotes(data?.notes ?? '')
      const classroomIds = Array.isArray(data?.classroom_ids) ? data.classroom_ids : [classroomId]
      const timeSlotIds = Array.isArray(data?.time_slot_ids) ? data.time_slot_ids : [timeSlotId]
      setFlexClassroomIds(classroomIds.length > 0 ? classroomIds : [classroomId])
      setFlexTimeSlotIds(timeSlotIds.length > 0 ? timeSlotIds : [timeSlotId])
      setFlexApplyDayNames(
        new Set(
          (Array.isArray(data?.weekdays) ? data.weekdays : []).map((d: string) =>
            String(d).toLowerCase()
          )
        )
      )
      setEditingFlexEventId(assignment.staffing_event_id)
      setEditingFlexStaffId(assignment.teacher_id ?? null)
      setEditingFlexStaffName(assignment.teacher_name ?? null)
      setEditingFlexCategory(data?.event_category === 'break' ? 'break' : 'standard')
      setEditFlexShiftCount(Number(data?.matching_shift_count ?? 0) || null)
      setFlexError(null)
      setPanelMode('flex')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to load temporary coverage for editing.'
      )
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
        throw new Error(errorData.error || 'Failed to remove temporary coverage.')
      }

      clearDataHealthCache()
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
      const message =
        error instanceof Error ? error.message : 'Failed to remove temporary coverage.'
      toast.error(message)
      setFlexError(message)
    } finally {
      setFlexRemoveSubmitting(false)
    }
  }

  /** Update enrollment state and ref so save uses user's value even if an effect overwrote state */
  const handleEnrollmentChange = useCallback((value: number | null) => {
    enrollmentEditedRef.current = value
    setEnrollment(value)
  }, [])

  const handleSave = async () => {
    // Block save only when parent (classroom/time slot) is inactive; allow saving when user set cell to inactive
    if (isParentEffectivelyInactive) return
    // Block save when there are unresolved baseline conflicts (teacher double-booked in another room)
    if (conflicts.length > 0) return
    setApplyConflictError(null)
    setSaveErrorInDialog(null)
    setSaving(true)
    onSaveStart?.()
    try {
      // Class groups required only when slot is active; inactive slots can be saved without class groups
      if (isActive && classGroupIds.length === 0) {
        alert('At least one class group is required when slot is active')
        setSaving(false)
        return
      }

      // Use user-edited enrollment when they changed it (ref); otherwise state (avoids stale state if an effect overwrote)
      const refValue = enrollmentEditedRef.current
      const enrollmentToSave = refValue !== undefined ? refValue : enrollment
      // Total for DB: when mode is 'total' use single enrollment and clear per-class; otherwise per-class sum if any set, else single enrollment
      const totalForDb =
        enrollmentMode === 'total'
          ? enrollmentToSave
          : getTotalEnrollmentForCalculation(classGroups, enrollmentToSave)
      const enrollmentByClassGroup =
        enrollmentMode === 'total'
          ? ({} as Record<string, number>)
          : classGroups.reduce(
              (acc, cg) => (cg.enrollment != null ? { ...acc, [cg.id]: cg.enrollment } : acc),
              {} as Record<string, number>
            )

      // Prepare cell data (enrollment_by_class_group for per-class display; overrides for staffing)
      // API expects enrollment_for_staffing to be positive or null, not 0
      const enrollmentForApi = totalForDb === 0 || totalForDb === null ? null : totalForDb
      const cellData = {
        classroom_id: classroomId,
        day_of_week_id: dayId,
        time_slot_id: timeSlotId,
        is_active: isActive,
        class_group_ids: classGroupIds,
        enrollment_for_staffing: enrollmentForApi,
        enrollment_by_class_group: enrollmentByClassGroup,
        required_staff_override: requiredStaffOverride,
        preferred_staff_override: preferredStaffOverride,
        notes: notes,
      }

      // Determine which days and time slots to update based on scope
      // Safeguard: if all checkboxes were unchecked, default to this cell only
      let daysToUpdate: string[] = [dayId]
      let timeSlotsToUpdate: string[] = [timeSlotId]

      if (applyScope === 'timeSlot') {
        // Same time slot across selected days
        daysToUpdate = applyDayIds.length > 0 ? applyDayIds : [dayId]
        timeSlotsToUpdate = [timeSlotId]
      } else if (applyScope === 'day') {
        // All time slots for the same day
        daysToUpdate = [dayId]
        timeSlotsToUpdate = applyTimeSlotIds.length > 0 ? applyTimeSlotIds : [timeSlotId]
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
        enrollment_by_class_group: Record<string, number>
        required_staff_override: number | null
        preferred_staff_override: number | null
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
            enrollment_by_class_group: cellData.enrollment_by_class_group,
            required_staff_override: cellData.required_staff_override,
            preferred_staff_override: cellData.preferred_staff_override,
            notes: cellData.notes,
          })
        }
      }

      // Pre-Apply conflict check: when applying to multiple cells, ensure no target cell would conflict
      const applyCellCount = daysToUpdate.length * timeSlotsToUpdate.length
      if (applyCellCount > 1 && allAssignedTeachers.some(t => t.teacher_id)) {
        const applyChecks: Array<{
          teacher_id: string
          day_of_week_id: string
          time_slot_id: string
          classroom_id: string
          is_floater: boolean
        }> = []
        for (const updateDayId of daysToUpdate) {
          for (const updateTimeSlotId of timeSlotsToUpdate) {
            for (const t of allAssignedTeachers) {
              if (t.teacher_id) {
                applyChecks.push({
                  teacher_id: t.teacher_id,
                  day_of_week_id: updateDayId,
                  time_slot_id: updateTimeSlotId,
                  classroom_id: cellData.classroom_id,
                  is_floater: t.is_floater === true,
                })
              }
            }
          }
        }
        if (applyChecks.length > 0) {
          const checkRes = await fetch('/api/teacher-schedules/check-conflicts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checks: applyChecks }),
          })
          const checkData = (await checkRes.json().catch(() => ({}))) as {
            conflicts?: Array<{
              teacher_name?: string
              conflicting_classroom_name?: string
              day_of_week_name?: string
              time_slot_code?: string
            }>
          }
          const applyConflicts = Array.isArray(checkData?.conflicts) ? checkData.conflicts : []
          if (applyConflicts.length > 0) {
            const c = applyConflicts[0]
            const teacherName = c.teacher_name ?? 'A teacher'
            const roomName = c.conflicting_classroom_name ?? 'another room'
            const dayName = c.day_of_week_name ?? 'that day'
            const slotCode = c.time_slot_code ?? 'that time'
            setApplyConflictError(
              `Cannot apply: ${teacherName} is already scheduled in ${roomName} for ${dayName} ${slotCode}. Resolve that conflict first or apply only to this time slot.`
            )
            setSaving(false)
            onSaveEnd?.()
            return
          }
        }
      }

      // Bulk update cells
      const cellResponse = await fetch('/api/schedule-cells/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })

      if (cellResponse.ok) {
        await cellResponse.json().catch(() => [])
      }

      if (!cellResponse.ok) {
        const errorBody = await cellResponse.json().catch(() => ({}))
        const details = (errorBody as { details?: Array<{ path?: string; message?: string }> })
          ?.details
        const message =
          details?.length && details[0]?.message
            ? `Validation: ${details.map(d => d.message).join(', ')}`
            : (errorBody as { error?: string })?.error || 'Failed to save schedule cells'
        throw new Error(message)
      }

      // Update teacher assignments for each day/time slot combination
      // Fetch all schedules once at the start; use cache: 'no-store' so we see latest state
      // (e.g. after conflict resolution "remove from other" so we don't overwrite with stale data)
      const allSchedulesResponse = await fetch('/api/teacher-schedules', { cache: 'no-store' })
      if (!allSchedulesResponse.ok) {
        const errorBody = await allSchedulesResponse.json().catch(() => ({}))
        const detail =
          (errorBody as { error?: string; message?: string }).error ??
          (errorBody as { message?: string }).message ??
          allSchedulesResponse.statusText
        throw new Error(`Failed to fetch current teacher schedules${detail ? `: ${detail}` : ''}`)
      }
      const allSchedules = await allSchedulesResponse.json()

      const deletePromises: Promise<void>[] = []
      const createPromises: Promise<void>[] = []

      log(
        '[ScheduleSidePanel] Starting save - allAssignedTeachers:',
        allAssignedTeachers.map(t => ({
          name: t.name,
          teacher_id: t.teacher_id,
          is_floater: t.is_floater ?? false,
          is_flexible: t.is_flexible,
        }))
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
          log('[ScheduleSidePanel] Processing cell:', {
            updateDayId,
            updateTimeSlotId,
            currentSchedulesCount: currentSchedules.length,
          })

          const schedulesForThisSlot = currentSchedules

          {
            const newTeacherIds = new Set(allAssignedTeachers.map(t => t.teacher_id))

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
                        errorData.error ||
                          `Failed to delete teacher schedule: ${deleteResponse.statusText}`
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
              allAssignedTeachers.length,
              'teachers'
            )
            for (const teacher of allAssignedTeachers) {
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
                          errorData.error ||
                            `Failed to update teacher schedule: ${updateResponse.statusText}`
                        )
                      }
                      const updatedSchedule = await updateResponse.json().catch(() => null)
                      if (!updatedSchedule?.id) {
                        throw new Error(
                          `Failed to update teacher schedule ${teacherScheduleForThisSlot.id}: empty response`
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

      clearDataHealthCache()
      setHasUnsavedChanges(false)

      // Wait a moment for database to commit, then refresh and close
      // This ensures the refresh happens after data is saved
      await new Promise(resolve => setTimeout(resolve, 100))

      teacherCacheRef.current.clear()
      teachersLoadedRef.current = false
      preserveSelectedTeachersAfterConflictRef.current = false

      if (onSave) {
        await Promise.resolve(onSave())
      }

      // When launched from the read-only weekly cell panel, return to that panel after baseline save.
      if (readOnly && panelMode === 'editCell') {
        // Preserve the just-saved teacher/floater state in the read-only cell view
        // so we don't momentarily fall back to stale assignment snapshot data.
        const cacheKey = `${classroomId}|${dayId}|${timeSlotId}`
        teacherCacheRef.current.set(cacheKey, allAssignedTeachers)
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
      if (showUnsavedDialog) {
        setSaveErrorInDialog(message)
      } else {
        alert(`Failed to save: ${message}`)
      }
    } finally {
      setSaving(false)
      onSaveEnd?.()
    }
  }

  // After user confirms deactivate: state is updated (isActive false, teachers cleared); save and close.
  useEffect(() => {
    if (!pendingDeactivateAndCloseRef.current || isActive) return
    pendingDeactivateAndCloseRef.current = false
    void handleSave()
  }, [isActive])

  const handleDiscard = () => {
    setShowUnsavedDialog(false)
    setApplyConflictError(null)
    setSaveErrorInDialog(null)
    setHasUnsavedChanges(false)
    if (unsavedDialogReturnToCellRef.current) {
      unsavedDialogReturnToCellRef.current = false
      setPanelMode('cell')
    } else {
      onClose()
    }
  }

  const handleApplyScopeChange = (
    scope: 'single' | 'timeSlot' | 'day',
    dayIds: string[],
    timeSlotIds?: string[]
  ) => {
    setApplyConflictError(null)
    setApplyScope(scope)
    setApplyDayIds(dayIds)
    if (scope === 'day') {
      // Use the selected time slot IDs from the selector when provided; otherwise default to all
      if (timeSlotIds && timeSlotIds.length > 0) {
        setApplyTimeSlotIds(timeSlotIds)
      } else if (timeSlots.length > 0) {
        setApplyTimeSlotIds(timeSlots.map(ts => ts.id))
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

  const handleApplyConflictResolutions = async (
    resolutionsFromBanner?: Map<string, ConflictResolution>
  ) => {
    const resolutions = resolutionsFromBanner ?? conflictResolutions
    if (resolutions.size === 0) return

    setConflictResolutionApplying(true)
    try {
      // Set preserve ref immediately so any in-flight teacher fetch that completes during
      // resolve-conflict API calls will skip overwriting (they would overwrite with 0 or 1).
      preserveSelectedTeachersAfterConflictRef.current = true
      assignmentCountWhenPreserveSetRef.current = selectedCellData?.assignments?.length ?? -1
      const cellCacheKey = `${classroomId}|${dayId}|${timeSlotId}`
      teacherCacheRef.current.delete(cellCacheKey)

      const teachersToRemove: string[] = []

      // Resolve each conflict using passed resolutions (state may not have updated yet)
      for (const conflict of conflicts) {
        const resolution = resolutions.get(conflict.conflicting_schedule_id)
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

      // Build set of teacher ids to mark as floater (so chip dropdown shows "Floater")
      const teacherIdsMarkedFloater = new Set(
        conflicts
          .filter(c => resolutions.get(c.conflicting_schedule_id) === 'mark_floater')
          .map(c => c.teacher_id)
      )

      // Store for follow-up effect so chip shows Floater even if another effect overwrites selectedTeachers
      pendingFloaterIdsAfterResolutionRef.current = new Set(teacherIdsMarkedFloater)

      // Single state update: remove canceled teachers and set is_floater for mark_floater teachers (both permanent and flex lists)
      const matchFloaterId = (t: Teacher) =>
        (t.teacher_id && teacherIdsMarkedFloater.has(t.teacher_id)) ||
        (t.id && teacherIdsMarkedFloater.has(t.id))
      const filterRemoved = (prev: Teacher[]) =>
        teachersToRemove.length > 0
          ? prev.filter(t => t.teacher_id && !teachersToRemove.includes(t.teacher_id))
          : prev
      const applyFloaterTo = (prev: Teacher[]) =>
        teacherIdsMarkedFloater.size > 0
          ? prev.map(t => (matchFloaterId(t) ? { ...t, is_floater: true } : t))
          : prev
      setSelectedTeachers(prev => applyFloaterTo(filterRemoved(prev)))
      setSelectedFlexTeachers(prev => applyFloaterTo(filterRemoved(prev)))

      // Clear conflicts and resolutions
      setConflicts([])
      setConflictResolutions(new Map())

      // Refresh grid so UI shows updated assignments; use onRefresh so we don't close the panel
      if (onRefresh) await Promise.resolve(onRefresh())
    } catch (error) {
      console.error('Error resolving conflicts:', error)
      const message = error instanceof Error ? error.message : 'Failed to resolve conflicts'
      alert(`Failed to resolve conflicts: ${message}`)
    } finally {
      setConflictResolutionApplying(false)
    }
  }

  // Total enrollment for ratio: per-class sum if any class group has enrollment, else single enrollment field
  const enrollmentForCalculation = getTotalEnrollmentForCalculation(classGroups, enrollment)

  // Find class group with lowest min_age for ratio calculation
  const classGroupForRatio = pickClassGroupForRatio(classGroups)

  const formatAgeRange = useCallback(
    (group: { min_age: number | null; max_age: number | null; age_unit?: 'months' | 'years' }) => {
      const unit = group.age_unit ?? 'years'
      if (group.min_age !== null && group.max_age !== null) {
        return `${group.min_age}–${group.max_age} ${unit}`
      }
      if (group.min_age !== null) {
        return `${group.min_age}+ ${unit}`
      }
      if (group.max_age !== null) {
        return `Up to ${group.max_age} ${unit}`
      }
      return 'Not specified'
    },
    []
  )

  const sortedAbsences = sortAbsencesByTeacherName(selectedCellData?.absences ?? [])
  const {
    permanentAssignments: sortedPermanentAssignments,
    baselineFlexAssignments: sortedBaselineFlexAssignments,
    temporaryCoverageAssignments: sortedTemporaryCoverageAssignments,
    floaterAssignments: sortedFloaterAssignments,
  } = sortAssignmentsForPanel(selectedCellData?.assignments ?? [])
  const findSubLink = buildFindSubLink({
    absences: selectedCellData?.absences,
    assignments: selectedCellData?.assignments,
    cellDateISO: cellDateISO ?? (panelMode === 'flex' ? flexStartDate : null),
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

  const { requiredTeachers: calculatedRequired, preferredTeachers: calculatedPreferred } =
    calculateTeacherTargets({
      classGroupForRatio,
      enrollmentForCalculation,
    })

  const scheduledStaffCountFromCell = useMemo(() => {
    return calculateScheduledStaffCount({
      readOnly,
      assignments: selectedCellData?.assignments,
      selectedTeacherCount: allAssignedTeachers.length,
    })
  }, [readOnly, selectedCellData?.assignments, allAssignedTeachers.length])

  // When opened from dashboard (flex mode), use initial staffing so header shows target and scheduled
  const useInitialFlexStaffing =
    initialPanelMode === 'flex' &&
    (initialFlexRequiredStaff !== undefined || initialFlexScheduledStaff !== undefined)

  const requiredTeachers = useInitialFlexStaffing
    ? (initialFlexRequiredStaff ?? calculatedRequired)
    : requiredStaffOverride != null
      ? requiredStaffOverride
      : calculatedRequired
  const preferredTeachers = useInitialFlexStaffing
    ? (initialFlexPreferredStaff ?? calculatedPreferred)
    : preferredStaffOverride != null
      ? preferredStaffOverride
      : calculatedPreferred
  const scheduledStaffCount = useInitialFlexStaffing
    ? (initialFlexScheduledStaff ?? scheduledStaffCountFromCell)
    : scheduledStaffCountFromCell

  const staffingSummary = useMemo(() => {
    return buildStaffingSummary({
      requiredTeachers,
      preferredTeachers,
      scheduledStaffCount,
    })
  }, [requiredTeachers, preferredTeachers, scheduledStaffCount])

  const classGroupsSortedForDisplay = useMemo(
    () => sortClassGroupsBySettingsOrder(classGroups),
    [classGroups]
  )

  const staffingWarning = useMemo(
    () =>
      buildStaffingWarningMessage({
        staffingSummary,
        requiredTeachers,
        preferredTeachers,
        scheduledStaffCount,
        absences: sortedAbsences.map(a => ({ teacher_name: a.teacher_name, has_sub: a.has_sub })),
      }),
    [staffingSummary, requiredTeachers, preferredTeachers, scheduledStaffCount, sortedAbsences]
  )

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
                {classroomName} • {dayName} {timeSlotCode}
                {showDateInHeader && dayNameDateLabel ? ` • ${dayNameDateLabel}` : ''}{' '}
                {timeRange && `(${timeRange})`}
              </SheetTitle>
              <SheetDescription>
                {readOnly
                  ? 'View schedule details and take quick actions'
                  : 'Configure schedule cell settings and assignments'}
              </SheetDescription>
              {slotIsInactive && (
                <div className="mt-2 space-y-1.5 pt-4 pb-4">
                  {isParentEffectivelyInactive ? (
                    <>
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-900">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Inactive: {effectiveInactiveReasonLabel}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        To make this cell active, go to Baseline Schedule in Settings and make
                        Classroom and Time Slot Active.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-900">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        This slot is inactive
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Turn Slot status to Active below to assign teachers and make changes.
                      </p>
                    </>
                  )}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                {staffingSummary.status && (
                  <StaffingStatusBadge
                    status={staffingSummary.status}
                    label={staffingSummary.label}
                    size="sm"
                  />
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

          <div className="relative px-6">
            {/* Hide overlay when unsaved dialog is open so we don't show "Saving…" above the dialog */}
            {saving && !showUnsavedDialog && (
              <div
                className="sticky top-0 z-20 flex min-h-[100dvh] w-full items-center justify-center rounded-lg bg-white/50 backdrop-blur-[2px]"
                aria-live="polite"
                aria-busy="true"
              >
                <span className="px-4 py-2 text-sm font-medium text-slate-700">Saving…</span>
              </div>
            )}
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
                          Temporary Coverage
                        </p>
                        <h2 className="text-xl font-semibold text-slate-900">
                          {editingFlexEventId
                            ? 'Edit Temporary Coverage'
                            : 'Add Temporary Coverage'}
                        </h2>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingFlexEventId(null)
                          setEditingFlexStaffId(null)
                          setEditingFlexStaffName(null)
                          setEditingFlexCategory(null)
                          setEditFlexShiftCount(null)
                          setShowChangeStaffList(false)
                          initialPanelMode === 'flex' ? onClose() : setPanelMode('cell')
                        }}
                      >
                        {initialPanelMode === 'flex' ? 'Close' : 'Back'}
                      </Button>
                    </div>

                    {editingFlexEventId && editingFlexStaffName && (
                      <div
                        className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-slate-800"
                        role="status"
                      >
                        Editing coverage for{' '}
                        <span className="font-medium">{editingFlexStaffName}</span>
                        {' for '}
                        {[classroomName, dayName, timeSlotCode].filter(Boolean).join(' ')}
                        {flexStartDate && flexEndDate && (
                          <>
                            {' '}
                            (
                            {parseLocalDate(flexStartDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                            {' – '}
                            {parseLocalDate(flexEndDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                            )
                          </>
                        )}
                      </div>
                    )}

                    {(() => {
                      const fromDashboard =
                        initialPanelMode === 'flex' &&
                        initialFlexStartDate &&
                        initialFlexEndDate &&
                        initialFlexTargetType
                      const fromWeekly =
                        flexRunInfo?.belowTarget &&
                        flexRunInfo.dateStart &&
                        flexRunInfo.dateEnd &&
                        flexRunInfo.weeksLabel &&
                        flexRunInfo.targetType
                      if (!fromDashboard && !fromWeekly) return null
                      const slotName = [classroomName, dayName, timeSlotCode]
                        .filter(Boolean)
                        .join(' ')
                      const formatShort = (d: string) =>
                        parseLocalDate(d).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })
                      const weeksLabel = fromDashboard
                        ? getStaffingWeeksLabel(initialFlexStartDate!, initialFlexEndDate!)
                        : flexRunInfo!.weeksLabel!
                      const targetLabel = fromDashboard
                        ? initialFlexTargetType!
                        : flexRunInfo!.targetType!
                      const rangeStart = fromDashboard
                        ? initialFlexStartDate!
                        : flexRunInfo!.dateStart!
                      const rangeEnd = fromDashboard ? initialFlexEndDate! : flexRunInfo!.dateEnd!
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
                            Summary
                          </p>
                          <p className="text-sm text-slate-700">
                            {slotName} is below {targetLabel} target for the next {weeksLabel}.
                            Suggested coverage range: {formatShort(rangeStart)} –{' '}
                            {formatShort(rangeEnd)}.
                          </p>
                        </div>
                      )
                    })()}

                    <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-4">
                      {/* Feature flag: Break Coverage UI hidden when BREAK_COVERAGE_ENABLED is false. */}
                      {BREAK_COVERAGE_ENABLED && (
                        <div className="space-y-4 pb-6 border-b border-slate-100">
                          <Label>Coverage Type</Label>
                          <RadioGroup
                            value={flexCategory}
                            onValueChange={(val: string) =>
                              setFlexCategory(val as 'standard' | 'break')
                            }
                            className="flex items-center gap-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="standard" id="type-standard" />
                              <Label htmlFor="type-standard" className="font-normal cursor-pointer">
                                Extra Coverage
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="break" id="type-break" />
                              <Label htmlFor="type-break" className="font-normal cursor-pointer">
                                Break Coverage
                              </Label>
                            </div>
                          </RadioGroup>

                          {flexCategory === 'break' && (
                            <div className="mt-4 pt-4 border-t border-slate-100">
                              <div className="rounded-md bg-slate-50 border border-slate-200 p-4 space-y-4">
                                <div className="space-y-2">
                                  <Label htmlFor="covered_staff_id">
                                    Teacher taking break (optional)
                                  </Label>
                                  <Select
                                    value={flexCoveredStaffId || 'unspecified'}
                                    onValueChange={v =>
                                      setFlexCoveredStaffId(v === 'unspecified' ? '' : v)
                                    }
                                  >
                                    <SelectTrigger id="covered_staff_id">
                                      <SelectValue placeholder="Select teacher..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="unspecified">Unspecified</SelectItem>
                                      {selectedCellData?.assignments
                                        ?.filter(a => !a.is_substitute && !a.is_flexible)
                                        .map(t => (
                                          <SelectItem key={t.teacher_id} value={t.teacher_id}>
                                            {t.teacher_name}
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="break_start_time">Start Time (optional)</Label>
                                    <input
                                      type="time"
                                      id="break_start_time"
                                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                      value={flexStartTime}
                                      onChange={e => setFlexStartTime(e.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="break_end_time">End Time (optional)</Label>
                                    <input
                                      type="time"
                                      id="break_end_time"
                                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                      value={flexEndTime}
                                      onChange={e => setFlexEndTime(e.target.value)}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

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
                          <div className="flex flex-wrap gap-3 text-sm">
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
                            <p className="text-xs text-slate-500">
                              To apply to more days, please select a later End date.
                            </p>
                          )}
                          {hasInvalidFlexDayRange && (
                            <p className="text-xs text-amber-700">
                              Multiple days selected. Please choose a date range that contains these
                              days.
                            </p>
                          )}
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="flex_notes">Notes (optional)</Label>
                        <Textarea
                          id="flex_notes"
                          placeholder="e.g. Covering for Sarah's appointment"
                          value={flexNotes}
                          onChange={e => setFlexNotes(e.target.value)}
                          className="min-h-[80px] resize-y"
                          rows={2}
                        />
                      </div>
                    </div>

                    {isLongTermFlex && flexCategory !== 'break' && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                        <div className="flex gap-3">
                          <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0" />
                          <div>
                            <h4 className="text-sm font-semibold text-amber-800">
                              Long-term assignment detected
                            </h4>
                            <p className="mt-1 text-sm text-amber-700">
                              Assigning for a whole semester? You might want to do this in the{' '}
                              <Link
                                href={`/settings/baseline-schedule?classroom_id=${classroomId}&day_of_week_id=${dayId}&time_slot_id=${timeSlotId}`}
                                className="font-medium text-amber-800 underline hover:text-amber-900"
                              >
                                Baseline Schedule
                              </Link>{' '}
                              instead.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
                        {filteredFlexShiftMetrics.length > 0 && (
                          <button
                            type="button"
                            className="flex items-center rounded p-0.5 -m-0.5 hover:bg-slate-100"
                            onClick={() => setIsStaffingTargetsExpanded(prev => !prev)}
                            aria-expanded={isStaffingTargetsExpanded}
                          >
                            {isStaffingTargetsExpanded ? (
                              <ChevronUp className="h-4 w-4 text-slate-500 shrink-0" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
                            )}
                          </button>
                        )}
                        <span className="font-medium text-slate-900">
                          {totalFlexShiftCount} {totalFlexShiftCount === 1 ? 'shift' : 'shifts'}{' '}
                          selected
                        </span>
                        <span className="text-slate-400" aria-hidden>
                          •
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-500">
                          Below required:{' '}
                          {flexAvailabilityLoading
                            ? '—'
                            : `${flexBelowRequiredCount} ${
                                flexBelowRequiredCount === 1 ? 'shift' : 'shifts'
                              }`}
                          {!flexAvailabilityLoading && flexBelowRequiredCount > 0 && (
                            <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                          )}
                        </span>
                        <span className="text-slate-400" aria-hidden>
                          •
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-500">
                          Below preferred:{' '}
                          {flexAvailabilityLoading
                            ? '—'
                            : `${flexBelowPreferredCount} ${
                                flexBelowPreferredCount === 1 ? 'shift' : 'shifts'
                              }`}
                          {!flexAvailabilityLoading && flexBelowPreferredCount > 0 && (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                          )}
                        </span>
                      </div>
                      {flexAvailabilityLoading && (
                        <p className="text-xs text-slate-400">Loading staffing targets...</p>
                      )}
                      {filteredFlexShiftMetrics.length > 0 && isStaffingTargetsExpanded && (
                        <div className="pt-3">
                          {filteredFlexShiftMetrics.map((metric, index) => (
                            <div
                              key={`${metric.date}-${metric.time_slot_id}-${metric.classroom_id}`}
                              className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                                index > 0 ? 'border-t border-slate-100' : ''
                              }`}
                            >
                              <div>
                                <p className="font-medium text-slate-900">
                                  {new Date(`${metric.date}T00:00:00`).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                  })}{' '}
                                  • {metric.time_slot_code}
                                </p>
                                {metric.classroom_name && (
                                  <p className="text-xs text-slate-500">{metric.classroom_name}</p>
                                )}
                              </div>
                              <div className="pt-1 text-right text-xs text-slate-500 space-y-2">
                                {(() => {
                                  const preferred =
                                    metric.preferred_staff ?? metric.required_staff ?? 0
                                  const isAboveTarget =
                                    metric.status === 'ok' && metric.scheduled_staff > preferred
                                  const badgeStatus =
                                    metric.status === 'below_required'
                                      ? ('below_required' as const)
                                      : metric.status === 'below_preferred'
                                        ? ('below_preferred' as const)
                                        : isAboveTarget
                                          ? ('above_target' as const)
                                          : ('adequate' as const)
                                  const badgeLabel =
                                    metric.status === 'below_required'
                                      ? `Below Required by ${Math.max(
                                          0,
                                          (metric.required_staff ?? 0) - metric.scheduled_staff
                                        )}`
                                      : metric.status === 'below_preferred'
                                        ? `Below Preferred by ${Math.max(
                                            0,
                                            preferred - metric.scheduled_staff
                                          )}`
                                        : isAboveTarget
                                          ? 'Above target'
                                          : 'On target'
                                  return (
                                    <StaffingStatusBadge
                                      status={badgeStatus}
                                      label={badgeLabel}
                                      size="sm"
                                    />
                                  )
                                })()}
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

                    {flexAvailabilityError && (
                      <p className="text-sm text-destructive">{flexAvailabilityError}</p>
                    )}
                    {flexError && <p className="text-sm text-destructive">{flexError}</p>}

                    {editingFlexEventId && !showChangeStaffList ? (
                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">
                              Currently assigned
                            </p>
                            <p className="text-sm font-medium text-slate-900 mt-0.5">
                              {editingFlexStaffName ?? 'Unknown'}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="teal"
                            size="sm"
                            onClick={() => setShowChangeStaffList(true)}
                          >
                            Change Staff
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {(!editingFlexEventId || showChangeStaffList) && flexAvailabilityLoading ? (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Loading staff for temporary coverage...
                        </p>
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
                    ) : (!editingFlexEventId || showChangeStaffList) &&
                      flexStaffWithCounts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No staff found for temporary coverage.
                      </p>
                    ) : !editingFlexEventId || showChangeStaffList ? (
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
                                  const matchPercent =
                                    staff.totalCount > 0
                                      ? Math.round((staff.availableCount / staff.totalCount) * 100)
                                      : 0
                                  return (
                                    <div
                                      key={staff.id}
                                      className="rounded-lg border border-slate-200 bg-white p-4"
                                    >
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-medium text-slate-900">
                                              {staff.name}
                                            </p>
                                            {staff.totalCount > 0 && (
                                              <span
                                                className={cn(
                                                  'inline-flex shrink-0 items-center gap-1.5 text-sm font-medium tabular-nums',
                                                  matchPercent === 100
                                                    ? 'text-emerald-800'
                                                    : 'text-amber-700'
                                                )}
                                                aria-label={`Available for ${staff.availableCount} of ${staff.totalCount} shifts`}
                                              >
                                                {matchPercent === 100 ? (
                                                  <CheckCircle
                                                    className="h-4 w-4 shrink-0 text-emerald-700"
                                                    aria-hidden
                                                  />
                                                ) : (
                                                  <CheckCircle
                                                    className="h-4 w-4 shrink-0 text-amber-500"
                                                    aria-hidden
                                                  />
                                                )}
                                                {matchPercent}% match
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-xs text-slate-500">
                                            Available for {staff.availableCount}/{staff.totalCount}{' '}
                                            shifts
                                          </p>
                                        </div>
                                        {!isExpanded && (
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="teal"
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
                                        )}
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

                                          <div className="flex justify-end gap-2">
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="ghost"
                                              className="text-slate-700 hover:bg-transparent hover:text-slate-900"
                                              onClick={() => {
                                                setExpandedFlexStaffId(prev =>
                                                  prev === staff.id ? null : prev
                                                )
                                                setFlexAssignModes(prev => ({
                                                  ...prev,
                                                  [staff.id]: 'all',
                                                }))
                                                setFlexSelectedShiftKeys(prev => ({
                                                  ...prev,
                                                  [staff.id]: staff.availableShiftKeys,
                                                }))
                                              }}
                                            >
                                              Cancel
                                            </Button>
                                            <Button
                                              type="button"
                                              size="sm"
                                              disabled={flexSaving || hasInvalidFlexDayRange}
                                              onClick={() => {
                                                const keys =
                                                  assignMode === 'all'
                                                    ? staff.availableShiftKeys
                                                    : selectedKeys
                                                handleCreateFlexAssignment(staff.id, keys)
                                              }}
                                            >
                                              {flexSaving ? 'Confirming...' : 'Confirm assignment'}
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
                    ) : null}
                  </div>
                )}
                {panelMode === 'cell' && readOnly && (
                  <div className="space-y-6">
                    {staffingWarning && (
                      <div
                        className="rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium"
                        style={
                          staffingWarning.status === 'below_required'
                            ? {
                                borderLeftWidth: '4px',
                                borderLeftColor: staffingColorValues.below_required.border,
                                borderLeftStyle: 'solid',
                                color: staffingColorValues.below_required.text,
                              }
                            : staffingWarning.status === 'below_preferred'
                              ? {
                                  borderLeftWidth: '4px',
                                  borderLeftColor: staffingColorValues.below_preferred.border,
                                  borderLeftStyle: 'solid',
                                  color: staffingColorValues.below_preferred.text,
                                }
                              : staffingWarning.status === 'above_target'
                                ? {
                                    borderLeftWidth: '4px',
                                    borderLeftColor: staffingColorValues.above_target.border,
                                    borderLeftStyle: 'solid',
                                    color: staffingColorValues.above_target.text,
                                  }
                                : {
                                    borderLeftWidth: '4px',
                                    borderLeftColor: 'rgb(34, 197, 94)',
                                    borderLeftStyle: 'solid',
                                    color: 'rgb(22, 101, 52)',
                                  }
                        }
                      >
                        {staffingWarning.message}
                      </div>
                    )}
                    {/* Single staff card: Absence → Sub → Permanent → Flex → Temporary Coverage → Floater */}
                    <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-4">
                      <h3 className="text-sm font-semibold text-slate-900">Staff Assignments</h3>
                      <div className="space-y-2">
                        {sortedAbsences.length > 0 &&
                          sortedAbsences.map(
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
                                  <div className="flex items-center justify-between rounded-md border border-gray-300 bg-gray-100 px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-semibold text-gray-800">
                                        {absence.teacher_name}
                                      </span>
                                      <span className="inline-flex items-center rounded-full border border-gray-300 bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-700">
                                        Absent
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        type="button"
                                        variant="teal"
                                        size="sm"
                                        className="h-8 px-2.5 text-sm"
                                        onClick={() => router.push('/time-off')}
                                        disabled={slotIsInactive}
                                      >
                                        Edit Time Off
                                      </Button>
                                      {!absence.has_sub && (
                                        <Button
                                          type="button"
                                          variant="teal"
                                          size="sm"
                                          className="h-8 px-2.5"
                                          onClick={() => router.push(findSubLink)}
                                          disabled={slotIsInactive}
                                        >
                                          Find Sub
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  {subsForAbsence.length > 0 &&
                                    subsForAbsence.map(sub => (
                                      <div
                                        key={sub.id}
                                        className="flex items-center justify-between rounded-md border border-teal-200 bg-teal-50 px-3 py-2 ml-2"
                                      >
                                        <div className="flex items-center gap-2">
                                          <CornerDownRight className="h-4 w-4 text-slate-400" />
                                          <span className="text-sm font-semibold text-teal-700">
                                            {sub.teacher_name}
                                          </span>
                                          <span className="inline-flex items-center rounded-full border border-teal-300 bg-teal-100 px-2 py-0.5 text-[10px] font-medium text-teal-700">
                                            Sub
                                          </span>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="teal"
                                          size="sm"
                                          className="h-8 px-2.5"
                                          onClick={() => router.push(findSubLink)}
                                          disabled={slotIsInactive}
                                        >
                                          Change Sub
                                        </Button>
                                      </div>
                                    ))}
                                </div>
                              )
                            }
                          )}
                        {sortedPermanentAssignments.length > 0 &&
                          sortedPermanentAssignments.map(assignment => (
                            <div
                              key={assignment.id}
                              className="flex items-center justify-between rounded-md border border-blue-300 bg-blue-100 px-3 py-2"
                              style={{ borderColor: '#93c5fd' }}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-blue-800">
                                  {assignment.teacher_name}
                                </span>
                                <span className="inline-flex items-center rounded-full border border-blue-300 bg-blue-200 px-2 py-0.5 text-[10px] font-medium text-blue-800">
                                  Permanent
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {(cellDateISO ?? flexStartDate) && (
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
                                    onClick={() => openFindSub(assignment.teacher_id)}
                                    disabled={slotIsInactive}
                                  >
                                    <UserSearch className="h-3.5 w-3.5" />
                                    Find Sub
                                  </Button>
                                )}
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
                                  disabled={slotIsInactive}
                                >
                                  <CalendarPlus className="h-3.5 w-3.5" />
                                  Add Time Off
                                </Button>
                              </div>
                            </div>
                          ))}
                        {sortedBaselineFlexAssignments.length > 0 &&
                          sortedBaselineFlexAssignments.map(assignment => (
                            <div
                              key={assignment.id}
                              className="flex items-center justify-between rounded-md border border-blue-500 border-dashed bg-blue-50 px-3 py-2"
                              style={{ borderColor: '#3b82f6' }}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-blue-800">
                                  {assignment.teacher_name}
                                </span>
                                <span className="inline-flex items-center rounded-full border border-blue-400 bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800">
                                  Flex
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {(cellDateISO ?? flexStartDate) && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="h-8 gap-1.5 rounded-md bg-white px-3 font-medium text-teal-700 hover:bg-teal-50 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-0"
                                    onClick={() => openFindSub(assignment.teacher_id)}
                                    disabled={slotIsInactive}
                                  >
                                    <UserSearch className="h-3.5 w-3.5" />
                                    Find Sub
                                  </Button>
                                )}
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
                                  disabled={slotIsInactive}
                                >
                                  <CalendarPlus className="h-3.5 w-3.5" />
                                  Add Time Off
                                </Button>
                              </div>
                            </div>
                          ))}
                        {sortedTemporaryCoverageAssignments.length > 0 &&
                          sortedTemporaryCoverageAssignments.map(assignment => (
                            <div
                              key={assignment.id}
                              className="flex items-center justify-between rounded-md border border-dashed px-3 py-2"
                              style={{
                                borderColor: '#f9a8d4',
                                backgroundColor: '#fdf2f8',
                              }}
                            >
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="text-sm font-semibold"
                                    style={{ color: '#db2777' }}
                                  >
                                    {assignment.teacher_name}
                                  </span>
                                  <span
                                    className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium"
                                    style={{
                                      borderColor: '#f9a8d4',
                                      backgroundColor: '#fdf2f8',
                                      color: '#db2777',
                                    }}
                                  >
                                    Temporary
                                  </span>
                                </div>
                                {assignment.notes?.trim() ? (
                                  <p
                                    className="text-xs italic text-slate-600"
                                    title={assignment.notes}
                                  >
                                    {assignment.notes}
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-8 px-2.5 text-red-600 hover:bg-red-50 hover:text-red-700"
                                  onClick={() => {
                                    void handleOpenRemoveFlexDialog(assignment)
                                  }}
                                  disabled={slotIsInactive}
                                >
                                  Remove
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-8 gap-1.5 border-0 bg-transparent px-2.5 text-teal-700 shadow-none hover:bg-teal-50 hover:text-teal-800"
                                  onClick={() => {
                                    void handleOpenEditFlex(assignment)
                                  }}
                                  disabled={slotIsInactive}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Edit
                                </Button>
                                {(cellDateISO ?? flexStartDate) && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="h-8 gap-1.5 rounded-md bg-white px-3 font-medium text-teal-700 hover:bg-teal-50 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-0"
                                    onClick={() => openFindSub(assignment.teacher_id)}
                                    disabled={slotIsInactive}
                                  >
                                    <UserSearch className="h-3.5 w-3.5" />
                                    Find Sub
                                  </Button>
                                )}
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
                                  disabled={slotIsInactive}
                                >
                                  <CalendarPlus className="h-3.5 w-3.5" />
                                  Add Time Off
                                </Button>
                              </div>
                            </div>
                          ))}
                        {sortedFloaterAssignments.length > 0 &&
                          sortedFloaterAssignments.map(assignment => (
                            <div
                              key={assignment.id}
                              className="flex items-center justify-between rounded-md border border-purple-300 border-dashed bg-purple-100 px-3 py-2"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-purple-800">
                                  {assignment.teacher_name}
                                </span>
                                <span className="inline-flex items-center rounded-full border border-purple-300 bg-purple-200 px-2 py-0.5 text-[10px] font-medium text-purple-800">
                                  Floater
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {(cellDateISO ?? flexStartDate) && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="h-8 gap-1.5 rounded-md bg-white px-3 font-medium text-teal-700 hover:bg-teal-50 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-0"
                                    onClick={() => openFindSub(assignment.teacher_id)}
                                    disabled={slotIsInactive}
                                  >
                                    <UserSearch className="h-3.5 w-3.5" />
                                    Find Sub
                                  </Button>
                                )}
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
                                  disabled={slotIsInactive}
                                >
                                  <CalendarPlus className="h-3.5 w-3.5" />
                                  Add Time Off
                                </Button>
                              </div>
                            </div>
                          ))}
                        {sortedAbsences.length === 0 &&
                          sortedPermanentAssignments.length === 0 &&
                          sortedBaselineFlexAssignments.length === 0 &&
                          sortedTemporaryCoverageAssignments.length === 0 &&
                          sortedFloaterAssignments.length === 0 && (
                            <p className="text-sm text-muted-foreground py-2">
                              No staff assigned for this slot.
                            </p>
                          )}
                      </div>

                      <div className="border-t border-gray-200 pt-4 mt-4">
                        <div className="flex items-center justify-between gap-4">
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-auto px-0 text-sm text-slate-500 hover:text-slate-700 shrink-0"
                            onClick={() => setShowBaselineEditDialog(true)}
                            disabled={slotIsInactive}
                          >
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Edit baseline staff
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="h-9 rounded-md px-3.5 shadow-sm hover:opacity-95 focus-visible:outline-none focus-visible:ring-0 shrink-0"
                            style={{ backgroundColor: '#14b8a6', color: '#ffffff' }}
                            onClick={() => setPanelMode('flex')}
                            disabled={slotIsInactive}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add Temporary Coverage
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-900">
                          Class Groups, Enrollment & Ratios
                        </h3>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground">Class groups:</span>
                          {classGroupsSortedForDisplay.length > 0 ? (
                            classGroupsSortedForDisplay.map(group => (
                              <span
                                key={group.id}
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  group.is_active === false
                                    ? 'border border-slate-200 bg-slate-50 text-slate-500'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {group.name}
                                {group.is_active === false ? ' (Inactive)' : ''}
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
                        {classGroupForRatio && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-muted-foreground">Ratios:</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                              Required 1:{classGroupForRatio.required_ratio}
                            </span>
                            {classGroupForRatio.preferred_ratio != null && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                                Preferred 1:{classGroupForRatio.preferred_ratio}
                              </span>
                            )}
                          </div>
                        )}
                        {classGroups.some(group => group.is_active === false) && (
                          <div className="text-xs text-slate-500">
                            Includes inactive class groups
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto px-0 text-sm text-slate-500 hover:text-slate-700"
                        onClick={() => {
                          router.push(
                            `/settings/baseline-schedule?classroom_id=${classroomId}&day_of_week_id=${dayId}&time_slot_id=${timeSlotId}&return_to_weekly=true`
                          )
                        }}
                        disabled={slotIsInactive}
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Edit class groups, enrollment & ratios
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
                    <div
                      className={`rounded-lg border border-gray-200 p-6 space-y-1 ${
                        !isActive ? 'bg-slate-100' : 'bg-white'
                      }`}
                    >
                      <SlotStatusToggle
                        isActive={effectiveIsActive}
                        disabled={isParentEffectivelyInactive}
                        onToggle={newActive => {
                          if (isParentEffectivelyInactive) return
                          if (isActive && !newActive) {
                            // Show confirmation when deactivating
                            setShowDeactivateDialog(true)
                          } else {
                            setIsActive(newActive)
                          }
                        }}
                      />
                      <div className="mt-0">
                        {isParentEffectivelyInactive ? (
                          <div className="space-y-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                            <p className="text-xs font-medium text-amber-900">
                              This cell is locked because parent settings are inactive
                              {effectiveInactiveReasonLabel
                                ? ` (${effectiveInactiveReasonLabel})`
                                : ''}
                              .
                            </p>
                            <p className="text-xs text-amber-800 leading-relaxed">
                              To make this cell active, go to Settings → Baseline Schedule and set
                              both Classroom and Time Slot to Active.
                            </p>
                          </div>
                        ) : isActive ? (
                          <p className="text-sm text-muted-foreground whitespace-nowrap">
                            This slot requires staffing and will be validated
                          </p>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground whitespace-nowrap">
                              Inactive slots are ignored for staffing and substitutes
                            </p>
                            <p className="text-sm font-medium text-slate-700">
                              To assign teachers and make changes, turn Slot status to Active above.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Section B: Class Group Selection */}
                    <div
                      className={`rounded-lg bg-white border border-gray-200 p-6 space-y-2 ${fieldsDisabled ? 'opacity-60' : ''}`}
                    >
                      <Label
                        htmlFor="class-group-select"
                        className="text-base font-medium mb-6 block"
                      >
                        Class Groups
                      </Label>
                      <ClassSelector
                        selectedClassIds={classGroupIds}
                        disablePortal
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
                          classroomId && allowedClassGroupIdsLoaded
                            ? allowedClassGroupIds
                            : undefined
                        }
                        includeInactive
                        disabled={fieldsDisabled}
                      />
                      <div className="pt-2 pb-3 border-b border-gray-200"></div>
                      {isActive && classGroupIds.length === 0 && (
                        <p className="text-sm text-yellow-600">
                          At least one class group is required when slot is active
                        </p>
                      )}

                      {/* Age and Ratios Display */}
                      {classGroups.length > 0 && classGroupForRatio && (
                        <div className="space-y-2 text-base pt-1">
                          {/* Age Range (from lowest min_age) */}
                          <div className="flex items-center gap-2">
                            <div className="text-muted-foreground">Age (lowest):</div>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                              {formatAgeRange(classGroupForRatio)}
                            </span>
                          </div>

                          {/* Ratios (from lowest min_age class group) */}
                          <div className="flex items-center gap-2">
                            <div className="text-muted-foreground">Ratios:</div>
                            <div className="flex flex-wrap gap-2">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                                Required 1:{classGroupForRatio.required_ratio}
                              </span>
                              {classGroupForRatio.preferred_ratio && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                                  Preferred 1:{classGroupForRatio.preferred_ratio}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground pt-0.5">
                            To update age and ratios, go to{' '}
                            <Link
                              href="/settings/classes"
                              className="text-teal-700 underline underline-offset-2 hover:text-teal-800"
                            >
                              Settings → Class Groups
                            </Link>
                            .
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Section C: Enrollment */}
                    <div
                      className={`rounded-lg bg-white border border-gray-200 p-6 space-y-2 ${fieldsDisabled ? 'opacity-60' : ''}`}
                    >
                      <Label htmlFor="enrollment" className="text-base font-medium mb-6 block">
                        Enrollment (for staffing)
                      </Label>
                      {classGroupsSortedForDisplay.length > 1 ? (
                        <>
                          <RadioGroup
                            value={enrollmentMode}
                            onValueChange={(value: 'total' | 'by_class_group') => {
                              setEnrollmentMode(value)
                              if (value === 'total' && enrollmentForCalculation != null) {
                                handleEnrollmentChange(enrollmentForCalculation)
                              }
                            }}
                            className="flex flex-row gap-4 pt-1"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="total"
                                id="enrollment-mode-total"
                                disabled={fieldsDisabled}
                              />
                              <Label
                                htmlFor="enrollment-mode-total"
                                className="text-sm font-normal cursor-pointer"
                              >
                                By total
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="by_class_group"
                                id="enrollment-mode-by-class"
                                disabled={fieldsDisabled}
                              />
                              <Label
                                htmlFor="enrollment-mode-by-class"
                                className="text-sm font-normal cursor-pointer"
                              >
                                By class group
                              </Label>
                            </div>
                          </RadioGroup>
                          {enrollmentMode === 'total' ? (
                            <div className="space-y-1 pt-2">
                              <EnrollmentInput
                                value={enrollment}
                                onChange={handleEnrollmentChange}
                                disabled={fieldsDisabled}
                                hideLabel
                              />
                            </div>
                          ) : (
                            <div className="space-y-2 pt-1">
                              <p className="text-xs text-muted-foreground mb-3">
                                Enter per group for &quot;Toddler A (3), Toddler B (2)&quot; display
                                in the grid.
                              </p>
                              <div className="grid gap-2">
                                {classGroupsSortedForDisplay.map(group => (
                                  <div key={group.id} className="flex items-center gap-3">
                                    <Label
                                      htmlFor={`enrollment-${group.id}`}
                                      className="min-w-[120px] text-sm"
                                    >
                                      {group.name}
                                    </Label>
                                    <Input
                                      id={`enrollment-${group.id}`}
                                      type="number"
                                      min={0}
                                      value={group.enrollment ?? ''}
                                      onChange={e => {
                                        const raw = e.target.value
                                        const value =
                                          raw === '' ? null : Math.max(0, parseInt(raw, 10) || 0)
                                        setClassGroups(prev =>
                                          prev.map(cg =>
                                            cg.id === group.id ? { ...cg, enrollment: value } : cg
                                          )
                                        )
                                      }}
                                      disabled={fieldsDisabled}
                                      placeholder="—"
                                      className="w-20"
                                    />
                                  </div>
                                ))}
                              </div>
                              <div className="text-sm text-muted-foreground pt-1">
                                Total for ratio: {enrollmentForCalculation ?? '—'}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <EnrollmentInput
                          value={enrollment}
                          onChange={handleEnrollmentChange}
                          disabled={fieldsDisabled}
                          hideLabel
                        />
                      )}
                      <div className="pt-2 pb-3 border-b border-gray-200"></div>

                      {/* Staffing requirements: auto-calculated + optional override */}
                      {classGroupForRatio &&
                        enrollmentForCalculation != null &&
                        enrollmentForCalculation > 0 && (
                          <div className="space-y-3 pt-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-muted-foreground">Auto-calculated:</span>
                              {calculatedRequired !== undefined && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                                  Required: {calculatedRequired} Teacher
                                  {calculatedRequired !== 1 ? 's' : ''}
                                </span>
                              )}
                              {calculatedPreferred !== undefined && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                                  Preferred: {calculatedPreferred} Teacher
                                  {calculatedPreferred !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <Switch
                                id="override-staffing"
                                checked={
                                  requiredStaffOverride != null || preferredStaffOverride != null
                                }
                                onCheckedChange={checked => {
                                  if (!checked) {
                                    setRequiredStaffOverride(null)
                                    setPreferredStaffOverride(null)
                                  } else {
                                    setRequiredStaffOverride(calculatedRequired ?? null)
                                    setPreferredStaffOverride(calculatedPreferred ?? null)
                                  }
                                }}
                              />
                              <Label
                                htmlFor="override-staffing"
                                className="text-sm font-normal cursor-pointer"
                              >
                                Override calculated staffing requirements
                              </Label>
                            </div>
                            {(requiredStaffOverride != null || preferredStaffOverride != null) && (
                              <div className="flex flex-wrap items-center gap-4 pl-2">
                                <div className="flex items-center gap-2">
                                  <Label htmlFor="override-required" className="text-sm">
                                    Required
                                  </Label>
                                  <Input
                                    id="override-required"
                                    type="number"
                                    min={0}
                                    value={requiredStaffOverride ?? ''}
                                    onChange={e => {
                                      const raw = e.target.value
                                      setRequiredStaffOverride(
                                        raw === '' ? null : Math.max(0, parseInt(raw, 10) || 0)
                                      )
                                    }}
                                    disabled={fieldsDisabled}
                                    className="w-20"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <Label htmlFor="override-preferred" className="text-sm">
                                    Preferred
                                  </Label>
                                  <Input
                                    id="override-preferred"
                                    type="number"
                                    min={0}
                                    value={preferredStaffOverride ?? ''}
                                    onChange={e => {
                                      const raw = e.target.value
                                      setPreferredStaffOverride(
                                        raw === '' ? null : Math.max(0, parseInt(raw, 10) || 0)
                                      )
                                    }}
                                    disabled={fieldsDisabled}
                                    className="w-20"
                                  />
                                </div>
                              </div>
                            )}
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
                      {isLoadingTeachers && allAssignedTeachers.length === 0 && (
                        <div className="text-sm text-muted-foreground mb-3">
                          Loading assigned teachers…
                        </div>
                      )}
                      <TeacherMultiSelect
                        selectedTeachers={allAssignedTeachers}
                        onTeachersChange={handleAssignedTeachersChange}
                        requiredCount={classGroupIds.length > 0 ? requiredTeachers : undefined}
                        preferredCount={classGroupIds.length > 0 ? preferredTeachers : undefined}
                        disabled={fieldsDisabled}
                      />

                      {/* Warning message when teachers are assigned but no class groups */}
                      {classGroupIds.length === 0 && allAssignedTeachers.length > 0 && (
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
                            applying={conflictResolutionApplying}
                          />
                        </div>
                      )}
                    </div>

                    {/* Section F: Notes (hidden for inactive cells) */}
                    {isActive && (
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
                          className="text-base min-h-[80px]"
                        />
                      </div>
                    )}

                    {/* Section G: Apply Changes To */}
                    <div className="rounded-lg bg-blue-50/30 border-l-4 border-l-blue-500 border border-gray-200 p-6 mt-16">
                      <MultiDayApplySelector
                        currentDayId={dayId}
                        currentDayName={dayName}
                        currentTimeSlotCode={timeSlotCode}
                        currentTimeSlotId={timeSlotId}
                        currentClassroomName={classroomName}
                        selectedDayIds={scheduleDayIdsFromSettings ?? selectedDayIds}
                        timeSlots={timeSlots}
                        disabled={slotIsInactive}
                        onApplyScopeChange={handleApplyScopeChange}
                      />
                      {applyConflictError && (
                        <p className="mt-3 text-sm text-destructive font-medium" role="alert">
                          {applyConflictError}
                        </p>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="space-y-2 pt-4 pb-6 border-t">
                      {/* Warning if below required staffing */}
                      {isActive &&
                        classGroups.length > 0 &&
                        enrollmentForCalculation != null &&
                        enrollmentForCalculation > 0 &&
                        requiredTeachers !== undefined &&
                        allAssignedTeachers.length < requiredTeachers && (
                          <p className="text-xs text-muted-foreground italic text-right">
                            This slot will be saved below required staffing
                          </p>
                        )}
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            if (readOnly && panelMode === 'editCell') {
                              if (hasUnsavedChanges) {
                                unsavedDialogReturnToCellRef.current = true
                                setShowUnsavedDialog(true)
                              } else {
                                setPanelMode('cell')
                              }
                            } else {
                              handleClose()
                            }
                          }}
                          disabled={saving}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSave}
                          disabled={
                            saving ||
                            isParentEffectivelyInactive ||
                            conflicts.length > 0 ||
                            !!applyConflictError
                          }
                        >
                          {saving
                            ? 'Saving...'
                            : returnToWeekly
                              ? 'Save & Return to Weekly Schedule'
                              : 'Save'}
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
        onCancel={() => {
          setShowUnsavedDialog(false)
          setApplyConflictError(null)
          setSaveErrorInDialog(null)
          unsavedDialogReturnToCellRef.current = false
        }}
        saving={saving}
        saveError={applyConflictError || saveErrorInDialog}
        blockSaveReason={
          conflicts.length > 0 ? 'Resolve scheduling conflicts in the panel before saving.' : null
        }
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
                pendingDeactivateAndCloseRef.current = true
                setIsActive(false)
                setSelectedTeachers([])
                setSelectedFlexTeachers([])
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
            <DialogTitle>Edit class groups, enrollment & ratios?</DialogTitle>
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
            <DialogTitle>Remove temporary coverage?</DialogTitle>
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
      <Dialog
        open={showSaveScopeDialog}
        onOpenChange={open => {
          if (!open) {
            setShowSaveScopeDialog(false)
            setPendingFlexSave(null)
            setSaveScopeDialogMode('scope')
          }
        }}
      >
        <DialogContent>
          {saveScopeDialogMode === 'confirm_single' ? (
            <>
              <DialogHeader>
                <DialogTitle>Confirm change</DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-2">
                    {(() => {
                      const newStaffName =
                        pendingFlexSave &&
                        (flexAvailability.find(s => s.id === pendingFlexSave.staffId)?.name ??
                          'selected staff')
                      const staffChanged =
                        editingFlexStaffName !== newStaffName &&
                        (editingFlexStaffName || newStaffName)
                      // When Break Coverage is disabled, do not show coverage-type change in confirm dialog.
                      const categoryChanged =
                        BREAK_COVERAGE_ENABLED &&
                        editingFlexCategory !== null &&
                        editingFlexCategory !== flexCategory
                      const dateLabel =
                        flexStartDate && flexEndDate
                          ? flexStartDate === flexEndDate
                            ? parseLocalDate(flexStartDate).toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                              })
                            : `${parseLocalDate(flexStartDate).toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                              })} – ${parseLocalDate(flexEndDate).toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                              })}`
                          : ''
                      const locationLabel = [classroomName, dayName, timeSlotCode, dateLabel]
                        .filter(Boolean)
                        .join(' ')
                      if (staffChanged && categoryChanged) {
                        const oldCat = editingFlexCategory === 'break' ? 'Break' : 'Extra'
                        const newCat = flexCategory === 'break' ? 'Break' : 'Extra'
                        return (
                          <>
                            <p>
                              Changed from{' '}
                              <span className="underline">
                                {editingFlexStaffName ?? 'unassigned'} to {newStaffName}
                              </span>{' '}
                              for {locationLabel}.
                            </p>
                            <p>
                              Changed from{' '}
                              <span className="underline">
                                {oldCat} to {newCat}
                              </span>{' '}
                              coverage for {locationLabel}.
                            </p>
                          </>
                        )
                      }
                      if (staffChanged) {
                        return (
                          <p>
                            Changed from{' '}
                            <span className="underline">
                              {editingFlexStaffName ?? 'unassigned'} to {newStaffName}
                            </span>{' '}
                            for {locationLabel}.
                          </p>
                        )
                      }
                      if (categoryChanged) {
                        const oldLabel = editingFlexCategory === 'break' ? 'Break' : 'Extra'
                        const newLabel = flexCategory === 'break' ? 'Break' : 'Extra'
                        return (
                          <p>
                            Changed from{' '}
                            <span className="underline">
                              {oldLabel} to {newLabel}
                            </span>{' '}
                            coverage for {locationLabel}.
                          </p>
                        )
                      }
                      return (
                        <p>
                          Apply your changes to this shift
                          {locationLabel ? ` for ${locationLabel}` : ''}.
                        </p>
                      )
                    })()}
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSaveScopeDialog(false)
                    setPendingFlexSave(null)
                    setSaveScopeDialogMode('scope')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    void handleConfirmSaveScope()
                  }}
                  disabled={flexSaving}
                >
                  {flexSaving ? 'Saving...' : 'Confirm'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Apply these changes to</DialogTitle>
                <DialogDescription>
                  Choose how to apply your temporary coverage update.
                </DialogDescription>
              </DialogHeader>
              {(() => {
                const todayLocal = new Date(
                  new Date().getFullYear(),
                  new Date().getMonth(),
                  new Date().getDate()
                )
                const hasPastDates = !!flexStartDate && parseLocalDate(flexStartDate) < todayLocal
                return (
                  <RadioGroup
                    value={saveScopeChoice}
                    onValueChange={(v: string) =>
                      setSaveScopeChoice(v as 'single_shift' | 'future_shifts' | 'all_shifts')
                    }
                    className="space-y-3 py-2"
                  >
                    {hasPastDates && (
                      <>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="single_shift" id="scope-single" />
                          <Label htmlFor="scope-single" className="font-normal cursor-pointer">
                            This shift only
                            {cellDateISO && (
                              <span className="block text-xs text-slate-500 mt-0.5">
                                {parseLocalDate(cellDateISO).toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                })}{' '}
                                • {classroomName} • {timeSlotCode}
                              </span>
                            )}
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="future_shifts" id="scope-future" />
                          <Label htmlFor="scope-future" className="font-normal cursor-pointer">
                            This and following shifts
                            {(cellDateISO ?? flexStartDate) && (
                              <span className="block text-xs text-slate-500 mt-0.5">
                                From{' '}
                                {parseLocalDate(cellDateISO ?? flexStartDate!).toLocaleDateString(
                                  'en-US',
                                  {
                                    month: 'short',
                                    day: 'numeric',
                                  }
                                )}{' '}
                                onward
                              </span>
                            )}
                          </Label>
                        </div>
                      </>
                    )}
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all_shifts" id="scope-all" />
                      <Label htmlFor="scope-all" className="font-normal cursor-pointer">
                        All shifts in this assignment
                        {flexStartDate && flexEndDate && (
                          <span className="block text-xs text-slate-500 mt-0.5">
                            {parseLocalDate(flexStartDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}{' '}
                            –{' '}
                            {parseLocalDate(flexEndDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        )}
                      </Label>
                    </div>
                  </RadioGroup>
                )
              })()}
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSaveScopeDialog(false)
                    setPendingFlexSave(null)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    void handleConfirmSaveScope()
                  }}
                  disabled={
                    flexSaving ||
                    (saveScopeChoice !== 'all_shifts' && !(cellDateISO ?? flexStartDate))
                  }
                >
                  {flexSaving ? 'Saving...' : 'Save'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
