'use client'

import React from 'react'
import { formatShiftLabel } from '@/components/sub-finder/ShiftChips'
import CoverageBadge from '@/components/shared/CoverageBadge'
import { coverageColorValues, neutralColors, getHeaderClasses } from '@/lib/utils/colors'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { sortShiftDetailsByDisplayOrder } from '@/lib/utils/shift-display-order'

interface ShiftDetail {
  id: string
  date: string
  day_name: string
  time_slot_code: string
  status: 'uncovered' | 'partially_covered' | 'fully_covered'
  sub_name?: string | null
  is_partial?: boolean
  day_display_order?: number | null
  time_slot_display_order?: number | null
}

interface CoverageSummaryProps {
  shifts: {
    total: number
    uncovered: number
    partially_covered: number
    fully_covered: number
    shift_details: ShiftDetail[]
    shift_details_sorted?: ShiftDetail[]
    coverage_segments?: Array<{ id: string; status: ShiftDetail['status'] }>
  }
  onShiftClick?: (shift: ShiftDetail) => void
  variant?: 'full' | 'compact'
  headerText?: string
}

export default function CoverageSummary({
  shifts,
  onShiftClick,
  variant = 'full',
  headerText,
}: CoverageSummaryProps) {
  const { uncovered, fully_covered, shift_details } = shifts

  // Don't show if no shifts
  if (shifts.total === 0) {
    return null
  }

  // Sort shifts by date, then day display_order, then time_slot display_order (AGENTS.md)
  const sortedShifts = shifts.shift_details_sorted?.length
    ? shifts.shift_details_sorted
    : sortShiftDetailsByDisplayOrder([...shift_details])

  const getBadgeStyles = (shift: ShiftDetail) => {
    switch (shift.status) {
      case 'fully_covered':
        return {
          backgroundColor: coverageColorValues.covered.bg,
          color: coverageColorValues.covered.text,
          borderWidth: '1px',
          borderStyle: 'solid' as const,
          borderColor: coverageColorValues.covered.border,
        }
      case 'partially_covered':
        return {
          backgroundColor: coverageColorValues.partial.bg,
          color: coverageColorValues.partial.text,
          borderWidth: '1px',
          borderStyle: 'dashed' as const,
          borderColor: coverageColorValues.partial.border,
        }
      case 'uncovered':
        return {
          backgroundColor: coverageColorValues.uncovered.bg,
          color: coverageColorValues.uncovered.text,
          borderWidth: '1px',
          borderStyle: 'solid' as const,
          borderColor: coverageColorValues.uncovered.border,
        }
    }
  }

  const totalShifts = shifts.total
  const coveredShiftsWithSubs = shift_details.filter(shift => Boolean(shift.sub_name))
  const coveredCount = coveredShiftsWithSubs.length
  const coveredSubNames = Array.from(
    new Set(coveredShiftsWithSubs.map(shift => shift.sub_name).filter(Boolean))
  ) as string[]
  const headerLabel = headerText ?? `${uncovered} of ${totalShifts} Shifts Require Subs`
  const headerClass =
    variant === 'compact' ? 'text-lg font-normal text-slate-700' : getHeaderClasses('xl')
  return (
    <div
      className={cn(
        variant === 'compact' ? 'px-0 py-0' : 'rounded-lg border px-4 pt-3 pb-2 shadow-sm',
        variant === 'compact' ? '' : neutralColors.border,
        variant === 'compact' ? '' : neutralColors.bgLight
      )}
    >
      {/* Header */}
      <div className={cn('flex flex-wrap items-center gap-3', coveredCount > 0 ? 'mb-2' : 'mb-0')}>
        <div className={headerClass}>{headerLabel}</div>
        <div className="h-2 rounded-full overflow-hidden flex gap-0.5">
          {(
            shifts.coverage_segments ||
            sortedShifts.map(shift => ({
              id: shift.id,
              status: shift.status,
            }))
          )
            .slice()
            .sort((a, b) => {
              // Covered first, then need coverage (green then grey)
              const order: Record<ShiftDetail['status'], number> = {
                fully_covered: 0,
                partially_covered: 1,
                uncovered: 2,
              }
              return order[a.status] - order[b.status]
            })
            .map(segment => {
              const getSegmentColor = () => {
                switch (segment.status) {
                  case 'fully_covered':
                    return 'rgb(186, 225, 210)' // green-blue tone used in sub card coverage bars
                  case 'partially_covered':
                    return 'rgb(200, 232, 219)' // lighter green-blue for partial
                  case 'uncovered':
                    return 'rgb(253, 218, 185)' // light orange (softer than uncovered text)
                }
              }

              return (
                <div
                  key={segment.id}
                  className="h-full rounded border"
                  style={{
                    width: '14px', // 14px (between 12-16px)
                    backgroundColor: getSegmentColor(),
                    borderColor: getSegmentColor(),
                  }}
                />
              )
            })}
        </div>
      </div>

      {coveredCount > 0 && (
        <div className="mt-0 mb-2 text-lg text-muted-foreground">
          {coveredCount} shift{coveredCount === 1 ? '' : 's'} covered by{' '}
          {coveredSubNames.join(', ')}
        </div>
      )}

      {variant === 'compact' ? null : (
        <>
          {/* Summary Line */}
          <div className="mb-3 flex items-center gap-2 flex-wrap">
            <CoverageBadge type="covered" count={fully_covered} />
            <CoverageBadge type="uncovered" count={uncovered} />
          </div>
          <div className={cn('border-t', neutralColors.border)} />
        </>
      )}

      {variant === 'compact' ? null : (
        <TooltipProvider>
          <div className="mt-3 flex flex-wrap gap-1.5 pb-2">
            {sortedShifts.map(shift => {
              const isClickable =
                shift.status === 'fully_covered' || shift.status === 'partially_covered'
              const baseLabel = formatShiftLabel(shift.date, shift.time_slot_code)
              const badgeStyles = getBadgeStyles(shift)
              const isFullyCovered = shift.status === 'fully_covered' && shift.sub_name

              const badgeContent = (
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-normal transition-colors',
                    isClickable ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''
                  )}
                  style={badgeStyles}
                  onClick={() => {
                    if (isClickable && onShiftClick) {
                      onShiftClick(shift)
                    }
                  }}
                >
                  {shift.status === 'fully_covered' && shift.sub_name ? (
                    <>
                      {baseLabel} - <span className="font-bold">{shift.sub_name}</span>
                    </>
                  ) : shift.status === 'partially_covered' && shift.sub_name ? (
                    <>
                      {baseLabel} - <span className="font-bold">{shift.sub_name}</span> (Partial)
                    </>
                  ) : (
                    baseLabel
                  )}
                </span>
              )

              // Wrap in tooltip if fully covered with sub name
              if (isFullyCovered) {
                return (
                  <Tooltip key={shift.id}>
                    <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
                    <TooltipContent>
                      <p>Assigned to {shift.sub_name}</p>
                    </TooltipContent>
                  </Tooltip>
                )
              }

              // Return badgeContent with key using React.cloneElement
              return React.cloneElement(badgeContent, { key: shift.id })
            })}
          </div>
        </TooltipProvider>
      )}
    </div>
  )
}
