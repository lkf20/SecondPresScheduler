'use client'

import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { parseLocalDate } from '@/lib/utils/date'

interface Shift {
  date: string
  time_slot_code: string
  day_name?: string
  reason?: string // Reason for unavailable shifts
  classroom_name?: string | null
  class_name?: string | null
}

interface ShiftChipsProps {
  canCover: Shift[]
  cannotCover: Shift[] // Includes reason field for unavailable shifts
  assigned?: Shift[] // Optional list of assigned shifts
  shifts?: Array<{
    date: string
    time_slot_code: string
    status: 'assigned' | 'available' | 'unavailable'
    reason?: string
    classroom_name?: string | null
    class_name?: string | null
  }>
  showLegend?: boolean // Whether to show the color legend
  isDeclined?: boolean // If true, all chips will be gray
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

const formatShiftTooltipLabel = (dateString: string, timeSlotCode: string): string => {
  const date = parseLocalDate(dateString)
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const dayName = dayNames[date.getDay()]
  const month = monthNames[date.getMonth()]
  const day = date.getDate()
  return `${dayName} ${timeSlotCode} • ${month} ${day}`
}

export default function ShiftChips({
  canCover,
  cannotCover,
  assigned = [],
  shifts,
  showLegend = false,
  isDeclined = false,
}: ShiftChipsProps) {
  if (canCover.length === 0 && cannotCover.length === 0 && assigned.length === 0 && (!shifts || shifts.length === 0)) {
    return null
  }

  type ShiftItem = {
    date: string
    time_slot_code: string
    status: 'assigned' | 'available' | 'unavailable'
    reason?: string // Reason for unavailable shifts
    classroom_name?: string | null
    class_name?: string | null
  }

  const allShiftsMap = new Map<string, ShiftItem>()

  // Add assigned shifts first (highest priority)
  assigned.forEach((shift) => {
    const key = `${shift.date}|${shift.time_slot_code}`
    allShiftsMap.set(key, {
      date: shift.date,
      time_slot_code: shift.time_slot_code,
      status: 'assigned',
      classroom_name: shift.classroom_name || null,
      class_name: shift.class_name || null,
    })
  })

  // Add can_cover shifts (only if not already assigned)
  canCover.forEach((shift) => {
    const key = `${shift.date}|${shift.time_slot_code}`
    if (!allShiftsMap.has(key)) {
      allShiftsMap.set(key, {
        date: shift.date,
        time_slot_code: shift.time_slot_code,
        status: 'available',
        classroom_name: shift.classroom_name || null,
        class_name: shift.class_name || null,
      })
    }
  })

  // Add cannot_cover shifts (only if not already assigned)
  cannotCover.forEach((shift) => {
    const key = `${shift.date}|${shift.time_slot_code}`
    if (!allShiftsMap.has(key)) {
      allShiftsMap.set(key, {
        date: shift.date,
        time_slot_code: shift.time_slot_code,
        status: 'unavailable',
        reason: shift.reason, // Store reason for tooltip
        classroom_name: shift.classroom_name || null,
        class_name: shift.class_name || null,
      })
    }
  })

  // Convert to array and sort by date, then time slot
  const allShifts = shifts
    ? shifts
    : Array.from(allShiftsMap.values()).sort((a, b) => {
        const dateA = parseLocalDate(a.date).getTime()
        const dateB = parseLocalDate(b.date).getTime()
        if (dateA !== dateB) return dateA - dateB
        // If same date, sort by time slot code (AM before PM, etc.)
        return a.time_slot_code.localeCompare(b.time_slot_code)
      })

  const getBadgeClassName = (status: 'assigned' | 'available' | 'unavailable') => {
    // If declined, make all chips gray
    if (isDeclined) {
      return 'bg-gray-100 text-gray-600 border-gray-300'
    }
    
    switch (status) {
      case 'assigned':
        return 'bg-blue-50 text-blue-900 border-blue-200'
      case 'available':
        return 'bg-emerald-50 text-emerald-900 border-emerald-200'
      case 'unavailable':
        return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  return (
    <TooltipProvider>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {allShifts.map((shift, idx) => {
            const shiftLabel = formatShiftLabel(shift.date, shift.time_slot_code)
            const tooltipLabel = formatShiftTooltipLabel(shift.date, shift.time_slot_code)
            const classroomName = shift.classroom_name
            const classGroupName = shift.class_name
            const classroomLabel = classroomName
              ? classGroupName
                ? `${classroomName} (${classGroupName})`
                : classroomName
              : classGroupName || 'Classroom unavailable'
            const badge = (
              <Badge
                key={`shift-${shift.date}-${shift.time_slot_code}-${idx}`}
                variant="outline"
                className={`text-xs ${getBadgeClassName(shift.status)}`}
              >
                {shiftLabel}
              </Badge>
            )

            return (
              <Tooltip key={`shift-${shift.date}-${shift.time_slot_code}-${idx}`}>
                <TooltipTrigger asChild>
                  {badge}
                </TooltipTrigger>
                <TooltipContent side="top">
                  <div className="text-base">
                    <div>{tooltipLabel}</div>
                    <div className={classroomName ? 'font-semibold' : undefined}>{classroomLabel}</div>
                    {shift.status === 'unavailable' && shift.reason && (
                      <div className="text-muted-foreground">{shift.reason}</div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
        {showLegend && (
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1 pb-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded border bg-blue-50 border-blue-200" />
              <span>Assigned</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded border bg-emerald-50 border-emerald-200" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded border bg-gray-100 border-gray-300" />
              <span>Unavailable</span>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
