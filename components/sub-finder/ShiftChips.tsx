'use client'

import { Badge } from '@/components/ui/badge'
import { parseLocalDate } from '@/lib/utils/date'

interface Shift {
  date: string
  time_slot_code: string
  day_name?: string
}

interface ShiftChipsProps {
  canCover: Shift[]
  cannotCover: Shift[]
}

// Format shift label as "Mon AM • Feb 9"
export function formatShiftLabel(dateString: string, timeSlotCode: string): string {
  const date = parseLocalDate(dateString)
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const dayName = dayNames[date.getDay()]
  const month = monthNames[date.getMonth()]
  const day = date.getDate()
  return `${dayName} ${timeSlotCode} • ${month} ${day}`
}

export default function ShiftChips({ canCover, cannotCover }: ShiftChipsProps) {
  if (canCover.length === 0 && cannotCover.length === 0) {
    return null
  }

  type ShiftItem = {
    date: string
    time_slot_code: string
    canCover: boolean
  }

  const allShiftsMap = new Map<string, ShiftItem>()

  // Add can_cover shifts
  canCover.forEach((shift) => {
    const key = `${shift.date}|${shift.time_slot_code}`
    allShiftsMap.set(key, {
      date: shift.date,
      time_slot_code: shift.time_slot_code,
      canCover: true,
    })
  })

  // Add cannot_cover shifts
  cannotCover.forEach((shift) => {
    const key = `${shift.date}|${shift.time_slot_code}`
    allShiftsMap.set(key, {
      date: shift.date,
      time_slot_code: shift.time_slot_code,
      canCover: false,
    })
  })

  // Convert to array and sort by date, then time slot
  const allShifts = Array.from(allShiftsMap.values()).sort((a, b) => {
    const dateA = parseLocalDate(a.date).getTime()
    const dateB = parseLocalDate(b.date).getTime()
    if (dateA !== dateB) return dateA - dateB
    // If same date, sort by time slot code (AM before PM, etc.)
    return a.time_slot_code.localeCompare(b.time_slot_code)
  })

  return (
    <div className="flex flex-wrap gap-1.5">
      {allShifts.map((shift, idx) => {
        const shiftLabel = formatShiftLabel(shift.date, shift.time_slot_code)

        return (
          <Badge
            key={`shift-${shift.date}-${shift.time_slot_code}-${idx}`}
            variant="outline"
            className={`text-xs ${
              shift.canCover
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-gray-100 text-gray-700 border-gray-300'
            }`}
          >
            {shiftLabel}
          </Badge>
        )
      })}
    </div>
  )
}

