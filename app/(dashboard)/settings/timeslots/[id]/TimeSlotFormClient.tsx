'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import FormField from '@/components/shared/FormField'
import ErrorMessage from '@/components/shared/ErrorMessage'
import { Database } from '@/types/database'

type TimeSlot = Database['public']['Tables']['time_slots']['Row']

// TODO: Fix TypeScript error with display_order field - Known limitation between Zod and react-hook-form
// where optional string fields get inferred as `unknown` in input type, causing type mismatch with defaultValues.
// Runtime validation works correctly via zodResolver. Consider: using @ts-ignore on the useForm call,
// refactoring to use a different form typing approach, or waiting for improved Zod/react-hook-form typings.
const timeslotSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().optional(),
  default_start_time: z.string().optional(),
  default_end_time: z.string().optional(),
  display_order: z.string().optional(),
})

type TimeSlotFormData = z.infer<typeof timeslotSchema>

interface TimeSlotFormClientProps {
  timeslot: TimeSlot
}

export default function TimeSlotFormClient({ timeslot }: TimeSlotFormClientProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    // @ts-expect-error - Known limitation: Zod infers optional string fields (display_order) as `unknown` in input type, but react-hook-form expects the input type to match defaultValues. Runtime validation works correctly via zodResolver. TODO: Revisit if Zod/react-hook-form typings improve or we refactor form typing approach.
    resolver: zodResolver(timeslotSchema),
    defaultValues: {
      code: timeslot.code,
      name: timeslot.name || '',
      default_start_time: timeslot.default_start_time || '',
      default_end_time: timeslot.default_end_time || '',
      display_order: (timeslot.display_order != null ? timeslot.display_order.toString() : '') as string | undefined,
    } as z.input<typeof timeslotSchema>,
  })

  // Reset form when timeslot data changes
  useEffect(() => {
    reset({
      code: timeslot.code,
      name: timeslot.name || '',
      default_start_time: timeslot.default_start_time || '',
      default_end_time: timeslot.default_end_time || '',
      display_order: timeslot.display_order != null ? timeslot.display_order.toString() : '',
    })
  }, [timeslot, reset])

  const onSubmit = async (data: any) => {
    try {
      setError(null)
      const payload: {
        code: string
        name: string | null
        default_start_time: string | null
        default_end_time: string | null
        display_order?: number | null
      } = {
        code: data.code,
        name: data.name || null,
        default_start_time: data.default_start_time || null,
        default_end_time: data.default_end_time || null,
      }

      // Handle display_order - allow 0 as a valid value
      // The form field is a string that may be empty
      if (
        !data.display_order ||
        data.display_order === '' ||
        data.display_order.trim() === ''
      ) {
        payload.display_order = null
      } else {
        const numValue = Number(data.display_order)
        payload.display_order = isNaN(numValue) ? null : numValue
      }
      const response = await fetch(`/api/timeslots/${timeslot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update time slot')
      }

      router.push('/settings/timeslots')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update time slot')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this time slot?')) return

    try {
      setError(null)
      const response = await fetch(`/api/timeslots/${timeslot.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete time slot')
      }

      router.push('/settings/timeslots')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete time slot')
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Edit Time Slot</h1>
        <p className="text-muted-foreground mt-2">{timeslot.name || timeslot.code}</p>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormField label="Code" error={errors.code?.message} required>
            <Input {...register('code')} />
          </FormField>

          <FormField label="Name" error={errors.name?.message}>
            <Input {...register('name')} placeholder="Optional" />
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
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/settings/timeslots')}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update'}
            </Button>
          </div>
        </form>
        <div className="mt-6 pt-6 border-t">
          <button onClick={handleDelete} className="text-sm text-destructive hover:underline">
            Delete Time Slot
          </button>
        </div>
      </div>
    </div>
  )
}
