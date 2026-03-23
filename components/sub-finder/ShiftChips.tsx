'use client'

import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { parseLocalDate } from '@/lib/utils/date'
import { cn } from '@/lib/utils'
import { coverageColorValues, shiftStatusColorValues } from '@/lib/utils/colors'
import { DAY_NAMES, MONTH_NAMES } from '@/lib/utils/date-format'
import { sortShiftDetailsByDisplayOrder } from '@/lib/utils/shift-display-order'
import {
  FLOATER_SHIFT_GROUP_CONTAINER_CLASS,
  FLOATER_SHIFT_GROUP_HEADER_CLASS,
  floaterGroupHeaderLabel,
  groupShiftsForFloaterUi,
  shiftChipRowKey,
} from '@/lib/sub-finder/floater-shift-groups'
import { Check, Clock3 } from 'lucide-react'

interface ShiftBase {
  date: string
  time_slot_code: string
  day_name?: string
  reason?: string
  classroom_name?: string | null
  /** Room-level shift identity (floater / CRS); use with date + time_slot_code in shift keys */
  classroom_id?: string | null
  class_name?: string | null
  classroom_color?: string | null
  day_display_order?: number | null
  time_slot_display_order?: number | null
}

type AssignmentOwner = 'this_sub' | 'other_sub'

export type ShiftChipSubFinderStatus = 'assigned' | 'available' | 'unavailable'
export type ShiftChipCoverageStatus = 'covered' | 'partial' | 'uncovered'

export type AvailabilityShift = ShiftBase & {
  status: ShiftChipSubFinderStatus
  assignment_owner?: AssignmentOwner
  assigned_sub_name?: string | null
}

export type CoverageShift = ShiftBase & {
  status: ShiftChipCoverageStatus
  assignment_owner?: AssignmentOwner
  assigned_sub_name?: string | null
  assigned_sub_names?: string[]
}

const isCoverageShift = (shift: ShiftBase & { status: string }): shift is CoverageShift =>
  shift.status === 'covered' || shift.status === 'partial' || shift.status === 'uncovered'

type AvailabilityInputShift = ShiftBase

type AvailabilityProps = {
  mode: 'availability'
  canCover?: AvailabilityInputShift[]
  cannotCover?: AvailabilityInputShift[]
  assigned?: AvailabilityInputShift[]
  shifts?: AvailabilityShift[]
  showLegend?: boolean
  isDeclined?: boolean
  recommendedShifts?: AvailabilityInputShift[]
  softAvailableStyle?: boolean
  thisSubName?: string | null
}

type CoverageProps = {
  mode: 'coverage'
  shifts: CoverageShift[]
  showLegend?: boolean
}

type ShiftChipsProps = AvailabilityProps | CoverageProps

export function formatShiftLabel(dateString: string, timeSlotCode: string): string {
  const date = parseLocalDate(dateString)
  const dayName = DAY_NAMES[date.getDay()]
  const month = MONTH_NAMES[date.getMonth()]
  const day = date.getDate()
  return `${dayName} ${timeSlotCode} • ${month} ${day}`
}

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

const assignedPillStyles = {
  thisSub: {
    backgroundColor: 'rgb(204, 251, 241)' as const,
    color: 'rgb(15, 118, 110)' as const,
    borderColor: 'rgb(153, 246, 228)' as const,
  },
  uncovered: {
    backgroundColor: coverageColorValues.uncovered.bg,
    borderColor: coverageColorValues.uncovered.border,
    color: coverageColorValues.uncovered.text,
  },
} as const

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

const appendSentencePeriod = (value: string): string => {
  if (!value.trim()) return value
  return /[.!?]$/.test(value) ? value : `${value}.`
}

export function ShiftChipsLegend({ className }: { className?: string }) {
  const legendAvailableColors = {
    bg: 'rgb(246, 253, 251)',
    border: 'rgb(196, 234, 226)',
  }
  return (
    <div
      className={cn('p-3 rounded-md border border-gray-200', className)}
      style={{ backgroundColor: 'rgb(249, 250, 251)' }}
      role="img"
      aria-label="Legend: green = can cover, gray = cannot cover, Assigned Sub = chip with checkmark, amber dot = recommended assignment"
    >
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-700">Key:</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: legendAvailableColors.bg,
              color: 'rgb(15, 118, 110)',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: legendAvailableColors.border,
            }}
          >
            Can cover
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: shiftStatusColorValues.unavailable.bg,
              color: shiftStatusColorValues.unavailable.text,
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: shiftStatusColorValues.unavailable.border,
            }}
          >
            Cannot cover
          </span>
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
            <Check className="h-3 w-3" aria-hidden />
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

export default function ShiftChips(props: ShiftChipsProps) {
  const isCoverageMode = props.mode === 'coverage'
  const showLegend = props.showLegend ?? false
  const softAvailableStyle = !isCoverageMode ? (props.softAvailableStyle ?? true) : false
  const isDeclined = !isCoverageMode ? (props.isDeclined ?? false) : false
  const thisSubName = !isCoverageMode ? (props.thisSubName ?? null) : null
  const recommendedShifts = !isCoverageMode ? (props.recommendedShifts ?? []) : []

  type ShiftItem = AvailabilityShift | CoverageShift
  const allShiftsMap = new Map<string, ShiftItem>()

  if (isCoverageMode) {
    props.shifts.forEach(shift => {
      allShiftsMap.set(shiftChipRowKey(shift), shift)
    })
  } else {
    const assigned = props.assigned ?? []
    const canCover = props.canCover ?? []
    const cannotCover = props.cannotCover ?? []

    assigned.forEach(shift => {
      allShiftsMap.set(shiftChipRowKey(shift), {
        ...shift,
        status: 'assigned',
        assignment_owner: 'this_sub',
      })
    })

    canCover.forEach(shift => {
      const key = shiftChipRowKey(shift)
      if (!allShiftsMap.has(key)) {
        allShiftsMap.set(key, { ...shift, status: 'available' })
      }
    })

    cannotCover.forEach(shift => {
      const key = shiftChipRowKey(shift)
      if (!allShiftsMap.has(key)) {
        allShiftsMap.set(key, { ...shift, status: 'unavailable' })
      }
    })

    props.shifts?.forEach(shift => {
      allShiftsMap.set(shiftChipRowKey(shift), shift)
    })
  }

  const allShifts = sortShiftDetailsByDisplayOrder(Array.from(allShiftsMap.values()))
  if (allShifts.length === 0) return null

  const groups = groupShiftsForFloaterUi(allShifts)

  /** Recommended dot is per calendar slot (same slot = same recommendation hint for all rooms). */
  const recommendedShiftKeys = new Set(
    recommendedShifts.map(shift => normalizeShiftKey(shift.date, shift.time_slot_code))
  )

  const legendAvailableColors = softAvailableStyle
    ? { bg: 'rgb(246, 253, 251)', border: 'rgb(196, 234, 226)' }
    : { bg: shiftStatusColorValues.available.bg, border: shiftStatusColorValues.available.border }

  const renderOneShiftChip = (shift: ShiftItem, reactKey: string) => {
    if (isCoverageMode && !isCoverageShift(shift)) {
      return null
    }

    const { daySlot, datePart } = getShiftLabelParts(shift.date, shift.time_slot_code)
    const tooltipLabel = formatShiftTooltipLabel(shift.date, shift.time_slot_code)
    const classroomName = shift.classroom_name
    const classGroupName = shift.class_name
    const classroomLabel = classroomName
      ? classGroupName
        ? `${classroomName} (${classGroupName})`
        : classroomName
      : classGroupName || 'Classroom unavailable'

    const shiftKey = normalizeShiftKey(shift.date, shift.time_slot_code)
    const isRecommended = !isCoverageMode && recommendedShiftKeys.has(shiftKey)
    const availabilityStatus = isDeclined
      ? 'unavailable'
      : shift.status === 'unavailable'
        ? 'unavailable'
        : 'available'

    const coverageStatus = isCoverageShift(shift) ? shift.status : null
    const colorValues = isCoverageMode
      ? coverageStatus === 'uncovered'
        ? shiftStatusColorValues.unavailable
        : {
            bg: coverageColorValues[coverageStatus!].bg,
            border: coverageColorValues[coverageStatus!].border,
            text: coverageColorValues[coverageStatus!].text,
          }
      : softAvailableStyle && availabilityStatus === 'available'
        ? {
            ...shiftStatusColorValues.available,
            bg: 'rgb(246, 253, 251)' as const,
            border: 'rgb(196, 234, 226)' as const,
            text: 'rgb(15, 118, 110)' as const,
          }
        : shiftStatusColorValues[availabilityStatus]

    const assignedNames =
      'assigned_sub_names' in shift && shift.assigned_sub_names?.length
        ? shift.assigned_sub_names.join(', ')
        : shift.assigned_sub_name || null

    const cornerIndicator =
      isCoverageMode || !isRecommended ? null : (
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
      )

    const pillClassName =
      'mt-2 inline-flex min-w-0 max-w-full shrink-0 items-center gap-1 truncate rounded-full border px-1.5 py-0.5 text-xs font-medium'

    const pill = (() => {
      if (isCoverageMode) {
        if (assignedNames) {
          const isPartial = shift.status === 'partial'
          return (
            <span
              className={pillClassName}
              style={{
                backgroundColor: isPartial
                  ? coverageColorValues.partialAssignedPill.bg
                  : assignedPillStyles.thisSub.backgroundColor,
                borderColor: isPartial
                  ? coverageColorValues.partialAssignedPill.border
                  : assignedPillStyles.thisSub.borderColor,
                color: isPartial
                  ? coverageColorValues.partialAssignedPill.text
                  : assignedPillStyles.thisSub.color,
              }}
            >
              {isPartial ? (
                <Clock3 className="h-3 w-3 shrink-0" aria-hidden />
              ) : (
                <Check className="h-3 w-3 shrink-0" aria-hidden />
              )}
              <span className="min-w-0 truncate">{assignedNames}</span>
            </span>
          )
        }

        return (
          <span
            className={`${pillClassName} min-h-[1.5rem] justify-center`}
            style={{
              backgroundColor: coverageColorValues[coverageStatus!].bg,
              borderColor: coverageColorValues[coverageStatus!].border,
              color: coverageColorValues[coverageStatus!].text,
              borderStyle: coverageStatus === 'partial' ? 'dashed' : 'solid',
            }}
          >
            {coverageStatus === 'covered'
              ? 'Covered'
              : coverageStatus === 'partial'
                ? 'Partial'
                : 'Uncovered'}
          </span>
        )
      }

      if (shift.assignment_owner === 'this_sub' || shift.status === 'assigned') {
        return (
          <span className={pillClassName} style={assignedPillStyles.thisSub}>
            <Check className="h-3 w-3 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{thisSubName || 'This sub'}</span>
          </span>
        )
      }

      if (shift.assignment_owner === 'other_sub' && assignedNames) {
        return (
          <span className={pillClassName} style={assignedPillStyles.thisSub}>
            <Check className="h-3 w-3 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{assignedNames}</span>
          </span>
        )
      }

      return (
        <span
          className={`${pillClassName} min-h-[1.5rem] justify-center`}
          style={assignedPillStyles.uncovered}
        >
          Uncovered
        </span>
      )
    })()

    const tooltipStatusLine = (() => {
      if (isCoverageMode) {
        if (shift.status === 'partial' && assignedNames) {
          return appendSentencePeriod(`Partial shift assigned to ${assignedNames}`)
        }
        if (shift.status === 'covered' && assignedNames) {
          return `Assigned to ${assignedNames}`
        }
        if (shift.status === 'partial') return 'Partially covered shift'
        if (shift.status === 'covered') return 'Covered shift'
        return 'Uncovered shift'
      }

      if (shift.assignment_owner === 'this_sub' || shift.status === 'assigned') {
        return 'Assigned to this sub'
      }
      if (shift.assignment_owner === 'other_sub' && assignedNames) {
        return `Assigned to ${assignedNames}`
      }
      if (shift.status === 'unavailable' && shift.reason) {
        return shift.reason
      }
      if (shift.status === 'available') return 'This sub can cover this shift'
      return null
    })()

    const badge = (
      <div className="relative inline-block shrink-0 mr-3 mb-3" style={{ overflow: 'visible' }}>
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
          <span className="inline-flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 overflow-hidden leading-tight text-center">
            <span className="shrink-0 truncate text-[10px] font-medium uppercase text-slate-400">
              {classroomLabel}
            </span>
            <span className="shrink-0 text-base font-medium">{daySlot}</span>
            <span className="shrink-0 text-sm opacity-90">{datePart}</span>
            {pill}
          </span>
        </Badge>
        {cornerIndicator ? (
          <div
            className="absolute z-10"
            style={{ top: 5, left: 5, pointerEvents: 'none', overflow: 'visible' }}
          >
            {cornerIndicator}
          </div>
        ) : null}
      </div>
    )

    return (
      <Tooltip key={reactKey}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="p-0 m-0 border-0 bg-transparent rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            aria-label={`${tooltipLabel}. ${classroomLabel}${tooltipStatusLine ? `. ${tooltipStatusLine}` : ''}`}
          >
            {badge}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="text-base">
            <div>{tooltipLabel}</div>
            <div className={classroomName ? 'font-semibold' : undefined}>{classroomLabel}</div>
            {tooltipStatusLine ? (
              <div className="text-muted-foreground">{tooltipStatusLine}</div>
            ) : null}
          </div>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-2">
        <div className="flex flex-wrap items-start" style={{ overflow: 'visible' }}>
          {groups.map((group, gIdx) => {
            if (group.kind === 'single') {
              return renderOneShiftChip(group.shift, `sg-${shiftChipRowKey(group.shift)}`)
            }
            return (
              <div
                key={`floater-${group.slotKey}-${gIdx}`}
                role="group"
                aria-label={floaterGroupHeaderLabel(group.shifts)}
                className={`mb-3 w-full ${FLOATER_SHIFT_GROUP_CONTAINER_CLASS}`}
              >
                <div className={FLOATER_SHIFT_GROUP_HEADER_CLASS}>
                  {floaterGroupHeaderLabel(group.shifts)}
                </div>
                <div className="flex flex-wrap" style={{ overflow: 'visible' }}>
                  {group.shifts.map((s, i) =>
                    renderOneShiftChip(s, `fl-${group.slotKey}-${i}-${shiftChipRowKey(s)}`)
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {showLegend &&
          (isCoverageMode ? (
            <div className="mt-2 p-3 bg-white rounded-md border border-gray-200">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">Key:</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: coverageColorValues.covered.bg,
                      color: coverageColorValues.covered.text,
                      borderColor: coverageColorValues.covered.border,
                    }}
                  >
                    <Check className="h-3 w-3" aria-hidden />
                    Covered
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: coverageColorValues.partial.bg,
                      color: coverageColorValues.partial.text,
                      borderColor: coverageColorValues.partial.border,
                      borderStyle: 'dashed',
                    }}
                  >
                    <Clock3 className="h-3 w-3" aria-hidden />
                    Partial
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: coverageColorValues.uncovered.bg,
                      color: coverageColorValues.uncovered.text,
                      borderColor: coverageColorValues.uncovered.border,
                    }}
                  >
                    Uncovered
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-2 p-3 bg-white rounded-md border border-gray-200">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">Key:</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: legendAvailableColors.bg,
                      color: 'rgb(15, 118, 110)',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: legendAvailableColors.border,
                    }}
                  >
                    Can cover
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: shiftStatusColorValues.unavailable.bg,
                      color: shiftStatusColorValues.unavailable.text,
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: shiftStatusColorValues.unavailable.border,
                    }}
                  >
                    Cannot cover
                  </span>
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
                    <Check className="h-3 w-3" aria-hidden />
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
          ))}
      </div>
    </TooltipProvider>
  )
}
