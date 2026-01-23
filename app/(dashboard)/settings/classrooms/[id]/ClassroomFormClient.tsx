'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import FormField from '@/components/shared/FormField'
import ErrorMessage from '@/components/shared/ErrorMessage'
import ClassSelector from '@/components/settings/ClassSelector'
import ClassroomColorPicker from '@/components/settings/ClassroomColorPicker'
import { Database } from '@/types/database'

type Classroom = Database['public']['Tables']['classrooms']['Row']

const classroomSchema = z.object({
  name: z.string().min(1, 'Classroom name is required'),
  capacity: z.string().optional(),
  allowed_classes: z.array(z.string()).optional(),
  color: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
})

type ClassroomFormData = z.infer<typeof classroomSchema>

interface ClassroomFormClientProps {
  classroom: Classroom
}

export default function ClassroomFormClient({ classroom }: ClassroomFormClientProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [allowedClassIds, setAllowedClassIds] = useState<string[]>([])
  const [loadingAllowedClasses, setLoadingAllowedClasses] = useState(true)
  const [selectedColor, setSelectedColor] = useState<string | null>(classroom.color ?? null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ClassroomFormData>({
    resolver: zodResolver(classroomSchema),
    defaultValues: {
      name: classroom.name,
      capacity: classroom.capacity?.toString() || '',
      is_active: classroom.is_active ?? true,
    },
  })

  const isActive = watch('is_active')

  // Load allowed classes on mount
  useEffect(() => {
    fetch(`/api/classrooms/${classroom.id}/allowed-classes`)
      .then(r => r.json())
      .then(data => {
        setAllowedClassIds(data || [])
        setLoadingAllowedClasses(false)
      })
      .catch(err => {
        console.error('Failed to load allowed class groups:', err)
        setLoadingAllowedClasses(false)
      })
  }, [classroom.id])

  const onSubmit = async (data: ClassroomFormData) => {
    try {
      setError(null)
      const payload: {
        name: string
        capacity?: number
        allowed_classes: string[]
        color?: string | null
        is_active: boolean
      } = { name: data.name, allowed_classes: allowedClassIds, is_active: data.is_active ?? true }
      if (data.capacity && data.capacity !== '') {
        const capacityNum = Number(data.capacity)
        if (!isNaN(capacityNum) && capacityNum > 0) {
          payload.capacity = capacityNum
        }
      }
      // Order is managed by drag-and-drop, don't update it here
      // Add color if selected
      if (selectedColor) {
        payload.color = selectedColor
      } else {
        payload.color = null
      }
      // Add is_active
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update classroom')
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Edit Classroom</h1>
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

          <FormField label="Color (Optional)" error={errors.color?.message}>
            <ClassroomColorPicker value={selectedColor} onChange={setSelectedColor} />
          </FormField>

          <FormField label="Allowed Class Groups" error={errors.allowed_classes?.message}>
            {loadingAllowedClasses ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : (
              <ClassSelector
                selectedClassIds={allowedClassIds}
                onSelectionChange={setAllowedClassIds}
              />
            )}
          </FormField>

          <div className="space-y-4 pt-6 border-t">
            <div>
              <Label className="text-base font-semibold">Status</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Inactive items will not appear in dropdowns but historical data is preserved.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_active"
                checked={isActive}
                onCheckedChange={checked => setValue('is_active', checked === true)}
              />
              <Label htmlFor="is_active" className="font-normal cursor-pointer">
                Active (appears in dropdowns)
              </Label>
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/settings/classrooms')}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
