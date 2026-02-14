'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import StaffForm, { type StaffFormData } from '@/components/staff/StaffForm'
import ErrorMessage from '@/components/shared/ErrorMessage'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import SubAvailabilitySection from '@/components/subs/SubAvailabilitySection'
import SubPreferencesSection from '@/components/subs/SubPreferencesSection'
import { ArrowLeft } from 'lucide-react'
import { Database } from '@/types/database'
import type { DisplayNameFormat } from '@/lib/utils/staff-display-name'
import { getStaffDisplayName } from '@/lib/utils/staff-display-name'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useSchool } from '@/lib/contexts/SchoolContext'
import {
  invalidateDashboard,
  invalidateDailySchedule,
  invalidateSubFinderAbsences,
  invalidateTimeOffRequests,
  invalidateWeeklySchedule,
} from '@/lib/utils/invalidation'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

interface StaffFormClientProps {
  staff: Database['public']['Tables']['staff']['Row'] & {
    role_type_ids?: string[]
    role_type_codes?: string[]
  }
}

type StaffRoleType = Database['public']['Tables']['staff_role_types']['Row']

type RoleTypeLookup = Record<string, StaffRoleType>

export default function StaffFormClient({ staff }: StaffFormClientProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const schoolId = useSchool()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [roleTypes, setRoleTypes] = useState<RoleTypeLookup>({})
  const [defaultFormat, setDefaultFormat] = useState<DisplayNameFormat>('first_last_initial')
  const [isActive, setIsActive] = useState(staff.active ?? true)

  const returnPage = searchParams.get('returnPage') || '1'
  const returnSearch = searchParams.get('returnSearch')

  useEffect(() => {
    const fetchRoleTypes = async () => {
      try {
        const response = await fetch('/api/staff-role-types')
        if (!response.ok) return
        const data = await response.json()
        const lookup = (data as StaffRoleType[]).reduce<RoleTypeLookup>((acc, role) => {
          acc[role.id] = role
          return acc
        }, {})
        setRoleTypes(lookup)
      } catch (err) {
        console.error('Failed to fetch staff role types', err)
      }
    }

    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/schedule-settings')
        if (!response.ok) return
        const data = await response.json()
        if (data?.default_display_name_format) {
          setDefaultFormat(data.default_display_name_format)
        }
      } catch (err) {
        console.error('Failed to fetch schedule settings', err)
      }
    }

    fetchRoleTypes()
    fetchSettings()
  }, [])

  const getReturnUrl = () => {
    const params = new URLSearchParams()
    if (returnPage !== '1') {
      params.set('page', returnPage)
    }
    if (returnSearch) {
      params.set('search', returnSearch)
    }
    const queryString = params.toString()
    return `/staff${queryString ? `?${queryString}` : ''}`
  }

  const roleTypeCodes = useMemo(() => {
    if (staff.role_type_codes && staff.role_type_codes.length > 0) {
      return staff.role_type_codes
    }
    const ids = staff.role_type_ids || []
    return ids.map(id => roleTypes[id]?.code).filter(Boolean) as string[]
  }, [roleTypes, staff.role_type_codes, staff.role_type_ids])

  const showAvailability = staff.is_sub || roleTypeCodes.includes('FLEXIBLE')

  useEffect(() => {
    if (!showAvailability && activeTab === 'availability') {
      setActiveTab('overview')
    }
  }, [showAvailability, activeTab])

  const handleSubmit = async (data: StaffFormData) => {
    try {
      setError(null)
      const roleCodes = (data.role_type_ids || [])
        .map(id => roleTypes[id]?.code)
        .filter(Boolean) as string[]
      const effectiveRoleCodes = roleCodes.length > 0 ? roleCodes : roleTypeCodes
      const isTeacherRole =
        effectiveRoleCodes.includes('PERMANENT') || effectiveRoleCodes.includes('FLEXIBLE')

      const payload = {
        ...data,
        email: data.email && data.email.trim() !== '' ? data.email : null,
        is_teacher: isTeacherRole,
        is_sub: data.is_sub ?? false,
        role_type_ids: data.role_type_ids,
        active: isActive,
      }

      const response = await fetch(`/api/staff/${staff.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update staff')
      }

      await Promise.all([
        invalidateWeeklySchedule(queryClient, schoolId),
        invalidateDailySchedule(queryClient, schoolId),
        invalidateDashboard(queryClient, schoolId),
        invalidateTimeOffRequests(queryClient, schoolId),
        invalidateSubFinderAbsences(queryClient, schoolId),
      ])
      router.refresh()
      toast.success('Staff updated.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update staff')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this staff member?')) return

    try {
      setError(null)
      const response = await fetch(`/api/staff/${staff.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete staff')
      }

      router.push(getReturnUrl())
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete staff')
    }
  }

  const staffName =
    getStaffDisplayName(
      {
        first_name: staff.first_name ?? '',
        last_name: staff.last_name ?? '',
        display_name: staff.display_name ?? null,
      },
      defaultFormat
    ) || `${staff.first_name} ${staff.last_name}`

  return (
    <div>
      <div className="mb-4">
        <button
          type="button"
          onClick={() => router.push(getReturnUrl())}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Staff
        </button>
      </div>
      <div className="mb-6 max-w-2xl">
        <div className="flex items-center justify-between gap-6">
          <p className="text-3xl font-bold tracking-tight text-slate-900">{staffName}</p>
          <div className="flex items-center gap-3">
            <Switch
              id="active-toggle"
              checked={isActive}
              onCheckedChange={checked => setIsActive(checked === true)}
            />
            <Label htmlFor="active-toggle" className="font-normal cursor-pointer">
              {isActive ? 'Active' : 'Inactive'}
            </Label>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {isActive
            ? 'Available for scheduling and assignments.'
            : 'Cannot be scheduled or assigned. Past records are preserved.'}
        </p>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList
          className={`grid w-full max-w-2xl ${showAvailability ? 'grid-cols-3' : 'grid-cols-2'}`}
        >
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {showAvailability && <TabsTrigger value="availability">Availability</TabsTrigger>}
          <TabsTrigger value="preferences">Preferences & Qualifications</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-w-2xl">
                <StaffForm
                  staff={staff}
                  onSubmit={handleSubmit}
                  onCancel={() => router.push(getReturnUrl())}
                  defaultDisplayNameFormat={defaultFormat}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {showAvailability && (
          <TabsContent value="availability" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Availability</CardTitle>
              </CardHeader>
              <CardContent>
                <SubAvailabilitySection subId={staff.id} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="preferences" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Preferences & Qualifications</CardTitle>
            </CardHeader>
            <CardContent>
              <SubPreferencesSection
                subId={staff.id}
                sub={{
                  can_change_diapers: staff.can_change_diapers,
                  can_lift_children: staff.can_lift_children,
                  can_assist_with_toileting: staff.can_assist_with_toileting,
                  capabilities_notes: staff.capabilities_notes,
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
