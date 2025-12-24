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
import { Database } from '@/types/database'

type Classroom = Database['public']['Tables']['classrooms']['Row']

const classroomSchema = z.object({
  name: z.string().min(1, 'Classroom name is required'),
  capacity: z.coerce.number().int().positive().optional().or(z.literal('')),
})

type ClassroomFormData = z.infer<typeof classroomSchema>

interface ClassroomFormClientProps {
  classroom: Classroom
}

export default function ClassroomFormClient({ classroom }: ClassroomFormClientProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClassroomFormData>({
    resolver: zodResolver(classroomSchema),
    defaultValues: {
      name: classroom.name,
      capacity: classroom.capacity?.toString() || '',
    },
  })

  const onSubmit = async (data: ClassroomFormData) => {
    try {
      setError(null)
      const payload: any = { name: data.name }
      if (data.capacity && data.capacity !== '') {
        payload.capacity = Number(data.capacity)
      }
      const response = await fetch(`/api/classrooms/${classroom.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update classroom')
      }

      router.push('/settings/classrooms')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this classroom?')) return

    try {
      setError(null)
      const response = await fetch(`/api/classrooms/${classroom.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete classroom')
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
        <h1 className="text-3xl font-bold tracking-tight">Edit Classroom</h1>
        <p className="text-muted-foreground mt-2">{classroom.name}</p>
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
              {isSubmitting ? 'Updating...' : 'Update'}
            </Button>
          </div>
        </form>
        <div className="mt-6 pt-6 border-t">
          <button
            onClick={handleDelete}
            className="text-sm text-destructive hover:underline"
          >
            Delete Classroom
          </button>
        </div>
      </div>
    </div>
  )
}

