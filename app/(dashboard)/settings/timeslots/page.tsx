'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
// Note: getTimeSlots is server-side, so we'll fetch via API
import DataTable, { Column } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Database } from '@/types/database'
import ErrorMessage from '@/components/shared/ErrorMessage'
import DaySelector from '@/components/settings/DaySelector'

type TimeSlot = Database['public']['Tables']['time_slots']['Row']

export default function TimeSlotsPage() {
  const [timeslots, setTimeslots] = useState<TimeSlot[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedDayIds, setSelectedDayIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTimeSlots()
    fetchScheduleSettings()
  }, [])

  const fetchTimeSlots = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/timeslots')
      if (!response.ok) {
        throw new Error('Failed to load time slots')
      }
      const data = (await response.json()) as TimeSlot[]
      setTimeslots(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load time slots')
      console.error('Error loading time slots:', err)
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
    } catch (err: unknown) {
      console.error('Failed to load schedule settings:', err)
    }
  }

  const handleDaySelectionChange = async (dayIds: string[]) => {
    setSelectedDayIds(dayIds)
    try {
      const response = await fetch('/api/schedule-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected_day_ids: dayIds }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save schedule settings')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save schedule settings'
      console.error('Failed to save schedule settings:', err)
      alert(`Failed to save schedule settings: ${message}`)
    }
  }

  // Helper function to convert 24-hour time to 12-hour format with AM/PM
  const formatTime12Hour = (time24: string | null | undefined): string => {
    if (!time24) return '-'

    try {
      const [hours, minutes] = time24.split(':')
      const hour24 = parseInt(hours, 10)
      const mins = minutes || '00'

      if (isNaN(hour24)) return time24

      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24
      const ampm = hour24 >= 12 ? 'PM' : 'AM'

      return `${hour12}:${mins} ${ampm}`
    } catch {
      return time24
    }
  }

  const columns: Column<TimeSlot>[] = [
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      linkBasePath: '/settings/timeslots',
    },
    {
      key: 'name',
      header: 'Name',
      sortable: true,
    },
    {
      key: 'default_start_time',
      header: 'Start Time',
      cell: row => formatTime12Hour(row.default_start_time),
    },
    {
      key: 'default_end_time',
      header: 'End Time',
      cell: row => formatTime12Hour(row.default_end_time),
    },
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Days and Time Slots</h1>
          <p className="text-muted-foreground mt-2">
            Configure which days appear in the weekly schedule and manage time periods
          </p>
        </div>
        <Link href="/settings/timeslots/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Time Slot
          </Button>
        </Link>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Days</h2>
        <DaySelector selectedDayIds={selectedDayIds} onSelectionChange={handleDaySelectionChange} />
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Time Slots</h2>
        {loading ? (
          <div className="text-muted-foreground">Loading time slots...</div>
        ) : (
          <DataTable
            data={timeslots}
            columns={columns}
            searchable
            searchPlaceholder="Search time slots..."
            emptyMessage="No time slots found."
          />
        )}
      </div>
    </div>
  )
}
