'use client'

import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import FormField from '@/components/shared/FormField'
import { Database } from '@/types/database'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import {
  computeDisplayName,
  formatStaffDisplayName,
  type DisplayNameFormat,
} from '@/lib/utils/staff-display-name'

const staffSchema = z
  .object({
    first_name: z.string().min(1, 'First name is required'),
    last_name: z.string().min(1, 'Last name is required'),
    display_name: z.string().min(1, 'Display name is required'),
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

type Staff = Database['public']['Tables']['staff']['Row']
type StaffWithRoleIds = Staff & { role_type_ids?: string[] }
type StaffRoleType = Database['public']['Tables']['staff_role_types']['Row']

export type StaffFormData = z.infer<typeof staffSchema>

interface StaffFormProps {
  staff?: StaffWithRoleIds
  onSubmit: (data: StaffFormData) => Promise<void>
  onCancel?: () => void
  defaultDisplayNameFormat?: DisplayNameFormat
  roleTypes?: StaffRoleType[]
  draftCacheKey?: string
  onDirtyChange?: (dirty: boolean) => void
  formId?: string
}

const staffFormDraftCache = new Map<string, StaffFormData>()
const normalizeRoleTypeIds = (ids: string[] = []) => [...ids].sort((a, b) => a.localeCompare(b))
const normalizeStaffFormData = (data: StaffFormData): StaffFormData => ({
  first_name: data.first_name || '',
  last_name: data.last_name || '',
  display_name: data.display_name || '',
  phone: data.phone || '',
  email: data.email || '',
  role_type_ids: normalizeRoleTypeIds(data.role_type_ids || []),
  active: data.active ?? true,
  is_sub: data.is_sub ?? false,
})

export default function StaffForm({
  staff,
  onSubmit,
  onCancel,
  defaultDisplayNameFormat = 'first_last_initial',
  roleTypes: roleTypesProp = [],
  draftCacheKey,
  onDirtyChange,
  formId,
}: StaffFormProps) {
  const [roleTypes, setRoleTypes] = useState<StaffRoleType[]>(roleTypesProp)
  const [loadingRoleTypes, setLoadingRoleTypes] = useState(roleTypesProp.length === 0)
  const [duplicateWarning, setDuplicateWarning] = useState<{
    message: string
    existingTeacher: { first_name: string; last_name: string; email: string | null }
  } | null>(null)
  const [proceedWithDuplicate, setProceedWithDuplicate] = useState(false)
  const cachedDraft = draftCacheKey ? staffFormDraftCache.get(draftCacheKey) : undefined
  const initialValues: StaffFormData = cachedDraft
    ? cachedDraft
    : staff
      ? {
          first_name: staff.first_name,
          last_name: staff.last_name,
          display_name: staff.display_name || '',
          phone: staff.phone || '',
          email: staff.email || '',
          role_type_ids: normalizeRoleTypeIds(staff.role_type_ids || []),
          active: staff.active ?? true,
          is_sub: staff.is_sub ?? false,
        }
      : {
          first_name: '',
          last_name: '',
          display_name: '',
          phone: '',
          email: '',
          role_type_ids: normalizeRoleTypeIds([]),
          active: true,
          is_sub: false,
        }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<StaffFormData>({
    resolver: zodResolver(staffSchema) as Resolver<StaffFormData>,
    defaultValues: initialValues,
  })

  const firstName = watch('first_name')
  const lastName = watch('last_name')
  const active = watch('active')
  const phone = watch('phone')
  const email = watch('email')
  const isSub = watch('is_sub')
  const displayName = watch('display_name')
  const watchedRoleTypeIds = watch('role_type_ids')
  const roleTypeIds = useMemo(
    () => normalizeRoleTypeIds(watchedRoleTypeIds || []),
    [watchedRoleTypeIds]
  )
  const baselineForDirtyRef = useRef<StaffFormData>(normalizeStaffFormData(initialValues))
  const currentForDirty = useMemo(
    () =>
      normalizeStaffFormData({
        first_name: firstName || '',
        last_name: lastName || '',
        display_name: displayName || '',
        phone: phone || '',
        email: email || '',
        role_type_ids: roleTypeIds || [],
        active: active ?? true,
        is_sub: isSub ?? false,
      }),
    [firstName, lastName, displayName, phone, email, roleTypeIds, active, isSub]
  )
  const isFormDirty =
    JSON.stringify(currentForDirty) !== JSON.stringify(baselineForDirtyRef.current)
  const [useDefaultDisplayName, setUseDefaultDisplayName] = useState(() => {
    if (!staff) return true
    const { isCustom } = computeDisplayName(staff, defaultDisplayNameFormat)
    return !isCustom
  })
  const defaultDisplayNamePreview = formatStaffDisplayName(
    {
      first_name: firstName || '',
      last_name: lastName || '',
      display_name: displayName || '',
    },
    defaultDisplayNameFormat
  )

  useEffect(() => {
    if (!useDefaultDisplayName) return
    if (!defaultDisplayNamePreview) return
    setValue('display_name', defaultDisplayNamePreview)
  }, [useDefaultDisplayName, defaultDisplayNamePreview, setValue])

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
    if (!staff) return
    const { isCustom } = computeDisplayName(staff, defaultDisplayNameFormat)
    setUseDefaultDisplayName(!isCustom)
  }, [staff, defaultDisplayNameFormat])

  useEffect(() => {
    if (roleTypesProp.length > 0) {
      setRoleTypes(roleTypesProp)
      setLoadingRoleTypes(false)
      return
    }

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
  }, [roleTypesProp])

  useEffect(() => {
    if (!draftCacheKey) return
    const subscription = watch(values => {
      const nextDraft: StaffFormData = {
        first_name: values.first_name || '',
        last_name: values.last_name || '',
        display_name: values.display_name || '',
        phone: values.phone || '',
        email: values.email || '',
        role_type_ids: normalizeRoleTypeIds(
          (values.role_type_ids || []).filter((id): id is string => typeof id === 'string')
        ),
        active: values.active ?? true,
        is_sub: values.is_sub ?? false,
      }
      staffFormDraftCache.set(draftCacheKey, nextDraft)
    })
    return () => subscription.unsubscribe()
  }, [draftCacheKey, watch])

  useEffect(() => {
    onDirtyChange?.(isFormDirty)
  }, [isFormDirty, onDirtyChange])

  const handleFormSubmit = async (data: StaffFormData) => {
    if (duplicateWarning && !proceedWithDuplicate) {
      return
    }
    await onSubmit(data)
    onDirtyChange?.(false)
    if (draftCacheKey) {
      staffFormDraftCache.delete(draftCacheKey)
    }
  }

  return (
    <form id={formId} onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField label="First Name" error={errors.first_name?.message} required>
          <Input {...register('first_name')} />
        </FormField>

        <FormField label="Last Name" error={errors.last_name?.message} required>
          <Input {...register('last_name')} />
        </FormField>

        <div className="md:col-span-2 space-y-2">
          <FormField label="Display Name" error={errors.display_name?.message} required>
            <Input {...register('display_name')} disabled={useDefaultDisplayName} />
          </FormField>
          <div className="flex items-center gap-2">
            <Checkbox
              id="use-default-display-name"
              checked={useDefaultDisplayName}
              onCheckedChange={checked => {
                const next = checked === true
                setUseDefaultDisplayName(next)
                if (next) {
                  setValue('display_name', defaultDisplayNamePreview)
                }
              }}
            />
            <Label htmlFor="use-default-display-name" className="font-normal cursor-pointer">
              Use default format
            </Label>
          </div>
          {!useDefaultDisplayName && (
            <p className="text-sm text-muted-foreground">
              Default: {defaultDisplayNamePreview || '—'}
            </p>
          )}
        </div>

        <FormField label="Email" error={errors.email?.message}>
          <Input type="email" {...register('email')} placeholder="Optional" />
        </FormField>

        <FormField label="Phone" error={errors.phone?.message}>
          <Input type="tel" {...register('phone')} placeholder="Optional" />
        </FormField>
      </div>

      <div className="space-y-4 pt-4 border-t">
        <FormField label="Staff Roles" error={errors.role_type_ids?.message} required>
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
                        setValue('role_type_ids', normalizeRoleTypeIds(next), {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
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
                    setValue('is_sub', checked === true, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
                <Label htmlFor="is_sub" className="font-normal cursor-pointer">
                  Substitute
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
        <Button type="submit" disabled={isSubmitting || (Boolean(staff) && !isFormDirty)}>
          {isSubmitting ? 'Saving...' : staff ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  )
}
