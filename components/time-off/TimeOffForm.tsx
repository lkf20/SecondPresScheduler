'use client'

import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { Resolver, SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import DatePickerInput from '@/components/ui/date-picker-input'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import FormField from '@/components/shared/FormField'
import ErrorMessage from '@/components/shared/ErrorMessage'
import ShiftSelectionTable from '@/components/time-off/ShiftSelectionTable'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { Database } from '@/types/database'
import { useDisplayNameFormat } from '@/lib/hooks/use-display-name-format'
import { getStaffDisplayName } from '@/lib/utils/staff-display-name'
import { useSchool } from '@/lib/contexts/SchoolContext'
import {
  invalidateDashboard,
  invalidateTimeOffRequests,
  invalidateSubFinderAbsences,
  invalidateWeeklySchedule,
} from '@/lib/utils/invalidation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Staff = Database['public']['Tables']['staff']['Row']

const timeOffSchema = z.object({
  teacher_id: z.string().min(1, 'Teacher is required'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional(),
  shift_selection_mode: z.enum(['all_scheduled', 'select_shifts']).default('all_scheduled'),
  reason: z.enum(['Vacation', 'Sick Day', 'Training', 'Other']).optional(),
  notes: z.string().optional(),
})

type TimeOffFormData = z.infer<typeof timeOffSchema>

interface TimeOffFormProps {
  onSuccess?: (teacherName: string, startDate: string, endDate: string) => void
  onCancel?: () => void
  onHasUnsavedChanges?: (hasChanges: boolean) => void
  clearDraftOnMount?: boolean // Force clear draft when component mounts
  timeOffRequestId?: string | null // ID of time off request to edit
  initialStartDate?: string
  initialEndDate?: string
  initialTeacherId?: string
  initialSelectedShifts?: Array<{ date: string; day_of_week_id: string; time_slot_id: string }>
  hidePageHeader?: boolean
}

const TimeOffForm = React.forwardRef<{ reset: () => void }, TimeOffFormProps>(
  (
    {
      onSuccess,
      onCancel,
      onHasUnsavedChanges,
      clearDraftOnMount = false,
      timeOffRequestId = null,
      initialStartDate,
      initialEndDate,
      initialTeacherId,
      initialSelectedShifts,
      hidePageHeader = false,
    },
    ref
  ) => {
    const router = useRouter()
    const queryClient = useQueryClient()
    const schoolId = useSchool()
    const { format: displayNameFormat } = useDisplayNameFormat()
    const [error, setError] = useState<string | null>(null)
    const [teachers, setTeachers] = useState<Staff[]>([])
    const [teacherQuery, setTeacherQuery] = useState('')
    const [isTeacherSearchOpen, setIsTeacherSearchOpen] = useState(false)
    const [selectedShifts, setSelectedShifts] = useState<
      Array<{ date: string; day_of_week_id: string; time_slot_id: string }>
    >([])
    const [conflictSummary, setConflictSummary] = useState({ conflictCount: 0, totalScheduled: 0 })
    const [conflictingRequests, setConflictingRequests] = useState<
      Array<{ id: string; start_date: string; end_date: string | null; reason: string | null }>
    >([])
    const [endDateCorrected, setEndDateCorrected] = useState(false)
    const justCorrectedRef = useRef(false)
    const [isPastDate, setIsPastDate] = useState(false)
    const hasHydratedDraftRef = useRef(false)
    const [isDraftRestored, setIsDraftRestored] = useState(false)
    const [isLoadingRequest, setIsLoadingRequest] = useState(false)
    const [showCancelDialog, setShowCancelDialog] = useState(false)
    const [isCancelling, setIsCancelling] = useState(false)
    const [assignmentData, setAssignmentData] = useState<{
      hasAssignments: boolean
      assignmentCount: number
      assignments: Array<{
        id: string
        display: string
        date: string
        dayName: string
        timeSlot: string
        subName: string
        classroom: string
      }>
      teacherName: string
    } | null>(null)
    const [showAssignmentDetails, setShowAssignmentDetails] = useState(false)
    const [assignmentHandling, setAssignmentHandling] = useState<'unassign' | 'keep'>('unassign')
    const getTeacherDisplayName = useCallback(
      (teacher: Staff) =>
        getStaffDisplayName(
          {
            first_name: teacher.first_name ?? '',
            last_name: teacher.last_name ?? '',
            display_name: teacher.display_name ?? null,
          },
          displayNameFormat
        ),
      [displayNameFormat]
    )
    const filteredTeachers = useMemo(() => {
      const query = teacherQuery.trim().toLowerCase()
      if (!query) return teachers
      return teachers.filter(teacher => {
        const label = getTeacherDisplayName(teacher)
        return label.toLowerCase().includes(query)
      })
    }, [teacherQuery, teachers, getTeacherDisplayName])
    const draftKey = timeOffRequestId ? `time-off:edit:${timeOffRequestId}` : 'time-off:new'
    const initialFormStateRef = useRef<{
      teacher_id: string
      start_date: string
      end_date: string | undefined
      shift_selection_mode: 'all_scheduled' | 'select_shifts'
      reason: string | undefined
      notes: string | undefined
      selectedShifts: Array<{ date: string; day_of_week_id: string; time_slot_id: string }>
    } | null>(null)

    const focusEndDate = () => {
      if (typeof window === 'undefined') return
      window.requestAnimationFrame(() => {
        const endDateEl = document.getElementById('time-off-end-date')
        endDateEl?.focus()
        endDateEl?.click()
      })
    }

    const focusStartDate = () => {
      if (typeof window === 'undefined') return
      window.requestAnimationFrame(() => {
        document.getElementById('time-off-start-date')?.focus()
      })
    }

    useEffect(() => {
      fetch('/api/teachers')
        .then(r => r.json())
        .then(data => {
          const sorted = (data as Staff[]).sort((a, b) => {
            const nameA = getTeacherDisplayName(a) || ''
            const nameB = getTeacherDisplayName(b) || ''
            return nameA.localeCompare(nameB)
          })
          setTeachers(sorted)
        })
        .catch(console.error)
    }, [getTeacherDisplayName])

    const {
      register,
      handleSubmit,
      formState: { errors, isSubmitting },
      setValue,
      setError: setFormError,
      clearErrors,
      watch,
      reset,
      getValues,
    } = useForm<TimeOffFormData>({
      resolver: zodResolver(timeOffSchema) as Resolver<TimeOffFormData>,
      defaultValues: {
        shift_selection_mode: 'all_scheduled',
      },
    })

    useEffect(() => {
      if (timeOffRequestId) return
      if (initialStartDate) {
        setValue('start_date', initialStartDate, { shouldValidate: true })
      }
      if (initialEndDate) {
        setValue('end_date', initialEndDate, { shouldValidate: true })
      }
      if (initialTeacherId) {
        setValue('teacher_id', initialTeacherId, { shouldValidate: true })
      }
      if (initialSelectedShifts && initialSelectedShifts.length > 0) {
        setSelectedShifts(initialSelectedShifts)
        setValue('shift_selection_mode', 'select_shifts', { shouldValidate: true })
      }
    }, [initialStartDate, initialEndDate, initialTeacherId, setValue, timeOffRequestId])

    // Load existing time off request data when editing (after useForm is initialized)
    useEffect(() => {
      if (!timeOffRequestId) return

      setIsLoadingRequest(true)
      fetch(`/api/time-off/${timeOffRequestId}`)
        .then(r => {
          if (!r.ok) {
            throw new Error(`Failed to fetch: ${r.status} ${r.statusText}`)
          }
          return r.json()
        })
        .then(requestData => {
          // Populate form with existing data
          reset({
            teacher_id: requestData.teacher_id || '',
            start_date: requestData.start_date || '',
            end_date: requestData.end_date || '',
            shift_selection_mode: requestData.shift_selection_mode || 'all_scheduled',
            reason: requestData.reason || undefined,
            notes: requestData.notes || '',
          })

          // Load existing shifts
          let loadedShifts: Array<{ date: string; day_of_week_id: string; time_slot_id: string }> =
            []
          if (requestData.shifts && Array.isArray(requestData.shifts)) {
            loadedShifts = requestData.shifts.map(
              (shift: { date: string; day_of_week_id: string; time_slot_id: string }) => ({
                date: shift.date,
                day_of_week_id: shift.day_of_week_id || '',
                time_slot_id: shift.time_slot_id,
              })
            )
            setSelectedShifts(loadedShifts)
          }

          // Capture initial state immediately after loading (for edit mode)
          // Use a small delay to ensure form state is settled after reset()
          setTimeout(() => {
            const currentValues = getValues()
            initialFormStateRef.current = {
              teacher_id: currentValues.teacher_id || '',
              start_date: currentValues.start_date || '',
              end_date: currentValues.end_date || undefined,
              shift_selection_mode: currentValues.shift_selection_mode || 'all_scheduled',
              reason: currentValues.reason || undefined,
              notes: currentValues.notes || undefined,
              selectedShifts: [...loadedShifts],
            }
            setIsInitialStateCaptured(true)
            setIsDraftRestored(true)
          }, 100)

          setIsLoadingRequest(false)
        })
        .catch(error => {
          console.error('Failed to load time off request:', error)
          setError('Failed to load time off request')
          setIsLoadingRequest(false)
        })
    }, [timeOffRequestId, reset, getValues])

    // Track if we've captured the initial state yet
    const [isInitialStateCaptured, setIsInitialStateCaptured] = useState(false)

    // Capture initial state after draft restoration completes
    // We need to wait for draft restoration to finish before capturing initial state
    useEffect(() => {
      // Wait for draft restoration to complete
      if (!isDraftRestored) {
        return // Don't capture yet if draft restoration hasn't completed
      }

      // Capture initial state after a brief delay to ensure form is settled
      const timer = setTimeout(() => {
        if (!isInitialStateCaptured) {
          const currentValues = getValues()
          initialFormStateRef.current = {
            teacher_id: currentValues.teacher_id || '',
            start_date: currentValues.start_date || '',
            end_date: currentValues.end_date || undefined,
            shift_selection_mode: currentValues.shift_selection_mode || 'all_scheduled',
            reason: currentValues.reason || undefined,
            notes: currentValues.notes || undefined,
            selectedShifts: [...selectedShifts],
          }
          console.log('[TimeOffForm] Captured initial state:', initialFormStateRef.current)
          setIsInitialStateCaptured(true)
        }
      }, 150) // Small delay to ensure all initialization is complete

      return () => clearTimeout(timer)
    }, [isDraftRestored, isInitialStateCaptured, getValues, selectedShifts])

    // Expose reset method via ref
    React.useImperativeHandle(ref, () => ({
      reset: () => {
        reset({
          teacher_id: '',
          start_date: '',
          end_date: '',
          shift_selection_mode: 'all_scheduled',
          reason: undefined,
          notes: undefined,
        })
        setSelectedShifts([])
        setError(null)
        setConflictSummary({ conflictCount: 0, totalScheduled: 0 })
        setConflictingRequests([])
        setEndDateCorrected(false)
        setIsPastDate(false)
        // Reset initial state reference and flag
        initialFormStateRef.current = {
          teacher_id: '',
          start_date: '',
          end_date: undefined,
          shift_selection_mode: 'all_scheduled',
          reason: undefined,
          notes: undefined,
          selectedShifts: [],
        }
        setIsInitialStateCaptured(false)
        setIsDraftRestored(false)
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem(draftKey)
        }
      },
    }))

    // Track unsaved changes by comparing current state to initial state
    // Only check after initial state has been captured
    const currentValues = watch()
    const hasUnsavedChanges = (() => {
      // Don't show warning if we haven't captured initial state yet
      if (!isInitialStateCaptured || !initialFormStateRef.current) {
        return false
      }

      const initial = initialFormStateRef.current

      // Normalize values for comparison (treat empty string, null, and undefined as the same)
      const normalize = (value: string | undefined | null): string | undefined => {
        if (value === '' || value === null || value === undefined) return undefined
        return String(value).trim()
      }

      // Normalize dates for comparison (handle date format variations)
      const normalizeDate = (dateStr: string | undefined | null): string | undefined => {
        if (!dateStr) return undefined
        // If already in YYYY-MM-DD format, return as is
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
        // Try to parse and format
        try {
          const date = new Date(dateStr)
          if (isNaN(date.getTime())) return undefined
          return date.toISOString().split('T')[0]
        } catch {
          return undefined
        }
      }

      // Check if form fields have changed
      const teacherIdChanged = normalize(currentValues.teacher_id) !== normalize(initial.teacher_id)
      const startDateChanged =
        normalizeDate(currentValues.start_date) !== normalizeDate(initial.start_date)
      const endDateChanged =
        normalizeDate(currentValues.end_date) !== normalizeDate(initial.end_date)
      const shiftModeChanged = currentValues.shift_selection_mode !== initial.shift_selection_mode
      const reasonChanged = normalize(currentValues.reason) !== normalize(initial.reason)
      const notesChanged = normalize(currentValues.notes) !== normalize(initial.notes)

      const formFieldChanges = {
        teacher_id: teacherIdChanged,
        start_date: startDateChanged,
        end_date: endDateChanged,
        shift_selection_mode: shiftModeChanged,
        reason: reasonChanged,
        notes: notesChanged,
      }

      const formChanged = Object.values(formFieldChanges).some(Boolean)

      // Check if selected shifts have changed
      // Sort both arrays for consistent comparison
      const sortShifts = (
        shifts: Array<{ date: string; day_of_week_id: string; time_slot_id: string }>
      ) => {
        return [...shifts].sort((a, b) => {
          const keyA = `${a.date}::${a.time_slot_id}`
          const keyB = `${b.date}::${b.time_slot_id}`
          return keyA.localeCompare(keyB)
        })
      }

      const currentShiftsSorted = sortShifts(selectedShifts)
      const initialShiftsSorted = sortShifts(initial.selectedShifts)

      const shiftsChanged = (() => {
        if (currentShiftsSorted.length !== initialShiftsSorted.length) {
          return true
        }

        // Compare each shift
        for (let i = 0; i < currentShiftsSorted.length; i++) {
          const current = currentShiftsSorted[i]
          const initial = initialShiftsSorted[i]
          if (
            normalizeDate(current.date) !== normalizeDate(initial.date) ||
            current.time_slot_id !== initial.time_slot_id ||
            current.day_of_week_id !== initial.day_of_week_id
          ) {
            return true
          }
        }

        return false
      })()

      const result = formChanged || shiftsChanged

      // Err on the side of showing the dialog - if we're not 100% sure there are no changes, show it
      // But if we're certain nothing changed, don't show it
      return result
    })()

    // Notify parent of unsaved changes status
    useEffect(() => {
      if (onHasUnsavedChanges) {
        onHasUnsavedChanges(hasUnsavedChanges)
      }
    }, [hasUnsavedChanges, onHasUnsavedChanges, currentValues, selectedShifts])

    const teacherId = watch('teacher_id')
    const startDate = watch('start_date')
    const endDate = watch('end_date')
    const shiftMode = watch('shift_selection_mode')
    const reason = watch('reason')
    const selectedTeacherName = useMemo(() => {
      if (!teacherId) return ''
      const teacher = teachers.find(item => item.id === teacherId)
      if (!teacher) return ''
      return getTeacherDisplayName(teacher)
    }, [teacherId, teachers, getTeacherDisplayName])
    const allShiftsRecorded =
      conflictSummary.totalScheduled > 0 &&
      conflictSummary.conflictCount === conflictSummary.totalScheduled

    const formatRange = (start: string, end?: string | null) => {
      const [startYear, startMonth, startDay] = start.split('-').map(Number)
      const startDate = new Date(startYear, startMonth - 1, startDay)
      const endSource = end || start
      const [endYear, endMonth, endDay] = endSource.split('-').map(Number)
      const endDate = new Date(endYear, endMonth - 1, endDay)
      const startLabel = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const endLabel = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`
    }

    const hasDateRange = Boolean(startDate)
    const rangeLabel = hasDateRange ? formatRange(startDate, endDate || startDate) : ''

    useEffect(() => {
      if (startDate) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const selectedDate = new Date(startDate)
        selectedDate.setHours(0, 0, 0, 0)
        setIsPastDate(selectedDate < today)
      } else {
        setIsPastDate(false)
      }
    }, [startDate])

    useEffect(() => {
      if (typeof window === 'undefined') return
      if (hasHydratedDraftRef.current) return

      // If clearDraftOnMount is true, clear the draft and skip restoration
      if (clearDraftOnMount) {
        window.sessionStorage.removeItem(draftKey)
        hasHydratedDraftRef.current = true
        setIsDraftRestored(true)
        return
      }

      const raw = window.sessionStorage.getItem(draftKey)
      if (!raw) {
        hasHydratedDraftRef.current = true
        setIsDraftRestored(true)
        return
      }
      try {
        const draft = JSON.parse(raw) as {
          form?: Partial<TimeOffFormData>
          selectedShifts?: Array<{ date: string; day_of_week_id: string; time_slot_id: string }>
          updatedAt?: number
        }

        // Invalidate drafts older than 24 hours
        const DRAFT_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours
        if (draft.updatedAt && Date.now() - draft.updatedAt > DRAFT_EXPIRY_MS) {
          console.log('[TimeOffForm] Draft expired, clearing:', {
            age: Date.now() - draft.updatedAt,
            expiry: DRAFT_EXPIRY_MS,
          })
          window.sessionStorage.removeItem(draftKey)
          hasHydratedDraftRef.current = true
          setIsDraftRestored(true)
          return
        }

        if (draft.form) {
          reset({ shift_selection_mode: 'all_scheduled', ...draft.form })
        }
        if (draft.selectedShifts) {
          setSelectedShifts(draft.selectedShifts)
        }
      } catch (error) {
        console.error('Failed to restore time off draft:', error)
        // Clear corrupted draft
        window.sessionStorage.removeItem(draftKey)
      }
      hasHydratedDraftRef.current = true
      setIsDraftRestored(true)
    }, [reset, draftKey, clearDraftOnMount])

    useEffect(() => {
      if (typeof window === 'undefined') return
      const subscription = watch(value => {
        const payload = {
          form: value,
          selectedShifts,
          updatedAt: Date.now(),
        }
        window.sessionStorage.setItem(draftKey, JSON.stringify(payload))
      })
      return () => subscription.unsubscribe()
    }, [watch, selectedShifts, draftKey])

    useEffect(() => {
      if (startDate && endDate) {
        if (endDate < startDate) {
          setValue('end_date', startDate, { shouldValidate: false })
          justCorrectedRef.current = true
          setEndDateCorrected(true)
          const timer = setTimeout(() => {
            setEndDateCorrected(false)
            justCorrectedRef.current = false
          }, 5000)
          return () => clearTimeout(timer)
        } else if (endDate === startDate && justCorrectedRef.current) {
          // Keep the message visible if we just corrected it
        } else {
          setEndDateCorrected(false)
          justCorrectedRef.current = false
        }
      } else {
        setEndDateCorrected(false)
        justCorrectedRef.current = false
      }
    }, [startDate, endDate, setValue])

    useEffect(() => {
      if (shiftMode === 'select_shifts' && selectedShifts.length > 0) {
        clearErrors('shift_selection_mode')
      }
      if (shiftMode === 'all_scheduled') {
        clearErrors('shift_selection_mode')
      }
    }, [shiftMode, selectedShifts.length, clearErrors])

    const onSubmit: SubmitHandler<TimeOffFormData> = async data => {
      try {
        setError(null)
        if (allShiftsRecorded) {
          setError('All selected shifts already have time off recorded.')
          return
        }
        if (data.shift_selection_mode === 'select_shifts' && selectedShifts.length === 0) {
          setFormError('shift_selection_mode', {
            type: 'manual',
            message: 'Select at least one shift.',
          })
          return
        }
        const effectiveEndDate = data.end_date || data.start_date

        const payload: {
          teacher_id: string
          start_date: string
          end_date: string
          reason: string | null
          notes: string | null
          shift_selection_mode: 'all_scheduled' | 'select_shifts'
          shifts?: Array<{ date: string; day_of_week_id: string; time_slot_id: string }>
        } = {
          teacher_id: data.teacher_id,
          start_date: data.start_date,
          end_date: effectiveEndDate,
          reason: data.reason || null,
          notes: data.notes || null,
          shift_selection_mode: data.shift_selection_mode,
        }

        if (data.shift_selection_mode === 'select_shifts' && selectedShifts.length > 0) {
          payload.shifts = selectedShifts
        }

        const url = timeOffRequestId ? `/api/time-off/${timeOffRequestId}` : '/api/time-off'
        const method = timeOffRequestId ? 'PUT' : 'POST'

        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const errorData = await response.json()
          const action = timeOffRequestId ? 'update' : 'create'
          throw new Error(errorData.error || `Failed to ${action} time off request`)
        }

        const responseData = await response.json()

        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem(draftKey)
        }

        // Invalidate React Query caches to refresh all affected pages
        if (schoolId) {
          await Promise.all([
            invalidateDashboard(queryClient, schoolId),
            invalidateTimeOffRequests(queryClient, schoolId),
            invalidateSubFinderAbsences(queryClient, schoolId),
            invalidateWeeklySchedule(queryClient, schoolId),
          ])
        }

        // Get teacher name for toast
        const teacher = teachers.find(t => t.id === data.teacher_id)
        const teacherName = teacher ? getTeacherDisplayName(teacher) : 'Teacher'

        // Show warning if shifts were excluded
        if (responseData.warning) {
          // Split the warning message by <br> to show as separate lines
          const warningParts = responseData.warning.split('<br>')
          if (warningParts.length === 2) {
            toast.warning(warningParts[0], {
              description: warningParts[1],
            })
          } else {
            // Fallback for any other format
            toast.warning(responseData.warning.replace(/<br>/g, '\n'))
          }
        }

        if (onSuccess) {
          onSuccess(teacherName, data.start_date, effectiveEndDate)
        } else {
          router.push('/time-off')
          router.refresh()
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to create time off request')
      }
    }

    const saveDraft = async () => {
      const values = getValues()
      if (!values.teacher_id) {
        setFormError('teacher_id', { type: 'manual', message: 'Teacher is required.' })
        return
      }
      if (!values.start_date) {
        setFormError('start_date', { type: 'manual', message: 'Start date is required.' })
        return
      }

      try {
        setError(null)
        const effectiveEndDate = values.end_date || values.start_date
        const payload: {
          teacher_id: string
          start_date: string
          end_date: string
          reason: string | null
          notes: string | null
          shift_selection_mode: 'all_scheduled' | 'select_shifts'
          status: 'draft'
          shifts?: Array<{ date: string; day_of_week_id: string; time_slot_id: string }>
        } = {
          teacher_id: values.teacher_id,
          start_date: values.start_date,
          end_date: effectiveEndDate,
          reason: values.reason || null,
          notes: values.notes || null,
          shift_selection_mode: values.shift_selection_mode || 'all_scheduled',
          status: 'draft',
        }

        if (values.shift_selection_mode === 'select_shifts' && selectedShifts.length > 0) {
          payload.shifts = selectedShifts
        }

        const url = timeOffRequestId ? `/api/time-off/${timeOffRequestId}` : '/api/time-off'
        const method = timeOffRequestId ? 'PUT' : 'POST'

        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to save draft')
        }

        await response.json()
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem(draftKey)
        }
        toast.success('Draft saved')
        router.push('/time-off')
        router.refresh()
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to save draft')
      }
    }

    const handleCancelClick = async () => {
      if (!timeOffRequestId) return

      // First, check for assignments
      try {
        const response = await fetch(`/api/time-off/${timeOffRequestId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}), // Empty body to trigger summary response
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to check assignments')
        }

        const data = await response.json()

        if (data.hasAssignments) {
          // Show dialog with assignment details
          setAssignmentData(data)
          setShowCancelDialog(true)
          setAssignmentHandling('unassign') // Default to unassign
        } else {
          // No assignments, show simple confirmation
          setAssignmentData(null)
          setShowCancelDialog(true)
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to check assignments')
      }
    }

    const handleCancelConfirm = async () => {
      if (!timeOffRequestId) return

      setIsCancelling(true)
      try {
        const keepAssignments = assignmentData?.hasAssignments && assignmentHandling === 'keep'

        const response = await fetch(`/api/time-off/${timeOffRequestId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'cancel',
            keepAssignmentsAsExtraCoverage: keepAssignments,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to cancel time off request')
        }

        // Clear any draft data
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem(draftKey)
        }

        // Invalidate React Query caches to refresh all affected pages
        if (schoolId) {
          await Promise.all([
            invalidateDashboard(queryClient, schoolId),
            invalidateTimeOffRequests(queryClient, schoolId),
            invalidateSubFinderAbsences(queryClient, schoolId),
            invalidateWeeklySchedule(queryClient, schoolId),
          ])
        }

        // Show success toast
        const result = await response.json()
        if (result.assignmentsKept > 0) {
          toast.success(
            `Time off request cancelled. ${result.assignmentsKept} assignment${result.assignmentsKept !== 1 ? 's' : ''} kept as extra coverage.`
          )
        } else {
          toast.success('Time off request cancelled')
        }

        // Close the panel and refresh
        if (onCancel) {
          onCancel()
        }
        router.refresh()
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to cancel time off request')
        setIsCancelling(false)
        setShowCancelDialog(false)
      }
    }

    return (
      <div className="h-full flex flex-col">
        {error && <ErrorMessage message={error} className="mb-6" />}

        {isLoadingRequest && (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">Loading time off request...</p>
          </div>
        )}

        {!isLoadingRequest && (
          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-6">
              <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-6">
                <FormField label="Teacher" error={errors.teacher_id?.message} required>
                  <div className="rounded-md border border-input bg-background">
                    <div className="px-2 py-1">
                      <input
                        type="text"
                        tabIndex={1}
                        placeholder="Select a teacher"
                        value={isTeacherSearchOpen ? teacherQuery : selectedTeacherName}
                        onChange={event => {
                          if (!isTeacherSearchOpen) {
                            setIsTeacherSearchOpen(true)
                          }
                          setTeacherQuery(event.target.value)
                        }}
                        onFocus={() => {
                          setTeacherQuery('')
                          setIsTeacherSearchOpen(true)
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            setIsTeacherSearchOpen(false)
                            setTeacherQuery('')
                          }, 150)
                        }}
                        onKeyDown={event => {
                          if (event.key === 'Tab' && !event.shiftKey) {
                            event.preventDefault()
                            focusStartDate()
                          }
                        }}
                        className="w-full bg-transparent text-sm focus:outline-none"
                      />
                    </div>
                    {isTeacherSearchOpen && (
                      <div className="border-t border-slate-100 max-h-40 overflow-y-auto px-2 py-1">
                        {filteredTeachers.map(teacher => {
                          const label = getTeacherDisplayName(teacher)
                          const isSelected = teacher.id === teacherId
                          return (
                            <button
                              key={teacher.id}
                              type="button"
                              className={`w-full rounded px-1.5 py-1 text-left text-sm text-slate-700 hover:bg-slate-100 ${
                                isSelected ? 'bg-slate-100 opacity-60' : ''
                              }`}
                              onClick={() => {
                                if (isSelected) return
                                setValue('teacher_id', teacher.id, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                })
                                setTeacherQuery('')
                                setIsTeacherSearchOpen(false)
                              }}
                              disabled={isSelected}
                            >
                              {label || 'Unnamed teacher'}
                            </button>
                          )
                        })}
                        {filteredTeachers.length === 0 && (
                          <div className="px-1.5 py-1 text-sm text-muted-foreground">
                            No matching teachers
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </FormField>

                <FormField label="Start Date" error={errors.start_date?.message} required>
                  <DatePickerInput
                    id="time-off-start-date"
                    value={startDate || ''}
                    includeWeekdayInDisplay={Boolean(timeOffRequestId)}
                    onChange={value => {
                      setValue('start_date', value, { shouldValidate: true, shouldDirty: true })
                      if (value) focusEndDate()
                    }}
                    placeholder="Select start date"
                    tabIndex={2}
                  />
                  <input type="hidden" {...register('start_date')} />
                  {isPastDate && (
                    <p className="text-xs text-yellow-600 mt-1">
                      You are recording time off for a past date.
                    </p>
                  )}
                </FormField>

                <FormField label="End Date" error={errors.end_date?.message}>
                  <DatePickerInput
                    id="time-off-end-date"
                    value={endDate || ''}
                    includeWeekdayInDisplay={Boolean(timeOffRequestId)}
                    openToDate={startDate || ''}
                    onChange={value =>
                      setValue('end_date', value, { shouldValidate: true, shouldDirty: true })
                    }
                    placeholder="Optional - leave blank for single day"
                    allowClear
                    closeOnSelect
                    tabIndex={3}
                  />
                  <input type="hidden" {...register('end_date')} />
                  {endDateCorrected && (
                    <p className="text-xs text-yellow-600 mt-1">
                      End date was updated to match the start date.
                    </p>
                  )}
                  {!endDateCorrected && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Optional. If not specified, time off will be for the start date only.
                    </p>
                  )}
                </FormField>
              </div>

              <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-4">
                <FormField label="Shifts" error={errors.shift_selection_mode?.message} required>
                  <RadioGroup
                    value={shiftMode || 'all_scheduled'}
                    onValueChange={value =>
                      setValue('shift_selection_mode', value as 'all_scheduled' | 'select_shifts')
                    }
                  >
                    <div className="flex items-center space-x-6">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="all_scheduled" id="shifts-all" tabIndex={4} />
                        <Label htmlFor="shifts-all" className="font-normal cursor-pointer">
                          All scheduled shifts
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="select_shifts" id="shifts-select" tabIndex={5} />
                        <Label htmlFor="shifts-select" className="font-normal cursor-pointer">
                          Select shifts
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>
                </FormField>

                <div className="space-y-4">
                  {shiftMode === 'select_shifts' && selectedShifts.length === 0 && (
                    <p className="text-sm text-yellow-600">Select at least one shift.</p>
                  )}
                  {shiftMode === 'all_scheduled' && teacherId && (
                    <p className="text-sm text-muted-foreground">
                      All scheduled shifts will be logged. Switch to &quot;Select shifts&quot; to
                      make changes.
                    </p>
                  )}
                  {hasDateRange && (
                    <p className="text-xs text-muted-foreground">
                      Scheduled shifts from {rangeLabel}
                    </p>
                  )}
                  {(conflictSummary.conflictCount > 0 || conflictingRequests.length > 0) && (
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50/40 p-4 space-y-3">
                      {conflictSummary.conflictCount > 0 && (
                        <p className="text-sm text-yellow-600 flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                          This teacher already has time off recorded for{' '}
                          {conflictSummary.conflictCount} of these shifts. This shift
                          {conflictSummary.conflictCount !== 1 ? 's will' : ' will'} not be included
                          in this time off request.
                        </p>
                      )}
                      {conflictingRequests.length > 0 && (
                        <div className="ml-6 space-y-2">
                          <div className="text-xs font-medium text-yellow-700">
                            Existing time off requests
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {conflictingRequests.map(request => (
                              <a
                                key={request.id}
                                href={`/time-off?edit=${request.id}`}
                                className="inline-flex items-center rounded-md border border-yellow-200 bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-700 hover:underline"
                              >
                                {formatRange(request.start_date, request.end_date)}
                                {request.reason ? ` (${request.reason})` : ''}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <ShiftSelectionTable
                    teacherId={teacherId || null}
                    startDate={startDate || ''}
                    endDate={endDate || startDate || ''}
                    selectedShifts={selectedShifts}
                    onShiftsChange={setSelectedShifts}
                    onConflictSummaryChange={setConflictSummary}
                    onConflictRequestsChange={setConflictingRequests}
                    excludeRequestId={timeOffRequestId || undefined}
                    validateConflicts
                    disabled={shiftMode === 'all_scheduled'}
                  />
                  {conflictSummary.conflictCount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Already recorded shifts are locked and can&apos;t be selected.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-6">
                <h3 className="text-sm font-medium">Optional Details</h3>
                <div className="space-y-6">
                  <FormField label="Reason" error={errors.reason?.message}>
                    <RadioGroup
                      value={reason || ''}
                      onValueChange={value =>
                        setValue('reason', value as 'Vacation' | 'Sick Day' | 'Training' | 'Other')
                      }
                    >
                      <div className="flex items-center space-x-6">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Vacation" id="reason-vacation" tabIndex={6} />
                          <Label htmlFor="reason-vacation" className="font-normal cursor-pointer">
                            Vacation
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Sick Day" id="reason-sick" tabIndex={7} />
                          <Label htmlFor="reason-sick" className="font-normal cursor-pointer">
                            Sick Day
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Training" id="reason-training" tabIndex={8} />
                          <Label htmlFor="reason-training" className="font-normal cursor-pointer">
                            Training
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Other" id="reason-other" tabIndex={9} />
                          <Label htmlFor="reason-other" className="font-normal cursor-pointer">
                            Other
                          </Label>
                        </div>
                      </div>
                    </RadioGroup>
                  </FormField>

                  <FormField label="Notes" error={errors.notes?.message}>
                    <Textarea {...register('notes')} placeholder="Optional notes" tabIndex={10} />
                  </FormField>
                </div>
              </div>

              {allShiftsRecorded && (
                <p className="text-sm text-yellow-600">
                  All selected shifts already have time off recorded.
                </p>
              )}
            </div>

            <div className="flex justify-between items-center pt-6 pb-8 border-t mt-6">
              {/* Left side - Delete button (only in edit mode) */}
              <div>
                {timeOffRequestId && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleCancelClick}
                    tabIndex={14}
                  >
                    Cancel Time Off Request
                  </Button>
                )}
              </div>

              {/* Right side - Action buttons */}
              <div className="flex gap-4">
                {onCancel && (
                  <Button type="button" variant="outline" onClick={onCancel} tabIndex={11}>
                    Cancel
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={saveDraft} tabIndex={12}>
                  Save as Draft
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    allShiftsRecorded ||
                    (Boolean(timeOffRequestId) && !hasUnsavedChanges)
                  }
                  tabIndex={13}
                >
                  {isSubmitting
                    ? timeOffRequestId
                      ? 'Updating...'
                      : 'Creating...'
                    : timeOffRequestId
                      ? 'Update'
                      : 'Create'}
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* Cancel Confirmation Dialog */}
        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {assignmentData?.hasAssignments
                  ? 'Cancel time off and sub coverage?'
                  : `Cancel this time off request for ${assignmentData?.teacherName || 'this teacher'}?`}
              </DialogTitle>
              <DialogDescription className="space-y-4">
                {assignmentData?.hasAssignments ? (
                  <>
                    <p>
                      This time off request has sub assignment
                      {assignmentData.assignmentCount !== 1 ? 's' : ''} on{' '}
                      {assignmentData.assignmentCount} shift
                      {assignmentData.assignmentCount !== 1 ? 's' : ''}.
                    </p>

                    {/* View Details Section */}
                    <div>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setShowAssignmentDetails(!showAssignmentDetails)}
                        className="w-full flex items-center justify-between p-2 hover:bg-gray-100"
                      >
                        <span className="font-medium text-sm">View details</span>
                        {showAssignmentDetails ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>

                      {showAssignmentDetails && (
                        <div className="mt-2 p-4 bg-gray-50 rounded-md border border-gray-200 max-h-60 overflow-y-auto">
                          <ul className="space-y-2">
                            {assignmentData.assignments.map(assignment => (
                              <li key={assignment.id} className="text-sm text-gray-700">
                                {assignment.display}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 pt-2">
                      <p className="text-sm font-medium">
                        What would you like to do with{' '}
                        {assignmentData.assignmentCount === 1
                          ? 'this assignment'
                          : 'these assignments'}
                        ?
                      </p>

                      <RadioGroup
                        value={assignmentHandling}
                        onValueChange={value => setAssignmentHandling(value as 'unassign' | 'keep')}
                        className="space-y-3"
                      >
                        <div className="flex items-start space-x-3 p-3 border rounded-md hover:bg-gray-50">
                          <RadioGroupItem value="unassign" id="unassign" className="mt-0.5" />
                          <div className="flex-1">
                            <Label htmlFor="unassign" className="font-medium cursor-pointer">
                              Unassign subs from these shifts
                            </Label>
                            <p className="text-sm text-muted-foreground mt-1">
                              Sub coverage for this request will be removed, and these subs will be
                              available for other assignments.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start space-x-3 p-3 border rounded-md hover:bg-gray-50">
                          <RadioGroupItem value="keep" id="keep" className="mt-0.5" />
                          <div className="flex-1">
                            <Label htmlFor="keep" className="font-medium cursor-pointer">
                              Keep sub assignments as extra coverage
                            </Label>
                            <p className="text-sm text-muted-foreground mt-1">
                              Keep these subs scheduled even though the time off request is
                              cancelled.
                            </p>
                          </div>
                        </div>
                      </RadioGroup>
                    </div>
                  </>
                ) : (
                  <p>
                    Are you sure you want to cancel this time off request? This action cannot be
                    undone.
                  </p>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCancelDialog(false)
                  setShowAssignmentDetails(false)
                  setAssignmentHandling('unassign')
                }}
                disabled={isCancelling}
              >
                Cancel
              </Button>
              {assignmentData?.hasAssignments ? (
                <Button variant="destructive" onClick={handleCancelConfirm} disabled={isCancelling}>
                  {isCancelling ? 'Cancelling...' : 'Cancel Time Off'}
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCancelDialog(false)
                    }}
                    disabled={isCancelling}
                  >
                    Keep Request
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleCancelConfirm}
                    disabled={isCancelling}
                  >
                    {isCancelling ? 'Cancelling...' : 'Cancel Time Off'}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }
)

TimeOffForm.displayName = 'TimeOffForm'

export default TimeOffForm
