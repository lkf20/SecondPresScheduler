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
  endDate: string | null // End date can be null/optional
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

  // Helper function to normalize dates to YYYY-MM-DD format
  const normalizeDate = (d: string) => {
    if (!d) return ''
    if (d.match(/^\d{4}-\d{2}-\d{2}$/)) return d
    try {
      const parsed = new Date(d)
      return parsed.toISOString().split('T')[0]
    } catch {
      return d
    }
  }

  // Fetch scheduled shifts when teacher and dates change (NOT when disabled changes)
  useEffect(() => {
    if (!teacherId) {
      setScheduledShifts([])
      setLoading(false)
      return
    }

    // If no start date, don't fetch
    if (!startDate) {
      setScheduledShifts([])
      setLoading(false)
      return
    }

    // If endDate is not provided, use startDate (single day)
    const effectiveEndDate = endDate || startDate

    setLoading(true)
    fetch(`/api/teachers/${teacherId}/scheduled-shifts?start_date=${startDate}&end_date=${effectiveEndDate}`)
      .then((r) => r.json())
      .then((data) => {
        const shifts = data || []
        setScheduledShifts(shifts)
      })
      .catch((error) => {
        console.error('Error fetching scheduled shifts:', error)
        setScheduledShifts([])
      })
      .finally(() => setLoading(false))
  }, [teacherId, startDate, endDate || startDate]) // Remove 'disabled' and 'onShiftsChange' from dependencies

  // Handle mode switching - auto-select all shifts when switching to "all_scheduled" mode
  useEffect(() => {
    // Only run this when we have scheduled shifts and we're in disabled mode
    if (disabled && scheduledShifts.length > 0) {
      const allShifts = scheduledShifts.map((shift: ScheduledShift) => ({
        date: normalizeDate(shift.date),
        day_of_week_id: shift.day_of_week_id,
        time_slot_id: shift.time_slot_id,
      }))
      onShiftsChange(allShifts)
    }
    // Note: When switching to "select_shifts" mode (disabled=false), we keep the current selectedShifts
    // so no action needed here
  }, [disabled, scheduledShifts, onShiftsChange])

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
    // Parse date string directly to avoid timezone issues
    // dateStr is in YYYY-MM-DD format
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    const monthName = date.toLocaleString('default', { month: 'short' })
    return `${monthName} ${day}`
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
    // Normalize dates for comparison (same logic as isShiftSelected)
    const normalizeDate = (d: string) => {
      if (!d) return ''
      if (d.match(/^\d{4}-\d{2}-\d{2}$/)) return d
      try {
        const parsed = new Date(d)
        return parsed.toISOString().split('T')[0]
      } catch {
        return d
      }
    }
    
    const normalizedDate = normalizeDate(date)
    return scheduledShifts.some(
      (s) => normalizeDate(s.date) === normalizedDate && s.time_slot_id === timeSlotId
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

  // Show placeholder when teacher or start date is missing
  if (!teacherId || !startDate) {
    let message = ''
    if (!teacherId && !startDate) {
      message = 'Select a teacher and start date to preview scheduled shifts.'
    } else if (!teacherId) {
      message = 'Select a teacher to preview scheduled shifts.'
    } else {
      message = 'Select a start date to preview scheduled shifts.'
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
            <TableRow>
              <TableCell colSpan={timeSlots.length + 1} className="text-center py-8 text-muted-foreground">
                {message}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    )
  }

  if (loading) {
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
            <TableRow>
              <TableCell colSpan={timeSlots.length + 1} className="text-center py-8 text-muted-foreground">
                Loading shifts...
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    )
  }

  if (Object.keys(shiftsByDate).length === 0) {
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
            <TableRow>
              <TableCell colSpan={timeSlots.length + 1} className="text-center py-8 text-muted-foreground">
                No scheduled shifts found for this teacher in the selected date range.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
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

