'use client'

import { useState, useEffect } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface Day {
  id: string
  name: string
  day_number: number
}

interface TimeSlot {
  id: string
  code: string
  name: string | null
}

interface AvailabilityItem {
  id: string
  day_of_week_id: string
  time_slot_id: string
  available: boolean
  day_of_week?: Day
  time_slot?: TimeSlot
}

interface ExceptionRow {
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
  time_slot?: TimeSlot
}

interface SubAvailabilityGridProps {
  subId: string
  weeklyAvailability: AvailabilityItem[]
  exceptionRows: ExceptionRow[]
  onAvailabilityChange: (availability: Array<{ day_of_week_id: string; time_slot_id: string; available: boolean }>) => void
}

export default function SubAvailabilityGrid({
  subId,
  weeklyAvailability,
  exceptionRows,
  onAvailabilityChange,
}: SubAvailabilityGridProps) {
  const [days, setDays] = useState<Day[]>([])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [localAvailability, setLocalAvailability] = useState<Map<string, boolean>>(new Map())
  const [exceptionMap, setExceptionMap] = useState<Map<string, ExceptionRow>>(new Map())

  // Fetch days and time slots
  useEffect(() => {
    Promise.all([
      fetch('/api/days-of-week').then((r) => r.json()),
      fetch('/api/timeslots').then((r) => r.json()),
    ]).then(([daysData, slotsData]) => {
      // Filter to weekdays only (Monday-Friday, day_number 1-5)
      const weekdays = daysData.filter((d: Day) => d.day_number >= 1 && d.day_number <= 5)
      setDays(weekdays.sort((a: Day, b: Day) => a.day_number - b.day_number))
      // Sort time slots by display_order (from settings), then by code as fallback
      setTimeSlots(slotsData.sort((a: TimeSlot, b: TimeSlot) => {
        const orderA = (a as any).display_order ?? 999
        const orderB = (b as any).display_order ?? 999
        if (orderA !== orderB) {
          return orderA - orderB
        }
        return (a.code || '').localeCompare(b.code || '')
      }))
    })
  }, [])

  // Initialize availability map from props
  useEffect(() => {
    const map = new Map<string, boolean>()
    weeklyAvailability.forEach((item) => {
      const key = `${item.day_of_week_id}|${item.time_slot_id}`
      map.set(key, item.available)
    })
    setLocalAvailability(map)
  }, [weeklyAvailability])

  // Build exception map: day_of_week_id|time_slot_id -> exception row
  useEffect(() => {
    const map = new Map<string, ExceptionRow>()
    exceptionRows.forEach((row) => {
      // Convert date to day_of_week_id
      // JavaScript Date.getDay(): 0=Sunday, 1=Monday, ..., 6=Saturday
      // Our day_number: 1=Monday, 2=Tuesday, ..., 5=Friday, 7=Sunday
      const date = new Date(row.date)
      const jsDay = date.getDay() // 0-6
      let dayNumber: number
      if (jsDay === 0) {
        dayNumber = 7 // Sunday
      } else {
        dayNumber = jsDay // Monday=1, Tuesday=2, etc.
      }
      // Find matching day by day_number
      const day = days.find((d) => d.day_number === dayNumber)
      if (day) {
        const key = `${day.id}|${row.time_slot_id}`
        map.set(key, row)
      }
    })
    setExceptionMap(map)
  }, [exceptionRows, days])

  const handleToggle = (dayId: string, timeSlotId: string) => {
    const key = `${dayId}|${timeSlotId}`
    const current = localAvailability.get(key) ?? false
    const newValue = !current

    const updated = new Map(localAvailability)
    updated.set(key, newValue)
    setLocalAvailability(updated)

    // Convert map to array and notify parent
    const availabilityArray = Array.from(updated.entries()).map(([key, available]) => {
      const [day_of_week_id, time_slot_id] = key.split('|')
      return { day_of_week_id, time_slot_id, available }
    })

    onAvailabilityChange(availabilityArray)
  }

  const isAvailable = (dayId: string, timeSlotId: string) => {
    const key = `${dayId}|${timeSlotId}`
    return localAvailability.get(key) ?? false
  }

  const getException = (dayId: string, timeSlotId: string) => {
    const key = `${dayId}|${timeSlotId}`
    return exceptionMap.get(key)
  }

  const hasException = (dayId: string, timeSlotId: string) => {
    return getException(dayId, timeSlotId) !== undefined
  }

  if (days.length === 0 || timeSlots.length === 0) {
    return (
      <div className="rounded-md border p-4 text-center text-muted-foreground">
        Loading availability grid...
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
              <TableHead key={slot.id} className="text-center">
                {slot.code}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {days.map((day) => (
            <TableRow key={day.id}>
              <TableCell className="font-medium">{day.name}</TableCell>
              {timeSlots.map((slot) => {
                const available = isAvailable(day.id, slot.id)
                const exception = getException(day.id, slot.id)
                const hasExcept = hasException(day.id, slot.id)

                return (
                  <TableCell key={slot.id} className="text-center">
                    <div className="flex items-center justify-center">
                      <div className="relative">
                        <Checkbox
                          checked={available}
                          onCheckedChange={() => handleToggle(day.id, slot.id)}
                          className={cn(
                            available && 'bg-primary',
                            hasExcept && 'opacity-75 ring-2 ring-dashed ring-yellow-500'
                          )}
                        />
                        {hasExcept && exception && (
                          <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-yellow-500" />
                        )}
                      </div>
                    </div>
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

