'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
import StaffUnsavedChangesDialog from '@/components/staff/StaffUnsavedChangesDialog'
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

type ClassroomFormSnapshot = {
  name: string
  capacity: string
  allowedClassIds: string[]
  color: string | null
  isActive: boolean
}

const normalizeAllowedClassIds = (ids: string[]) => [...ids].sort((a, b) => a.localeCompare(b))

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
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingPath, setPendingPath] = useState<string | null>(null)

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
  const name = watch('name')
  const capacity = watch('capacity')

  const currentSnapshot = useMemo<ClassroomFormSnapshot>(
    () => ({
      name: name?.trim() ?? '',
      capacity: capacity?.trim() ?? '',
      allowedClassIds: normalizeAllowedClassIds(allowedClassIds),
      color: selectedColor ?? null,
      isActive: isActive ?? true,
    }),
    [name, capacity, allowedClassIds, selectedColor, isActive]
  )

  const baselineSnapshotRef = useRef<ClassroomFormSnapshot>({
    name: classroom?.name?.trim() ?? '',
    capacity: classroom?.capacity?.toString() ?? '',
    allowedClassIds: [],
    color: classroom?.color ?? null,
    isActive: classroom?.is_active ?? true,
  })

  const hasUnsavedChanges =
    JSON.stringify(currentSnapshot) !== JSON.stringify(baselineSnapshotRef.current)

  const navigateWithUnsavedGuard = (path: string) => {
    if (hasUnsavedChanges) {
      setPendingPath(path)
      setShowUnsavedDialog(true)
      return
    }
    router.push(path)
  }

  useEffect(() => {
    if (!isEdit || !classroom) {
      setLoadingAllowedClasses(false)
      baselineSnapshotRef.current = {
        name: '',
        capacity: '',
        allowedClassIds: [],
        color: null,
        isActive: true,
      }
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
        const ids = Array.isArray(data) ? normalizeAllowedClassIds(data) : []
        setAllowedClassIds(ids)
        baselineSnapshotRef.current = {
          name: classroom.name?.trim() ?? '',
          capacity: classroom.capacity?.toString() ?? '',
          allowedClassIds: ids,
          color: classroom.color ?? null,
          isActive: classroom.is_active ?? true,
        }
      })
      .catch(err => {
        console.error('Failed to load allowed class groups:', err)
      })
      .finally(() => {
        setLoadingAllowedClasses(false)
      })
  }, [isEdit, classroom])

  useEffect(() => {
    if (!hasUnsavedChanges) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return

      const anchor = target.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      if (anchor.target && anchor.target !== '_self') return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return

      const nextUrl = new URL(anchor.href, window.location.href)
      if (nextUrl.origin !== window.location.origin) return

      const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
      if (nextPath === currentPath) return

      event.preventDefault()
      setPendingPath(nextPath)
      setShowUnsavedDialog(true)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleDocumentClick, true)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleDocumentClick, true)
    }
  }, [hasUnsavedChanges])

  const handleDiscardAndLeave = () => {
    const destination = pendingPath
    setShowUnsavedDialog(false)
    setPendingPath(null)
    if (destination) {
      router.push(destination)
    }
  }

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
        <button
          type="button"
          onClick={() => navigateWithUnsavedGuard('/settings/classrooms')}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Classrooms
        </button>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {isEdit ? 'Edit Classroom' : 'Add New Classroom'}
          </h1>
          {hasUnsavedChanges && (
            <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              Unsaved changes
            </span>
          )}
        </div>
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
              onClick={() => navigateWithUnsavedGuard('/settings/classrooms')}
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
      <StaffUnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onKeepEditing={() => {
          setShowUnsavedDialog(false)
          setPendingPath(null)
        }}
        onDiscardAndLeave={handleDiscardAndLeave}
      />
    </div>
  )
}
