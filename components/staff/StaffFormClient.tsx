'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import StaffForm, { type StaffFormData } from '@/components/staff/StaffForm'
import ErrorMessage from '@/components/shared/ErrorMessage'
import StaffEditorTabs from '@/components/staff/StaffEditorTabs'
import StaffUnsavedChangesDialog from '@/components/staff/StaffUnsavedChangesDialog'
import SubAvailabilitySection from '@/components/subs/SubAvailabilitySection'
import SubPreferencesSection from '@/components/subs/SubPreferencesSection'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
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
  defaultDisplayNameFormat?: DisplayNameFormat
}

type StaffRoleType = Database['public']['Tables']['staff_role_types']['Row']

type RoleTypeLookup = Record<string, StaffRoleType>

export default function StaffFormClient({ staff, defaultDisplayNameFormat }: StaffFormClientProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const schoolId = useSchool()
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(() => {
    if (requestedTab === 'availability' || requestedTab === 'preferences') return requestedTab
    return 'overview'
  })
  const [roleTypes, setRoleTypes] = useState<RoleTypeLookup>({})
  const [defaultFormat, setDefaultFormat] = useState<DisplayNameFormat>(
    defaultDisplayNameFormat ?? 'first_last_initial'
  )
  const [isActive, setIsActive] = useState(staff.active ?? true)
  const [savedIsActive, setSavedIsActive] = useState(staff.active ?? true)
  const [isOverviewDirty, setIsOverviewDirty] = useState(false)
  const [isAvailabilityDirty, setIsAvailabilityDirty] = useState(false)
  const [isPreferencesDirty, setIsPreferencesDirty] = useState(false)
  const [availabilitySaveSignal, setAvailabilitySaveSignal] = useState(0)
  const [preferencesSaveSignal, setPreferencesSaveSignal] = useState(0)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [staffList, setStaffList] = useState<Array<{ id: string }>>([])
  const [pendingPath, setPendingPath] = useState<string | null>(null)

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

  useEffect(() => {
    const fetchStaffList = async () => {
      try {
        const response = await fetch('/api/staff')
        if (!response.ok) return
        const data = (await response.json()) as Array<{ id: string }>
        setStaffList(data)
      } catch (err) {
        console.error('Failed to fetch staff list', err)
      }
    }

    fetchStaffList()
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

  const getStaffDetailUrl = (staffId: string) => {
    const params = new URLSearchParams()
    if (returnPage !== '1') {
      params.set('returnPage', returnPage)
    }
    if (returnSearch) {
      params.set('returnSearch', returnSearch)
    }
    const queryString = params.toString()
    return `/staff/${staffId}${queryString ? `?${queryString}` : ''}`
  }

  const staffIndex = useMemo(() => {
    return staffList.findIndex(item => item.id === staff.id)
  }, [staffList, staff.id])
  const previousStaffId = staffIndex > 0 ? staffList[staffIndex - 1]?.id : null
  const nextStaffId =
    staffIndex >= 0 && staffIndex < staffList.length - 1 ? staffList[staffIndex + 1]?.id : null

  const roleTypeCodes = useMemo(() => {
    if (staff.role_type_codes && staff.role_type_codes.length > 0) {
      return staff.role_type_codes
    }
    const ids = staff.role_type_ids || []
    return ids.map(id => roleTypes[id]?.code).filter(Boolean) as string[]
  }, [roleTypes, staff.role_type_codes, staff.role_type_ids])

  const showAvailability = staff.is_sub || roleTypeCodes.includes('FLEXIBLE')
  const overviewHasUnsavedChanges = isOverviewDirty || isActive !== savedIsActive
  const hasUnsavedChanges = overviewHasUnsavedChanges || isAvailabilityDirty || isPreferencesDirty

  const navigateWithUnsavedGuard = (path: string) => {
    if (hasUnsavedChanges) {
      setPendingPath(path)
      setShowUnsavedDialog(true)
      return
    }
    router.push(path)
  }

  useEffect(() => {
    if (!showAvailability && activeTab === 'availability') {
      setActiveTab('overview')
    }
  }, [showAvailability, activeTab])

  useEffect(() => {
    if (requestedTab === 'availability') {
      setActiveTab(showAvailability ? 'availability' : 'overview')
      return
    }
    if (requestedTab === 'preferences') {
      setActiveTab('preferences')
    }
  }, [requestedTab, showAvailability])

  useEffect(() => {
    if (!hasUnsavedChanges) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      const anchor = target.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      if (anchor.target && anchor.target !== '_self') return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return

      const nextUrl = new URL(anchor.href, window.location.href)
      if (nextUrl.origin !== window.location.origin) return

      const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
      if (nextPath === currentPath) return

      event.preventDefault()
      setPendingPath(nextPath)
      setShowUnsavedDialog(true)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleDocumentClick, true)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleDocumentClick, true)
    }
  }, [hasUnsavedChanges])

  const handleDiscardAndLeave = () => {
    const destination = pendingPath
    setShowUnsavedDialog(false)
    setPendingPath(null)
    if (destination) {
      router.push(destination)
    }
  }

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
      setSavedIsActive(isActive)
      setIsOverviewDirty(false)
      router.refresh()
      const staffNameForToast =
        data.display_name?.trim() ||
        [data.first_name?.trim(), data.last_name?.trim()].filter(Boolean).join(' ') ||
        'Staff member'
      toast.success(`${staffNameForToast} has been updated.`)
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
          onClick={() => navigateWithUnsavedGuard(getReturnUrl())}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Staff
        </button>
      </div>
      <div className="mb-6 max-w-2xl">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <p className="text-3xl font-bold tracking-tight text-slate-900">{staffName}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  previousStaffId && navigateWithUnsavedGuard(getStaffDetailUrl(previousStaffId))
                }
                disabled={!previousStaffId}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous staff member"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  nextStaffId && navigateWithUnsavedGuard(getStaffDetailUrl(nextStaffId))
                }
                disabled={!nextStaffId}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next staff member"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="active-toggle" className="font-normal cursor-pointer">
              {isActive ? 'Active' : 'Inactive'}
            </Label>
            <Switch
              id="active-toggle"
              checked={isActive}
              onCheckedChange={checked => setIsActive(checked === true)}
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {isActive
            ? 'Available for scheduling and assignments.'
            : 'Cannot be scheduled or assigned. Past records are preserved.'}
        </p>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <StaffEditorTabs
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
        showAvailabilityTab={showAvailability}
        overview={{
          title: 'Overview',
          dirty: overviewHasUnsavedChanges,
          actionLabel: 'Save',
          actionFormId: `staff-overview-form-${staff.id}`,
          cardClassName: 'max-w-2xl',
          content: (
            <div className="max-w-2xl">
              <StaffForm
                staff={staff}
                onSubmit={handleSubmit}
                onCancel={() => navigateWithUnsavedGuard(getReturnUrl())}
                defaultDisplayNameFormat={defaultFormat}
                roleTypes={Object.values(roleTypes)}
                draftCacheKey={`staff-form:${staff.id}`}
                onDirtyChange={setIsOverviewDirty}
                formId={`staff-overview-form-${staff.id}`}
              />
            </div>
          ),
        }}
        availability={{
          title: 'Availability',
          dirty: isAvailabilityDirty,
          actionLabel: 'Save',
          onAction: () => setAvailabilitySaveSignal(v => v + 1),
          cardClassName: 'max-w-3xl',
          content: (
            <SubAvailabilitySection
              subId={staff.id}
              onDirtyChange={setIsAvailabilityDirty}
              externalSaveSignal={availabilitySaveSignal}
            />
          ),
        }}
        preferences={{
          title: 'Preferences & Qualifications',
          dirty: isPreferencesDirty,
          actionLabel: 'Save',
          onAction: () => setPreferencesSaveSignal(v => v + 1),
          cardClassName: 'max-w-2xl',
          content: (
            <SubPreferencesSection
              subId={staff.id}
              sub={{
                can_change_diapers: staff.can_change_diapers,
                can_lift_children: staff.can_lift_children,
                can_assist_with_toileting: staff.can_assist_with_toileting,
                capabilities_notes: staff.capabilities_notes,
              }}
              onDirtyChange={setIsPreferencesDirty}
              externalSaveSignal={preferencesSaveSignal}
            />
          ),
        }}
      />
      <StaffUnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onKeepEditing={() => {
          setShowUnsavedDialog(false)
          setPendingPath(null)
        }}
        onDiscardAndLeave={handleDiscardAndLeave}
      />
    </div>
  )
}
