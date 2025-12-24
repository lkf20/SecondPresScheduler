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

const classroomSchema = z.object({
  name: z.string().min(1, 'Classroom name is required'),
  capacity: z.coerce.number().int().positive().optional().or(z.literal('')),
})

type ClassroomFormData = z.infer<typeof classroomSchema>

export default function NewClassroomPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClassroomFormData>({
    resolver: zodResolver(classroomSchema),
  })

  const onSubmit = async (data: ClassroomFormData) => {
    try {
      setError(null)
      const payload: any = { name: data.name }
      if (data.capacity && data.capacity !== '') {
        payload.capacity = Number(data.capacity)
      }
      const response = await fetch('/api/classrooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create classroom')
      }

      router.push('/settings/classrooms')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Add New Classroom</h1>
        <p className="text-muted-foreground mt-2">Create a new classroom</p>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormField label="Classroom Name" error={errors.name?.message} required>
            <Input {...register('name')} />
          </FormField>

          <FormField label="Capacity" error={errors.capacity?.message}>
            <Input type="number" {...register('capacity')} placeholder="Optional" />
          </FormField>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => router.push('/settings/classrooms')}>
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

