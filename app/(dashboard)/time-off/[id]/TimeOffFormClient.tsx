'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import DatePickerInput from '@/components/ui/date-picker-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import FormField from '@/components/shared/FormField'
import ErrorMessage from '@/components/shared/ErrorMessage'
import ShiftSelectionTable from '@/components/time-off/ShiftSelectionTable'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

const timeOffSchema = z.object({
  teacher_id: z.string().min(1, 'Teacher is required'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional(), // End date is now optional
  shift_selection_mode: z.enum(['all_scheduled', 'select_shifts']).default('all_scheduled'),
  reason: z.enum(['Vacation', 'Sick Day', 'Training', 'Other']).optional(),
  notes: z.string().optional(),
})

type TimeOffFormData = z.infer<typeof timeOffSchema>

interface TimeOffFormClientProps {
  timeOffRequest: any
}

export default function TimeOffFormClient({ timeOffRequest }: TimeOffFormClientProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [teachers, setTeachers] = useState<any[]>([])
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
  const draftKey = timeOffRequest?.id ? `time-off:edit:${timeOffRequest.id}` : null
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
        // Sort teachers alphabetically by display_name, fallback to first_name
        const sorted = data.sort((a: any, b: any) => {
          const nameA = a.display_name || `${a.first_name} ${a.last_name}`.trim() || ''
          const nameB = b.display_name || `${b.first_name} ${b.last_name}`.trim() || ''
          return nameA.localeCompare(nameB)
        })
        setTeachers(sorted)
      })
      .catch(console.error)
  }, [])

  // Load shifts separately when timeOffRequest changes
  useEffect(() => {
    if (timeOffRequest?.id) {
      // Fetch shifts from API to ensure we have the latest data
      fetch(`/api/time-off/${timeOffRequest.id}`)
        .then(r => r.json())
        .then(data => {
          if (data.shifts && Array.isArray(data.shifts)) {
            const shifts = data.shifts.map((shift: any) => ({
              date: shift.date, // Ensure date is in YYYY-MM-DD format
              day_of_week_id: shift.day_of_week_id || '',
              time_slot_id: shift.time_slot_id,
            }))
            setSelectedShifts(shifts)
          }
        })
        .catch(error => {
          console.error('Failed to load shifts:', error)
        })
    }
  }, [timeOffRequest?.id])

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
    resolver: zodResolver(timeOffSchema),
    defaultValues: timeOffRequest
      ? {
          teacher_id: timeOffRequest.teacher_id || '',
          start_date: timeOffRequest.start_date || '',
          end_date: timeOffRequest.end_date || '',
          shift_selection_mode: timeOffRequest.shift_selection_mode || 'all_scheduled',
          reason: timeOffRequest.reason || undefined,
          notes: timeOffRequest.notes || '',
        }
      : undefined,
  })

  // Reset form when timeOffRequest changes
  useEffect(() => {
    if (timeOffRequest) {
      reset({
        teacher_id: timeOffRequest.teacher_id || '',
        start_date: timeOffRequest.start_date || '',
        end_date: timeOffRequest.end_date || '',
        shift_selection_mode: timeOffRequest.shift_selection_mode || 'all_scheduled',
        reason: timeOffRequest.reason || undefined,
        notes: timeOffRequest.notes || '',
      })

      // Load existing shifts
      if (timeOffRequest.shifts && Array.isArray(timeOffRequest.shifts)) {
        const shifts = timeOffRequest.shifts.map((shift: any) => ({
          date: shift.date,
          day_of_week_id: shift.day_of_week_id || '',
          time_slot_id: shift.time_slot_id,
        }))
        setSelectedShifts(shifts)
      }
    }
  }, [timeOffRequest, reset])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!draftKey) return
    if (hasHydratedDraftRef.current) return
    const raw = window.sessionStorage.getItem(draftKey)
    if (!raw) {
      hasHydratedDraftRef.current = true
      return
    }
    try {
      const draft = JSON.parse(raw) as {
        form?: Partial<TimeOffFormData>
        selectedShifts?: Array<{ date: string; day_of_week_id: string; time_slot_id: string }>
      }
      if (draft.form) {
        reset({ ...draft.form })
      }
      if (draft.selectedShifts) {
        setSelectedShifts(draft.selectedShifts)
      }
    } catch (error) {
      console.error('Failed to restore time off draft:', error)
    }
    hasHydratedDraftRef.current = true
  }, [reset, draftKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!draftKey) return
    const subscription = watch((value) => {
      const payload = {
        form: value,
        selectedShifts,
        updatedAt: Date.now(),
      }
      window.sessionStorage.setItem(draftKey, JSON.stringify(payload))
    })
    return () => subscription.unsubscribe()
  }, [watch, selectedShifts, draftKey])

  const onSubmit = async (data: TimeOffFormData) => {
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
      // If end_date is not provided, use start_date (single day time off)
      const effectiveEndDate = data.end_date || data.start_date

      const payload: any = {
        teacher_id: data.teacher_id,
        start_date: data.start_date,
        end_date: effectiveEndDate,
        reason: data.reason || null,
        notes: data.notes || null,
        shift_selection_mode: data.shift_selection_mode,
      }
      if (timeOffRequest?.status === 'draft') {
        payload.status = 'active'
      }

      // Include shifts if in select_shifts mode
      if (data.shift_selection_mode === 'select_shifts' && selectedShifts.length > 0) {
        payload.shifts = selectedShifts
      }

      const response = await fetch(`/api/time-off/${timeOffRequest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update time off request')
      }

      if (typeof window !== 'undefined' && draftKey) {
        window.sessionStorage.removeItem(draftKey)
      }
      router.push('/time-off')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
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
      const payload: any = {
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

      const response = await fetch(`/api/time-off/${timeOffRequest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save draft')
      }

      if (typeof window !== 'undefined' && draftKey) {
        window.sessionStorage.removeItem(draftKey)
      }
      toast.success('Draft saved')
      router.push('/time-off')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this time off request?')) return

    try {
      setError(null)
      const response = await fetch(`/api/time-off/${timeOffRequest.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete time off request')
      }

      if (typeof window !== 'undefined' && draftKey) {
        window.sessionStorage.removeItem(draftKey)
      }
      router.push('/time-off')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const teacherId = watch('teacher_id')
  const startDate = watch('start_date')
  const endDate = watch('end_date')
  const shiftMode = watch('shift_selection_mode')
  const reason = watch('reason')
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
  const rangeLabel = hasDateRange
    ? formatRange(startDate, endDate || startDate)
    : ''

  // Check if start date is in the past
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

  // Validate end date is not before start date
  useEffect(() => {
    if (startDate && endDate) {
      if (endDate < startDate) {
        setValue('end_date', startDate, { shouldValidate: false })
        justCorrectedRef.current = true
        setEndDateCorrected(true)
        // Clear the message after a few seconds
        const timer = setTimeout(() => {
          setEndDateCorrected(false)
          justCorrectedRef.current = false
        }, 5000)
        return () => clearTimeout(timer)
      } else if (endDate === startDate && justCorrectedRef.current) {
        // Keep the message visible if we just corrected it
        // Don't clear it here, let the timer handle it
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

  return (
    <div>
      <div className="mb-4">
        <Link href="/time-off" className="inline-flex items-center text-sm text-muted-foreground hover:text-slate-900">
          ← Back to Time Off
        </Link>
      </div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Edit Time Off Request</h1>
        <p className="text-muted-foreground mt-2">
          {timeOffRequest.teacher?.display_name ||
            (timeOffRequest.teacher?.first_name && timeOffRequest.teacher?.last_name
              ? `${timeOffRequest.teacher.first_name} ${timeOffRequest.teacher.last_name}`
              : 'Time Off Request')}
        </p>
      </div>

      {timeOffRequest?.status === 'draft' && (
        <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50/40 px-4 py-3 text-sm text-yellow-700">
          This request is a draft and not yet active.
        </div>
      )}

      {error && <ErrorMessage message={error} className="mb-6" />}

      <div className="max-w-2xl">
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-6">
              <FormField label="Teacher" error={errors.teacher_id?.message} required>
                <Select value={teacherId || ''} onValueChange={value => setValue('teacher_id', value)}>
                  <SelectTrigger
                    tabIndex={1}
                    onKeyDown={(event) => {
                      if (event.key === 'Tab' && !event.shiftKey) {
                        event.preventDefault()
                        focusStartDate()
                      }
                    }}
                  >
                    <SelectValue placeholder="Select a teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map(teacher => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.display_name || `${teacher.first_name} ${teacher.last_name}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Start Date" error={errors.start_date?.message} required>
                <DatePickerInput
                  id="time-off-start-date"
                  value={startDate || ''}
                  onChange={(value) => {
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
                  onChange={(value) =>
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
                  <p className="text-sm text-yellow-600">
                    Select at least one shift.
                  </p>
                )}
                {shiftMode === 'all_scheduled' && teacherId && (
                  <p className="text-sm text-muted-foreground">
                    All scheduled shifts will be logged. Switch to &quot;Select shifts&quot; to make
                    changes.
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
                        This teacher already has time off recorded for {conflictSummary.conflictCount}{' '}
                        of these shifts. Existing requests will be shown below.
                      </p>
                    )}
                    {conflictingRequests.length > 0 && (
                      <div className="ml-6 space-y-2">
                        <div className="text-xs font-medium text-yellow-700">
                          Existing time off requests
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {conflictingRequests.map((request) => (
                            <Link
                              key={request.id}
                              href={`/time-off/${request.id}`}
                              className="inline-flex items-center rounded-md border border-yellow-200 bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-700 hover:underline"
                            >
                              {formatRange(request.start_date, request.end_date)}
                              {request.reason ? ` (${request.reason})` : ''}
                            </Link>
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
                  excludeRequestId={timeOffRequest?.id}
                  validateConflicts
                  disabled={shiftMode === 'all_scheduled'}
                />
                {conflictSummary.conflictCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Already recorded shifts are locked and can’t be selected.
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
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (typeof window !== 'undefined' && draftKey) {
                    window.sessionStorage.removeItem(draftKey)
                  }
                  router.push('/time-off')
                }}
                tabIndex={11}
              >
                Cancel
              </Button>
              <Button type="button" variant="outline" onClick={saveDraft} tabIndex={12}>
                Save as Draft
              </Button>
              <Button type="submit" disabled={isSubmitting || allShiftsRecorded} tabIndex={13}>
                {isSubmitting ? 'Updating...' : 'Update'}
              </Button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={handleDelete}
              className="text-sm text-destructive hover:underline"
              tabIndex={-1}
            >
              Delete Time Off Request
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
