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
import FormField from '@/components/shared/FormField'
import ErrorMessage from '@/components/shared/ErrorMessage'

const timeOffSchema = z.object({
  teacher_id: z.string().min(1, 'Teacher is required'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  time_slot_id: z.string().optional(),
  notes: z.string().optional(),
})

type TimeOffFormData = z.infer<typeof timeOffSchema>

export default function NewTimeOffPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [teachers, setTeachers] = useState<any[]>([])
  const [timeSlots, setTimeSlots] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/teachers').then((r) => r.json()).then(setTeachers).catch(console.error)
    fetch('/api/timeslots').then((r) => r.json()).then(setTimeSlots).catch(console.error)
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<TimeOffFormData>({
    resolver: zodResolver(timeOffSchema),
  })

  const onSubmit = async (data: TimeOffFormData) => {
    try {
      setError(null)
      const payload: any = { ...data }
      if (!payload.time_slot_id || payload.time_slot_id === '') {
        delete payload.time_slot_id
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

      router.push('/time-off')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Add Time Off Request</h1>
        <p className="text-muted-foreground mt-2">Create a new time off request</p>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormField label="Teacher" error={errors.teacher_id?.message} required>
            <Select onValueChange={(value) => setValue('teacher_id', value)}>
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

          <FormField label="Time Slot" error={errors.time_slot_id?.message}>
            <Select onValueChange={(value) => setValue('time_slot_id', value)}>
              <SelectTrigger>
                <SelectValue placeholder="All Day (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Day</SelectItem>
                {timeSlots.map((slot) => (
                  <SelectItem key={slot.id} value={slot.id}>
                    {slot.name || slot.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Notes" error={errors.notes?.message}>
            <Textarea {...register('notes')} placeholder="Optional notes" />
          </FormField>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => router.push('/time-off')}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

