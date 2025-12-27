'use client'

import { useState, useEffect } from 'react'
import ScheduleStructureGrid from '@/components/settings/ScheduleStructureGrid'
import DaySelector from '@/components/settings/DaySelector'
import ErrorMessage from '@/components/shared/ErrorMessage'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import type { ClassClassroomMappingWithDetails } from '@/lib/api/class-classroom-mappings'

export default function ScheduleStructurePage() {
  const [mappings, setMappings] = useState<ClassClassroomMappingWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDayIds, setSelectedDayIds] = useState<string[]>([])

  useEffect(() => {
    fetchMappings()
    fetchScheduleSettings()
  }, [])

  const fetchMappings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/class-classroom-mappings')
      if (!response.ok) {
        throw new Error('Failed to load mappings')
      }
      const data = await response.json()
      setMappings(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load schedule structure')
    } finally {
      setLoading(false)
    }
  }

  const fetchScheduleSettings = async () => {
    try {
      const response = await fetch('/api/schedule-settings')
      if (!response.ok) {
        throw new Error('Failed to load schedule settings')
      }
      const data = await response.json()
      if (data.selected_day_ids && Array.isArray(data.selected_day_ids)) {
        setSelectedDayIds(data.selected_day_ids)
      }
    } catch (err: any) {
      console.error('Failed to load schedule settings:', err)
      // Don't show error to user, just use empty array
    }
  }

  const handleDaySelectionChange = async (dayIds: string[]) => {
    setSelectedDayIds(dayIds)
    // Save to API
    try {
      const response = await fetch('/api/schedule-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected_day_ids: dayIds }),
      })
      if (!response.ok) {
        throw new Error('Failed to save schedule settings')
      }
    } catch (err: any) {
      console.error('Failed to save schedule settings:', err)
      // Could show a toast notification here
    }
  }

  const handleMappingsChange = () => {
    // Refresh mappings after changes
    fetchMappings()
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Schedule Structure</h1>
        <p className="text-muted-foreground mt-2">
          Configure which classes can be assigned to which classrooms for each day and time slot
        </p>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <div className="mb-6">
        <DaySelector
          selectedDayIds={selectedDayIds}
          onSelectionChange={handleDaySelectionChange}
        />
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <ScheduleStructureGrid
          mappings={mappings}
          selectedDayIds={selectedDayIds}
          onMappingsChange={handleMappingsChange}
        />
      )}
    </div>
  )
}

