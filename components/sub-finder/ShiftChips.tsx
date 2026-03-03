'use client'

import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { parseLocalDate } from '@/lib/utils/date'
import { cn } from '@/lib/utils'
import { coverageColorValues, shiftStatusColorValues } from '@/lib/utils/colors'
import { DAY_NAMES, MONTH_NAMES } from '@/lib/utils/date-format'

interface Shift {
  date: string
  time_slot_code: string
  day_name?: string
  reason?: string // Reason for unavailable shifts
  classroom_name?: string | null
  class_name?: string | null
  classroom_color?: string | null
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
    classroom_color?: string | null
  }>
  showLegend?: boolean // Whether to show the color legend
  isDeclined?: boolean // If true, all chips will be gray
  recommendedShifts?: Shift[] // Optional list of recommended shifts (for showing checkmarks)
  softAvailableStyle?: boolean // If true, use lower-saturation available chip colors
  /** When a shift is assigned to "this sub", show this name on the chip (e.g. the card's sub name) */
  thisSubName?: string | null
}

// Format shift label as "Mon AM • Feb 9"
export function formatShiftLabel(dateString: string, timeSlotCode: string): string {
  const date = parseLocalDate(dateString)
  const dayName = DAY_NAMES[date.getDay()]
  const month = MONTH_NAMES[date.getMonth()]
  const day = date.getDate()
  return `${dayName} ${timeSlotCode} • ${month} ${day}`
}

// Parts for stacked chip display: "Mon AM" on first line, "March 16" on second
function getShiftLabelParts(
  dateString: string,
  timeSlotCode: string
): { daySlot: string; datePart: string } {
  const date = parseLocalDate(dateString)
  const dayName = DAY_NAMES[date.getDay()]
  const month = MONTH_NAMES[date.getMonth()]
  const day = date.getDate()
  return {
    daySlot: `${dayName} ${timeSlotCode}`,
    datePart: `${month} ${day}`,
  }
}

const formatShiftTooltipLabel = (dateString: string, timeSlotCode: string): string => {
  const date = parseLocalDate(dateString)
  const dayName = DAY_NAMES[date.getDay()]
  const month = MONTH_NAMES[date.getMonth()]
  const day = date.getDate()
  return `${dayName} ${timeSlotCode} • ${month} ${day}`
}

/** Normalize shift key so recommendedShifts (from combination) and shifts (from absence) match */
function normalizeShiftKey(dateString: string, timeSlotCode: string): string {
  try {
    const d = parseLocalDate(dateString)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}|${timeSlotCode}`
  } catch {
    return `${dateString}|${timeSlotCode}`
  }
}

/** Standalone legend for shift chip colors (e.g. above Recommended subs card). Matches weekly schedule legend: light gray box, text-sm. */
export function ShiftChipsLegend({ className }: { className?: string }) {
  const legendAvailableColors = {
    bg: 'rgb(246, 253, 251)',
    border: 'rgb(196, 234, 226)',
  }
  return (
    <div
      className={cn('p-3 bg-white rounded-md border border-gray-200', className)}
      role="img"
      aria-label="Legend: green = can cover, gray = cannot cover, Assigned Sub = chip with checkmark, amber dot = recommended assignment"
    >
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-700">Key:</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded"
            style={{
              backgroundColor: legendAvailableColors.bg,
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: legendAvailableColors.border,
            }}
          />
          <span className="text-gray-600">Can cover</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded"
            style={{
              backgroundColor: shiftStatusColorValues.unavailable.bg,
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: shiftStatusColorValues.unavailable.border,
            }}
          />
          <span className="text-gray-600">Cannot cover</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: 'rgb(204, 251, 241)',
              color: 'rgb(15, 118, 110)',
              borderColor: 'rgb(153, 246, 228)',
            }}
          >
            <span className="font-bold leading-none" style={{ fontSize: '10px' }}>
              ✓
            </span>
            Assigned Sub
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: '#fde68a' }}
            aria-hidden="true"
          />
          <span className="text-gray-600">Recommended assignment</span>
        </div>
      </div>
    </div>
  )
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
  thisSubName = null,
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
    classroom_color?: string | null
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
      classroom_color: shift.classroom_color ?? null,
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
        classroom_color: shift.classroom_color ?? null,
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
        classroom_color: shift.classroom_color ?? null,
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

  // Create a Set of recommended shift keys for quick lookup (normalize dates so combination + absence formats match)
  const recommendedShiftKeys = new Set(
    recommendedShifts.map(shift => normalizeShiftKey(shift.date, shift.time_slot_code))
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
        <div className="flex flex-wrap" style={{ overflow: 'visible' }}>
          {allShifts.map((shift, idx) => {
            const shiftLabel = formatShiftLabel(shift.date, shift.time_slot_code)
            const { daySlot, datePart } = getShiftLabelParts(shift.date, shift.time_slot_code)
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
            const shiftKey = normalizeShiftKey(shift.date, shift.time_slot_code)
            const isRecommended = recommendedShiftKeys.has(shiftKey)
            const cornerIndicator = isRecommended ? (
              <div
                aria-hidden="true"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: '#fde68a',
                  flexShrink: 0,
                }}
              />
            ) : shift.assignment_owner === 'this_sub' ? (
              <div
                aria-hidden="true"
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: 'rgb(204, 251, 241)',
                  color: 'rgb(15, 118, 110)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 8,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                ✓
              </div>
            ) : null

            const indicatorToShow = cornerIndicator

            const badge = (
              <div
                key={`shift-${shift.date}-${shift.time_slot_code}-${idx}`}
                className="relative inline-block shrink-0 mr-3 mb-3"
                style={{ overflow: 'visible' }}
              >
                <Badge
                  variant="outline"
                  className="relative box-border flex h-28 w-36 shrink-0 overflow-hidden rounded-lg text-sm px-2 py-1.5"
                  style={
                    {
                      backgroundColor: colorValues.bg,
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: colorValues.border,
                      color: colorValues.text,
                      height: '7rem',
                      minHeight: '7rem',
                      maxHeight: '7rem',
                      width: '9rem',
                      minWidth: '9rem',
                      maxWidth: '9rem',
                    } as React.CSSProperties
                  }
                >
                  {/* Text: centered; overflow hidden keeps uniform height with nested chip. Order: classroom, day/slot, date, sub/uncovered. Classroom: temporary plain text (was colored chip via getClassroomPillStyle). */}
                  <span className="inline-flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 overflow-hidden leading-tight text-center">
                    <span className="shrink-0 truncate text-[10px] font-medium uppercase text-slate-400">
                      {classroomLabel}
                    </span>
                    <span className="shrink-0 text-base font-medium">{daySlot}</span>
                    <span className="shrink-0 text-sm opacity-90">{datePart}</span>
                    {shift.assignment_owner === 'this_sub' ? (
                      <span
                        className="mt-2 inline-flex min-w-0 max-w-full shrink-0 items-center truncate rounded-full border px-1.5 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: 'rgb(204, 251, 241)',
                          color: 'rgb(15, 118, 110)',
                          borderColor: 'rgb(153, 246, 228)',
                        }}
                      >
                        {thisSubName || 'This sub'}
                      </span>
                    ) : shift.assignment_owner === 'other_sub' ? (
                      <span
                        className="mt-2 inline-flex min-w-0 max-w-full shrink-0 items-center truncate rounded-full border px-1.5 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: 'rgb(226, 232, 240)',
                          color: 'rgb(71, 85, 105)',
                          borderColor: 'rgb(203, 213, 225)',
                        }}
                      >
                        {shift.assigned_sub_name || 'Other sub'}
                      </span>
                    ) : (
                      <span
                        className="mt-2 inline-flex min-h-[1.5rem] min-w-0 max-w-full shrink-0 items-center justify-center truncate rounded-full border px-1.5 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: coverageColorValues.uncovered.bg,
                          borderColor: coverageColorValues.uncovered.border,
                          color: coverageColorValues.uncovered.text,
                        }}
                      >
                        Uncovered
                      </span>
                    )}
                  </span>
                </Badge>
                {/* Corner indicator: AFTER Badge so it paints on top; outside Badge to avoid overflow-hidden */}
                {indicatorToShow && (
                  <div
                    className="absolute z-[200]"
                    style={{
                      top: 5,
                      left: 5,
                      pointerEvents: 'none',
                      overflow: 'visible',
                    }}
                  >
                    {indicatorToShow}
                  </div>
                )}
              </div>
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
          <div className="mt-2 p-3 bg-white rounded-md border border-gray-200">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">Key:</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{
                    backgroundColor: legendAvailableColors.bg,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: legendAvailableColors.border,
                  }}
                />
                <span className="text-gray-600">Can cover</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{
                    backgroundColor: shiftStatusColorValues.unavailable.bg,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: shiftStatusColorValues.unavailable.border,
                  }}
                />
                <span className="text-gray-600">Cannot cover</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: 'rgb(204, 251, 241)',
                    color: 'rgb(15, 118, 110)',
                    borderColor: 'rgb(153, 246, 228)',
                  }}
                >
                  <span className="font-bold leading-none" style={{ fontSize: '10px' }}>
                    ✓
                  </span>
                  Assigned Sub
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: '#fde68a' }}
                  aria-hidden="true"
                />
                <span className="text-gray-600">Recommended assignment</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
