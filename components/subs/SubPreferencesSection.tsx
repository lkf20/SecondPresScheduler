'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import SubClassPreferences from './SubClassPreferences'
import SubQualifications from './SubQualifications'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface ClassPreference {
  id: string
  class_group_id?: string | null
  class_group?: {
    id: string
    name: string
  }
}

interface StaffQualification {
  id: string
  qualification_id: string
  level: string | null
  expires_on: string | null
  verified: boolean | null
  notes: string | null
  qualification?: {
    id: string
    name: string
    category: string | null
  }
}

interface SubPreferencesSectionProps {
  subId: string
  sub: {
    can_change_diapers: boolean | null
    can_lift_children: boolean | null
    can_assist_with_toileting: boolean | null
    capabilities_notes: string | null
  }
  onDirtyChange?: (dirty: boolean) => void
  externalSaveSignal?: number
}

type QualificationDraft = {
  qualification_id: string
  level: string | null
  expires_on: string | null
  verified: boolean | null
  notes: string | null
}

type PreferencesSnapshot = {
  selectedClassIds: string[]
  qualifications: QualificationDraft[]
  capabilitiesState: {
    can_change_diapers: boolean
    can_lift_children: boolean
    can_assist_with_toileting: boolean
    capabilities_notes: string
  }
}

const preferencesCache = new Map<
  string,
  {
    classPreferences: ClassPreference[]
    selectedClassIds: string[]
    qualifications: StaffQualification[]
    capabilitiesState: {
      can_change_diapers: boolean
      can_lift_children: boolean
      can_assist_with_toileting: boolean
      capabilities_notes: string
    }
  }
>()
const preferencesDirtyCache = new Map<string, boolean>()
const preferencesBaselineCache = new Map<string, PreferencesSnapshot>()

const normalizeQualificationDrafts = (quals: QualificationDraft[]) =>
  [...quals]
    .map(item => ({
      qualification_id: item.qualification_id,
      level: item.level ?? null,
      expires_on: item.expires_on ?? null,
      verified: item.verified ?? null,
      notes: item.notes ?? null,
    }))
    .sort((a, b) => a.qualification_id.localeCompare(b.qualification_id))

const buildSnapshot = (
  selectedClassIds: string[],
  qualifications: QualificationDraft[],
  capabilitiesState: {
    can_change_diapers: boolean
    can_lift_children: boolean
    can_assist_with_toileting: boolean
    capabilities_notes: string
  }
): PreferencesSnapshot => ({
  selectedClassIds: [...selectedClassIds].sort(),
  qualifications: normalizeQualificationDrafts(qualifications),
  capabilitiesState: {
    can_change_diapers: capabilitiesState.can_change_diapers,
    can_lift_children: capabilitiesState.can_lift_children,
    can_assist_with_toileting: capabilitiesState.can_assist_with_toileting,
    capabilities_notes: capabilitiesState.capabilities_notes || '',
  },
})

const snapshotsEqual = (a: PreferencesSnapshot | null, b: PreferencesSnapshot | null) => {
  if (!a || !b) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

export default function SubPreferencesSection({
  subId,
  sub,
  onDirtyChange,
  externalSaveSignal,
}: SubPreferencesSectionProps) {
  const defaultCapabilitiesState = useMemo(
    () => ({
      can_change_diapers: sub.can_change_diapers ?? false,
      can_lift_children: sub.can_lift_children ?? false,
      can_assist_with_toileting: sub.can_assist_with_toileting ?? false,
      capabilities_notes: sub.capabilities_notes || '',
    }),
    [
      sub.can_change_diapers,
      sub.can_lift_children,
      sub.can_assist_with_toileting,
      sub.capabilities_notes,
    ]
  )
  const [loading, setLoading] = useState(true)
  const [classPreferences, setClassPreferences] = useState<ClassPreference[]>([])
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([])
  const [qualifications, setQualifications] = useState<StaffQualification[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [capabilitiesState, setCapabilitiesState] = useState(defaultCapabilitiesState)
  const [baselineSnapshot, setBaselineSnapshot] = useState<PreferencesSnapshot | null>(null)
  const lastHandledExternalSaveSignalRef = useRef(0)
  const currentSnapshot = useMemo(
    () =>
      buildSnapshot(
        selectedClassIds,
        qualifications.map(item => ({
          qualification_id: item.qualification_id,
          level: item.level ?? null,
          expires_on: item.expires_on ?? null,
          verified: item.verified ?? null,
          notes: item.notes ?? null,
        })),
        capabilitiesState
      ),
    [selectedClassIds, qualifications, capabilitiesState]
  )

  const fetchPreferences = useCallback(async () => {
    try {
      const response = await fetch(`/api/subs/${subId}/preferences`)
      if (!response.ok) throw new Error('Failed to fetch preferences')
      const data = await response.json()
      const nextClassPreferences = data as ClassPreference[]
      const nextSelectedClassIds = nextClassPreferences
        .map(p => p.class_group_id)
        .filter((id): id is string => Boolean(id))
      setClassPreferences(nextClassPreferences)
      setSelectedClassIds(nextSelectedClassIds)
      const cached = preferencesCache.get(subId)
      preferencesCache.set(subId, {
        classPreferences: nextClassPreferences,
        selectedClassIds: nextSelectedClassIds,
        qualifications: cached?.qualifications || [],
        capabilitiesState: cached?.capabilitiesState || defaultCapabilitiesState,
      })
    } catch (error) {
      console.error('Error fetching preferences:', error)
    }
  }, [subId, defaultCapabilitiesState])

  const fetchQualifications = useCallback(async () => {
    try {
      const response = await fetch(`/api/subs/${subId}/qualifications`)
      if (!response.ok) throw new Error('Failed to fetch qualifications')
      const data = await response.json()
      const nextQualifications = data as StaffQualification[]
      setQualifications(nextQualifications)
      const cached = preferencesCache.get(subId)
      preferencesCache.set(subId, {
        classPreferences: cached?.classPreferences || [],
        selectedClassIds: cached?.selectedClassIds || [],
        qualifications: nextQualifications,
        capabilitiesState: cached?.capabilitiesState || defaultCapabilitiesState,
      })
    } catch (error) {
      console.error('Error fetching qualifications:', error)
    } finally {
      setLoading(false)
    }
  }, [subId, defaultCapabilitiesState])

  useEffect(() => {
    const cached = preferencesCache.get(subId)
    const cachedBaseline = preferencesBaselineCache.get(subId) || null
    setBaselineSnapshot(cachedBaseline)
    if (cached) {
      setClassPreferences(cached.classPreferences)
      setSelectedClassIds(cached.selectedClassIds)
      setQualifications(cached.qualifications)
      setCapabilitiesState(cached.capabilitiesState)
      const snapshot = buildSnapshot(
        cached.selectedClassIds,
        cached.qualifications.map(item => ({
          qualification_id: item.qualification_id,
          level: item.level,
          expires_on: item.expires_on,
          verified: item.verified,
          notes: item.notes,
        })),
        cached.capabilitiesState
      )
      const dirty = cachedBaseline
        ? !snapshotsEqual(snapshot, cachedBaseline)
        : preferencesDirtyCache.get(subId) === true
      setHasUnsavedChanges(dirty)
      preferencesDirtyCache.set(subId, dirty)
      setLoading(false)
      if (!dirty) {
        fetchPreferences()
        fetchQualifications()
      }
      return
    }
    fetchPreferences()
    fetchQualifications()
  }, [subId, fetchPreferences, fetchQualifications])

  useEffect(() => {
    setCapabilitiesState(defaultCapabilitiesState)
  }, [defaultCapabilitiesState])

  useEffect(() => {
    if (loading) return
    if (baselineSnapshot) return
    setBaselineSnapshot(currentSnapshot)
    preferencesBaselineCache.set(subId, currentSnapshot)
  }, [loading, baselineSnapshot, currentSnapshot, subId])

  useEffect(() => {
    if (loading || !baselineSnapshot) return
    const dirty = !snapshotsEqual(currentSnapshot, baselineSnapshot)
    setHasUnsavedChanges(dirty)
    preferencesDirtyCache.set(subId, dirty)
  }, [loading, baselineSnapshot, currentSnapshot, subId])

  useEffect(() => {
    onDirtyChange?.(hasUnsavedChanges)
  }, [hasUnsavedChanges, onDirtyChange])

  const handleClassPreferencesChange = (classIds: string[]) => {
    setSelectedClassIds(classIds)
    const cached = preferencesCache.get(subId)
    preferencesCache.set(subId, {
      classPreferences: cached?.classPreferences || classPreferences,
      selectedClassIds: classIds,
      qualifications: cached?.qualifications || qualifications,
      capabilitiesState: cached?.capabilitiesState || capabilitiesState,
    })
  }

  const handleQualificationsChange = async (
    qualifications: Array<{
      qualification_id: string
      level?: string | null
      expires_on?: string | null
      verified?: boolean | null
      notes?: string | null
    }>
  ) => {
    setQualifications(prev => {
      const byId = new Map(prev.map(item => [item.qualification_id, item]))
      return qualifications.map(item => {
        const existing = byId.get(item.qualification_id)
        return {
          id: existing?.id || `temp-${item.qualification_id}`,
          qualification_id: item.qualification_id,
          level: item.level ?? null,
          expires_on: item.expires_on ?? null,
          verified: item.verified ?? null,
          notes: item.notes ?? null,
          qualification: existing?.qualification,
        }
      })
    })
    const cached = preferencesCache.get(subId)
    preferencesCache.set(subId, {
      classPreferences: cached?.classPreferences || classPreferences,
      selectedClassIds: cached?.selectedClassIds || selectedClassIds,
      qualifications: qualifications.map(item => ({
        id: `temp-${item.qualification_id}`,
        qualification_id: item.qualification_id,
        level: item.level ?? null,
        expires_on: item.expires_on ?? null,
        verified: item.verified ?? null,
        notes: item.notes ?? null,
      })),
      capabilitiesState: cached?.capabilitiesState || capabilitiesState,
    })
  }

  const handleCapabilitiesChange = (capabilities: {
    can_change_diapers: boolean
    can_lift_children: boolean
    can_assist_with_toileting: boolean
    capabilities_notes: string | null
  }) => {
    setCapabilitiesState({
      can_change_diapers: capabilities.can_change_diapers,
      can_lift_children: capabilities.can_lift_children,
      can_assist_with_toileting: capabilities.can_assist_with_toileting,
      capabilities_notes: capabilities.capabilities_notes || '',
    })
    const cached = preferencesCache.get(subId)
    preferencesCache.set(subId, {
      classPreferences: cached?.classPreferences || classPreferences,
      selectedClassIds: cached?.selectedClassIds || selectedClassIds,
      qualifications: cached?.qualifications || qualifications,
      capabilitiesState: {
        can_change_diapers: capabilities.can_change_diapers,
        can_lift_children: capabilities.can_lift_children,
        can_assist_with_toileting: capabilities.can_assist_with_toileting,
        capabilities_notes: capabilities.capabilities_notes || '',
      },
    })
  }

  const handleSaveAll = useCallback(async () => {
    setIsSaving(true)
    try {
      const qualificationsPayload = qualifications.map(q => ({
        qualification_id: q.qualification_id,
        level: q.level ?? null,
        expires_on: q.expires_on ?? null,
        verified: q.verified ?? null,
        notes: q.notes ?? null,
      }))
      const capabilitiesPayload = {
        ...capabilitiesState,
        capabilities_notes: capabilitiesState.capabilities_notes.trim() || null,
      }

      const preferencesResponse = await fetch(`/api/subs/${subId}/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_group_ids: selectedClassIds }),
      })
      if (!preferencesResponse.ok) throw new Error('Failed to save preferences')

      const qualificationsResponse = await fetch(`/api/subs/${subId}/qualifications`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qualifications: qualificationsPayload }),
      })
      if (!qualificationsResponse.ok) throw new Error('Failed to save qualifications')

      const capabilitiesResponse = await fetch(`/api/subs/${subId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(capabilitiesPayload),
      })
      if (!capabilitiesResponse.ok) throw new Error('Failed to save capabilities')

      toast.success('Preferences saved.')
      const nextBaseline = currentSnapshot
      setBaselineSnapshot(nextBaseline)
      preferencesBaselineCache.set(subId, nextBaseline)
      preferencesDirtyCache.set(subId, false)
      setHasUnsavedChanges(false)
    } catch (error) {
      console.error('Error saving preferences', error)
      toast.error('Failed to save preferences.')
    } finally {
      setIsSaving(false)
    }
  }, [currentSnapshot, subId, selectedClassIds, qualifications, capabilitiesState])

  useEffect(() => {
    if (!externalSaveSignal) return
    if (externalSaveSignal === lastHandledExternalSaveSignalRef.current) return
    lastHandledExternalSaveSignalRef.current = externalSaveSignal
    if (!hasUnsavedChanges || isSaving) return
    void handleSaveAll()
  }, [externalSaveSignal, hasUnsavedChanges, isSaving, handleSaveAll])

  const normalizedQualifications = qualifications.map(q => ({
    ...q,
    qualification: q.qualification
      ? {
          ...q.qualification,
          is_system: (q.qualification as { is_system?: boolean }).is_system ?? false,
          is_active: (q.qualification as { is_active?: boolean }).is_active ?? true,
        }
      : undefined,
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <SubClassPreferences
          subId={subId}
          selectedClassIds={selectedClassIds}
          onSelectionChange={handleClassPreferencesChange}
        />
      </div>

      <div>
        <SubQualifications
          subId={subId}
          qualifications={normalizedQualifications}
          capabilities={{
            can_change_diapers: capabilitiesState.can_change_diapers,
            can_lift_children: capabilitiesState.can_lift_children,
            can_assist_with_toileting: capabilitiesState.can_assist_with_toileting,
            capabilities_notes: capabilitiesState.capabilities_notes || null,
          }}
          onQualificationsChange={handleQualificationsChange}
          onCapabilitiesChange={handleCapabilitiesChange}
        />
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={handleSaveAll} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save changes'}
        </Button>
      </div>
    </div>
  )
}
