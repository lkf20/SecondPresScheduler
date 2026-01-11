'use client'

import { Badge } from '@/components/ui/badge'
import { formatShiftLabel } from '@/components/sub-finder/ShiftChips'
import { parseLocalDate } from '@/lib/utils/date'

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
  }
  onShiftClick?: (shift: ShiftDetail) => void
}

export default function CoverageSummary({ shifts, onShiftClick }: CoverageSummaryProps) {
  const { uncovered, partially_covered, fully_covered, shift_details } = shifts
  
  // Don't show if no shifts
  if (shifts.total === 0) {
    return null
  }
  
  // Sort shifts by date, then time slot
  const sortedShifts = [...shift_details].sort((a, b) => {
    const dateA = parseLocalDate(a.date).getTime()
    const dateB = parseLocalDate(b.date).getTime()
    if (dateA !== dateB) return dateA - dateB
    return a.time_slot_code.localeCompare(b.time_slot_code)
  })

  const getBadgeClassName = (shift: ShiftDetail) => {
    switch (shift.status) {
      case 'fully_covered':
        return 'bg-blue-50 text-blue-900 border-blue-200'
      case 'partially_covered':
        return 'bg-blue-50 text-blue-900 border-blue-200 border-dashed'
      case 'uncovered':
        return 'bg-amber-50 text-amber-900 border-amber-200'
    }
  }


  const totalShifts = shifts.total
  const coveragePercent = totalShifts > 0 ? Math.round((fully_covered / totalShifts) * 100) : 0

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 pt-3 pb-2 shadow-sm">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="text-lg font-bold text-slate-900">
          {uncovered} of {totalShifts} Shifts Require Subs
        </div>
        <div className="h-2 rounded-full overflow-hidden flex gap-0.5">
          {sortedShifts.map((shift) => {
            const getSegmentColor = () => {
              switch (shift.status) {
                case 'fully_covered':
                  return 'bg-blue-200'
                case 'partially_covered':
                  return 'bg-blue-200'
                case 'uncovered':
                  return 'bg-amber-200'
              }
            }
            
            return (
              <div
                key={shift.id}
                className={`h-full ${getSegmentColor()} rounded`}
                style={{
                  width: '14px', // 14px (between 12-16px)
                }}
              />
            )
          })}
        </div>
      </div>
      
      {/* Summary Line */}

      {/* Shift Chips */}
      <div className="flex flex-wrap gap-1.5 pb-2">
        {sortedShifts.map((shift) => {
          const isClickable = shift.status === 'fully_covered' || shift.status === 'partially_covered'
          const baseLabel = formatShiftLabel(shift.date, shift.time_slot_code)
          
          return (
            <Badge
              key={shift.id}
              variant="outline"
              className={`text-xs ${getBadgeClassName(shift)} ${
                isClickable ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''
              }`}
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
            </Badge>
          )
        })}
      </div>
    </div>
  )
}
