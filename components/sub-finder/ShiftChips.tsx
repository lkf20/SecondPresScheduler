'use client'

import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { parseLocalDate } from '@/lib/utils/date'
import { shiftStatusColorValues } from '@/lib/utils/colors'
import { DAY_NAMES, MONTH_NAMES } from '@/lib/utils/date-format'

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
    assignment_owner?: 'this_sub' | 'other_sub'
    assigned_sub_name?: string | null
    reason?: string
    classroom_name?: string | null
    class_name?: string | null
  }>
  showLegend?: boolean // Whether to show the color legend
  isDeclined?: boolean // If true, all chips will be gray
  recommendedShifts?: Shift[] // Optional list of recommended shifts (for showing checkmarks)
  softAvailableStyle?: boolean // If true, use lower-saturation available chip colors
}

// Format shift label as "Mon AM • Feb 9"
export function formatShiftLabel(dateString: string, timeSlotCode: string): string {
  const date = parseLocalDate(dateString)
  const dayName = DAY_NAMES[date.getDay()]
  const month = MONTH_NAMES[date.getMonth()]
  const day = date.getDate()
  return `${dayName} ${timeSlotCode} • ${month} ${day}`
}

const formatShiftTooltipLabel = (dateString: string, timeSlotCode: string): string => {
  const date = parseLocalDate(dateString)
  const dayName = DAY_NAMES[date.getDay()]
  const month = MONTH_NAMES[date.getMonth()]
  const day = date.getDate()
  return `${dayName} ${timeSlotCode} • ${month} ${day}`
}

export default function ShiftChips({
  canCover = [],
  cannotCover = [],
  assigned = [],
  shifts,
  showLegend = false,
  isDeclined = false,
  recommendedShifts = [],
  softAvailableStyle = true,
}: ShiftChipsProps) {
  if (
    canCover.length === 0 &&
    cannotCover.length === 0 &&
    assigned.length === 0 &&
    (!shifts || shifts.length === 0)
  ) {
    return null
  }

  type ShiftItem = {
    date: string
    time_slot_code: string
    status: 'assigned' | 'available' | 'unavailable'
    assignment_owner?: 'this_sub' | 'other_sub'
    assigned_sub_name?: string | null
    reason?: string // Reason for unavailable shifts
    classroom_name?: string | null
    class_name?: string | null
  }

  const allShiftsMap = new Map<string, ShiftItem>()

  // Add assigned shifts first (highest priority)
  assigned.forEach(shift => {
    const key = `${shift.date}|${shift.time_slot_code}`
    allShiftsMap.set(key, {
      date: shift.date,
      time_slot_code: shift.time_slot_code,
      status: 'assigned',
      assignment_owner: 'this_sub',
      classroom_name: shift.classroom_name || null,
      class_name: shift.class_name || null,
    })
  })

  // Add can_cover shifts (only if not already assigned)
  canCover.forEach(shift => {
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
  cannotCover.forEach(shift => {
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

  // Create a Set of recommended shift keys for quick lookup
  const recommendedShiftKeys = new Set(
    recommendedShifts.map(shift => `${shift.date}|${shift.time_slot_code}`)
  )
  const legendAvailableColors = softAvailableStyle
    ? {
        bg: 'rgb(246, 253, 251)',
        border: 'rgb(196, 234, 226)',
      }
    : {
        bg: shiftStatusColorValues.available.bg,
        border: shiftStatusColorValues.available.border,
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
            const status = isDeclined ? 'declined' : shift.status
            const twoToneStatus =
              status === 'unavailable' || status === 'declined' ? 'unavailable' : 'available'
            const baseColorValues = shiftStatusColorValues[twoToneStatus]
            const colorValues =
              softAvailableStyle && twoToneStatus === 'available'
                ? {
                    ...baseColorValues,
                    bg: 'rgb(246, 253, 251)', // softer than teal-50
                    border: 'rgb(196, 234, 226)', // softer teal border
                    text: 'rgb(15, 118, 110)', // teal-700
                  }
                : baseColorValues
            const shiftKey = `${shift.date}|${shift.time_slot_code}`
            const isRecommended = recommendedShiftKeys.has(shiftKey)
            const badge = (
              <Badge
                key={`shift-${shift.date}-${shift.time_slot_code}-${idx}`}
                variant="outline"
                className="text-xs"
                style={
                  {
                    backgroundColor: colorValues.bg,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: colorValues.border,
                    color: colorValues.text,
                  } as React.CSSProperties
                }
              >
                <span className="inline-flex items-center gap-1.5">
                  {isRecommended && (
                    <span
                      className="inline-flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full border border-amber-500 bg-amber-300"
                      aria-hidden="true"
                    />
                  )}
                  {shiftLabel}
                  {shift.assignment_owner === 'this_sub' && (
                    <span className="inline-flex items-center rounded-sm bg-white/70 px-1 text-[10px] font-medium text-teal-700">
                      ✓
                    </span>
                  )}
                  {shift.assignment_owner === 'other_sub' && (
                    <span className="inline-flex items-center rounded-sm bg-white/70 px-1 text-[10px] font-medium text-slate-600">
                      {shift.assigned_sub_name || 'Other sub'}
                    </span>
                  )}
                </span>
              </Badge>
            )

            return (
              <Tooltip key={`shift-${shift.date}-${shift.time_slot_code}-${idx}`}>
                <TooltipTrigger asChild>{badge}</TooltipTrigger>
                <TooltipContent side="top">
                  <div className="text-base">
                    <div>{tooltipLabel}</div>
                    <div className={classroomName ? 'font-semibold' : undefined}>
                      {classroomLabel}
                    </div>
                    {shift.status === 'unavailable' && shift.reason && (
                      <div className="text-muted-foreground">{shift.reason}</div>
                    )}
                    {shift.assignment_owner === 'this_sub' && (
                      <div className="text-muted-foreground">Assigned to this sub</div>
                    )}
                    {shift.assignment_owner === 'other_sub' && (
                      <div className="text-muted-foreground">
                        Assigned to {shift.assigned_sub_name || 'another sub'}
                      </div>
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
              <div
                className="w-3 h-3 rounded"
                style={{
                  backgroundColor: legendAvailableColors.bg,
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: legendAvailableColors.border,
                }}
              />
              <span>Can cover</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded"
                style={{
                  backgroundColor: shiftStatusColorValues.unavailable.bg,
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: shiftStatusColorValues.unavailable.border,
                }}
              />
              <span>Cannot cover</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center rounded-sm bg-slate-100 px-1 text-[10px] font-medium text-teal-700">
                ✓
              </span>
              <span>Assigned to this sub</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center rounded-sm bg-slate-100 px-1 text-[10px] font-medium text-slate-600">
                Other sub
              </span>
              <span>Assigned elsewhere</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full border border-amber-500 bg-amber-300"
                aria-hidden="true"
              />
              <span>Recommended</span>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
