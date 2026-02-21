'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import StaffForm, { type StaffFormData } from '@/components/staff/StaffForm'
import ErrorMessage from '@/components/shared/ErrorMessage'
import StaffEditorTabs from '@/components/staff/StaffEditorTabs'
import StaffUnsavedChangesDialog from '@/components/staff/StaffUnsavedChangesDialog'
import { Database } from '@/types/database'
import type { DisplayNameFormat } from '@/lib/utils/staff-display-name'
import { ArrowLeft } from 'lucide-react'

export default function NewStaffPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [roleTypes, setRoleTypes] = useState<
    Database['public']['Tables']['staff_role_types']['Row'][]
  >([])
  const [defaultFormat, setDefaultFormat] = useState<DisplayNameFormat>('first_last_initial')
  const [isOverviewDirty, setIsOverviewDirty] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingPath, setPendingPath] = useState<string | null>(null)

  useEffect(() => {
    const fetchRoleTypes = async () => {
      try {
        const response = await fetch('/api/staff-role-types')
        if (!response.ok) return
        const data = await response.json()
        setRoleTypes(data)
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
    if (!isOverviewDirty) return

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
  }, [isOverviewDirty])

  const navigateWithUnsavedGuard = (path: string) => {
    if (isOverviewDirty) {
      setPendingPath(path)
      setShowUnsavedDialog(true)
      return
    }
    router.push(path)
  }

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
        .map(id => roleTypes.find(role => role.id === id)?.code)
        .filter(Boolean) as string[]
      const isTeacherRole = roleCodes.includes('PERMANENT') || roleCodes.includes('FLEXIBLE')

      const payload = {
        ...data,
        email: data.email && data.email.trim() !== '' ? data.email : null,
        is_teacher: isTeacherRole,
        is_sub: data.is_sub ?? false,
        role_type_ids: data.role_type_ids,
      }

      const response = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create staff')
      }

      const createdStaff = await response.json()
      setIsOverviewDirty(false)
      const nextTab = data.is_sub ? 'availability' : 'preferences'
      router.push(`/staff/${createdStaff.id}?tab=${nextTab}`)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create staff')
    }
  }

  return (
    <div>
      <div className="mb-4">
        <button
          type="button"
          onClick={() => navigateWithUnsavedGuard('/staff')}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Staff
        </button>
      </div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Add Staff Member</h1>
        <p className="text-muted-foreground mt-2">Create a new staff profile</p>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <StaffEditorTabs
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
        showAvailabilityTab={true}
        overview={{
          title: 'Overview',
          dirty: isOverviewDirty,
          actionLabel: 'Create',
          actionFormId: 'staff-new-overview-form',
          content: (
            <div className="max-w-2xl">
              <StaffForm
                onSubmit={handleSubmit}
                onCancel={() => navigateWithUnsavedGuard('/staff')}
                defaultDisplayNameFormat={defaultFormat}
                roleTypes={roleTypes}
                draftCacheKey="staff-form:new"
                onDirtyChange={setIsOverviewDirty}
                formId="staff-new-overview-form"
              />
            </div>
          ),
        }}
        availability={{
          title: 'Availability',
          triggerDisabled: true,
          content: (
            <p className="text-sm text-muted-foreground">
              Create this staff member first. Availability can be managed immediately afterward on
              their staff detail page.
            </p>
          ),
        }}
        preferences={{
          title: 'Preferences & Qualifications',
          triggerDisabled: true,
          content: (
            <p className="text-sm text-muted-foreground">
              Create this staff member first. Preferences and qualifications can be managed on their
              staff detail page.
            </p>
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
