'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import FormField from '@/components/shared/FormField'
import { Database } from '@/types/database'

type Staff = Database['public']['Tables']['staff']['Row']

const subSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  display_name: z.string().optional(),
  phone: z.string().optional(),
  email: z
    .union([z.string().email('Invalid email address'), z.literal('')])
    .optional()
    .transform((val) => (val === '' ? undefined : val)),
  active: z.boolean().default(true),
  is_teacher: z.boolean().default(false),
})

type SubFormData = z.infer<typeof subSchema>

interface SubFormProps {
  sub?: Staff
  onSubmit: (data: SubFormData) => Promise<void>
  onCancel?: () => void
}

export default function SubForm({ sub, onSubmit, onCancel }: SubFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<SubFormData>({
    resolver: zodResolver(subSchema),
    defaultValues: sub
      ? {
          first_name: sub.first_name,
          last_name: sub.last_name,
          display_name: sub.display_name || '',
          phone: sub.phone || '',
          email: sub.email || '',
          active: sub.active ?? true,
          is_teacher: sub.is_teacher ?? false,
        }
      : {
          active: true,
          is_teacher: false,
        },
  })

  const active = watch('active')
  const isTeacher = watch('is_teacher')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField label="First Name" error={errors.first_name?.message} required>
          <Input {...register('first_name')} />
        </FormField>

        <FormField label="Last Name" error={errors.last_name?.message} required>
          <Input {...register('last_name')} />
        </FormField>

        <FormField label="Display Name" error={errors.display_name?.message}>
          <Input {...register('display_name')} placeholder="Optional" />
        </FormField>

        <FormField label="Email" error={errors.email?.message}>
          <Input type="email" {...register('email')} placeholder="Optional" />
        </FormField>

        <FormField label="Phone" error={errors.phone?.message}>
          <Input type="tel" {...register('phone')} placeholder="Optional" />
        </FormField>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="active"
            checked={active}
            onCheckedChange={(checked) => setValue('active', checked === true)}
          />
          <Label htmlFor="active" className="font-normal cursor-pointer">
            Active
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="is_teacher"
            checked={isTeacher}
            onCheckedChange={(checked) => setValue('is_teacher', checked === true)}
          />
          <Label htmlFor="is_teacher" className="font-normal cursor-pointer">
            Is also a teacher
          </Label>
        </div>
      </div>

      <div className="flex justify-end gap-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : sub ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  )
}

