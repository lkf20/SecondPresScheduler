'use client'

import { useState, useEffect } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface ScheduledShift {
  date: string
  day_of_week_id: string
  day_name: string
  day_number: number
  time_slot_id: string
  time_slot_code: string
  time_slot_name: string | null
}

interface SelectedShift {
  date: string
  day_of_week_id: string
  time_slot_id: string
}

interface ShiftSelectionTableProps {
  teacherId: string | null
  startDate: string
  endDate: string
  selectedShifts: SelectedShift[]
  onShiftsChange: (shifts: SelectedShift[]) => void
  disabled?: boolean
}

export default function ShiftSelectionTable({
  teacherId,
  startDate,
  endDate,
  selectedShifts,
  onShiftsChange,
  disabled = false,
}: ShiftSelectionTableProps) {
  const [scheduledShifts, setScheduledShifts] = useState<ScheduledShift[]>([])
  const [loading, setLoading] = useState(true)
  const [timeSlots, setTimeSlots] = useState<Array<{ id: string; code: string; name: string | null }>>([])

  // Fetch time slots
  useEffect(() => {
    fetch('/api/timeslots')
      .then((r) => r.json())
      .then((data) => {
        setTimeSlots(data.sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)))
      })
      .catch(console.error)
  }, [])

  // Track if we've already auto-selected shifts to prevent overwriting on re-renders
  const [hasAutoSelected, setHasAutoSelected] = useState(false)

  // Fetch scheduled shifts when teacher and dates change
  useEffect(() => {
    if (!teacherId || !startDate || !endDate) {
      setScheduledShifts([])
      setLoading(false)
      return
    }

    setLoading(true)
    fetch(`/api/teachers/${teacherId}/scheduled-shifts?start_date=${startDate}&end_date=${endDate}`)
      .then((r) => r.json())
      .then((data) => {
        setScheduledShifts(data)
        // If disabled (all_scheduled mode) AND no shifts are already selected AND we haven't auto-selected yet
        // This prevents overwriting existing shifts when editing
        if (disabled && selectedShifts.length === 0 && !hasAutoSelected) {
          const allShifts = data.map((shift: ScheduledShift) => ({
            date: shift.date,
            day_of_week_id: shift.day_of_week_id,
            time_slot_id: shift.time_slot_id,
          }))
          onShiftsChange(allShifts)
          setHasAutoSelected(true)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [teacherId, startDate, endDate, disabled, selectedShifts.length, hasAutoSelected, onShiftsChange])

  // Reset auto-select flag when selectedShifts are provided externally (e.g., when editing)
  useEffect(() => {
    if (selectedShifts.length > 0) {
      setHasAutoSelected(true) // Prevent auto-selection if shifts are already provided
    }
  }, [selectedShifts.length])

  // Group shifts by date
  const shiftsByDate = scheduledShifts.reduce((acc, shift) => {
    if (!acc[shift.date]) {
      acc[shift.date] = {
        date: shift.date,
        day_name: shift.day_name,
        shifts: [],
      }
    }
    acc[shift.date].shifts.push(shift)
    return acc
  }, {} as Record<string, { date: string; day_name: string; shifts: ScheduledShift[] }>)

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const month = date.toLocaleString('default', { month: 'short' })
    const day = date.getDate()
    return `${month} ${day}`
  }

  const isShiftSelected = (date: string, timeSlotId: string) => {
    // Normalize dates to YYYY-MM-DD format for comparison
    const normalizeDate = (d: string) => {
      if (!d) return ''
      // If date is already in YYYY-MM-DD format, return as is
      if (d.match(/^\d{4}-\d{2}-\d{2}$/)) return d
      // Otherwise, try to parse and format
      try {
        const parsed = new Date(d)
        return parsed.toISOString().split('T')[0]
      } catch {
        return d
      }
    }
    
    const normalizedDate = normalizeDate(date)
    return selectedShifts.some(
      (s) => normalizeDate(s.date) === normalizedDate && s.time_slot_id === timeSlotId
    )
  }

  const isShiftScheduled = (date: string, timeSlotId: string) => {
    return scheduledShifts.some(
      (s) => s.date === date && s.time_slot_id === timeSlotId
    )
  }

  const handleShiftToggle = (date: string, dayOfWeekId: string, timeSlotId: string) => {
    if (disabled) return

    const isSelected = isShiftSelected(date, timeSlotId)
    let newShifts: SelectedShift[]

    if (isSelected) {
      newShifts = selectedShifts.filter(
        (s) => !(s.date === date && s.time_slot_id === timeSlotId)
      )
    } else {
      newShifts = [
        ...selectedShifts,
        { date, day_of_week_id: dayOfWeekId, time_slot_id: timeSlotId },
      ]
    }

    onShiftsChange(newShifts)
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading shifts...</div>
  }

  if (Object.keys(shiftsByDate).length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No scheduled shifts found for this date range.
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Day</TableHead>
            {timeSlots.map((slot) => (
              <TableHead key={slot.id} className="text-center">{slot.code}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.values(shiftsByDate)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((dayGroup) => (
              <TableRow key={dayGroup.date}>
                <TableCell className="font-medium">
                  {formatDate(dayGroup.date)} {dayGroup.day_name.slice(0, 3)}
                </TableCell>
                {timeSlots.map((slot) => {
                  const isScheduled = isShiftScheduled(dayGroup.date, slot.id)
                  const isSelected = isShiftSelected(dayGroup.date, slot.id)
                  const shift = dayGroup.shifts.find((s) => s.time_slot_id === slot.id)
                  const dayOfWeekId = shift?.day_of_week_id || ''

                  return (
                    <TableCell key={slot.id} className="text-center">
                      {isScheduled ? (
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() =>
                              handleShiftToggle(dayGroup.date, dayOfWeekId, slot.id)
                            }
                            disabled={disabled}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={false}
                            disabled
                            className="opacity-30"
                          />
                        </div>
                      )}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  )
}

