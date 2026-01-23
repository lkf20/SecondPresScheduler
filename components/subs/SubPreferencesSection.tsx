'use client'

import { useState, useEffect, useCallback } from 'react'
import SubClassPreferences from './SubClassPreferences'
import SubQualifications from './SubQualifications'
import SubCapabilities from './SubCapabilities'
import { Loader2 } from 'lucide-react'

interface ClassPreference {
  id: string
  class_id: string
  class?: {
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
  const [qualifications, setQualifications] = useState<StaffQualification[]>([])

  const fetchPreferences = useCallback(async () => {
    try {
      const response = await fetch(`/api/subs/${subId}/preferences`)
      if (!response.ok) throw new Error('Failed to fetch preferences')
      const data = await response.json()
      setClassPreferences(data)
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

  const handleClassPreferencesChange = async (classIds: string[]) => {
    try {
      const response = await fetch(`/api/subs/${subId}/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_ids: classIds }),
      })

      if (!response.ok) throw new Error('Failed to save preferences')
      await fetchPreferences()
    } catch (error) {
      console.error('Error saving preferences:', error)
      alert('Failed to save preferences. Please try again.')
    }
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
    try {
      const response = await fetch(`/api/subs/${subId}/qualifications`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qualifications }),
      })

      if (!response.ok) throw new Error('Failed to save qualifications')
      await fetchQualifications()
    } catch (error) {
      console.error('Error saving qualifications:', error)
      alert('Failed to save qualifications. Please try again.')
    }
  }

  const handleCapabilitiesChange = async (capabilities: {
    can_change_diapers: boolean
    can_lift_children: boolean
    can_assist_with_toileting: boolean
    capabilities_notes: string | null
  }) => {
    try {
      const response = await fetch(`/api/subs/${subId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(capabilities),
      })

      if (!response.ok) throw new Error('Failed to save capabilities')
      // Refresh the page data would be handled by parent component
    } catch (error) {
      console.error('Error saving capabilities:', error)
      alert('Failed to save capabilities. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const selectedClassIds = classPreferences.map(p => p.class_id)

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
          qualifications={qualifications}
          onQualificationsChange={handleQualificationsChange}
        />
      </div>

      <div>
        <SubCapabilities
          subId={subId}
          capabilities={{
            can_change_diapers: sub.can_change_diapers,
            can_lift_children: sub.can_lift_children,
            can_assist_with_toileting: sub.can_assist_with_toileting,
            capabilities_notes: sub.capabilities_notes,
          }}
          onCapabilitiesChange={handleCapabilitiesChange}
        />
      </div>
    </div>
  )
}
