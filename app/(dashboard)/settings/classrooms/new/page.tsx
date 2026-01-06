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
import ClassSelector from '@/components/settings/ClassSelector'
import ClassroomColorPicker from '@/components/settings/ClassroomColorPicker'

const classroomSchema = z.object({
  name: z.string().min(1, 'Classroom name is required'),
  capacity: z.string().optional(),
  allowed_classes: z.array(z.string()).optional(),
  color: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
})

type ClassroomFormData = z.infer<typeof classroomSchema>

export default function NewClassroomPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [allowedClassIds, setAllowedClassIds] = useState<string[]>([])
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
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
        const capacityNum = Number(data.capacity)
        if (!isNaN(capacityNum) && capacityNum > 0) {
          payload.capacity = capacityNum
        }
      }
      // Order will be set automatically to the end (highest order + 1)
      if (allowedClassIds.length > 0) {
        payload.allowed_classes = allowedClassIds
      }
      // Add color if selected
      if (selectedColor) {
        payload.color = selectedColor
      } else {
        payload.color = null
      }
      // Default is_active to true for new classrooms
      payload.is_active = true
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

          <FormField
            label={
              <span>
                Color <span className="text-muted-foreground font-normal">(Optional)</span>
              </span>
            }
            error={errors.color?.message}
          >
            <ClassroomColorPicker value={selectedColor} onChange={setSelectedColor} />
          </FormField>

          <FormField label="Allowed Class Groups" error={errors.allowed_classes?.message}>
            <ClassSelector
              selectedClassIds={allowedClassIds}
              onSelectionChange={setAllowedClassIds}
            />
          </FormField>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/settings/classrooms')}
            >
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
