'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { ArrowLeft } from 'lucide-react'
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

interface ClassroomFormProps {
  mode: 'create' | 'edit'
  classroom?: Classroom
}

export default function ClassroomForm({ mode, classroom }: ClassroomFormProps) {
  const router = useRouter()
  const isEdit = mode === 'edit'

  if (isEdit && !classroom) {
    throw new Error('classroom is required in edit mode')
  }

  const [error, setError] = useState<string | null>(null)
  const [allowedClassIds, setAllowedClassIds] = useState<string[]>([])
  const [loadingAllowedClasses, setLoadingAllowedClasses] = useState(isEdit)
  const [selectedColor, setSelectedColor] = useState<string | null>(classroom?.color ?? null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ClassroomFormData>({
    resolver: zodResolver(classroomSchema),
    defaultValues: {
      name: classroom?.name ?? '',
      capacity: classroom?.capacity?.toString() ?? '',
      is_active: classroom?.is_active ?? true,
    },
  })

  const isActive = watch('is_active')

  useEffect(() => {
    if (!isEdit || !classroom) {
      setLoadingAllowedClasses(false)
      return
    }

    fetch(`/api/classrooms/${classroom.id}/allowed-classes`)
      .then(async r => {
        if (!r.ok) {
          const errBody = await r.json().catch(() => ({}))
          throw new Error(errBody.error || 'Failed to load allowed class groups')
        }
        return r.json()
      })
      .then(data => {
        setAllowedClassIds(Array.isArray(data) ? data : [])
      })
      .catch(err => {
        console.error('Failed to load allowed class groups:', err)
      })
      .finally(() => {
        setLoadingAllowedClasses(false)
      })
  }, [isEdit, classroom])

  const onSubmit = async (data: ClassroomFormData) => {
    try {
      setError(null)

      if (isEdit && classroom) {
        const payload: {
          name: string
          capacity?: number
          allowed_class_group_ids: string[]
          color?: string | null
          is_active: boolean
        } = {
          name: data.name,
          allowed_class_group_ids: allowedClassIds,
          is_active: data.is_active ?? true,
          color: selectedColor ?? null,
        }

        if (data.capacity && data.capacity !== '') {
          const capacityNum = Number(data.capacity)
          if (!isNaN(capacityNum) && capacityNum > 0) {
            payload.capacity = capacityNum
          }
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
      } else {
        const payload: {
          name: string
          capacity?: number
          allowed_class_group_ids?: string[]
          color?: string | null
          is_active?: boolean
        } = {
          name: data.name,
          color: selectedColor ?? null,
          is_active: true,
        }

        if (data.capacity && data.capacity !== '') {
          const capacityNum = Number(data.capacity)
          if (!isNaN(capacityNum) && capacityNum > 0) {
            payload.capacity = capacityNum
          }
        }
        if (allowedClassIds.length > 0) {
          payload.allowed_class_group_ids = allowedClassIds
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
      }

      router.push('/settings/classrooms')
      router.refresh()
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : isEdit
            ? 'Failed to update classroom'
            : 'Failed to create classroom'
      )
    }
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/settings/classrooms"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Classrooms
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {isEdit ? 'Edit Classroom' : 'Add New Classroom'}
        </h1>
        <p className="text-muted-foreground mt-2">
          {isEdit ? classroom?.name : 'Create a new classroom'}
        </p>
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

          {isEdit && (
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
          )}

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/settings/classrooms')}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEdit
                  ? 'Updating...'
                  : 'Creating...'
                : isEdit
                  ? 'Update'
                  : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
