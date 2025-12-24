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

const teacherSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  display_name: z.string().optional(),
  phone: z.string().optional(),
  email: z
    .union([z.string().email('Invalid email address'), z.literal('')])
    .optional()
    .transform((val) => (val === '' ? undefined : val)),
  active: z.boolean().default(true),
})

type TeacherFormData = z.infer<typeof teacherSchema>

interface TeacherFormProps {
  teacher?: Staff
  onSubmit: (data: TeacherFormData) => Promise<void>
  onCancel?: () => void
}

export default function TeacherForm({ teacher, onSubmit, onCancel }: TeacherFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<TeacherFormData>({
    resolver: zodResolver(teacherSchema),
    defaultValues: teacher
      ? {
          first_name: teacher.first_name,
          last_name: teacher.last_name,
          display_name: teacher.display_name || '',
          phone: teacher.phone || '',
          email: teacher.email || '',
          active: teacher.active ?? true,
        }
      : {
          active: true,
        },
  })

  const active = watch('active')

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
      </div>

      <div className="flex justify-end gap-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : teacher ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  )
}

