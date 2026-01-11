'use client'

import { useState, useEffect } from 'react'
import SubAvailabilityGrid from './SubAvailabilityGrid'
import SubAvailabilityExceptions from './SubAvailabilityExceptions'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, AlertTriangle } from 'lucide-react'

interface AvailabilityData {
  weekly: Array<{
    id: string
    day_of_week_id: string
    time_slot_id: string
    available: boolean
    day_of_week?: { id: string; name: string; day_number: number }
    time_slot?: { id: string; code: string; name: string | null }
  }>
  exception_headers: Array<{
    id: string
    start_date: string
    end_date: string
    available: boolean
  }>
  exception_rows: Array<{
    id: string
    date: string
    time_slot_id: string
    available: boolean
    exception_header?: {
      id: string
      start_date: string
      end_date: string
      available: boolean
    }
    time_slot?: { id: string; code: string; name: string | null }
  }>
}

interface TimeSlot {
  id: string
  code: string
  name: string | null
  display_order?: number | null
}

interface TeacherSchedule {
  day_of_week_id?: string | null
  time_slot_id?: string | null
}

interface SubAvailabilitySectionProps {
  subId: string
}

export default function SubAvailabilitySection({ subId }: SubAvailabilitySectionProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [availabilityData, setAvailabilityData] = useState<AvailabilityData | null>(null)
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [conflicts, setConflicts] = useState<Array<{ day: string; timeSlot: string }>>([])
  const [showConflictWarning, setShowConflictWarning] = useState(false)

  // Fetch initial data
  useEffect(() => {
    fetchAvailability()
    fetchTimeSlots()
  }, [subId])

  const fetchAvailability = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/subs/${subId}/availability`)
      if (!response.ok) throw new Error('Failed to fetch availability')
      const data = await response.json()
      setAvailabilityData(data)
    } catch (error) {
      console.error('Error fetching availability:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTimeSlots = async () => {
    try {
      const response = await fetch('/api/timeslots')
      if (!response.ok) throw new Error('Failed to fetch time slots')
      const data = await response.json()
      // Sort time slots by display_order (from settings), then by code as fallback
      setTimeSlots((data as TimeSlot[]).sort((a, b) => {
        const orderA = a.display_order ?? 999
        const orderB = b.display_order ?? 999
        if (orderA !== orderB) {
          return orderA - orderB
        }
        return (a.code || '').localeCompare(b.code || '')
      }))
    } catch (error) {
      console.error('Error fetching time slots:', error)
    }
  }

  const handleAvailabilityChange = async (
    availability: Array<{ day_of_week_id: string; time_slot_id: string; available: boolean }>
  ) => {
    setHasUnsavedChanges(true)
    // Update local state immediately for responsive UI
    if (availabilityData) {
      setAvailabilityData({
        ...availabilityData,
        weekly: availability.map((item) => ({
          id: '',
          day_of_week_id: item.day_of_week_id,
          time_slot_id: item.time_slot_id,
          available: item.available,
        })),
      })
    }
  }

  const handleSaveWeekly = async () => {
    if (!availabilityData) return

    setSaving(true)
    setConflicts([])
    setShowConflictWarning(false)

    try {
      // Check for conflicts with teaching schedule
      const availableSlots = availabilityData.weekly.filter((item) => item.available)
      
      if (availableSlots.length > 0) {
        // Fetch teacher's schedule
        const scheduleResponse = await fetch(`/api/teachers/${subId}/schedules`)
        if (scheduleResponse.ok) {
          const schedules = await scheduleResponse.json()
          
          // Build a set of teaching schedule keys (day_of_week_id|time_slot_id)
          const teachingSlots = new Set<string>()
          ;(schedules as TeacherSchedule[]).forEach((schedule) => {
            if (schedule.day_of_week_id && schedule.time_slot_id) {
              const key = `${schedule.day_of_week_id}|${schedule.time_slot_id}`
              teachingSlots.add(key)
            }
          })

          // Find conflicts
          const conflictList: Array<{ day: string; timeSlot: string }> = []
          availableSlots.forEach((item) => {
            const key = `${item.day_of_week_id}|${item.time_slot_id}`
            if (teachingSlots.has(key)) {
              // Get day and time slot names from the item's nested data (already fetched by API)
              const day = item.day_of_week?.name || 'Unknown'
              const timeSlot = item.time_slot?.code || 'Unknown'
              conflictList.push({ day, timeSlot })
            }
          })

          if (conflictList.length > 0) {
            setConflicts(conflictList)
            setShowConflictWarning(true)
          }
        }
      }

      // Proceed with save regardless of conflicts
      const response = await fetch(`/api/subs/${subId}/availability`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekly: availabilityData.weekly.map((item) => ({
            day_of_week_id: item.day_of_week_id,
            time_slot_id: item.time_slot_id,
            available: item.available,
          })),
        }),
      })

      if (!response.ok) throw new Error('Failed to save availability')
      setHasUnsavedChanges(false)
    } catch (error) {
      console.error('Error saving availability:', error)
      alert('Failed to save availability. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleAddException = async (exception: {
    start_date: string
    end_date: string
    available: boolean
    time_slot_ids: string[]
  }) => {
    try {
      const response = await fetch(`/api/subs/${subId}/availability/exceptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exception),
      })

      if (!response.ok) throw new Error('Failed to add exception')
      await fetchAvailability() // Refresh data
    } catch (error) {
      console.error('Error adding exception:', error)
      throw error
    }
  }

  const handleDeleteException = async (headerId: string) => {
    if (!confirm('Are you sure you want to delete this exception?')) return

    try {
      const response = await fetch(`/api/subs/${subId}/availability/exceptions/${headerId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete exception')
      await fetchAvailability() // Refresh data
    } catch (error) {
      console.error('Error deleting exception:', error)
      alert('Failed to delete exception. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!availabilityData) {
    return <div className="text-center text-muted-foreground py-8">Failed to load availability data</div>
  }

  // Enhance exception headers with time slot IDs from exception rows
  const enhancedHeaders = availabilityData.exception_headers.map((header) => {
    const relatedRows = availabilityData.exception_rows.filter(
      (row) => row.exception_header?.id === header.id
    )
    const timeSlotIds = [...new Set(relatedRows.map((row) => row.time_slot_id))]
    return { ...header, time_slot_ids: timeSlotIds }
  })

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Weekly Availability</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Check the boxes for time slots when this sub is regularly available. Unchecked = unavailable.
        </p>
        <SubAvailabilityGrid
          subId={subId}
          weeklyAvailability={availabilityData.weekly}
          exceptionRows={availabilityData.exception_rows}
          onAvailabilityChange={handleAvailabilityChange}
        />
        {showConflictWarning && conflicts.length > 0 && (
          <Alert variant="default" className="mt-4 border-yellow-500 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800">Schedule Conflict Detected</AlertTitle>
            <AlertDescription className="text-yellow-700">
              This sub is marked as available during times when they are also assigned to teach:
              <ul className="list-disc list-inside mt-2 space-y-1">
                {conflicts.map((conflict, idx) => (
                  <li key={idx}>
                    {conflict.day} - {conflict.timeSlot}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm">
                The availability has been saved, but you may want to review these conflicts.
              </p>
            </AlertDescription>
          </Alert>
        )}
        {hasUnsavedChanges && (
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSaveWeekly} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Weekly Availability'
              )}
            </Button>
          </div>
        )}
      </div>

      <div>
        <SubAvailabilityExceptions
          subId={subId}
          exceptionHeaders={enhancedHeaders}
          timeSlots={timeSlots}
          onAddException={handleAddException}
          onDeleteException={handleDeleteException}
        />
      </div>
    </div>
  )
}
