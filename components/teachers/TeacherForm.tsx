'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import FormField from '@/components/shared/FormField'
import { Database } from '@/types/database'

type Staff = Database['public']['Tables']['staff']['Row']
type StaffRoleType = Database['public']['Tables']['staff_role_types']['Row']

const teacherSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  display_name: z.string().optional(),
  phone: z.string().optional(),
  email: z
    .union([z.string().email('Invalid email address'), z.literal('')])
    .optional()
    .transform((val) => (val === '' ? undefined : val)),
  role_type_id: z.string().min(1, 'Staff role is required'),
  active: z.boolean().default(true),
  is_sub: z.boolean().default(false),
})

type TeacherFormData = z.infer<typeof teacherSchema>

interface TeacherFormProps {
  teacher?: Staff
  onSubmit: (data: TeacherFormData) => Promise<void>
  onCancel?: () => void
}

export default function TeacherForm({ teacher, onSubmit, onCancel }: TeacherFormProps) {
  const [roleTypes, setRoleTypes] = useState<StaffRoleType[]>([])
  const [loadingRoleTypes, setLoadingRoleTypes] = useState(true)

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
          role_type_id: teacher.role_type_id || '',
          active: teacher.active ?? true,
          is_sub: teacher.is_sub ?? false,
        }
      : {
          active: true,
          is_sub: false,
        },
  })

  useEffect(() => {
    async function fetchRoleTypes() {
      try {
        const response = await fetch('/api/staff-role-types')
        if (response.ok) {
          const data = await response.json()
          setRoleTypes(data)
        }
      } catch (error) {
        console.error('Failed to fetch staff role types:', error)
      } finally {
        setLoadingRoleTypes(false)
      }
    }
    fetchRoleTypes()
  }, [])

  const active = watch('active')
  const isSub = watch('is_sub')
  const roleTypeId = watch('role_type_id')

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
            id="is_sub"
            checked={isSub}
            onCheckedChange={(checked) => setValue('is_sub', checked === true)}
          />
          <Label htmlFor="is_sub" className="font-normal cursor-pointer">
            Is also a sub
          </Label>
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t">
        <FormField label="Staff Role" error={errors.role_type_id?.message} required>
          {loadingRoleTypes ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <RadioGroup
              value={roleTypeId || ''}
              onValueChange={(value) => setValue('role_type_id', value)}
            >
              <div className="flex items-center space-x-6">
                {roleTypes.map((roleType) => (
                  <div key={roleType.id} className="flex items-center space-x-2">
                    <RadioGroupItem value={roleType.id} id={`role-${roleType.id}`} />
                    <Label
                      htmlFor={`role-${roleType.id}`}
                      className="font-normal cursor-pointer"
                    >
                      {roleType.label}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          )}
        </FormField>
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

