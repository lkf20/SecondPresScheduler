'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import FormField from '@/components/shared/FormField'
import ErrorMessage from '@/components/shared/ErrorMessage'
import StaffUnsavedChangesDialog from '@/components/staff/StaffUnsavedChangesDialog'
import { Database } from '@/types/database'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useSchool } from '@/lib/contexts/SchoolContext'
import { useUnsavedNavigationGuard } from '@/lib/hooks/use-unsaved-navigation-guard'
import { invalidateSchedulingSurfaces } from '@/lib/utils/invalidation'

type ClassGroup = Database['public']['Tables']['class_groups']['Row']

const nullableNumberSchema = (min?: number, max?: number) =>
  z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((val): number | null | undefined => {
      if (val === '' || val === null || val === undefined || isNaN(Number(val))) return undefined
      const num = Number(val)
      if (!Number.isInteger(num)) return undefined
      if (min !== undefined && num < min) return undefined
      if (max !== undefined && num > max) return undefined
      return num
    })
    .optional()

const classSchema = z.object({
  name: z.string().min(1, 'Class group name is required'),
  age_unit: z.enum(['months', 'years']).default('years'),
  min_age: nullableNumberSchema(0, 18),
  max_age: nullableNumberSchema(0, 18),
  required_ratio: z.number().int().min(1, 'Required ratio must be at least 1'),
  preferred_ratio: nullableNumberSchema(1),
  diaper_changing_required: z.boolean().optional(),
  lifting_children_required: z.boolean().optional(),
  toileting_assistance_required: z.boolean().optional(),
  is_active: z.boolean().optional(),
})

type ClassFormData = z.infer<typeof classSchema>
type ClassFormInput = z.input<typeof classSchema>

interface ClassGroupFormProps {
  mode: 'create' | 'edit'
  classData?: ClassGroup
  showInactiveBaselineWarning?: boolean
}

type ClassGroupFormSnapshot = {
  name: string
  age_unit: 'months' | 'years'
  min_age: number | null
  max_age: number | null
  required_ratio: number | null
  preferred_ratio: number | null
  diaper_changing_required: boolean
  lifting_children_required: boolean
  toileting_assistance_required: boolean
  is_active: boolean
}

const normalizeNumberish = (value: unknown): number | null => {
  if (value === '' || value === null || value === undefined) return null
  const num = Number(value)
  if (Number.isNaN(num)) return null
  return num
}

export default function ClassGroupForm({
  mode,
  classData,
  showInactiveBaselineWarning = false,
}: ClassGroupFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const schoolId = useSchool()
  const isEdit = mode === 'edit'
  const formId = `class-group-form-${isEdit ? (classData?.id ?? 'edit') : 'new'}`

  if (isEdit && !classData) {
    throw new Error('classData is required in edit mode')
  }

  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ClassFormInput>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      name: classData?.name ?? '',
      age_unit: classData?.age_unit ?? 'years',
      min_age: classData?.min_age ?? undefined,
      max_age: classData?.max_age ?? undefined,
      required_ratio: classData?.required_ratio ?? 8,
      preferred_ratio: classData?.preferred_ratio ?? undefined,
      diaper_changing_required: classData?.diaper_changing_required ?? false,
      lifting_children_required: classData?.lifting_children_required ?? false,
      toileting_assistance_required: classData?.toileting_assistance_required ?? false,
      is_active: classData?.is_active ?? true,
    },
  })

  const name = watch('name')
  const minAge = watch('min_age')
  const ageUnit = watch('age_unit')
  const maxAge = watch('max_age')
  const requiredRatio = watch('required_ratio')
  const preferredRatio = watch('preferred_ratio')
  const diaperChanging = watch('diaper_changing_required')
  const liftingChildren = watch('lifting_children_required')
  const toiletingAssistance = watch('toileting_assistance_required')
  const isActive = watch('is_active')

  const currentSnapshot = useMemo<ClassGroupFormSnapshot>(
    () => ({
      name: name?.trim() ?? '',
      age_unit: ageUnit ?? 'years',
      min_age: normalizeNumberish(minAge),
      max_age: normalizeNumberish(maxAge),
      required_ratio: normalizeNumberish(requiredRatio),
      preferred_ratio: normalizeNumberish(preferredRatio),
      diaper_changing_required: diaperChanging ?? false,
      lifting_children_required: liftingChildren ?? false,
      toileting_assistance_required: toiletingAssistance ?? false,
      is_active: isActive ?? true,
    }),
    [
      name,
      minAge,
      ageUnit,
      maxAge,
      requiredRatio,
      preferredRatio,
      diaperChanging,
      liftingChildren,
      toiletingAssistance,
      isActive,
    ]
  )

  const baselineSnapshotRef = useRef<ClassGroupFormSnapshot>({
    name: classData?.name?.trim() ?? '',
    age_unit: classData?.age_unit ?? 'years',
    min_age: classData?.min_age ?? null,
    max_age: classData?.max_age ?? null,
    required_ratio: classData?.required_ratio ?? 8,
    preferred_ratio: classData?.preferred_ratio ?? null,
    diaper_changing_required: classData?.diaper_changing_required ?? false,
    lifting_children_required: classData?.lifting_children_required ?? false,
    toileting_assistance_required: classData?.toileting_assistance_required ?? false,
    is_active: classData?.is_active ?? true,
  })

  useEffect(() => {
    baselineSnapshotRef.current = {
      name: classData?.name?.trim() ?? '',
      age_unit: classData?.age_unit ?? 'years',
      min_age: classData?.min_age ?? null,
      max_age: classData?.max_age ?? null,
      required_ratio: classData?.required_ratio ?? 8,
      preferred_ratio: classData?.preferred_ratio ?? null,
      diaper_changing_required: classData?.diaper_changing_required ?? false,
      lifting_children_required: classData?.lifting_children_required ?? false,
      toileting_assistance_required: classData?.toileting_assistance_required ?? false,
      is_active: classData?.is_active ?? true,
    }
  }, [classData])

  const hasUnsavedChanges =
    JSON.stringify(currentSnapshot) !== JSON.stringify(baselineSnapshotRef.current)

  const {
    showUnsavedDialog,
    setShowUnsavedDialog,
    navigateWithUnsavedGuard,
    handleKeepEditing,
    handleDiscardAndLeave,
  } = useUnsavedNavigationGuard({
    hasUnsavedChanges,
    onNavigate: path => router.push(path),
  })

  const onSubmit = async (data: ClassFormInput) => {
    try {
      setError(null)
      const payload = {
        ...data,
        age_unit: data.age_unit ?? 'years',
        min_age: data.min_age === undefined || data.min_age === null ? null : Number(data.min_age),
        max_age: data.max_age === undefined || data.max_age === null ? null : Number(data.max_age),
        required_ratio: Number(data.required_ratio),
        preferred_ratio:
          data.preferred_ratio === undefined || data.preferred_ratio === null
            ? null
            : Number(data.preferred_ratio),
        diaper_changing_required: data.diaper_changing_required ?? false,
        lifting_children_required: data.lifting_children_required ?? false,
        toileting_assistance_required: data.toileting_assistance_required ?? false,
        is_active: data.is_active ?? true,
      }

      const url = isEdit ? `/api/class-groups/${classData!.id}` : '/api/class-groups'
      const method = isEdit ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to ${isEdit ? 'update' : 'create'} class group`)
      }

      const classGroupName = data.name?.trim() || 'Class group'
      toast.success(isEdit ? `${classGroupName} updated.` : `${classGroupName} created.`)
      await invalidateSchedulingSurfaces(queryClient, schoolId)
      router.push('/settings/classes')
      router.refresh()
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : `Failed to ${isEdit ? 'update' : 'create'} class group`
      )
    }
  }

  return (
    <div>
      <div className="mb-8 max-w-2xl">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {isEdit ? classData?.name || 'Class Group' : 'Add Class Group'}
            </h1>
            {hasUnsavedChanges && (
              <>
                <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Unsaved changes
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-teal-700 hover:bg-transparent hover:text-teal-800"
                  type="submit"
                  form={formId}
                >
                  Save
                </Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="is_active" className="font-normal cursor-pointer">
              {isActive ? 'Active' : 'Inactive'}
            </Label>
            <Switch
              id="is_active"
              checked={isActive}
              onCheckedChange={checked => setValue('is_active', checked === true)}
            />
          </div>
        </div>
        <p className="text-muted-foreground mt-2">
          {isActive
            ? 'Active class groups will appear in schedules and dropdowns.'
            : 'Inactive class groups will not appear in dropdowns but historical data is preserved.'}
        </p>
        {!isActive && showInactiveBaselineWarning && (
          <Alert className="mt-3 border-amber-200 bg-amber-50 text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This class group is marked as inactive but still appears in the baseline schedule.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <div className="max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormField label="Class Group Name" error={errors.name?.message} required>
            <Input {...register('name')} />
          </FormField>

          <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/40 p-4">
            <div>
              <Label className="text-base font-semibold">Age Requirements</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Set the age range for this class group.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Age Unit</Label>
              <RadioGroup
                value={ageUnit ?? 'years'}
                onValueChange={value => setValue('age_unit', value as 'months' | 'years')}
                className="flex items-center gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="years" id="age-unit-years" />
                  <Label htmlFor="age-unit-years" className="font-normal cursor-pointer">
                    Years
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="months" id="age-unit-months" />
                  <Label htmlFor="age-unit-months" className="font-normal cursor-pointer">
                    Months
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField label="Min Age" error={errors.min_age?.message as string | undefined}>
                <Input
                  type="number"
                  min="0"
                  max="18"
                  {...register('min_age')}
                  placeholder="Optional"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Age in {ageUnit === 'months' ? 'months' : 'years'}
                </p>
              </FormField>

              <FormField label="Max Age" error={errors.max_age?.message as string | undefined}>
                <Input
                  type="number"
                  min="0"
                  max="18"
                  {...register('max_age')}
                  placeholder="Optional"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Age in {ageUnit === 'months' ? 'months' : 'years'}
                </p>
              </FormField>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/40 p-4">
            <div>
              <Label className="text-base font-semibold">Ratios</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Define required and preferred children-per-teacher ratios.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField label="Required Ratio" error={errors.required_ratio?.message} required>
                <Input
                  type="number"
                  min="1"
                  {...register('required_ratio', { valueAsNumber: true })}
                  placeholder="e.g., 8"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Number of children per teacher required
                </p>
              </FormField>

              <FormField label="Preferred Ratio" error={errors.preferred_ratio?.message}>
                <Input
                  type="number"
                  min="1"
                  {...register('preferred_ratio')}
                  placeholder="Optional"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Preferred number of children per teacher
                </p>
              </FormField>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/40 p-4">
            <div>
              <Label className="text-base font-semibold">Care Requirements</Label>
              <p className="text-sm text-muted-foreground mt-1">
                These requirements affect which subs and teachers are eligible.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="diaper_changing_required"
                  checked={diaperChanging}
                  onCheckedChange={checked =>
                    setValue('diaper_changing_required', checked === true)
                  }
                />
                <Label htmlFor="diaper_changing_required" className="font-normal cursor-pointer">
                  Diaper changing required
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="lifting_children_required"
                  checked={liftingChildren}
                  onCheckedChange={checked =>
                    setValue('lifting_children_required', checked === true)
                  }
                />
                <Label htmlFor="lifting_children_required" className="font-normal cursor-pointer">
                  Lifting children required
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="toileting_assistance_required"
                  checked={toiletingAssistance}
                  onCheckedChange={checked =>
                    setValue('toileting_assistance_required', checked === true)
                  }
                />
                <Label
                  htmlFor="toileting_assistance_required"
                  className="font-normal cursor-pointer"
                >
                  Toileting assistance required
                </Label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigateWithUnsavedGuard('/settings/classes')}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || (isEdit && !hasUnsavedChanges)}>
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
        onKeepEditing={handleKeepEditing}
        onDiscardAndLeave={handleDiscardAndLeave}
      />
    </div>
  )
}
