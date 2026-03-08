'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import StaffForm, { type StaffFormData } from '@/components/staff/StaffForm'
import ErrorMessage from '@/components/shared/ErrorMessage'
import StaffEditorTabs from '@/components/staff/StaffEditorTabs'
import StaffUnsavedChangesDialog from '@/components/staff/StaffUnsavedChangesDialog'
import SubAvailabilitySection from '@/components/subs/SubAvailabilitySection'
import SubPreferencesSection from '@/components/subs/SubPreferencesSection'
import SubNotesSection from '@/components/subs/SubNotesSection'
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { Database } from '@/types/database'
import type { DisplayNameFormat } from '@/lib/utils/staff-display-name'
import { getStaffDisplayName } from '@/lib/utils/staff-display-name'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useSchool } from '@/lib/contexts/SchoolContext'
import { useUnsavedNavigationGuard } from '@/lib/hooks/use-unsaved-navigation-guard'
import { invalidateSchedulingSurfaces } from '@/lib/utils/invalidation'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface StaffFormClientProps {
  staff: Database['public']['Tables']['staff']['Row'] & {
    role_type_ids?: string[]
    role_type_codes?: string[]
  }
  defaultDisplayNameFormat?: DisplayNameFormat
  showInactiveBaselineWarning?: boolean
}

type StaffRoleType = Database['public']['Tables']['staff_role_types']['Row']

type RoleTypeLookup = Record<string, StaffRoleType>

export default function StaffFormClient({
  staff,
  defaultDisplayNameFormat,
  showInactiveBaselineWarning = false,
}: StaffFormClientProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const schoolId = useSchool()
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(() => {
    if (
      requestedTab === 'availability' ||
      requestedTab === 'preferences' ||
      requestedTab === 'notes'
    )
      return requestedTab
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
  const [isNotesDirty, setIsNotesDirty] = useState(false)
  const [availabilitySaveSignal, setAvailabilitySaveSignal] = useState(0)
  const [preferencesSaveSignal, setPreferencesSaveSignal] = useState(0)
  const [notesSaveSignal, setNotesSaveSignal] = useState(0)
  const [staffList, setStaffList] = useState<Array<{ id: string }>>([])
  const [overviewResetKey, setOverviewResetKey] = useState(0)
  const [availabilityResetKey, setAvailabilityResetKey] = useState(0)
  const [preferencesResetKey, setPreferencesResetKey] = useState(0)
  const [notesResetKey, setNotesResetKey] = useState(0)
  const [showTabSwitchDialog, setShowTabSwitchDialog] = useState(false)
  const [pendingTabSwitch, setPendingTabSwitch] = useState<{
    sourceTab: 'overview' | 'availability' | 'preferences' | 'notes'
    targetTab: 'overview' | 'availability' | 'preferences' | 'notes'
  } | null>(null)
  const [pendingTabAfterSave, setPendingTabAfterSave] = useState<{
    sourceTab: 'overview' | 'availability' | 'preferences' | 'notes'
    targetTab: 'overview' | 'availability' | 'preferences' | 'notes'
  } | null>(null)
  const [overviewRoleContext, setOverviewRoleContext] = useState<{
    isSub: boolean
    roleTypeIds: string[]
  } | null>(null)

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

  const showAvailability =
    overviewRoleContext !== null ? overviewRoleContext.isSub : Boolean(staff.is_sub)
  const overviewHasUnsavedChanges = isOverviewDirty || isActive !== savedIsActive
  const hasUnsavedChanges =
    overviewHasUnsavedChanges || isAvailabilityDirty || isPreferencesDirty || isNotesDirty

  const resolveTargetTab = useCallback(
    (tab: 'overview' | 'availability' | 'preferences' | 'notes') => {
      if (tab === 'availability' && !showAvailability) return 'preferences' as const
      return tab
    },
    [showAvailability]
  )

  const isTabDirty = useCallback(
    (tab: 'overview' | 'availability' | 'preferences' | 'notes') => {
      if (tab === 'overview') return overviewHasUnsavedChanges
      if (tab === 'availability') return isAvailabilityDirty
      if (tab === 'notes') return isNotesDirty
      return isPreferencesDirty
    },
    [overviewHasUnsavedChanges, isAvailabilityDirty, isPreferencesDirty, isNotesDirty]
  )

  const handleRoleContextChange = useCallback(
    (context: { isSub: boolean; roleTypeIds: string[] }) => {
      setOverviewRoleContext(current => {
        if (
          current &&
          current.isSub === context.isSub &&
          current.roleTypeIds.length === context.roleTypeIds.length &&
          current.roleTypeIds.every((id, idx) => id === context.roleTypeIds[idx])
        ) {
          return current
        }
        return context
      })
    },
    []
  )

  const {
    showUnsavedDialog,
    setShowUnsavedDialog,
    navigateWithUnsavedGuard,
    handleKeepEditing,
    handleDiscardAndLeave,
  } = useUnsavedNavigationGuard({
    hasUnsavedChanges,
    onNavigate: path => router.push(path),
  })

  useEffect(() => {
    if (!showAvailability && activeTab === 'availability') {
      setActiveTab('overview')
    }
  }, [showAvailability, activeTab])

  useEffect(() => {
    if (pendingTabSwitch) {
      const resolved = resolveTargetTab(pendingTabSwitch.targetTab)
      if (resolved !== pendingTabSwitch.targetTab) {
        setPendingTabSwitch(current => (current ? { ...current, targetTab: resolved } : current))
      }
    }
    if (pendingTabAfterSave) {
      const resolved = resolveTargetTab(pendingTabAfterSave.targetTab)
      if (resolved !== pendingTabAfterSave.targetTab) {
        setPendingTabAfterSave(current => (current ? { ...current, targetTab: resolved } : current))
      }
    }
  }, [pendingTabSwitch, pendingTabAfterSave, resolveTargetTab])

  useEffect(() => {
    if (requestedTab === 'availability') {
      setActiveTab(showAvailability ? 'availability' : 'overview')
      return
    }
    if (requestedTab === 'preferences') {
      setActiveTab('preferences')
      return
    }
    if (requestedTab === 'notes') {
      setActiveTab('notes')
    }
  }, [requestedTab, showAvailability])

  useEffect(() => {
    if (!pendingTabAfterSave) return

    const sourceIsDirty = isTabDirty(pendingTabAfterSave.sourceTab)
    if (sourceIsDirty) return

    setActiveTab(pendingTabAfterSave.targetTab)
    setPendingTabAfterSave(null)
    setShowTabSwitchDialog(false)
    setPendingTabSwitch(null)
  }, [pendingTabAfterSave, isTabDirty])

  const handleTabChange = useCallback(
    (nextTab: string) => {
      const normalizedNextTab =
        nextTab === 'availability' || nextTab === 'preferences' || nextTab === 'notes'
          ? nextTab
          : 'overview'
      const resolvedNextTab = resolveTargetTab(normalizedNextTab)
      if (resolvedNextTab === activeTab) return

      const currentTab =
        activeTab === 'availability' || activeTab === 'preferences' || activeTab === 'notes'
          ? activeTab
          : 'overview'
      if (!isTabDirty(currentTab)) {
        setActiveTab(resolvedNextTab)
        return
      }

      setPendingTabSwitch({
        sourceTab: currentTab,
        targetTab: resolvedNextTab,
      })
      setShowTabSwitchDialog(true)
    },
    [activeTab, isTabDirty, resolveTargetTab]
  )

  const handleTabSwitchKeepEditing = useCallback(() => {
    setShowTabSwitchDialog(false)
    setPendingTabSwitch(null)
    setPendingTabAfterSave(null)
  }, [])

  const handleTabSwitchDiscard = useCallback(() => {
    if (!pendingTabSwitch) return

    if (pendingTabSwitch.sourceTab === 'overview') {
      setOverviewResetKey(v => v + 1)
      setIsOverviewDirty(false)
      setIsActive(savedIsActive)
      setOverviewRoleContext(null)
    } else if (pendingTabSwitch.sourceTab === 'availability') {
      setAvailabilityResetKey(v => v + 1)
      setIsAvailabilityDirty(false)
    } else {
      if (pendingTabSwitch.sourceTab === 'preferences') {
        setPreferencesResetKey(v => v + 1)
        setIsPreferencesDirty(false)
      } else {
        setNotesResetKey(v => v + 1)
        setIsNotesDirty(false)
      }
    }

    setActiveTab(resolveTargetTab(pendingTabSwitch.targetTab))
    setShowTabSwitchDialog(false)
    setPendingTabAfterSave(null)
    setPendingTabSwitch(null)
  }, [pendingTabSwitch, resolveTargetTab, savedIsActive])

  const handleTabSwitchSaveAndContinue = useCallback(() => {
    if (!pendingTabSwitch) return

    setPendingTabAfterSave(pendingTabSwitch)

    if (pendingTabSwitch.sourceTab === 'overview') {
      const form = document.getElementById(
        `staff-overview-form-${staff.id}`
      ) as HTMLFormElement | null
      if (form) {
        form.requestSubmit()
      } else {
        setPendingTabAfterSave(null)
      }
      return
    }

    if (pendingTabSwitch.sourceTab === 'availability') {
      setAvailabilitySaveSignal(v => v + 1)
      return
    }

    if (pendingTabSwitch.sourceTab === 'preferences') {
      setPreferencesSaveSignal(v => v + 1)
      return
    }

    setNotesSaveSignal(v => v + 1)
  }, [pendingTabSwitch, staff.id])

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

      await invalidateSchedulingSurfaces(queryClient, schoolId, {
        includeFilterOptions: false,
      })
      setSavedIsActive(isActive)
      setIsOverviewDirty(false)
      router.refresh()
      const staffNameForToast =
        data.display_name?.trim() ||
        [data.first_name?.trim(), data.last_name?.trim()].filter(Boolean).join(' ') ||
        'Staff member'
      toast.success(`${staffNameForToast} has been updated.`)
      return true
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update staff')
      return false
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
        {!isActive && showInactiveBaselineWarning && (
          <Alert className="mt-3 border-amber-200 bg-amber-50 text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This staff member is marked as inactive but still appears in the baseline schedule.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <StaffEditorTabs
        activeTab={activeTab}
        onActiveTabChange={handleTabChange}
        showAvailabilityTab={showAvailability}
        overview={{
          title: 'Overview',
          dirty: overviewHasUnsavedChanges,
          actionLabel: 'Save',
          actionFormId: `staff-overview-form-${staff.id}`,
          cardClassName: 'max-w-[56rem]',
          content: (
            <div className="max-w-[56rem]" key={`overview-form-${overviewResetKey}`}>
              <StaffForm
                staff={staff}
                onSubmit={handleSubmit}
                onCancel={() => navigateWithUnsavedGuard(getReturnUrl())}
                defaultDisplayNameFormat={defaultFormat}
                roleTypes={Object.values(roleTypes)}
                draftCacheKey={`staff-form:${staff.id}`}
                onDirtyChange={setIsOverviewDirty}
                onRoleContextChange={handleRoleContextChange}
                formId={`staff-overview-form-${staff.id}`}
                externalDirty={isActive !== savedIsActive}
              />
            </div>
          ),
        }}
        availability={{
          title: 'Availability',
          dirty: isAvailabilityDirty,
          actionLabel: 'Save',
          onAction: () => setAvailabilitySaveSignal(v => v + 1),
          cardClassName: 'max-w-[56rem]',
          content: (
            <div key={`availability-section-${availabilityResetKey}`}>
              <SubAvailabilitySection
                subId={staff.id}
                onDirtyChange={setIsAvailabilityDirty}
                externalSaveSignal={availabilitySaveSignal}
              />
            </div>
          ),
        }}
        preferences={{
          title: 'Preferences & Qualifications',
          dirty: isPreferencesDirty,
          actionLabel: 'Save',
          onAction: () => setPreferencesSaveSignal(v => v + 1),
          cardClassName: 'max-w-[56rem]',
          content: (
            <div key={`preferences-section-${preferencesResetKey}`}>
              <SubPreferencesSection
                subId={staff.id}
                sub={{
                  can_change_diapers: staff.can_change_diapers,
                  can_lift_children: staff.can_lift_children,
                  can_assist_with_toileting: staff.can_assist_with_toileting,
                }}
                onDirtyChange={setIsPreferencesDirty}
                externalSaveSignal={preferencesSaveSignal}
              />
            </div>
          ),
        }}
        notes={{
          title: 'Notes',
          dirty: isNotesDirty,
          actionLabel: 'Save',
          onAction: () => setNotesSaveSignal(v => v + 1),
          cardClassName: 'max-w-[56rem]',
          content: (
            <div key={`notes-section-${notesResetKey}`}>
              <SubNotesSection
                subId={staff.id}
                initialNotes={staff.capabilities_notes}
                onDirtyChange={setIsNotesDirty}
                externalSaveSignal={notesSaveSignal}
              />
            </div>
          ),
        }}
      />
      <StaffUnsavedChangesDialog
        open={showTabSwitchDialog}
        onOpenChange={open => {
          setShowTabSwitchDialog(open)
          if (!open) {
            setPendingTabSwitch(null)
            setPendingTabAfterSave(null)
          }
        }}
        title="Unsaved Changes"
        description={`You have unsaved changes in ${
          pendingTabSwitch?.sourceTab === 'overview'
            ? 'Overview'
            : pendingTabSwitch?.sourceTab === 'availability'
              ? 'Availability'
              : pendingTabSwitch?.sourceTab === 'preferences'
                ? 'Preferences & Qualifications'
                : 'Notes'
        }. What would you like to do?`}
        keepEditingLabel="Stay here"
        discardLabel="Discard and continue"
        saveLabel="Save and continue"
        onKeepEditing={handleTabSwitchKeepEditing}
        onDiscardAndLeave={handleTabSwitchDiscard}
        onSaveAndContinue={handleTabSwitchSaveAndContinue}
      />
      <StaffUnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onKeepEditing={handleKeepEditing}
        onDiscardAndLeave={handleDiscardAndLeave}
      />
    </div>
  )
}
