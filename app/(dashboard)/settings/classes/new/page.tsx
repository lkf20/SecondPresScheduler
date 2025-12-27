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

const classSchema = z.object({
  name: z.string().min(1, 'Class name is required'),
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
})

type ClassFormData = z.infer<typeof classSchema>

export default function NewClassPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
  })

  const onSubmit = async (data: ClassFormData) => {
    try {
      setError(null)
      // Convert empty strings to null for optional fields
      const payload = {
        ...data,
        min_age: data.min_age === undefined || data.min_age === null ? null : data.min_age,
        max_age: data.max_age === undefined || data.max_age === null ? null : data.max_age,
        preferred_ratio: data.preferred_ratio === undefined || data.preferred_ratio === null ? null : data.preferred_ratio,
      }
      const response = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create class')
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
        <h1 className="text-3xl font-bold tracking-tight">Add New Class</h1>
        <p className="text-muted-foreground mt-2">Create a new class</p>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormField label="Class Name" error={errors.name?.message} required>
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
            </FormField>

            <FormField label="Max Age" error={errors.max_age?.message}>
              <Input
                type="number"
                min="0"
                max="18"
                {...register('max_age')}
                placeholder="Optional"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Required Ratio" error={errors.required_ratio?.message} required>
              <Input
                type="number"
                min="1"
                {...register('required_ratio', { valueAsNumber: true })}
                placeholder="e.g., 8"
                defaultValue={8}
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

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => router.push('/settings/classes')}>
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



