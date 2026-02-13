'use client'

import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import FormField from '@/components/shared/FormField'
import { Database } from '@/types/database'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

const staffSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  display_name: z.string().optional(),
  phone: z.string().optional(),
  email: z
    .union([z.string().email('Invalid email address'), z.literal('')])
    .optional()
    .transform(val => (val === '' ? undefined : val)),
  role_type_ids: z.array(z.string()).min(1, 'At least one staff role is required'),
  active: z.boolean().default(true),
  is_sub: z.boolean().default(false),
})

type Staff = Database['public']['Tables']['staff']['Row']
type StaffWithRoleIds = Staff & { role_type_ids?: string[] }
type StaffRoleType = Database['public']['Tables']['staff_role_types']['Row']

export type StaffFormData = z.infer<typeof staffSchema>

interface StaffFormProps {
  staff?: StaffWithRoleIds
  onSubmit: (data: StaffFormData) => Promise<void>
  onCancel?: () => void
}

export default function StaffForm({ staff, onSubmit, onCancel }: StaffFormProps) {
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
  } = useForm<StaffFormData>({
    resolver: zodResolver(staffSchema) as Resolver<StaffFormData>,
    defaultValues: staff
      ? {
          first_name: staff.first_name,
          last_name: staff.last_name,
          display_name: staff.display_name || '',
          phone: staff.phone || '',
          email: staff.email || '',
          role_type_ids: staff.role_type_ids || [],
          active: staff.active ?? true,
          is_sub: staff.is_sub ?? false,
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
  const active = watch('active')
  const isSub = watch('is_sub')
  const roleTypeIds = watch('role_type_ids') || []

  useEffect(() => {
    if (staff) return

    const checkDuplicate = async () => {
      if (!firstName?.trim() && !lastName?.trim() && !email?.trim()) {
        setDuplicateWarning(null)
        setProceedWithDuplicate(false)
        return
      }

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
                message: `A staff member with this ${dup.matchType === 'email' ? 'email' : dup.matchType === 'name' ? 'name' : 'email and name'} already exists.`,
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
      }, 500)

      return () => clearTimeout(timeoutId)
    }

    checkDuplicate()
  }, [firstName, lastName, email, staff])

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

  const handleFormSubmit = async (data: StaffFormData) => {
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
                  onCheckedChange={checked => setValue('is_sub', checked === true)}
                />
                <Label htmlFor="is_sub" className="font-normal cursor-pointer">
                  Is also a sub
                </Label>
              </div>
            </div>
          )}
        </FormField>
      </div>

      {!staff && duplicateWarning && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="space-y-2">
            <div>
              {duplicateWarning.message}
              <div className="mt-1 text-sm">
                Existing staff:{' '}
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
                id="proceed_duplicate"
                checked={proceedWithDuplicate}
                onCheckedChange={checked => setProceedWithDuplicate(checked === true)}
              />
              <Label htmlFor="proceed_duplicate" className="font-normal cursor-pointer">
                Proceed anyway
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
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : staff ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  )
}
