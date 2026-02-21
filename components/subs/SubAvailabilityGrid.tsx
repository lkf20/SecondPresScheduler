'use client'

import { useState, useEffect } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  display_order?: number | null
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
  onAvailabilityChange: (
    availability: Array<{ day_of_week_id: string; time_slot_id: string; available: boolean }>
  ) => void
}

let cachedAvailabilityDays: Day[] | null = null
let cachedAvailabilityTimeSlots: TimeSlot[] | null = null

export default function SubAvailabilityGrid({
  weeklyAvailability,
  exceptionRows,
  onAvailabilityChange,
}: SubAvailabilityGridProps) {
  const [days, setDays] = useState<Day[]>(() => cachedAvailabilityDays || [])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>(() => cachedAvailabilityTimeSlots || [])
  const [localAvailability, setLocalAvailability] = useState<Map<string, boolean>>(new Map())
  const [exceptionMap, setExceptionMap] = useState<Map<string, ExceptionRow>>(new Map())
  const [isSelectAllHovered, setIsSelectAllHovered] = useState(false)
  const [isDeselectAllHovered, setIsDeselectAllHovered] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Fetch days and time slots
  useEffect(() => {
    if (cachedAvailabilityDays && cachedAvailabilityTimeSlots) {
      setDays(cachedAvailabilityDays)
      setTimeSlots(cachedAvailabilityTimeSlots)
      return
    }

    Promise.all([
      fetch('/api/days-of-week').then(r => r.json()),
      fetch('/api/timeslots').then(r => r.json()),
    ])
      .then(([daysData, slotsData]) => {
        setLoadError(null)
        // Filter to weekdays only (Monday-Friday, day_number 1-5)
        const weekdays = daysData.filter((d: Day) => d.day_number >= 1 && d.day_number <= 5)
        const sortedDays = weekdays.sort((a: Day, b: Day) => a.day_number - b.day_number)
        // Sort time slots by display_order (from settings), then by code as fallback
        const sortedSlots = slotsData.sort((a: TimeSlot, b: TimeSlot) => {
          const orderA = a.display_order ?? 999
          const orderB = b.display_order ?? 999
          if (orderA !== orderB) {
            return orderA - orderB
          }
          return (a.code || '').localeCompare(b.code || '')
        })
        cachedAvailabilityDays = sortedDays
        cachedAvailabilityTimeSlots = sortedSlots
        setDays(sortedDays)
        setTimeSlots(sortedSlots)
      })
      .catch(error => {
        console.error('Failed to load availability grid metadata:', error)
        setLoadError('Failed to load availability grid.')
      })
  }, [])

  // Initialize availability map from props
  useEffect(() => {
    const map = new Map<string, boolean>()
    weeklyAvailability.forEach(item => {
      const key = `${item.day_of_week_id}|${item.time_slot_id}`
      map.set(key, item.available)
    })
    setLocalAvailability(map)
  }, [weeklyAvailability])

  // Build exception map: day_of_week_id|time_slot_id -> exception row
  useEffect(() => {
    const map = new Map<string, ExceptionRow>()
    exceptionRows.forEach(row => {
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
      const day = days.find(d => d.day_number === dayNumber)
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

  const handleSetAll = (available: boolean) => {
    const updated = new Map<string, boolean>()
    days.forEach(day => {
      timeSlots.forEach(slot => {
        updated.set(`${day.id}|${slot.id}`, available)
      })
    })
    setLocalAvailability(updated)

    const availabilityArray = Array.from(updated.entries()).map(([key, value]) => {
      const [day_of_week_id, time_slot_id] = key.split('|')
      return { day_of_week_id, time_slot_id, available: value }
    })
    onAvailabilityChange(availabilityArray)
  }
  const hasAnySelected = Array.from(localAvailability.values()).some(value => value)

  if (loadError) {
    return <div className="rounded-md border p-4 text-center text-destructive">{loadError}</div>
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
      <div className="flex items-center justify-end gap-2 border-b px-3 py-2">
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors hover:!bg-transparent"
          style={{ color: isSelectAllHovered ? 'rgb(15, 118, 110)' : 'rgb(71, 85, 105)' }}
          onMouseEnter={() => setIsSelectAllHovered(true)}
          onMouseLeave={() => setIsSelectAllHovered(false)}
          onClick={() => handleSetAll(true)}
        >
          Select all
        </button>
        {hasAnySelected && (
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors hover:!bg-transparent"
            style={{ color: isDeselectAllHovered ? 'rgb(15, 118, 110)' : 'rgb(71, 85, 105)' }}
            onMouseEnter={() => setIsDeselectAllHovered(true)}
            onMouseLeave={() => setIsDeselectAllHovered(false)}
            onClick={() => handleSetAll(false)}
          >
            Deselect all
          </button>
        )}
      </div>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="h-12">
            <TableHead className="h-12 px-4 py-0 align-middle">Day</TableHead>
            {timeSlots.map(slot => (
              <TableHead key={slot.id} className="h-12 px-4 py-0 text-center align-middle">
                {slot.code}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {days.map(day => (
            <TableRow key={day.id} className="h-12">
              <TableCell className="h-12 px-4 py-0 font-medium align-middle">{day.name}</TableCell>
              {timeSlots.map(slot => {
                const available = isAvailable(day.id, slot.id)
                const hasExcept = hasException(day.id, slot.id)

                return (
                  <TableCell
                    key={slot.id}
                    className="h-12 px-4 py-0 text-center align-middle [&:has([role=checkbox])]:pr-4"
                  >
                    <Checkbox
                      checked={available}
                      onCheckedChange={() => handleToggle(day.id, slot.id)}
                      className={cn(
                        'mx-auto block',
                        available && 'bg-primary',
                        hasExcept && 'opacity-75'
                      )}
                    />
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
