'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import FormField from '@/components/shared/FormField'
import ErrorMessage from '@/components/shared/ErrorMessage'
import { Database } from '@/types/database'

type ClassGroup = Database['public']['Tables']['class_groups']['Row']

const classSchema = z.object({
  name: z.string().min(1, 'Class group name is required'),
  min_age: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || isNaN(Number(val)) ? null : Number(val)),
    z.number().int().min(0).max(18).nullable().optional()
  ),
  max_age: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || isNaN(Number(val)) ? null : Number(val)),
    z.number().int().min(0).max(18).nullable().optional()
  ),
  required_ratio: z.number().int().min(1, 'Required ratio must be at least 1'),
  preferred_ratio: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || isNaN(Number(val)) ? null : Number(val)),
    z.number().int().min(1).nullable().optional()
  ),
  diaper_changing_required: z.boolean().optional(),
  lifting_children_required: z.boolean().optional(),
  toileting_assistance_required: z.boolean().optional(),
  is_active: z.boolean().optional(),
})

type ClassFormData = z.infer<typeof classSchema>

interface ClassFormClientProps {
  classData: ClassGroup
}

export default function ClassFormClient({ classData }: ClassFormClientProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      name: classData.name,
      min_age: classData.min_age ?? undefined,
      max_age: classData.max_age ?? undefined,
      required_ratio: classData.required_ratio ?? 8,
      preferred_ratio: classData.preferred_ratio ?? undefined,
      diaper_changing_required: classData.diaper_changing_required ?? false,
      lifting_children_required: classData.lifting_children_required ?? false,
      toileting_assistance_required: classData.toileting_assistance_required ?? false,
      is_active: classData.is_active ?? true,
    },
  })

  const diaperChanging = watch('diaper_changing_required')
  const liftingChildren = watch('lifting_children_required')
  const toiletingAssistance = watch('toileting_assistance_required')
  const isActive = watch('is_active')

  const onSubmit = async (data: ClassFormData) => {
    try {
      setError(null)
      // Convert empty strings to null for optional fields
      const payload = {
        ...data,
        min_age: data.min_age === undefined || data.min_age === null ? null : data.min_age,
        max_age: data.max_age === undefined || data.max_age === null ? null : data.max_age,
        preferred_ratio: data.preferred_ratio === undefined || data.preferred_ratio === null ? null : data.preferred_ratio,
        diaper_changing_required: data.diaper_changing_required ?? false,
        lifting_children_required: data.lifting_children_required ?? false,
        toileting_assistance_required: data.toileting_assistance_required ?? false,
        is_active: data.is_active ?? true,
      }
      const response = await fetch(`/api/class-groups/${classData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update class group')
      }

      router.push('/settings/classes')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    }
  }


  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Edit Class Group</h1>
        <p className="text-muted-foreground mt-2">{classData.name}</p>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormField label="Class Group Name" error={errors.name?.message} required>
            <Input {...register('name')} />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Min Age" error={errors.min_age?.message}>
              <Input
                type="number"
                min="0"
                max="18"
                {...register('min_age')}
                placeholder="Optional"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Age in years
              </p>
            </FormField>

            <FormField label="Max Age" error={errors.max_age?.message}>
              <Input
                type="number"
                min="0"
                max="18"
                {...register('max_age')}
                placeholder="Optional"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Age in years
              </p>
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

          <div className="space-y-4 pt-6 border-t">
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
                  onCheckedChange={(checked) => setValue('diaper_changing_required', checked === true)}
                />
                <Label htmlFor="diaper_changing_required" className="font-normal cursor-pointer">
                  Diaper changing required
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="lifting_children_required"
                  checked={liftingChildren}
                  onCheckedChange={(checked) => setValue('lifting_children_required', checked === true)}
                />
                <Label htmlFor="lifting_children_required" className="font-normal cursor-pointer">
                  Lifting children required
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="toileting_assistance_required"
                  checked={toiletingAssistance}
                  onCheckedChange={(checked) => setValue('toileting_assistance_required', checked === true)}
                />
                <Label htmlFor="toileting_assistance_required" className="font-normal cursor-pointer">
                  Toileting assistance required
                </Label>
              </div>
            </div>
          </div>

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
                onCheckedChange={(checked) => setValue('is_active', checked === true)}
              />
              <Label htmlFor="is_active" className="font-normal cursor-pointer">
                Active (appears in dropdowns)
              </Label>
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => router.push('/settings/classes')}>
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



