'use client'

import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import FormField from '@/components/shared/FormField'
import { Database } from '@/types/database'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

type Staff = Database['public']['Tables']['staff']['Row']
type StaffWithRoleIds = Staff & { role_type_ids?: string[] }
type StaffRoleType = Database['public']['Tables']['staff_role_types']['Row']

const teacherSchema = z
  .object({
    first_name: z.string().min(1, 'First name is required'),
    last_name: z.string().min(1, 'Last name is required'),
    display_name: z.string().optional(),
    phone: z.string().optional(),
    email: z
      .union([z.string().email('Invalid email address'), z.literal('')])
      .optional()
      .transform(val => (val === '' ? undefined : val)),
    role_type_ids: z.array(z.string()),
    active: z.boolean().default(true),
    is_sub: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (!data.is_sub && (!data.role_type_ids || data.role_type_ids.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['role_type_ids'],
        message: 'Select at least one: Permanent, Flexible, or Substitute.',
      })
    }
  })

export type TeacherFormData = z.infer<typeof teacherSchema>

interface TeacherFormProps {
  teacher?: StaffWithRoleIds
  onSubmit: (data: TeacherFormData) => Promise<void>
  onCancel?: () => void
}

export default function TeacherForm({ teacher, onSubmit, onCancel }: TeacherFormProps) {
  const [roleTypes, setRoleTypes] = useState<StaffRoleType[]>([])
  const [loadingRoleTypes, setLoadingRoleTypes] = useState(true)
  const [duplicateWarning, setDuplicateWarning] = useState<{
    message: string
    existingTeacher: { first_name: string; last_name: string; email: string | null }
  } | null>(null)
  const [proceedWithDuplicate, setProceedWithDuplicate] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<TeacherFormData>({
    resolver: zodResolver(teacherSchema) as Resolver<TeacherFormData>,
    defaultValues: teacher
      ? {
          first_name: teacher.first_name,
          last_name: teacher.last_name,
          display_name: teacher.display_name || '',
          phone: teacher.phone || '',
          email: teacher.email || '',
          role_type_ids: teacher.role_type_ids || [],
          active: teacher.active ?? true,
          is_sub: teacher.is_sub ?? false,
        }
      : {
          active: true,
          is_sub: false,
          role_type_ids: [],
        },
  })

  const firstName = watch('first_name')
  const lastName = watch('last_name')
  const email = watch('email')

  // Check for duplicates when creating new teacher (not editing)
  useEffect(() => {
    if (teacher) return // Don't check duplicates when editing

    const checkDuplicate = async () => {
      // Only check if we have enough info (name or email)
      if (!firstName?.trim() && !lastName?.trim() && !email?.trim()) {
        setDuplicateWarning(null)
        setProceedWithDuplicate(false)
        return
      }

      // Debounce the check
      const timeoutId = setTimeout(async () => {
        try {
          const checkData = {
            first_name: firstName?.trim() || '',
            last_name: lastName?.trim() || '',
            email: email?.trim() || null,
          }

          const response = await fetch('/api/teachers/check-duplicates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              teachers: [checkData],
            }),
          })

          if (response.ok) {
            const data = await response.json()
            if (data.duplicates && data.duplicates.length > 0) {
              const dup = data.duplicates[0]
              setDuplicateWarning({
                message: `A teacher with this ${dup.matchType === 'email' ? 'email' : dup.matchType === 'name' ? 'name' : 'email and name'} already exists.`,
                existingTeacher: dup.existingTeacher,
              })
              setProceedWithDuplicate(false)
            } else {
              setDuplicateWarning(null)
              setProceedWithDuplicate(false)
            }
          }
        } catch (error) {
          console.error('Error checking duplicates:', error)
        }
      }, 500) // 500ms debounce

      return () => clearTimeout(timeoutId)
    }

    checkDuplicate()
  }, [firstName, lastName, email, teacher])

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
  const roleTypeIds = watch('role_type_ids') || []

  const handleFormSubmit = async (data: TeacherFormData) => {
    // If duplicate warning exists and user hasn't confirmed, prevent submission
    if (duplicateWarning && !proceedWithDuplicate) {
      return
    }
    await onSubmit(data)
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
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
            onCheckedChange={checked => setValue('active', checked === true)}
          />
          <Label htmlFor="active" className="font-normal cursor-pointer">
            Active
          </Label>
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t">
        <FormField label="Staff Role" error={errors.role_type_ids?.message} required>
          {loadingRoleTypes ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <div className="flex flex-wrap items-center gap-6">
              {roleTypes.map(roleType => {
                const checked = roleTypeIds.includes(roleType.id)
                return (
                  <div key={roleType.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`role-${roleType.id}`}
                      checked={checked}
                      onCheckedChange={value => {
                        const next = value
                          ? [...roleTypeIds, roleType.id]
                          : roleTypeIds.filter(id => id !== roleType.id)
                        setValue('role_type_ids', next, { shouldValidate: true })
                      }}
                    />
                    <Label htmlFor={`role-${roleType.id}`} className="font-normal cursor-pointer">
                      {roleType.label}
                    </Label>
                  </div>
                )
              })}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_sub"
                  checked={isSub}
                  onCheckedChange={checked =>
                    setValue('is_sub', checked === true, { shouldValidate: true })
                  }
                />
                <Label htmlFor="is_sub" className="font-normal cursor-pointer">
                  Is also a sub
                </Label>
              </div>
            </div>
          )}
        </FormField>
      </div>

      {/* Duplicate Warning */}
      {!teacher && duplicateWarning && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="space-y-2">
            <div>
              {duplicateWarning.message}
              <div className="mt-1 text-sm">
                Existing teacher:{' '}
                <strong>
                  {duplicateWarning.existingTeacher.first_name}{' '}
                  {duplicateWarning.existingTeacher.last_name}
                </strong>
                {duplicateWarning.existingTeacher.email && (
                  <> ({duplicateWarning.existingTeacher.email})</>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="proceed-duplicate"
                checked={proceedWithDuplicate}
                onCheckedChange={checked => setProceedWithDuplicate(checked === true)}
              />
              <Label htmlFor="proceed-duplicate" className="text-sm font-normal cursor-pointer">
                I understand this is a duplicate and want to create anyway
              </Label>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting || (duplicateWarning ? !proceedWithDuplicate : false)}
        >
          {isSubmitting ? 'Saving...' : teacher ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  )
}
