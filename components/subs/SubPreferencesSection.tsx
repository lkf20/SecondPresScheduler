'use client'

import { useState, useEffect, useCallback } from 'react'
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
}

export default function SubPreferencesSection({ subId, sub }: SubPreferencesSectionProps) {
  const [loading, setLoading] = useState(true)
  const [classPreferences, setClassPreferences] = useState<ClassPreference[]>([])
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([])
  const [qualifications, setQualifications] = useState<StaffQualification[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [capabilitiesState, setCapabilitiesState] = useState({
    can_change_diapers: sub.can_change_diapers ?? false,
    can_lift_children: sub.can_lift_children ?? false,
    can_assist_with_toileting: sub.can_assist_with_toileting ?? false,
    capabilities_notes: sub.capabilities_notes || '',
  })

  const fetchPreferences = useCallback(async () => {
    try {
      const response = await fetch(`/api/subs/${subId}/preferences`)
      if (!response.ok) throw new Error('Failed to fetch preferences')
      const data = await response.json()
      setClassPreferences(data)
      setSelectedClassIds(
        (data as ClassPreference[])
          .map(p => p.class_group_id)
          .filter((id): id is string => Boolean(id))
      )
    } catch (error) {
      console.error('Error fetching preferences:', error)
    }
  }, [subId])

  const fetchQualifications = useCallback(async () => {
    try {
      const response = await fetch(`/api/subs/${subId}/qualifications`)
      if (!response.ok) throw new Error('Failed to fetch qualifications')
      const data = await response.json()
      setQualifications(data)
    } catch (error) {
      console.error('Error fetching qualifications:', error)
    } finally {
      setLoading(false)
    }
  }, [subId])

  useEffect(() => {
    fetchPreferences()
    fetchQualifications()
  }, [fetchPreferences, fetchQualifications])

  useEffect(() => {
    setCapabilitiesState({
      can_change_diapers: sub.can_change_diapers ?? false,
      can_lift_children: sub.can_lift_children ?? false,
      can_assist_with_toileting: sub.can_assist_with_toileting ?? false,
      capabilities_notes: sub.capabilities_notes || '',
    })
  }, [sub])

  const handleClassPreferencesChange = (classIds: string[]) => {
    setSelectedClassIds(classIds)
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
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

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

  const handleSaveAll = async () => {
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
    } catch (error) {
      console.error('Error saving preferences', error)
      toast.error('Failed to save preferences.')
    } finally {
      setIsSaving(false)
    }
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
