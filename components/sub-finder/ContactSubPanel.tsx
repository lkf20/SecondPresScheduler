'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Phone,
  PhoneOff,
  CheckCircle,
  Clock,
  HelpCircle,
  Mail,
  AlertTriangle,
  ArrowRightLeft,
  X,
  XCircle,
  Calendar,
} from 'lucide-react'
import { parseLocalDate } from '@/lib/utils/date'
import ShiftChips, { formatShiftLabel } from '@/components/sub-finder/ShiftChips'
import CoverageSummary from '@/components/sub-finder/CoverageSummary'
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  getPanelBackgroundClasses,
  getPanelHeaderBackgroundClasses,
  panelBackgrounds,
} from '@/lib/utils/colors'
import { DAY_NAMES, MONTH_NAMES } from '@/lib/utils/date-format'
import { cn } from '@/lib/utils'
import { formatUSPhone } from '@/lib/utils/phone'
import { sortShiftDetailsByDisplayOrder } from '@/lib/utils/shift-display-order'
import { toast } from 'sonner'
import { useAssignSubShifts } from '@/lib/hooks/use-sub-assignment-mutations'
import { clearDataHealthCache } from '@/lib/dashboard/data-health-cache'

type ResponseStatus = 'none' | 'pending' | 'confirmed' | 'declined_all' | 'declined'
type ContactStatus =
  | 'not_contacted'
  | 'pending'
  | 'awaiting_response'
  | 'confirmed'
  | 'declined_all'

const normalizeResponseStatus = (value: string | null | undefined): ResponseStatus => {
  if (value === 'declined') return 'declined_all'
  if (
    value === 'none' ||
    value === 'pending' ||
    value === 'confirmed' ||
    value === 'declined_all'
  ) {
    return value
  }
  return 'none'
}

const deriveContactStatus = (
  isContacted: boolean,
  responseStatus: string | null | undefined,
  explicitContactStatus?: string | null
): ContactStatus => {
  const normalizedResponse = normalizeResponseStatus(responseStatus)
  if (explicitContactStatus === 'not_contacted') return 'not_contacted'
  if (explicitContactStatus === 'pending') return 'pending'
  if (explicitContactStatus === 'awaiting_response') return 'pending'
  if (explicitContactStatus === 'confirmed') return 'confirmed'
  if (explicitContactStatus === 'declined_all') return 'declined_all'

  if (!isContacted) return 'not_contacted'
  if (normalizedResponse === 'confirmed') return 'confirmed'
  if (normalizedResponse === 'declined_all') return 'declined_all'
  return 'pending'
}

const mapContactStatusToLegacy = (status: ContactStatus) => {
  switch (status) {
    case 'not_contacted':
      return { is_contacted: false, response_status: 'none' as ResponseStatus }
    case 'awaiting_response':
    case 'pending':
      return { is_contacted: true, response_status: 'pending' as ResponseStatus }
    case 'confirmed':
      return { is_contacted: true, response_status: 'confirmed' as ResponseStatus }
    case 'declined_all':
      return { is_contacted: true, response_status: 'declined_all' as ResponseStatus }
    default:
      return { is_contacted: false, response_status: 'none' as ResponseStatus }
  }
}

const shouldDebugLog =
  process.env.NODE_ENV === 'development' || process.env.SUB_FINDER_DEBUG === 'true'

const logContactPanelError = (...args: unknown[]) => {
  if (shouldDebugLog) {
    console.error(...args)
  }
}

type ShiftOverride = {
  coverage_request_shift_id?: string | null
  selected: boolean
  override_availability: boolean
  shift?: {
    date: string
    time_slot?: {
      code?: string | null
    } | null
  } | null
}

export interface RecommendedSub {
  id: string
  name: string
  phone: string | null
  email: string | null
  coverage_percent: number
  shifts_covered: number
  total_shifts: number
  can_cover: Array<{
    date: string
    day_name: string
    time_slot_code: string
    class_name: string | null
    classroom_name?: string | null
    classroom_id?: string | null
    classroom_color?: string | null
    diaper_changing_required?: boolean
    lifting_children_required?: boolean
  }>
  cannot_cover: Array<{
    date: string
    day_name: string
    time_slot_code: string
    reason: string
    coverage_request_shift_id?: string
  }>
  assigned_shifts?: Array<{
    coverage_request_shift_id: string
    date: string
    day_name: string
    time_slot_code: string
    is_partial?: boolean
    partial_start_time?: string | null
    partial_end_time?: string | null
  }>
  remaining_shift_keys?: string[]
  remaining_shift_count?: number
  has_assigned_shifts?: boolean
  can_change_diapers?: boolean
  can_lift_children?: boolean
}

interface Absence {
  id: string
  teacher_name: string
  start_date: string
  end_date: string | null
  shifts?: {
    shift_details?: Array<{
      date: string
      day_name?: string
      time_slot_code: string
      status?: 'uncovered' | 'partially_covered' | 'fully_covered'
      sub_name?: string | null
      sub_id?: string | null
      classroom_name?: string | null
      class_name?: string | null
      assigned_subs?: Array<{
        assignment_id: string
        sub_id: string
        sub_name: string
        is_partial: boolean
        partial_start_time?: string | null
        partial_end_time?: string | null
      }>
    }>
  }
}

interface ContactData {
  id: string
  is_contacted: boolean
  contacted_at: string | null
  response_status: ResponseStatus
  contact_status?: ContactStatus | null
  notes: string | null
  shift_overrides?: ShiftOverride[]
  coverage_request_id?: string
  shift_map?: Record<string, string>
  selected_shift_keys?: string[]
  override_shift_keys?: string[]
}

interface ContactSubPanelProps {
  isOpen: boolean
  onClose: () => void
  sub: RecommendedSub | null
  absence: Absence | null
  variant?: 'sheet' | 'inline'
  initialContactData?: ContactData // Cached contact data from parent
  onAssignmentComplete?: () => void // Callback to refresh data after assignment
  onChangeShift?: (shift: { date: string; time_slot_code: string }) => void
  /** When in manual mode with no time off request, called when user clicks "Create time off for this range" */
  onCreateTimeOffRequest?: () => void
  /** When in manual mode, called when user clicks "Add extra coverage" (temp coverage, no absence) */
  onAddExtraCoverage?: () => void
  /** When true, disable assignment and show "Preview only" banner */
  previewMode?: boolean
}

export default function ContactSubPanel({
  isOpen,
  onClose,
  sub,
  absence,
  variant = 'sheet',
  initialContactData,
  onAssignmentComplete,
  onChangeShift,
  onCreateTimeOffRequest,
  onAddExtraCoverage,
  previewMode = false,
}: ContactSubPanelProps) {
  const router = useRouter()
  const contactSummaryRef = useRef<HTMLDivElement | null>(null)
  const assignSubShiftsMutation = useAssignSubShifts()
  const [isContacted, setIsContacted] = useState(false)
  const [contactedAt, setContactedAt] = useState<string | null>(null)
  const [responseStatus, setResponseStatus] = useState<ResponseStatus>('none')
  const [notes, setNotes] = useState('')
  const [selectedShifts, setSelectedShifts] = useState<Set<string>>(new Set())
  const [assignedShifts, setAssignedShifts] = useState<
    Array<{
      coverage_request_shift_id: string
      date: string
      day_name: string
      time_slot_code: string
      is_partial?: boolean
      partial_start_time?: string | null
      partial_end_time?: string | null
    }>
  >([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [coverageRequestId, setCoverageRequestId] = useState<string | null>(null)
  const [contactId, setContactId] = useState<string | null>(null)
  const [overriddenShiftIds, setOverriddenShiftIds] = useState<Set<string>>(new Set())
  const [partialShiftKeys, setPartialShiftKeys] = useState<Set<string>>(new Set())
  const [partialShiftTimes, setPartialShiftTimes] = useState<
    Record<string, { start?: string; end?: string }>
  >({})
  const [isSubInactive, setIsSubInactive] = useState(false)
  const [remainingShiftKeys, setRemainingShiftKeys] = useState<Set<string>>(new Set())
  const [remainingShiftCount, setRemainingShiftCount] = useState<number | null>(null)
  const [removeDialogShift, setRemoveDialogShift] = useState<{
    coverage_request_shift_id: string
    date: string
    day_name: string
    time_slot_code: string
  } | null>(null)
  const [removingScope, setRemovingScope] = useState<'single' | 'all_for_absence' | null>(null)
  const [showAssignConfirmDialog, setShowAssignConfirmDialog] = useState(false)
  const [showConfirmedNeedsAssignmentDialog, setShowConfirmedNeedsAssignmentDialog] =
    useState(false)
  const [changeDialogShift, setChangeDialogShift] = useState<{
    date: string
    time_slot_code: string
    fromSubName?: string | null
    toSubName?: string | null
  } | null>(null)
  const [timeSlotOrderByCode, setTimeSlotOrderByCode] = useState<Record<string, number>>({})
  const applyContactStatusChange = (nextStatus: ContactStatus) => {
    const wasDeclinedAll = responseStatus === 'declined_all'
    const mapped = mapContactStatusToLegacy(nextStatus)
    setIsContacted(mapped.is_contacted)
    setResponseStatus(mapped.response_status)
    if (mapped.is_contacted && !contactedAt) {
      setContactedAt(new Date().toISOString())
    }
    if (nextStatus === 'declined_all') {
      setSelectedShifts(new Set())
      setOverriddenShiftIds(new Set())
      setPartialShiftKeys(new Set())
      setPartialShiftTimes({})
    }
    // When changing from declined to confirmed/pending/not contacted, refresh so availability is shown again.
    if (wasDeclinedAll && nextStatus !== 'declined_all' && onAssignmentComplete) {
      onAssignmentComplete()
    }
  }
  useEffect(() => {
    if (!isOpen) return
    let isCancelled = false

    const fetchTimeSlotOrder = async () => {
      try {
        const response = await fetch('/api/timeslots')
        if (!response.ok) return
        const rows = (await response.json()) as Array<{
          code?: string | null
          display_order?: number | null
        }>
        if (isCancelled) return
        const orderMap: Record<string, number> = {}
        rows.forEach(row => {
          if (!row.code || row.display_order == null) return
          orderMap[row.code] = row.display_order
        })
        setTimeSlotOrderByCode(orderMap)
      } catch {
        // Non-blocking: fallback sort remains code-based if timeslots request fails.
      }
    }

    fetchTimeSlotOrder()
    return () => {
      isCancelled = true
    }
  }, [isOpen])

  const refreshRemainingShifts = async () => {
    if (!absence) return
    const refreshResponse = await fetch(
      `/api/sub-finder/coverage-request/${absence.id}/assigned-shifts`
    )
    if (!refreshResponse.ok) return
    const refreshData = await refreshResponse.json()
    const refreshedRemainingKeys = new Set<string>(
      Array.isArray(refreshData.remaining_shift_keys) ? refreshData.remaining_shift_keys : []
    )
    setRemainingShiftKeys(refreshedRemainingKeys)
    setRemainingShiftCount(
      typeof refreshData.remaining_shift_count === 'number'
        ? refreshData.remaining_shift_count
        : null
    )
  }

  const handleRemoveAssignedShift = async (scope: 'single' | 'all_for_absence') => {
    if (!absence || !sub) return
    if (scope === 'single' && !removeDialogShift?.coverage_request_shift_id) return

    try {
      setRemovingScope(scope)
      const response = await fetch('/api/sub-finder/unassign-shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          absence_id: absence.id,
          sub_id: sub.id,
          scope,
          coverage_request_shift_id:
            scope === 'single' ? removeDialogShift?.coverage_request_shift_id : undefined,
        }),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: 'Failed to remove sub.' }))
        throw new Error(errorBody.error || 'Failed to remove sub.')
      }

      clearDataHealthCache()
      if (scope === 'single' && removeDialogShift) {
        setAssignedShifts(prev =>
          prev.filter(
            shift => shift.coverage_request_shift_id !== removeDialogShift.coverage_request_shift_id
          )
        )
      } else {
        setAssignedShifts([])
      }

      setRemoveDialogShift(null)
      await refreshRemainingShifts()
      if (onAssignmentComplete) await onAssignmentComplete()
      router.refresh()

      toast.success(
        scope === 'single'
          ? `Removed ${sub.name} from this shift.`
          : `Removed ${sub.name} from all shifts for this request.`
      )
    } catch (error) {
      logContactPanelError('Error removing assigned shift(s):', error)
      toast.error(error instanceof Error ? error.message : 'Failed to remove sub assignment.')
    } finally {
      setRemovingScope(null)
    }
  }

  const handleChangeAssignedShift = (shift: { date: string; time_slot_code: string }) => {
    onChangeShift?.(shift)
    onClose()
  }

  const applyShiftSelections = (data: ContactData) => {
    setPartialShiftKeys(new Set())
    setPartialShiftTimes({})

    if (data.response_status === 'declined_all') {
      setSelectedShifts(new Set())
      setOverriddenShiftIds(new Set())
      return
    }

    if (Array.isArray(data.selected_shift_keys) || Array.isArray(data.override_shift_keys)) {
      // Start unchecked by default; director explicitly selects shifts each session.
      setSelectedShifts(new Set())
      setOverriddenShiftIds(new Set(data.override_shift_keys || []))
      return
    }

    if (data.shift_overrides && data.shift_overrides.length > 0) {
      const overridden = new Set<string>()
      data.shift_overrides.forEach((override: ShiftOverride) => {
        if (!override.shift) return
        const key = `${override.shift.date}|${override.shift.time_slot?.code || ''}`
        if (override.override_availability) {
          overridden.add(key)
        }
      })
      setSelectedShifts(new Set())
      setOverriddenShiftIds(overridden)
    }
  }

  // Initialize assignedShifts and selectedShifts immediately from sub prop (no API call needed)
  useEffect(() => {
    if (sub?.assigned_shifts) {
      setAssignedShifts(sub.assigned_shifts)
    }
  }, [sub?.assigned_shifts])

  // Initialize selectedShifts to all can_cover shifts immediately when sub changes
  // Default to no preselected shifts; only use explicit saved selections when provided.
  useEffect(() => {
    if (sub?.can_cover) {
      setSelectedShifts(new Set())
      setPartialShiftKeys(new Set())
      setPartialShiftTimes({})
    }
  }, [sub?.can_cover])

  // Clear all shifts when responseStatus changes to 'declined_all'
  useEffect(() => {
    if (responseStatus === 'declined_all') {
      setSelectedShifts(new Set())
      setOverriddenShiftIds(new Set())
      setPartialShiftKeys(new Set())
      setPartialShiftTimes({})
    }
  }, [responseStatus])

  // When panel opens, use cached data for immediate paint but always refetch so we never show stale contact status (e.g. after marking as declined).
  // Depend only on stable primitives (isOpen, sub.id, absence.id) to avoid "Maximum update depth exceeded" when parent re-renders with new object references.
  const subId = sub?.id
  const absenceId = absence?.id
  useEffect(() => {
    if (!isOpen || !sub || !absence) return

    if (absence.id.startsWith('manual-')) {
      setCoverageRequestId(null)
      setFetching(false)
      return
    }

    // Optional: use cached data for immediate display to avoid loading flash
    if (initialContactData) {
      setContactId(initialContactData.id)
      setIsContacted(initialContactData.is_contacted ?? false)
      setContactedAt(initialContactData.contacted_at)
      setResponseStatus(normalizeResponseStatus(initialContactData.response_status))
      setNotes(initialContactData.notes || '')
      setCoverageRequestId(initialContactData.coverage_request_id || null)
      applyShiftSelections(initialContactData)
      fetch(`/api/subs/${sub.id}`)
        .then(res => (res.ok ? res.json() : null))
        .then(subData => {
          if (subData) setIsSubInactive(!subData.active)
        })
        .catch(() => {})
    }

    const fetchContactData = async () => {
      if (!initialContactData) setFetching(true)
      try {
        const [coverageResponse, subResponse] = await Promise.all([
          fetch(`/api/sub-finder/coverage-request/${absence.id}`),
          fetch(`/api/subs/${sub.id}`).catch(() => null),
        ])

        if (!coverageResponse.ok) {
          const errorBody = await coverageResponse.text().catch(() => '')
          logContactPanelError(
            `Failed to fetch coverage request: status=${coverageResponse.status} statusText=${coverageResponse.statusText} url=${coverageResponse.url} body=${errorBody.slice(0, 200)}`
          )
          setFetching(false)
          return
        }
        const coverageData = await coverageResponse.json()
        setCoverageRequestId(coverageData.coverage_request_id)

        if (subResponse?.ok) {
          const subData = await subResponse.json()
          setIsSubInactive(!subData.active)
        }

        const contactResponse = await fetch(
          `/api/sub-finder/substitute-contacts?coverage_request_id=${coverageData.coverage_request_id}&sub_id=${sub.id}`
        )
        if (contactResponse.ok) {
          const contactData = await contactResponse.json()
          if (contactData) {
            setContactId(contactData.id)
            setIsContacted(contactData.is_contacted ?? false)
            setContactedAt(contactData.contacted_at)
            setResponseStatus(normalizeResponseStatus(contactData.response_status))
            setNotes(contactData.notes || '')
            applyShiftSelections(contactData)
          }
        }
      } catch (error) {
        logContactPanelError('Error fetching contact data:', error)
      } finally {
        setFetching(false)
      }
    }

    fetchContactData()
  }, [isOpen, subId, absenceId])

  // Fetch remaining shifts for the coverage request (computed server-side)
  useEffect(() => {
    if (!coverageRequestId || !absence) {
      setRemainingShiftKeys(new Set())
      setRemainingShiftCount(null)
      return
    }

    const fetchRemainingShifts = async () => {
      try {
        const response = await fetch(
          `/api/sub-finder/coverage-request/${absence.id}/assigned-shifts`
        )
        if (response.ok) {
          const data = await response.json()
          const remainingKeys = new Set<string>(
            Array.isArray(data.remaining_shift_keys) ? data.remaining_shift_keys : []
          )
          setRemainingShiftKeys(remainingKeys)
          setRemainingShiftCount(
            typeof data.remaining_shift_count === 'number' ? data.remaining_shift_count : null
          )
        } else {
          logContactPanelError(
            'Failed to fetch assigned shifts:',
            response.status,
            response.statusText
          )
          const errorText = await response.text()
          logContactPanelError('Error response:', errorText)
        }
      } catch (error) {
        logContactPanelError('Error fetching remaining shifts:', error)
      }
    }

    fetchRemainingShifts()
  }, [coverageRequestId, absence])

  // Reset state when panel closes
  useEffect(() => {
    if (!isOpen) {
      setIsContacted(false)
      setContactedAt(null)
      setResponseStatus('none')
      setNotes('')
      setSelectedShifts(new Set())
      setAssignedShifts([])
      setCoverageRequestId(null)
      setContactId(null)
      setOverriddenShiftIds(new Set())
      setPartialShiftKeys(new Set())
      setPartialShiftTimes({})
      setIsSubInactive(false)
      setRemainingShiftKeys(new Set())
      setRemainingShiftCount(null)
    }
  }, [isOpen])

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = parseLocalDate(dateString)
    const dayName = DAY_NAMES[date.getDay()]
    const month = MONTH_NAMES[date.getMonth()]
    const day = date.getDate()
    return `${dayName} ${month} ${day}`
  }

  const formatPartialTimeWindow = (start?: string | null, end?: string | null) => {
    if (!start && !end) return null
    return `${start ?? '--:--'}-${end ?? '--:--'}`
  }

  // Format date range for display
  const formatDateRange = () => {
    if (!absence) return null

    const startDate = formatDate(absence.start_date)

    if (!absence.end_date || absence.end_date === absence.start_date) {
      return startDate
    }

    const endDate = formatDate(absence.end_date)
    return `${startDate} - ${endDate}`
  }

  // Format contacted timestamp
  const formatContactedTimestamp = (timestamp: string | null) => {
    if (!timestamp) return null

    const contactedDate = new Date(timestamp)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const contactedDay = new Date(
      contactedDate.getFullYear(),
      contactedDate.getMonth(),
      contactedDate.getDate()
    )

    // Format time
    const hours = contactedDate.getHours()
    const minutes = contactedDate.getMinutes()
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    const displayMinutes = minutes.toString().padStart(2, '0')
    const timeStr = `${displayHours}:${displayMinutes} ${ampm}`

    if (contactedDay.getTime() === today.getTime()) {
      return `Today at ${timeStr}`
    } else if (contactedDay.getTime() === yesterday.getTime()) {
      return `Yesterday at ${timeStr}`
    } else {
      const month = MONTH_NAMES[contactedDate.getMonth()]
      const day = contactedDate.getDate()
      const year = contactedDate.getFullYear()
      const currentYear = now.getFullYear()

      if (year === currentYear) {
        return `${month} ${day} at ${timeStr}`
      } else {
        return `${month} ${day}, ${year} at ${timeStr}`
      }
    }
  }

  const isInline = variant === 'inline'

  // Don't render if no sub or absence, but Sheet must still have a title when open
  if (!sub || !absence) {
    if (!isOpen) return null
    const emptyBody = (
      <>
        <div
          className={`sticky top-0 z-10 ${getPanelHeaderBackgroundClasses()} ${panelBackgrounds.panelBorder} border-b px-6 pt-6 pb-4 relative`}
        >
          {isInline ? (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-6 top-6 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:text-slate-700 hover:bg-white"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          ) : (
            <SheetClose asChild>
              <button
                type="button"
                className="absolute right-6 top-6 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:text-slate-700 hover:bg-white"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </button>
            </SheetClose>
          )}
          {isInline ? (
            <div className="text-left">
              <div className="text-lg font-semibold text-slate-900">
                Contact Sub{previewMode ? ' (Preview only)' : ''}
              </div>
            </div>
          ) : (
            <SheetHeader>
              <SheetTitle>Contact Sub{previewMode ? ' (Preview only)' : ''}</SheetTitle>
            </SheetHeader>
          )}
        </div>
        <div className="px-6">
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <p>No sub selected</p>
          </div>
        </div>
      </>
    )

    if (isInline) {
      return (
        <div className={`h-full overflow-y-auto p-0 ${getPanelBackgroundClasses()}`}>
          {emptyBody}
        </div>
      )
    }

    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent
          showCloseButton={false}
          className={`w-full sm:max-w-2xl overflow-y-auto p-0 ${getPanelBackgroundClasses()}`}
        >
          {emptyBody}
        </SheetContent>
      </Sheet>
    )
  }

  const handleShiftToggle = (shiftKey: string, isAvailable: boolean) => {
    // Only allow selection if available OR overridden
    if (!isAvailable && !overriddenShiftIds.has(shiftKey)) {
      return // Can't select unavailable shifts without override
    }

    const newSelected = new Set(selectedShifts)
    if (newSelected.has(shiftKey)) {
      newSelected.delete(shiftKey)
      setPartialShiftKeys(prev => {
        if (!prev.has(shiftKey)) return prev
        const next = new Set(prev)
        next.delete(shiftKey)
        return next
      })
      setPartialShiftTimes(prev => {
        if (!(shiftKey in prev)) return prev
        const next = { ...prev }
        delete next[shiftKey]
        return next
      })
    } else {
      newSelected.add(shiftKey)
    }
    setSelectedShifts(newSelected)
  }

  const handleToggleOverride = (shiftKey: string) => {
    setOverriddenShiftIds(prev => {
      const next = new Set(prev)
      if (next.has(shiftKey)) {
        next.delete(shiftKey)
      } else {
        next.add(shiftKey)
      }
      return next
    })
  }

  const resolveShiftOverrides = async () => {
    if (!coverageRequestId || !sub) {
      throw new Error('Coverage request or sub data missing')
    }

    const availableShiftKeys = (sub.can_cover || []).map(
      shift => `${shift.date}|${shift.time_slot_code}`
    )
    const unavailableShiftKeys = (sub.cannot_cover || []).map(
      shift => `${shift.date}|${shift.time_slot_code}`
    )

    const response = await fetch('/api/sub-finder/shift-overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coverage_request_id: coverageRequestId,
        selected_shift_keys: Array.from(selectedShifts),
        override_shift_keys: Array.from(overriddenShiftIds),
        available_shift_keys: availableShiftKeys,
        unavailable_shift_keys: unavailableShiftKeys,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      throw new Error(
        errorBody || `Failed to resolve shift overrides (${response.status} ${response.statusText})`
      )
    }

    return (await response.json()) as {
      shift_overrides: Array<{
        coverage_request_shift_id: string
        shift_key: string
        selected: boolean
        override_availability: boolean
      }>
      selected_shift_ids: string[]
      is_floater_shift_ids?: string[]
    }
  }

  const handleSave = async () => {
    if (!coverageRequestId) {
      logContactPanelError('Coverage request ID not available')
      toast.error('Coverage request ID not available')
      return
    }
    const hasAssignedToThisSub = assignedShifts.length > 0
    const hasSelectedShifts = selectedShifts.size > 0
    if (responseStatus === 'confirmed' && !hasSelectedShifts && !hasAssignedToThisSub) {
      setShowConfirmedNeedsAssignmentDialog(true)
      return
    }

    setLoading(true)
    try {
      const resolvedOverrides = await resolveShiftOverrides()

      // Get or create contact first if we don't have contactId
      let currentContactId = contactId
      if (!currentContactId) {
        const getContactResponse = await fetch(
          `/api/sub-finder/substitute-contacts?coverage_request_id=${coverageRequestId}&sub_id=${sub.id}`
        )
        if (getContactResponse.ok) {
          const contactData = await getContactResponse.json()
          currentContactId = contactData.id
          setContactId(currentContactId)
        } else {
          throw new Error('Failed to get or create contact')
        }
      }

      // Update contact with response_status, is_contacted, notes, and shift overrides
      const nextContactStatus = deriveContactStatus(isContacted, responseStatus)
      const updateResponse = await fetch('/api/sub-finder/substitute-contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentContactId,
          contact_status: nextContactStatus,
          response_status: responseStatus,
          is_contacted: isContacted,
          notes: notes || null,
          shift_overrides: resolvedOverrides.shift_overrides,
          selected_shift_keys: Array.from(selectedShifts),
        }),
      })

      const updatedContactData = await updateResponse.json()

      if (!updateResponse.ok) {
        throw new Error(updatedContactData.error || 'Failed to save contact')
      }

      // Refresh contact data to get updated contacted_at if it was set
      if (updatedContactData) {
        setIsContacted(updatedContactData.is_contacted ?? false)
        if (updatedContactData.contacted_at) {
          setContactedAt(updatedContactData.contacted_at)
        }
        setResponseStatus(normalizeResponseStatus(updatedContactData.response_status))
      }

      // Refresh parent data to update the main page
      if (onAssignmentComplete) {
        onAssignmentComplete()
      }

      onClose()
    } catch (error) {
      logContactPanelError('Error saving contact:', error)
      toast.error('Error saving contact', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setLoading(false)
    }
  }

  // Calculate contextual warnings
  const calculateWarnings = () => {
    if (!sub || !sub.can_cover) return []

    const warnings: string[] = []
    const selectedShiftKeys = Array.from(selectedShifts)

    // Check each selected shift for requirements
    const hasDiaperingRequired = sub.can_cover.some(shift => {
      const shiftKey = `${shift.date}|${shift.time_slot_code}`
      return selectedShiftKeys.includes(shiftKey) && shift.diaper_changing_required
    })

    const hasLiftingRequired = sub.can_cover.some(shift => {
      const shiftKey = `${shift.date}|${shift.time_slot_code}`
      return selectedShiftKeys.includes(shiftKey) && shift.lifting_children_required
    })

    if (hasDiaperingRequired && !sub.can_change_diapers) {
      warnings.push('Diapering required')
    }

    if (hasLiftingRequired && !sub.can_lift_children) {
      warnings.push('Lifting children required')
    }

    if (hasLiftingRequired && sub.can_lift_children === false) {
      warnings.push('Sub prefers not to lift children')
    }

    return warnings
  }

  const warnings = calculateWarnings()

  const handleAssignShifts = async (options?: {
    responseStatusOverride?: ResponseStatus
    isContactedOverride?: boolean
  }) => {
    if (!coverageRequestId || selectedShifts.size === 0) {
      logContactPanelError('Cannot assign: missing coverage request or no shifts selected')
      toast.error('Select at least one shift to assign.')
      return
    }

    setLoading(true)
    try {
      const effectiveResponseStatus = options?.responseStatusOverride ?? responseStatus
      const effectiveIsContacted = options?.isContactedOverride ?? isContacted

      // First, save the contact with status and notes
      let currentContactId = contactId
      if (!currentContactId) {
        const getContactResponse = await fetch(
          `/api/sub-finder/substitute-contacts?coverage_request_id=${coverageRequestId}&sub_id=${sub.id}`
        )
        if (getContactResponse.ok) {
          const contactData = await getContactResponse.json()
          currentContactId = contactData.id
          setContactId(currentContactId)
        } else {
          throw new Error('Failed to get or create contact')
        }
      }

      const resolvedOverrides = await resolveShiftOverrides()
      const selectedShiftIds = resolvedOverrides.selected_shift_ids

      // Map coverage_request_shift_id → shift_key from overrides response
      const shiftIdToKeyMap = new Map<string, string>(
        (resolvedOverrides.shift_overrides || []).map(o => [
          o.coverage_request_shift_id,
          o.shift_key,
        ])
      )
      const partialAssignments = selectedShiftIds
        .filter(id => partialShiftKeys.has(shiftIdToKeyMap.get(id) ?? ''))
        .map(id => {
          const shiftKey = shiftIdToKeyMap.get(id) ?? ''
          const times = partialShiftTimes[shiftKey]
          return {
            shift_id: id,
            ...(times?.start ? { partial_start_time: times.start } : {}),
            ...(times?.end ? { partial_end_time: times.end } : {}),
          }
        })
      if (!selectedShiftIds || selectedShiftIds.length === 0) {
        throw new Error('No valid shifts selected for assignment')
      }

      const updatePayload = {
        id: currentContactId,
        contact_status: deriveContactStatus(effectiveIsContacted, effectiveResponseStatus),
        response_status: effectiveResponseStatus,
        is_contacted: effectiveIsContacted,
        notes: notes || null,
        shift_overrides: resolvedOverrides.shift_overrides,
        selected_shift_keys: Array.from(selectedShifts),
      }

      const updateResponse = await fetch('/api/sub-finder/substitute-contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      })

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text()
        let errorData: Record<string, unknown> = {}
        let errorMessage = `Failed to update contact (${updateResponse.status} ${updateResponse.statusText})`

        try {
          if (errorText) {
            errorData = JSON.parse(errorText)
            const error = typeof errorData.error === 'string' ? errorData.error : null
            const message = typeof errorData.message === 'string' ? errorData.message : null
            errorMessage = error || message || errorMessage
          }
        } catch {
          // If JSON parsing fails, use the raw text
          errorMessage = errorText || errorMessage
          errorData = { rawError: errorText }
        }

        logContactPanelError('Update contact error:', {
          status: updateResponse.status,
          statusText: updateResponse.statusText,
          errorText: errorText || '(empty response)',
          errorData,
          payload: updatePayload,
        })

        throw new Error(errorMessage)
      }

      // Create calendar entries (sub_assignments) using mutation hook
      // This ensures React Query cache is properly invalidated, including weekly schedule
      if (!coverageRequestId) {
        throw new Error('Coverage request ID is missing. Please try opening the panel again.')
      }

      const assignPayload = {
        coverage_request_id: coverageRequestId,
        sub_id: sub.id,
        selected_shift_ids: selectedShiftIds,
        ...(resolvedOverrides.is_floater_shift_ids?.length
          ? { is_floater_shift_ids: resolvedOverrides.is_floater_shift_ids }
          : {}),
        ...(partialAssignments.length > 0 ? { partial_assignments: partialAssignments } : {}),
      }

      // Use the mutation hook which handles cache invalidation automatically
      const assignData = await assignSubShiftsMutation.mutateAsync(assignPayload)

      // Update assigned shifts state with response data
      if (assignData.assigned_shifts) {
        setAssignedShifts(assignData.assigned_shifts)
      }
      if (options?.responseStatusOverride) {
        setResponseStatus(options.responseStatusOverride)
      }
      if (options?.isContactedOverride !== undefined) {
        setIsContacted(options.isContactedOverride)
      }

      // Refresh parent data (absences and recommended subs)
      if (onAssignmentComplete) {
        onAssignmentComplete()
      }

      // Refresh all pages (including Sub Finder) to reflect new assignments
      router.refresh()

      // Refresh remaining shifts to update remaining shifts calculation
      if (coverageRequestId && absence) {
        await refreshRemainingShifts()
      }

      setShowAssignConfirmDialog(false)

      // Don't close - keep panel open so user can see the updated status
    } catch (error) {
      logContactPanelError('Error assigning shifts:', error)
      toast.error('Error assigning shifts', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsDeclined = () => {
    // Uncheck all shifts (available, unassigned, and unavailable)
    setSelectedShifts(new Set())
    setOverriddenShiftIds(new Set())
    // Status remains 'declined_all', buttons will revert to default
    toast.success('Marked as Declined', {
      description: 'All selected shifts have been cleared.',
    })
  }

  const handleChangeToConfirmed = () => {
    // Selected shifts remain selected, buttons revert to confirmed state.
    applyContactStatusChange('confirmed')
  }

  const handleMarkAsDeclinedSave = async () => {
    // When declined_all is selected with no shifts, save the contact but keep panel open
    if (responseStatus === 'declined_all' && selectedShiftsCount === 0) {
      if (!coverageRequestId) {
        logContactPanelError('Coverage request ID not available')
        toast.error('Coverage request ID not available')
        return
      }

      setLoading(true)
      try {
        // Build empty shift overrides array
        const shiftOverrides: ShiftOverride[] = []

        // Always resolve contact by current coverage request so we never PUT a stale id (e.g. from another absence).
        const getContactResponse = await fetch(
          `/api/sub-finder/substitute-contacts?coverage_request_id=${coverageRequestId}&sub_id=${sub.id}`
        )
        if (!getContactResponse.ok) {
          throw new Error('Failed to get or create contact')
        }
        const contactData = await getContactResponse.json()
        const currentContactId = contactData.id
        setContactId(currentContactId)

        // Update contact with declined status and empty shift overrides
        const updateResponse = await fetch('/api/sub-finder/substitute-contacts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: currentContactId,
            contact_status: 'declined_all' as ContactStatus,
            response_status: 'declined_all',
            is_contacted: true,
            notes: notes || null,
            shift_overrides: shiftOverrides,
            selected_shift_keys: [],
          }),
        })

        const updatedContactData = await updateResponse.json()

        if (!updateResponse.ok) {
          throw new Error(updatedContactData.error || 'Failed to save contact')
        }

        // Refresh contact data
        if (updatedContactData) {
          setIsContacted(updatedContactData.is_contacted ?? false)
          if (updatedContactData.contacted_at) {
            setContactedAt(updatedContactData.contacted_at)
          }
          setResponseStatus(normalizeResponseStatus(updatedContactData.response_status))
        }

        // Refresh parent data
        if (onAssignmentComplete) {
          onAssignmentComplete()
        }

        // Refresh all pages (including Sub Finder) to reflect status change
        router.refresh()

        // Show success toast
        toast.success('Marked as Declined', {
          description: `${sub.name} has been marked as declined for all shifts.`,
        })

        // Close the panel after marking as declined
        onClose()
      } catch (error) {
        logContactPanelError('Error saving declined status:', error)
        toast.error('Error saving declined status', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      } finally {
        setLoading(false)
      }
    } else {
      // Otherwise, assign shifts (which will handle the declined status)
      await handleAssignShifts()
    }
  }

  const shouldWarnBeforeAssign =
    !isContacted || responseStatus === 'none' || responseStatus === 'pending'

  const handleAssignButtonClick = async () => {
    if (shouldWarnBeforeAssign) {
      setShowAssignConfirmDialog(true)
      return
    }
    await handleAssignShifts()
  }

  const selectedShiftsCount = selectedShifts.size
  const isConfirmedContact = responseStatus === 'confirmed'
  const hasAssignedToThisSub = assignedShifts.length > 0
  const showConfirmedNoShiftWarning =
    responseStatus === 'confirmed' && selectedShiftsCount === 0 && !hasAssignedToThisSub
  const hasPendingAssignmentChanges = selectedShiftsCount > 0

  const derivedShiftKeys = (() => {
    if (remainingShiftKeys.size > 0) return remainingShiftKeys
    if (Array.isArray(sub.remaining_shift_keys) && sub.remaining_shift_keys.length > 0) {
      return new Set(sub.remaining_shift_keys)
    }
    const allKeys = new Set<string>()
    sub.can_cover?.forEach(shift => {
      allKeys.add(`${shift.date}|${shift.time_slot_code}`)
    })
    sub.cannot_cover?.forEach(shift => {
      allKeys.add(`${shift.date}|${shift.time_slot_code}`)
    })
    sub.assigned_shifts?.forEach(shift => {
      allKeys.add(`${shift.date}|${shift.time_slot_code}`)
    })
    const assignedKeys = new Set<string>()
    sub.assigned_shifts?.forEach(shift => {
      assignedKeys.add(`${shift.date}|${shift.time_slot_code}`)
    })
    return new Set(Array.from(allKeys).filter(key => !assignedKeys.has(key)))
  })()

  const remainingCanCover =
    sub.can_cover?.filter(shift => {
      const shiftKey = `${shift.date}|${shift.time_slot_code}`
      return derivedShiftKeys.has(shiftKey)
    }) || []

  // When sub has declined all, do not show them as available for any shift (display only).
  const effectiveRemainingShiftsCovered =
    responseStatus === 'declined_all' ? 0 : remainingCanCover.length

  const remainingShifts =
    remainingShiftCount !== null
      ? remainingShiftCount
      : typeof sub.remaining_shift_count === 'number'
        ? sub.remaining_shift_count
        : sub.total_shifts
  const remainingShiftsCovered = remainingCanCover.length
  const matchPercent =
    remainingShifts > 0 && responseStatus !== 'declined_all'
      ? Math.round((remainingShiftsCovered / remainingShifts) * 100)
      : null
  const requestShiftDetails = (() => {
    const details = absence.shifts?.shift_details || []
    return sortShiftDetailsByDisplayOrder([...details])
  })()
  // When sub has declined all, do not show them as covering any shift in the request summary.
  const requestShiftDetailsForDisplay =
    responseStatus === 'declined_all'
      ? requestShiftDetails.map(shift => {
          const s = shift as typeof shift & { sub_id?: string | null }
          const assignedToThisSub = s.sub_id === sub.id || shift.sub_name === sub.name
          if (assignedToThisSub) {
            return { ...shift, status: 'uncovered' as const, sub_name: null, sub_id: null }
          }
          return shift
        })
      : requestShiftDetails
  const requestTotalShifts = requestShiftDetails.length || remainingShifts
  const requestAssignedCount = requestShiftDetailsForDisplay.length
    ? requestShiftDetailsForDisplay.filter(shift => shift.status !== 'uncovered').length
    : assignedShifts.length
  const requestUncoveredCount = Math.max(0, requestTotalShifts - requestAssignedCount)
  const assignedShiftByKey = (() => {
    const map = new Map<string, (typeof assignedShifts)[number]>()
    assignedShifts.forEach(shift => {
      map.set(`${shift.date}|${shift.time_slot_code}`, shift)
    })
    return map
  })()
  const toShiftKeyNormalized = (date: string, time_slot_code: string) => {
    try {
      const d = parseLocalDate(String(date).trim())
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}|${String(time_slot_code).trim()}`
    } catch {
      return `${String(date).trim()}|${String(time_slot_code).trim()}`
    }
  }
  const canCoverShiftKeys = (() => {
    return new Set(
      (sub.can_cover || []).map(shift => toShiftKeyNormalized(shift.date, shift.time_slot_code))
    )
  })()
  const cannotCoverReasonByKey = (() => {
    const map = new Map<string, string>()
    ;(sub.cannot_cover || []).forEach(shift => {
      map.set(`${shift.date}|${shift.time_slot_code}`, shift.reason)
    })
    return map
  })()
  const actionableShifts = (() => {
    const shiftMap = new Map<
      string,
      {
        date: string
        time_slot_code: string
        classroom_name?: string | null
        class_name?: string | null
        classroom_color?: string | null
        sub_name?: string | null
        sub_id?: string | null
        status?: 'uncovered' | 'partially_covered' | 'fully_covered'
        assigned_subs?: Array<{
          assignment_id: string
          sub_id: string
          sub_name: string
          is_partial: boolean
          partial_start_time?: string | null
          partial_end_time?: string | null
        }>
      }
    >()

    requestShiftDetails.forEach(shift => {
      shiftMap.set(`${shift.date}|${shift.time_slot_code}`, shift)
    })
    ;(sub.can_cover || []).forEach(shift => {
      const key = `${shift.date}|${shift.time_slot_code}`
      if (!shiftMap.has(key)) {
        shiftMap.set(key, {
          date: shift.date,
          time_slot_code: shift.time_slot_code,
          classroom_name: shift.classroom_name ?? null,
          class_name: shift.class_name ?? null,
          classroom_color: shift.classroom_color ?? null,
          status: 'uncovered',
        })
      }
    })
    ;(sub.cannot_cover || []).forEach(shift => {
      const key = `${shift.date}|${shift.time_slot_code}`
      if (!shiftMap.has(key)) {
        shiftMap.set(key, {
          date: shift.date,
          time_slot_code: shift.time_slot_code,
          status: 'uncovered',
        })
      }
    })

    assignedShifts.forEach(shift => {
      const key = `${shift.date}|${shift.time_slot_code}`
      if (!shiftMap.has(key)) {
        shiftMap.set(key, {
          date: shift.date,
          time_slot_code: shift.time_slot_code,
          status: 'fully_covered',
          sub_name: sub.name,
          sub_id: sub.id,
        })
      }
    })

    return sortShiftDetailsByDisplayOrder(Array.from(shiftMap.values()))
  })()
  const requestCoverageSummaryLine = (() => {
    return `${requestUncoveredCount} of ${requestTotalShifts} upcoming shifts need coverage`
  })()

  const getCannotCoverMeta = (reason: string | null) => {
    const normalized = (reason || '').toLowerCase()
    if (normalized.includes('scheduled to teach')) {
      return {
        category: 'schedule_conflict',
        label: 'Scheduled elsewhere',
        detail: 'This sub is already scheduled to teach at this time.',
        canOverride: false,
      }
    }
    if (normalized.includes('already assigned as sub')) {
      const inMatch = reason?.match(/already assigned as sub in (.+)$/i)
      const conflictClassroom = inMatch?.[1]?.trim()
      return {
        category: 'sub_conflict',
        label: conflictClassroom ? `Assigned in ${conflictClassroom}` : 'Sub assignment conflict',
        detail: conflictClassroom
          ? `This sub is already assigned in ${conflictClassroom} at this time.`
          : 'This sub is already assigned to another coverage shift at this time.',
        canOverride: false,
      }
    }
    if (normalized.includes('has time off')) {
      return {
        category: 'time_off',
        label: 'Has time off',
        detail: 'This sub has time off for this shift.',
        canOverride: false,
      }
    }
    if (normalized.includes('marked as unavailable')) {
      return {
        category: 'unavailable',
        label: 'Marked unavailable',
        detail: 'Availability can be overridden for this shift.',
        canOverride: true,
      }
    }
    if (normalized.includes('not qualified')) {
      return {
        category: 'qualification',
        label: 'Qualification mismatch',
        detail: 'Qualifications can be overridden if needed.',
        canOverride: true,
      }
    }
    return {
      category: 'other',
      label: reason || 'Not available',
      detail: null,
      canOverride: false,
    }
  }

  // Check if declined_all is selected and any shifts are selected
  const isDeclinedWithShiftsSelected = responseStatus === 'declined_all' && selectedShiftsCount > 0
  const currentContactStatus = deriveContactStatus(isContacted, responseStatus)
  const statusBadge = (() => {
    const normalizedStatus = String(responseStatus || 'none').toLowerCase()
    if (normalizedStatus.includes('confirm')) {
      return {
        label: 'Contacted · Confirmed',
        icon: CheckCircle,
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        style: undefined as React.CSSProperties | undefined,
      }
    }
    if (normalizedStatus.includes('pending')) {
      return {
        label: 'Pending',
        icon: Clock,
        className: 'border-sky-200 bg-sky-50 text-sky-700',
        style: undefined as React.CSSProperties | undefined,
      }
    }
    if (normalizedStatus.includes('declined')) {
      return {
        label: 'Contacted · Declined',
        icon: XCircle,
        className: '',
        style: {
          backgroundColor: 'rgb(255, 241, 242)', // rose-50
          borderColor: 'rgb(253, 164, 175)', // rose-300
          color: 'rgb(190, 24, 93)', // rose-700
        } as React.CSSProperties,
      }
    }
    if (!isContacted) {
      return {
        label: 'Not contacted',
        icon: PhoneOff,
        className: 'border-slate-200 bg-slate-100 text-slate-600',
        style: undefined as React.CSSProperties | undefined,
      }
    }
    return {
      label: 'Pending',
      icon: HelpCircle,
      className: 'border-sky-200 bg-sky-50 text-sky-700',
      style: undefined as React.CSSProperties | undefined,
    }
  })()
  const scrollToContactSummary = () => {
    contactSummaryRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  const panelBody = (
    <>
      <div
        className={`sticky top-0 z-10 ${getPanelHeaderBackgroundClasses()} ${panelBackgrounds.panelBorder} border-b px-6 pt-6 pb-4 relative`}
      >
        {isInline ? (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-6 top-6 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:text-slate-700 hover:bg-white"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        ) : (
          <SheetClose asChild>
            <button
              type="button"
              onClick={event => {
                event.preventDefault()
                onClose()
              }}
              className="absolute right-6 top-6 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:text-slate-700 hover:bg-white"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </SheetClose>
        )}
        {isInline ? (
          <div className="text-left">
            <div className="text-2xl font-semibold text-slate-900 mb-1">
              Assign {sub.name} to sub for {absence.teacher_name}
              {previewMode ? ' (Preview only)' : ''}
            </div>
            <p className="text-base text-muted-foreground mt-1 mb-0 inline-flex flex-wrap items-center gap-1.5">
              {formatDateRange() && (
                <>
                  <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span>{formatDateRange()}</span>
                </>
              )}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={scrollToContactSummary}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadge.className}`}
                style={statusBadge.style}
                aria-label="Jump to contact summary"
              >
                <statusBadge.icon className="h-3.5 w-3.5" />
                <span>{statusBadge.label}</span>
              </button>
              <span className="flex items-center gap-4 text-sm text-muted-foreground">
                {sub.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{formatUSPhone(sub.phone)}</span>
                  </span>
                )}
                {sub.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    <span>{sub.email}</span>
                  </span>
                )}
              </span>
            </div>
          </div>
        ) : (
          <SheetHeader className="text-left">
            <SheetTitle className="text-2xl mb-1">
              Assign {sub.name} to sub for {absence.teacher_name}
              {previewMode ? ' (Preview only)' : ''}
            </SheetTitle>
            <p className="text-base text-muted-foreground mt-1 mb-0 inline-flex flex-wrap items-center gap-1.5">
              {formatDateRange() && (
                <>
                  <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span>{formatDateRange()}</span>
                </>
              )}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={scrollToContactSummary}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadge.className}`}
                style={statusBadge.style}
                aria-label="Jump to contact summary"
              >
                <statusBadge.icon className="h-3.5 w-3.5" />
                <span>{statusBadge.label}</span>
              </button>
              <span className="flex items-center gap-4 text-sm text-muted-foreground">
                {sub.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{formatUSPhone(sub.phone)}</span>
                  </span>
                )}
                {sub.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    <span>{sub.email}</span>
                  </span>
                )}
              </span>
            </div>
          </SheetHeader>
        )}
      </div>

      <div className="px-6">
        <div className="mt-6 flex flex-col">
          {/* Request Summary */}
          <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-slate-800">Request summary</h3>
              {matchPercent !== null ? (
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 text-base font-medium tabular-nums ${matchPercent === 100 ? 'text-emerald-800' : 'text-amber-700'}`}
                  aria-label={`${matchPercent}% match`}
                >
                  <CheckCircle
                    className={`h-4 w-4 shrink-0 ${matchPercent === 100 ? 'text-emerald-700' : 'text-amber-500'}`}
                    aria-hidden
                  />
                  {matchPercent}% match
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {responseStatus === 'declined_all'
                    ? 'Declined all'
                    : `${effectiveRemainingShiftsCovered} of ${remainingShifts} remaining shift${remainingShifts === 1 ? '' : 's'}`}
                </span>
              )}
            </div>
            <div className="space-y-2 border-t pt-3">
              {requestShiftDetails.length > 0 ? (
                <CoverageSummary
                  variant="compact"
                  headerText={requestCoverageSummaryLine}
                  shifts={{
                    total: requestTotalShifts,
                    uncovered: requestUncoveredCount,
                    partially_covered: requestShiftDetails.filter(
                      shift => shift.status === 'partially_covered'
                    ).length,
                    fully_covered: requestShiftDetails.filter(
                      shift => shift.status === 'fully_covered'
                    ).length,
                    shift_details: requestShiftDetailsForDisplay.map((shift, index) => ({
                      id: `${shift.date}-${shift.time_slot_code}-${index}`,
                      date: shift.date,
                      day_name: shift.day_name || '',
                      time_slot_code: shift.time_slot_code,
                      status: shift.status || 'uncovered',
                      sub_name: shift.sub_name || null,
                      sub_names:
                        shift.assigned_subs?.map(assignment => assignment.sub_name) || undefined,
                      partial_time_windows:
                        shift.assigned_subs
                          ?.filter(assignment => assignment.is_partial)
                          .map(assignment =>
                            formatPartialTimeWindow(
                              assignment.partial_start_time,
                              assignment.partial_end_time
                            )
                          )
                          .filter((value): value is string => Boolean(value)) || undefined,
                      is_partial: shift.status === 'partially_covered',
                    })),
                  }}
                />
              ) : null}
              <p className="text-lg text-muted-foreground">
                {responseStatus === 'declined_all' ? (
                  'This sub has declined all shifts.'
                ) : (
                  <>
                    This sub is available for{' '}
                    <span className="font-semibold">{effectiveRemainingShiftsCovered}</span> of{' '}
                    <span className="font-semibold">{remainingShifts}</span> remaining shift
                    {remainingShifts === 1 ? '' : 's'}.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Shift Assignments — mt-8 for consistent 2rem spacing from Request Summary */}
          {actionableShifts.length > 0 && (
            <div className="mt-8 rounded-lg bg-white border border-gray-200 p-6 space-y-6">
              <h3 className="text-base font-semibold text-slate-800">Shift assignments</h3>
              {responseStatus === 'declined_all' && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden />
                  <p className="text-sm text-amber-800">
                    This sub has declined all shifts. Change contact status below to enable
                    assignment.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 items-start gap-4">
                {actionableShifts.map(shift => {
                  const shiftKey = `${shift.date}|${shift.time_slot_code}`
                  const shiftKeyNorm = toShiftKeyNormalized(shift.date, shift.time_slot_code)
                  const assignedToThisSub = assignedShiftByKey.get(shiftKey)
                  const assignedToThisSubTimeWindow = assignedToThisSub
                    ? formatPartialTimeWindow(
                        assignedToThisSub.partial_start_time,
                        assignedToThisSub.partial_end_time
                      )
                    : null
                  // For partially_covered shifts, sub_name is set but assignment is additive:
                  // do NOT treat this as blocking. Only fully_covered shifts are truly assignedElsewhere.
                  const isPartiallyByOther =
                    !assignedToThisSub &&
                    shift.status === 'partially_covered' &&
                    Boolean(shift.sub_name)
                  const partialAssignmentsByOther = (shift.assigned_subs || []).filter(
                    assignment => assignment.is_partial && assignment.sub_id !== sub.id
                  )
                  const partialByOtherSummary =
                    partialAssignmentsByOther.length > 0
                      ? partialAssignmentsByOther
                          .map(assignment => {
                            const window = formatPartialTimeWindow(
                              assignment.partial_start_time,
                              assignment.partial_end_time
                            )
                            return window
                              ? `${assignment.sub_name} (${window})`
                              : `${assignment.sub_name}`
                          })
                          .join(', ')
                      : shift.sub_name || null
                  const assignedElsewhere =
                    !assignedToThisSub && !isPartiallyByOther && Boolean(shift.sub_name)
                  const canCoverThisShift =
                    (responseStatus === 'declined_all'
                      ? false
                      : canCoverShiftKeys.has(shiftKeyNorm)) || Boolean(assignedToThisSub)
                  const isOverridden = overriddenShiftIds.has(shiftKey)
                  const isSelected = selectedShifts.has(shiftKey)
                  const cannotCoverReason =
                    responseStatus === 'declined_all'
                      ? 'Declined this shift'
                      : cannotCoverReasonByKey.get(shiftKey) ||
                        (!canCoverThisShift && !isPartiallyByOther
                          ? 'Unavailable for this shift'
                          : null)
                  const canAssignFromCheckbox =
                    !assignedToThisSub &&
                    !assignedElsewhere &&
                    (canCoverThisShift || isOverridden || isPartiallyByOther) &&
                    !isSubInactive &&
                    responseStatus !== 'declined_all'
                  const canSwapToThisSub =
                    assignedElsewhere &&
                    (canCoverThisShift || isOverridden) &&
                    !isSubInactive &&
                    responseStatus !== 'declined_all'
                  const needsOverride =
                    !assignedToThisSub &&
                    !assignedElsewhere &&
                    !isPartiallyByOther &&
                    !canCoverThisShift
                  const cannotCoverMeta = getCannotCoverMeta(cannotCoverReason || null)
                  const canOverrideThisRow = cannotCoverMeta.canOverride
                  const isAvailableForShift =
                    canCoverThisShift || assignedToThisSub || isOverridden || isPartiallyByOther
                  const cardLeftBorderColor = isAvailableForShift
                    ? isPartiallyByOther
                      ? '#F59E0B' // amber for partially-covered (can add another partial)
                      : 'rgb(110, 231, 183)' // emerald-300 (green when sub is available for this shift)
                    : 'rgb(226, 232, 240)' // slate-200 (gray when not available)

                  return (
                    <div
                      key={shiftKey}
                      className="flex flex-col justify-between rounded-lg border border-l-4 border-slate-200 bg-slate-50 p-4 shadow-sm"
                      style={{ borderLeftColor: cardLeftBorderColor }}
                    >
                      <div
                        className={`flex justify-center -mr-3 ${
                          responseStatus === 'declined_all' ? '-mb-3 mb-0' : '-mb-3 mb-1'
                        }`}
                      >
                        <ShiftChips
                          mode="availability"
                          canCover={[]}
                          cannotCover={[]}
                          shifts={[
                            {
                              date: shift.date,
                              time_slot_code: shift.time_slot_code,
                              status:
                                canCoverThisShift || isOverridden ? 'available' : 'unavailable',
                              assignment_owner: assignedToThisSub
                                ? 'this_sub'
                                : assignedElsewhere
                                  ? 'other_sub'
                                  : undefined,
                              assigned_sub_name: assignedElsewhere ? shift.sub_name : null,
                              classroom_name: shift.classroom_name ?? null,
                              class_name: shift.class_name ?? null,
                              classroom_color: shift.classroom_color ?? null,
                            },
                          ]}
                          softAvailableStyle
                        />
                      </div>

                      <div
                        className={`text-center flex-grow flex flex-col justify-center mb-1 ${
                          responseStatus === 'declined_all' ? 'mt-0' : 'mt-1'
                        }`}
                      >
                        {assignedToThisSub ? (
                          <div className="space-y-1">
                            <p className="text-sm text-emerald-700 font-medium">
                              Assigned to this sub
                            </p>
                            {assignedToThisSub.is_partial && (
                              <p className="text-xs font-medium" style={{ color: '#92400E' }}>
                                Partial assignment
                                {assignedToThisSubTimeWindow
                                  ? ` (${assignedToThisSubTimeWindow})`
                                  : ''}
                              </p>
                            )}
                          </div>
                        ) : isPartiallyByOther ? (
                          <div className="space-y-1">
                            <p className="text-xs font-medium" style={{ color: '#92400E' }}>
                              Partially covered. You can add another partial assignment.
                            </p>
                            {partialByOtherSummary && (
                              <p className="text-xs text-amber-800">
                                Current partial coverage: {partialByOtherSummary}
                              </p>
                            )}
                          </div>
                        ) : !assignedElsewhere &&
                          (cannotCoverReason || responseStatus === 'declined_all') &&
                          !isOverridden ? (
                          <p
                            className={`text-sm text-slate-500 ${
                              responseStatus === 'declined_all' ? 'mt-0 mb-3' : ''
                            }`}
                          >
                            {responseStatus === 'declined_all'
                              ? 'Declined this shift'
                              : cannotCoverReason}
                          </p>
                        ) : null}
                      </div>

                      <div className="mt-auto pt-2 border-t border-slate-200">
                        <div className="flex items-center justify-center gap-4">
                          {assignedToThisSub && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setRemoveDialogShift(assignedToThisSub)}
                                className="text-rose-700 hover:text-rose-800 hover:bg-transparent px-0 h-auto font-medium hover:underline"
                              >
                                Remove
                              </Button>
                              <div className="w-px h-4 bg-slate-300" />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setChangeDialogShift({
                                    date: shift.date,
                                    time_slot_code: shift.time_slot_code,
                                    fromSubName: sub.name,
                                  })
                                }
                                className="text-teal-700 hover:text-teal-800 hover:bg-transparent px-0 h-auto font-medium hover:underline"
                              >
                                Replace with {sub.name}
                              </Button>
                            </>
                          )}

                          {!assignedToThisSub && assignedElsewhere && (
                            <>
                              {!canSwapToThisSub && canOverrideThisRow && (
                                <>
                                  {responseStatus === 'declined_all' ? (
                                    <span className="text-sm font-medium text-slate-500">
                                      Locked
                                    </span>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleToggleOverride(shiftKey)}
                                      disabled={isSubInactive}
                                      className="text-teal-700 hover:text-teal-800 hover:bg-transparent px-0 h-auto font-medium hover:underline"
                                    >
                                      {isOverridden ? 'Override on' : 'Override'}
                                    </Button>
                                  )}
                                  <div className="w-px h-4 bg-slate-300" />
                                </>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setChangeDialogShift({
                                    date: shift.date,
                                    time_slot_code: shift.time_slot_code,
                                    fromSubName: shift.sub_name || null,
                                    toSubName: sub.name,
                                  })
                                }
                                disabled={!canSwapToThisSub}
                                className="text-teal-700 hover:text-teal-800 hover:bg-transparent px-0 h-auto font-medium hover:underline disabled:opacity-50"
                              >
                                Replace with {sub.name}
                              </Button>
                            </>
                          )}

                          {!assignedToThisSub && !assignedElsewhere && (
                            <>
                              {responseStatus === 'declined_all' ? (
                                <span className="text-sm font-medium text-slate-500">Locked</span>
                              ) : (
                                <>
                                  {cannotCoverReason && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleToggleOverride(shiftKey)}
                                        disabled={isSubInactive || !canOverrideThisRow}
                                        className="text-teal-700 hover:text-teal-800 hover:bg-transparent px-0 h-auto font-medium hover:underline disabled:opacity-50"
                                      >
                                        {isOverridden
                                          ? 'Override on'
                                          : canOverrideThisRow
                                            ? 'Override'
                                            : 'Locked'}
                                      </Button>
                                      <div className="w-px h-4 bg-slate-300" />
                                    </>
                                  )}
                                  <label
                                    className={`inline-flex items-center justify-center gap-2 text-sm ${
                                      canAssignFromCheckbox
                                        ? 'cursor-pointer text-teal-700 hover:text-teal-800'
                                        : 'cursor-not-allowed text-slate-400'
                                    }`}
                                  >
                                    <span className="font-medium hover:underline">Assign</span>
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() =>
                                        handleShiftToggle(
                                          shiftKey,
                                          canCoverThisShift || isOverridden
                                        )
                                      }
                                      disabled={!canAssignFromCheckbox}
                                      className={
                                        canAssignFromCheckbox
                                          ? '!border focus-visible:!ring-2 focus-visible:!ring-[#0d9488] data-[state=checked]:!bg-[#0d9488] data-[state=checked]:!border-[#0d9488] data-[state=checked]:text-white'
                                          : ''
                                      }
                                      style={
                                        canAssignFromCheckbox
                                          ? { borderColor: '#0d9488', borderWidth: 1 }
                                          : undefined
                                      }
                                    />
                                  </label>
                                </>
                              )}
                            </>
                          )}
                        </div>
                        {!assignedToThisSub &&
                          !assignedElsewhere &&
                          isSelected &&
                          responseStatus !== 'declined_all' && (
                            <div className="mt-3 space-y-2 rounded-md border border-slate-200 bg-white px-3 py-2">
                              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                <Checkbox
                                  checked={partialShiftKeys.has(shiftKey)}
                                  onCheckedChange={(checked: boolean) => {
                                    setPartialShiftKeys(prev => {
                                      const next = new Set(prev)
                                      if (checked) {
                                        next.add(shiftKey)
                                      } else {
                                        next.delete(shiftKey)
                                        setPartialShiftTimes(times => {
                                          const nextTimes = { ...times }
                                          delete nextTimes[shiftKey]
                                          return nextTimes
                                        })
                                      }
                                      return next
                                    })
                                  }}
                                />
                                <span>Partial shift (sub covers part of this shift)</span>
                              </label>
                              {partialShiftKeys.has(shiftKey) && (
                                <div className="space-y-2 pl-6">
                                  <p className="text-xs text-muted-foreground">Optional:</p>
                                  <div className="flex items-center gap-2">
                                    <label
                                      className="w-10 text-xs text-muted-foreground"
                                      htmlFor={`partial-from-${shiftKey}`}
                                    >
                                      From
                                    </label>
                                    <input
                                      id={`partial-from-${shiftKey}`}
                                      type="time"
                                      className="h-7 rounded border px-1 py-0.5 text-xs"
                                      value={partialShiftTimes[shiftKey]?.start ?? ''}
                                      onChange={e =>
                                        setPartialShiftTimes(prev => ({
                                          ...prev,
                                          [shiftKey]: { ...prev[shiftKey], start: e.target.value },
                                        }))
                                      }
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <label
                                      className="w-10 text-xs text-muted-foreground"
                                      htmlFor={`partial-to-${shiftKey}`}
                                    >
                                      To
                                    </label>
                                    <input
                                      id={`partial-to-${shiftKey}`}
                                      type="time"
                                      className="h-7 rounded border px-1 py-0.5 text-xs"
                                      value={partialShiftTimes[shiftKey]?.end ?? ''}
                                      onChange={e =>
                                        setPartialShiftTimes(prev => ({
                                          ...prev,
                                          [shiftKey]: { ...prev[shiftKey], end: e.target.value },
                                        }))
                                      }
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Contextual Warnings — mt-8 for consistent 2rem spacing */}
          {warnings.length > 0 && (
            <div className="mt-8 rounded-lg bg-amber-50 border border-amber-200 p-4 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-800 mb-2">
                <AlertTriangle className="h-4 w-4" />
                <span>Important Information</span>
              </div>
              {warnings.map((warning, idx) => (
                <p key={idx} className="text-sm text-amber-700">
                  • {warning}
                </p>
              ))}
            </div>
          )}

          {/* Contact Summary & Notes — mt-8 for consistent 2rem spacing */}
          <div
            ref={contactSummaryRef}
            className="mt-8 rounded-lg bg-white border border-gray-200 p-6 space-y-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
              <h3 className="text-base font-semibold text-slate-800">Contact Status</h3>
              {!fetching && currentContactStatus !== 'not_contacted' && contactedAt && (
                <span className="text-sm text-muted-foreground">
                  Updated {formatContactedTimestamp(contactedAt)}
                </span>
              )}
            </div>
            {fetching ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading contact information...</p>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <RadioGroup
                    value={currentContactStatus}
                    onValueChange={(value: ContactStatus) => applyContactStatusChange(value)}
                    className="space-y-1"
                  >
                    <Label
                      htmlFor="contact_not_contacted"
                      onClick={() => applyContactStatusChange('not_contacted')}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-shadow hover:shadow-sm',
                        currentContactStatus === 'not_contacted'
                          ? 'border-slate-400 bg-slate-100 shadow-sm'
                          : 'border-slate-200 bg-transparent hover:bg-slate-100'
                      )}
                    >
                      <RadioGroupItem
                        value="not_contacted"
                        id="contact_not_contacted"
                        className="shrink-0"
                      />
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                        <PhoneOff className="h-5 w-5 text-slate-600" aria-hidden />
                      </span>
                      <span
                        className={cn(
                          'text-base text-slate-800',
                          currentContactStatus === 'not_contacted' ? 'font-medium' : 'font-normal'
                        )}
                      >
                        Not contacted
                      </span>
                    </Label>

                    <Label
                      htmlFor="contact_pending"
                      onClick={() => applyContactStatusChange('pending')}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-shadow hover:shadow-sm',
                        currentContactStatus === 'pending'
                          ? 'border-sky-400 bg-sky-50 shadow-sm'
                          : 'border-slate-200 bg-transparent hover:bg-sky-50'
                      )}
                    >
                      <RadioGroupItem value="pending" id="contact_pending" className="shrink-0" />
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-50">
                        <Clock className="h-5 w-5 text-sky-700" aria-hidden />
                      </span>
                      <span
                        className={cn(
                          'text-base text-slate-800',
                          currentContactStatus === 'pending' ? 'font-medium' : 'font-normal'
                        )}
                      >
                        Pending
                      </span>
                    </Label>

                    <Label
                      htmlFor="contact_confirmed"
                      onClick={() => applyContactStatusChange('confirmed')}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-shadow hover:shadow-sm',
                        currentContactStatus === 'confirmed'
                          ? 'border-emerald-400 bg-emerald-50 shadow-sm'
                          : 'border-slate-200 bg-transparent hover:bg-emerald-50'
                      )}
                    >
                      <RadioGroupItem
                        value="confirmed"
                        id="contact_confirmed"
                        className="shrink-0"
                      />
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                        <CheckCircle className="h-5 w-5 text-emerald-700" aria-hidden />
                      </span>
                      <span
                        className={cn(
                          'text-base text-slate-800',
                          currentContactStatus === 'confirmed' ? 'font-medium' : 'font-normal'
                        )}
                      >
                        Confirmed (some or all shifts)
                      </span>
                    </Label>

                    <Label
                      htmlFor="contact_declined_all"
                      onClick={() => applyContactStatusChange('declined_all')}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-shadow hover:shadow-sm',
                        currentContactStatus === 'declined_all'
                          ? 'border-rose-400 bg-rose-50 shadow-sm'
                          : 'border-slate-200 bg-transparent hover:bg-rose-50'
                      )}
                    >
                      <RadioGroupItem
                        value="declined_all"
                        id="contact_declined_all"
                        className="shrink-0"
                      />
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-50">
                        <XCircle className="h-5 w-5 text-rose-700" aria-hidden />
                      </span>
                      <span
                        className={cn(
                          'text-base',
                          currentContactStatus === 'declined_all'
                            ? 'font-medium text-rose-800'
                            : 'font-normal text-slate-800'
                        )}
                      >
                        Declined all
                      </span>
                    </Label>
                  </RadioGroup>
                </div>

                <div className="space-y-2 border-t pt-6">
                  <Label htmlFor="notes" className="text-sm font-medium mb-2 block">
                    Notes
                  </Label>
                  <Textarea
                    id="notes"
                    placeholder="e.g. Left a voicemail"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={4}
                    className="resize-none text-lg md:text-lg focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
              </>
            )}
          </div>

          <Dialog
            open={Boolean(removeDialogShift)}
            onOpenChange={open => {
              if (!open && !removingScope) {
                setRemoveDialogShift(null)
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Remove sub assignment?</DialogTitle>
                <DialogDescription>
                  {assignedShifts.length > 1
                    ? `Would you like to remove ${sub.name} from only this shift, or from all shifts for ${absence.teacher_name} on this request?`
                    : `Are you sure you want to remove ${sub.name} from this shift?`}
                </DialogDescription>
                {isConfirmedContact && (
                  <p className="text-sm text-amber-700 mt-2">
                    This sub is marked confirmed. Removing will reopen this shift.
                  </p>
                )}
              </DialogHeader>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRemoveDialogShift(null)}
                  disabled={Boolean(removingScope)}
                >
                  Cancel
                </Button>
                {assignedShifts.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleRemoveAssignedShift('all_for_absence')}
                    disabled={Boolean(removingScope)}
                  >
                    {removingScope === 'all_for_absence' ? 'Removing...' : 'All shifts'}
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={() => handleRemoveAssignedShift('single')}
                  disabled={Boolean(removingScope)}
                >
                  {removingScope === 'single' ? 'Removing...' : 'This shift only'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={Boolean(changeDialogShift)}
            onOpenChange={open => {
              if (!open) {
                setChangeDialogShift(null)
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Change assigned sub?</DialogTitle>
                <DialogDescription>
                  {changeDialogShift?.fromSubName && changeDialogShift?.toSubName
                    ? `This will unassign ${changeDialogShift.fromSubName} and assign ${changeDialogShift.toSubName} for ${formatShiftLabel(changeDialogShift.date, changeDialogShift.time_slot_code)}.`
                    : `This will unassign ${sub.name} from ${
                        changeDialogShift
                          ? formatShiftLabel(
                              changeDialogShift.date,
                              changeDialogShift.time_slot_code
                            )
                          : 'this shift'
                      } and lets you assign a different sub.`}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setChangeDialogShift(null)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (!changeDialogShift) return
                    handleChangeAssignedShift(changeDialogShift)
                    setChangeDialogShift(null)
                  }}
                  disabled={loading}
                >
                  Continue
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={showAssignConfirmDialog}
            onOpenChange={open => {
              if (!loading) setShowAssignConfirmDialog(open)
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign without confirmation?</DialogTitle>
                <DialogDescription>
                  You have not marked this sub as confirmed. Do you want to continue anyway?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAssignConfirmDialog(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    await handleAssignShifts({
                      responseStatusOverride: 'confirmed',
                      isContactedOverride: true,
                    })
                  }}
                  disabled={loading}
                >
                  Mark confirmed and assign
                </Button>
                <Button type="button" onClick={() => handleAssignShifts()} disabled={loading}>
                  Assign without confirming
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={showConfirmedNeedsAssignmentDialog}
            onOpenChange={setShowConfirmedNeedsAssignmentDialog}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assignment required</DialogTitle>
                <DialogDescription>
                  {`${sub.name} is marked as confirmed. Please assign at least one shift or change their response to Pending or Declined.`}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" onClick={() => setShowConfirmedNeedsAssignmentDialog(false)}>
                  OK
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col gap-2 pt-4 pb-6 border-t" style={{ order: 100 }}>
            {isDeclinedWithShiftsSelected ? (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-2">
                <p className="text-sm text-amber-800">⚠️ Conflicting selections</p>
                <p className="text-sm text-amber-800 mt-1">
                  You&apos;ve marked this sub as Declined (all) but also selected shifts.
                </p>
              </div>
            ) : (
              responseStatus === 'declined_all' && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-2">
                  <p className="text-sm text-amber-800">Declining all shifts</p>
                </div>
              )
            )}
            {isSubInactive && (
              <div className="rounded-lg bg-gray-100 border border-gray-300 p-3 mb-2">
                <p className="text-sm text-gray-700">
                  This sub is inactive. Assignment is disabled.
                </p>
              </div>
            )}
            {responseStatus !== 'declined_all' && !hasPendingAssignmentChanges && (
              <p className="text-xs text-slate-500 mb-1">
                {hasAssignedToThisSub
                  ? 'To remove or swap existing assignments, use the buttons next to each assigned shift above. Select a new shift to enable Assign.'
                  : 'No pending assignment changes. Select a shift to enable Assign.'}
              </p>
            )}
            {showConfirmedNoShiftWarning && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-2">
                <p className="text-sm text-amber-800">
                  This sub is marked as confirmed. Please assign at least one shift or mark this sub
                  as Pending.
                </p>
              </div>
            )}
            {previewMode && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 mb-2">
                <p className="text-sm text-amber-800 font-medium">
                  Preview only — assignment is not available.
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  Create a time off request for this range to contact and assign subs.
                </p>
              </div>
            )}
            {!previewMode &&
              absence?.id?.startsWith('manual-') &&
              !coverageRequestId &&
              onCreateTimeOffRequest && (
                <div className="rounded-lg border border-sky-200 bg-sky-50/80 p-3 mb-2">
                  <p className="text-sm text-slate-700 mb-2">
                    Assigning requires a time off request for this range.
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button size="sm" className="w-full" onClick={onCreateTimeOffRequest}>
                      Create time off for this range
                    </Button>
                    {onAddExtraCoverage && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full text-slate-600"
                        onClick={onAddExtraCoverage}
                      >
                        I meant to add extra coverage (no absence)
                      </Button>
                    )}
                  </div>
                </div>
              )}
            <TooltipProvider>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
                  Cancel
                </Button>
                {!previewMode &&
                  (isDeclinedWithShiftsSelected ? (
                    <>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={handleMarkAsDeclined}
                        disabled={loading || fetching || !coverageRequestId}
                      >
                        Mark as Declined
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={handleChangeToConfirmed}
                        disabled={loading || fetching || !coverageRequestId}
                      >
                        Change to Confirmed
                      </Button>
                    </>
                  ) : responseStatus === 'declined_all' ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex-1">
                          <Button
                            variant="outline"
                            className="flex-1 w-full"
                            onClick={handleSave}
                            disabled={true}
                          >
                            Save
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Save isn&apos;t applicable when a sub has declined all shifts.</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={handleSave}
                      disabled={
                        loading ||
                        fetching ||
                        !coverageRequestId ||
                        (responseStatus === 'confirmed' &&
                          selectedShiftsCount === 0 &&
                          !hasAssignedToThisSub)
                      }
                    >
                      Save
                    </Button>
                  ))}
                {!previewMode && !isDeclinedWithShiftsSelected && (
                  <Button
                    variant="default"
                    className="flex-1 !bg-teal-600 !text-white hover:!bg-teal-700"
                    onClick={
                      responseStatus === 'declined_all' && selectedShiftsCount === 0
                        ? handleMarkAsDeclinedSave
                        : handleAssignButtonClick
                    }
                    disabled={
                      loading ||
                      fetching ||
                      !coverageRequestId ||
                      (responseStatus !== 'declined_all' &&
                        selectedShiftsCount === 0 &&
                        !hasAssignedToThisSub) ||
                      isSubInactive
                    }
                  >
                    {responseStatus === 'declined_all'
                      ? 'Mark as Declined'
                      : selectedShiftsCount === 0 && hasAssignedToThisSub
                        ? 'Update Assignment'
                        : 'Assign'}
                  </Button>
                )}
              </div>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </>
  )

  if (isInline) {
    return (
      <div className={`h-full overflow-y-auto p-0 ${getPanelBackgroundClasses()}`}>{panelBody}</div>
    )
  }

  return (
    <Sheet open={isOpen} onOpenChange={open => !open && onClose()}>
      <SheetContent
        showCloseButton={false}
        className={`w-full sm:max-w-2xl overflow-y-auto p-0 ${getPanelBackgroundClasses()}`}
      >
        {panelBody}
      </SheetContent>
    </Sheet>
  )
}
