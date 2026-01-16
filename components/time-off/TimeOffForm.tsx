'use client'

import { useRouter } from 'next/navigation'
import React, { useState, useEffect, useRef } from 'react'
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
import { Database } from '@/types/database'

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
  showBackLink?: boolean
  onHasUnsavedChanges?: (hasChanges: boolean) => void
}

const TimeOffForm = React.forwardRef<{ reset: () => void }, TimeOffFormProps>(
  ({ onSuccess, onCancel, showBackLink = true, onHasUnsavedChanges }, ref) => {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [teachers, setTeachers] = useState<Staff[]>([])
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
  const draftKey = 'time-off:new'
  
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
      .then((data) => {
        const sorted = (data as Staff[]).sort((a, b) => {
          const nameA = a.display_name || `${a.first_name} ${a.last_name}`.trim() || ''
          const nameB = b.display_name || `${b.first_name} ${b.last_name}`.trim() || ''
          return nameA.localeCompare(nameB)
        })
        setTeachers(sorted)
      })
      .catch(console.error)
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    setValue,
    setError: setFormError,
    clearErrors,
    watch,
    reset,
    getValues,
  } = useForm<TimeOffFormData>({
    resolver: zodResolver(timeOffSchema),
    defaultValues: {
      shift_selection_mode: 'all_scheduled',
    },
  })
  
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
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(draftKey)
      }
    },
  }))
  
  // Track unsaved changes (form is dirty or has selected shifts)
  const hasUnsavedChanges = isDirty || selectedShifts.length > 0 || 
    Boolean(watch('teacher_id')) || Boolean(watch('start_date'))
  
  // Notify parent of unsaved changes status
  useEffect(() => {
    if (onHasUnsavedChanges) {
      onHasUnsavedChanges(hasUnsavedChanges)
    }
  }, [hasUnsavedChanges, onHasUnsavedChanges])

  const teacherId = watch('teacher_id')
  const startDate = watch('start_date')
  const endDate = watch('end_date')
  const shiftMode = watch('shift_selection_mode')
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
        reset({ shift_selection_mode: 'all_scheduled', ...draft.form })
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

      const response = await fetch('/api/time-off', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create time off request')
      }

      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(draftKey)
      }
      
      // Get teacher name for toast
      const teacher = teachers.find(t => t.id === data.teacher_id)
      const teacherName = teacher 
        ? (teacher.display_name || `${teacher.first_name} ${teacher.last_name}`.trim())
        : 'Teacher'
      
      // Format date range
      const formatDateForToast = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number)
        const date = new Date(year, month - 1, day)
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }
      const startDateFormatted = formatDateForToast(data.start_date)
      const endDateFormatted = formatDateForToast(effectiveEndDate)
      const dateRange = startDateFormatted === endDateFormatted 
        ? startDateFormatted 
        : `${startDateFormatted}-${endDateFormatted}`
      
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

      const response = await fetch('/api/time-off', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save draft')
      }

      const created = await response.json()
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(draftKey)
      }
      toast.success('Draft saved')
      if (created?.id) {
        router.push(`/time-off/${created.id}`)
        router.refresh()
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save draft')
    }
  }

  return (
    <div className="h-full flex flex-col">
      {error && <ErrorMessage message={error} className="mb-6" />}

      <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-6">
          <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-6">
            <FormField label="Teacher" error={errors.teacher_id?.message} required>
              <Select onValueChange={value => setValue('teacher_id', value)}>
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
                          <a
                            key={request.id}
                            href={`/time-off/${request.id}`}
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
                validateConflicts
                disabled={shiftMode === 'all_scheduled'}
              />
              {conflictSummary.conflictCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  Already recorded shifts are locked and can't be selected.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-6">
            <h3 className="text-sm font-medium">Optional Details</h3>
            <div className="space-y-6">
              <FormField label="Reason" error={errors.reason?.message}>
                <RadioGroup
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

        <div className="flex justify-end gap-4 pt-6 border-t mt-6">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              tabIndex={11}
            >
              Cancel
            </Button>
          )}
          <Button 
            type="button" 
            variant="outline" 
            onClick={saveDraft} 
            tabIndex={12}
          >
            Save as Draft
          </Button>
          <Button 
            type="submit"
            disabled={isSubmitting || allShiftsRecorded} 
            tabIndex={13}
          >
            {isSubmitting ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </form>
    </div>
  )
})

TimeOffForm.displayName = 'TimeOffForm'

export default TimeOffForm
