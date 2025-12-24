'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import FormField from '@/components/shared/FormField'
import ErrorMessage from '@/components/shared/ErrorMessage'

const timeslotSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().optional(),
  default_start_time: z.string().optional(),
  default_end_time: z.string().optional(),
  display_order: z.coerce.number().int().optional().or(z.literal('')),
})

type TimeSlotFormData = z.infer<typeof timeslotSchema>

export default function NewTimeSlotPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TimeSlotFormData>({
    resolver: zodResolver(timeslotSchema),
  })

  const onSubmit = async (data: TimeSlotFormData) => {
    try {
      setError(null)
      const payload: any = {
        code: data.code,
        name: data.name || null,
        default_start_time: data.default_start_time || null,
        default_end_time: data.default_end_time || null,
      }
      if (data.display_order && data.display_order !== '') {
        payload.display_order = Number(data.display_order)
      }
      const response = await fetch('/api/timeslots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create time slot')
      }

      router.push('/settings/timeslots')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Add New Time Slot</h1>
        <p className="text-muted-foreground mt-2">Create a new time slot</p>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormField label="Code" error={errors.code?.message} required>
            <Input {...register('code')} placeholder="e.g., EM, AM, LB, AC" />
          </FormField>

          <FormField label="Name" error={errors.name?.message}>
            <Input {...register('name')} placeholder="e.g., Early Morning, Afternoon" />
          </FormField>

          <FormField label="Default Start Time" error={errors.default_start_time?.message}>
            <Input type="time" {...register('default_start_time')} placeholder="Optional" />
          </FormField>

          <FormField label="Default End Time" error={errors.default_end_time?.message}>
            <Input type="time" {...register('default_end_time')} placeholder="Optional" />
          </FormField>

          <FormField label="Display Order" error={errors.display_order?.message}>
            <Input type="number" {...register('display_order')} placeholder="Optional" />
          </FormField>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => router.push('/settings/timeslots')}>
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

