'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Plus } from 'lucide-react'
import { Database } from '@/types/database'
import ErrorMessage from '@/components/shared/ErrorMessage'
import DaySelector from '@/components/settings/DaySelector'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useSchool } from '@/lib/contexts/SchoolContext'
import {
  invalidateDailySchedule,
  invalidateDashboard,
  invalidateSubFinderAbsences,
  invalidateTimeOffRequests,
  invalidateWeeklySchedule,
} from '@/lib/utils/invalidation'
import SortableTimeSlotsTable from '@/components/settings/SortableTimeSlotsTable'

type TimeSlot = Database['public']['Tables']['time_slots']['Row']

export default function TimeSlotsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const schoolId = useSchool()
  const [timeslots, setTimeslots] = useState<TimeSlot[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedDayIds, setSelectedDayIds] = useState<string[]>([])
  const [savedDayIds, setSavedDayIds] = useState<string[]>([])
  const [isSavingDays, setIsSavingDays] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTimeSlots()
    fetchScheduleSettings()
  }, [])

  const normalizeIds = (ids: string[]) => [...ids].sort((a, b) => a.localeCompare(b))
  const hasUnsavedDayChanges =
    JSON.stringify(normalizeIds(selectedDayIds)) !== JSON.stringify(normalizeIds(savedDayIds))

  const fetchTimeSlots = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/timeslots?includeInactive=true')
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
        setSavedDayIds(data.selected_day_ids)
      }
    } catch (err: unknown) {
      console.error('Failed to load schedule settings:', err)
    }
  }

  const invalidateAfterSave = async () => {
    await Promise.all([
      invalidateWeeklySchedule(queryClient, schoolId),
      invalidateDailySchedule(queryClient, schoolId),
      invalidateDashboard(queryClient, schoolId),
      invalidateTimeOffRequests(queryClient, schoolId),
      invalidateSubFinderAbsences(queryClient, schoolId),
      queryClient.invalidateQueries({ queryKey: ['filterOptions', schoolId] }),
      queryClient.invalidateQueries({ queryKey: ['filterOptions'] }),
      queryClient.invalidateQueries({ queryKey: ['dailySchedule'] }),
      queryClient.invalidateQueries({ queryKey: ['weeklySchedule'] }),
      queryClient.invalidateQueries({ queryKey: ['scheduleSettings'] }),
    ])
  }

  const handleSaveDays = async () => {
    setIsSavingDays(true)
    try {
      const response = await fetch('/api/schedule-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected_day_ids: selectedDayIds }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save schedule settings')
      }
      setSavedDayIds(selectedDayIds)
      toast.success('Days updated.')
      await invalidateAfterSave()
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save schedule settings'
      console.error('Failed to save schedule settings:', err)
      setError(message)
    } finally {
      setIsSavingDays(false)
    }
  }

  const filteredTimeSlots = showInactive
    ? timeslots
    : timeslots.filter(slot => slot.is_active !== false)

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
      </div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Days & Time Slots</h1>
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

      <div className="mb-8 rounded-lg border bg-white p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Days</h2>
            {hasUnsavedDayChanges && (
              <>
                <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Unsaved changes
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-teal-700 hover:bg-transparent hover:text-teal-800"
                  onClick={handleSaveDays}
                  disabled={isSavingDays}
                >
                  {isSavingDays ? 'Saving...' : 'Save'}
                </Button>
              </>
            )}
          </div>
        </div>
        <DaySelector selectedDayIds={selectedDayIds} onSelectionChange={setSelectedDayIds} />
      </div>

      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Time Slots</h2>
          <div className="flex items-center gap-2">
            <Switch
              id="show-inactive-timeslots"
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
            <Label htmlFor="show-inactive-timeslots" className="text-sm font-normal cursor-pointer">
              Show inactive
            </Label>
          </div>
        </div>
        {loading ? (
          <div className="text-muted-foreground">Loading time slots...</div>
        ) : (
          <SortableTimeSlotsTable timeSlots={filteredTimeSlots} />
        )}
      </div>
    </div>
  )
}
