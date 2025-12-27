'use client'

import { useState, useEffect } from 'react'
import WeeklyScheduleGridNew from '@/components/schedules/WeeklyScheduleGridNew'
import ErrorMessage from '@/components/shared/ErrorMessage'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import type { WeeklyScheduleDataByClassroom } from '@/lib/api/weekly-schedule'

export default function WeeklySchedulePage() {
  const [data, setData] = useState<WeeklyScheduleDataByClassroom[]>([])
  const [selectedDayIds, setSelectedDayIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Fetch schedule settings for selected days
    fetch('/api/schedule-settings')
      .then((r) => r.json())
      .then((settings) => {
        if (settings.selected_day_ids && Array.isArray(settings.selected_day_ids)) {
          setSelectedDayIds(settings.selected_day_ids)
        }
      })
      .catch((err) => {
        console.error('Error loading schedule settings:', err)
        // Continue without selected days filter
      })

    // Fetch weekly schedule data
    fetch('/api/weekly-schedule')
      .then((r) => {
        if (!r.ok) {
          throw new Error(`HTTP error! status: ${r.status}`)
        }
        return r.json()
      })
      .then((data) => {
        setData(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message || 'Failed to load weekly schedule')
        setLoading(false)
        console.error('Error loading weekly schedule:', err)
      })
  }, [])

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Weekly Schedule</h1>
        <p className="text-muted-foreground mt-2">
          View and manage teacher assignments by classroom, day, and time slot
        </p>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <WeeklyScheduleGridNew data={data} selectedDayIds={selectedDayIds} />
      )}
    </div>
  )
}

