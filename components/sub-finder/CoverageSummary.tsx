'use client'

import { formatShiftLabel } from '@/components/sub-finder/ShiftChips'
import { parseLocalDate } from '@/lib/utils/date'
import CoverageBadge from '@/components/shared/CoverageBadge'
import { getCoverageColors, getCoverageColorClasses, coverageColorValues, neutralColors, getHeaderClasses } from '@/lib/utils/colors'
import { cn } from '@/lib/utils'

interface ShiftDetail {
  id: string
  date: string
  day_name: string
  time_slot_code: string
  status: 'uncovered' | 'partially_covered' | 'fully_covered'
  sub_name?: string | null
  is_partial?: boolean
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
}

export default function CoverageSummary({ shifts, onShiftClick }: CoverageSummaryProps) {
  const { uncovered, fully_covered, shift_details } = shifts
  
  // Don't show if no shifts
  if (shifts.total === 0) {
    return null
  }
  
  // Sort shifts by date, then time slot
  const sortedShifts = shifts.shift_details_sorted?.length
    ? shifts.shift_details_sorted
    : [...shift_details].sort((a, b) => {
        const dateA = parseLocalDate(a.date).getTime()
        const dateB = parseLocalDate(b.date).getTime()
        if (dateA !== dateB) return dateA - dateB
        return a.time_slot_code.localeCompare(b.time_slot_code)
      })

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
  const coveredShiftsWithSubs = shift_details.filter((shift) => Boolean(shift.sub_name))
  const coveredCount = coveredShiftsWithSubs.length
  const coveredSubNames = Array.from(
    new Set(coveredShiftsWithSubs.map((shift) => shift.sub_name).filter(Boolean))
  ) as string[]
  return (
    <div className={cn('rounded-lg border px-4 pt-3 pb-2 shadow-sm', neutralColors.border, neutralColors.bgLight)}>
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className={getHeaderClasses('lg')}>
          {uncovered} of {totalShifts} Shifts Require Subs
        </div>
        <div className="h-2 rounded-full overflow-hidden flex gap-0.5">
          {(shifts.coverage_segments ||
            sortedShifts.map((shift) => ({
              id: shift.id,
              status: shift.status,
            }))
          ).map((segment) => {
            const getSegmentColor = () => {
              switch (segment.status) {
                case 'fully_covered':
                  return 'bg-blue-200' // Use darker shade for progress bar
                case 'partially_covered':
                  return 'bg-yellow-200' // Use darker shade for progress bar
                case 'uncovered':
                  return 'bg-orange-200' // Use darker shade for progress bar
              }
            }

            return (
              <div
                key={segment.id}
                className={`h-full ${getSegmentColor()} rounded`}
                style={{
                  width: '14px', // 14px (between 12-16px)
                }}
              />
            )
          })}
        </div>
      </div>
      
      {coveredCount > 0 && (
        <div className="mb-3 -mt-2 text-sm text-muted-foreground">
          {coveredCount} Shift{coveredCount === 1 ? '' : 's'} covered by {coveredSubNames.join(', ')}
        </div>
      )}

      {/* Summary Line */}
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <CoverageBadge type="covered" count={fully_covered} />
        <CoverageBadge type="uncovered" count={uncovered} />
      </div>
      <div className={cn('border-t', neutralColors.border)} />

      {/* Shift Chips */}
      <div className="mt-3 flex flex-wrap gap-1.5 pb-2">
        {sortedShifts.map((shift) => {
          const isClickable = shift.status === 'fully_covered' || shift.status === 'partially_covered'
          const baseLabel = formatShiftLabel(shift.date, shift.time_slot_code)
          const badgeStyles = getBadgeStyles(shift)
          
          return (
            <span
              key={shift.id}
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
        })}
      </div>
    </div>
  )
}
