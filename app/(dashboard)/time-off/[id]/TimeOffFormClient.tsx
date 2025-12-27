'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import FormField from '@/components/shared/FormField'
import ErrorMessage from '@/components/shared/ErrorMessage'
import ShiftSelectionTable from '@/components/time-off/ShiftSelectionTable'

const timeOffSchema = z.object({
  teacher_id: z.string().min(1, 'Teacher is required'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
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
  const [selectedShifts, setSelectedShifts] = useState<Array<{ date: string; day_of_week_id: string; time_slot_id: string }>>([])

  useEffect(() => {
    fetch('/api/teachers').then((r) => r.json()).then(setTeachers).catch(console.error)
  }, [])

  // Load shifts separately when timeOffRequest changes
  useEffect(() => {
    if (timeOffRequest?.id) {
      // Fetch shifts from API to ensure we have the latest data
      fetch(`/api/time-off/${timeOffRequest.id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.shifts && Array.isArray(data.shifts)) {
            const shifts = data.shifts.map((shift: any) => ({
              date: shift.date, // Ensure date is in YYYY-MM-DD format
              day_of_week_id: shift.day_of_week_id || '',
              time_slot_id: shift.time_slot_id,
            }))
            setSelectedShifts(shifts)
          }
        })
        .catch((error) => {
          console.error('Failed to load shifts:', error)
        })
    }
  }, [timeOffRequest?.id])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    reset,
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

  const onSubmit = async (data: TimeOffFormData) => {
    try {
      setError(null)
      const payload: any = {
        teacher_id: data.teacher_id,
        start_date: data.start_date,
        end_date: data.end_date,
        reason: data.reason || null,
        notes: data.notes || null,
        shift_selection_mode: data.shift_selection_mode,
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Edit Time Off Request</h1>
        <p className="text-muted-foreground mt-2">
          {timeOffRequest.teacher?.display_name || 
           (timeOffRequest.teacher?.first_name && timeOffRequest.teacher?.last_name
             ? `${timeOffRequest.teacher.first_name} ${timeOffRequest.teacher.last_name}`
             : 'Time Off Request')}
        </p>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormField label="Teacher" error={errors.teacher_id?.message} required>
            <Select value={teacherId || ''} onValueChange={(value) => setValue('teacher_id', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a teacher" />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.display_name || `${teacher.first_name} ${teacher.last_name}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Start Date" error={errors.start_date?.message} required>
            <Input type="date" {...register('start_date')} />
          </FormField>

          <FormField label="End Date" error={errors.end_date?.message} required>
            <Input type="date" {...register('end_date')} />
          </FormField>

          <FormField label="Shifts" error={errors.shift_selection_mode?.message}>
            <RadioGroup
              value={shiftMode || 'all_scheduled'}
              onValueChange={(value) => setValue('shift_selection_mode', value as 'all_scheduled' | 'select_shifts')}
            >
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all_scheduled" id="shifts-all" />
                  <Label htmlFor="shifts-all" className="font-normal cursor-pointer">
                    All scheduled shifts
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="select_shifts" id="shifts-select" />
                  <Label htmlFor="shifts-select" className="font-normal cursor-pointer">
                    Select shifts
                  </Label>
                </div>
              </div>
            </RadioGroup>
            {shiftMode === 'all_scheduled' && (
              <p className="text-sm text-muted-foreground mt-2">
                All scheduled shifts will be logged. Switch to &quot;Select shifts&quot; to make changes.
              </p>
            )}
          </FormField>

          <FormField label="Reason" error={errors.reason?.message}>
            <RadioGroup
              value={reason || ''}
              onValueChange={(value) => setValue('reason', value as 'Vacation' | 'Sick Day' | 'Training' | 'Other')}
            >
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Vacation" id="reason-vacation" />
                  <Label htmlFor="reason-vacation" className="font-normal cursor-pointer">
                    Vacation
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Sick Day" id="reason-sick" />
                  <Label htmlFor="reason-sick" className="font-normal cursor-pointer">
                    Sick Day
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Training" id="reason-training" />
                  <Label htmlFor="reason-training" className="font-normal cursor-pointer">
                    Training
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Other" id="reason-other" />
                  <Label htmlFor="reason-other" className="font-normal cursor-pointer">
                    Other
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </FormField>

          <FormField label="Notes" error={errors.notes?.message}>
            <Textarea {...register('notes')} placeholder="Optional notes" />
          </FormField>

          {teacherId && startDate && endDate && (
            <div className="space-y-4 pt-4 border-t">
              <div>
                <h3 className="text-sm font-medium mb-2">Shifts</h3>
                <ShiftSelectionTable
                  teacherId={teacherId}
                  startDate={startDate}
                  endDate={endDate}
                  selectedShifts={selectedShifts}
                  onShiftsChange={setSelectedShifts}
                  disabled={shiftMode === 'all_scheduled'}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => router.push('/time-off')}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update'}
            </Button>
          </div>
        </form>

        <div className="mt-6 pt-6 border-t">
          <button
            onClick={handleDelete}
            className="text-sm text-destructive hover:underline"
          >
            Delete Time Off Request
          </button>
        </div>
      </div>
    </div>
  )
}

