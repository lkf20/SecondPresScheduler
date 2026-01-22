'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, ChevronDown, ChevronUp, AlertTriangle, PieChart, CheckCircle2 } from 'lucide-react'
import CoverageBadge from './CoverageBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { parseLocalDate } from '@/lib/utils/date'
import { getClassroomPillStyle } from '@/lib/utils/classroom-style'
import { getButtonColors, getCoverageColorClasses, getNeutralChipClasses, coverageColorValues } from '@/lib/utils/colors'

export type TimeOffCardVariant = 'sub-finder' | 'dashboard' | 'time-off'

export interface ClassroomBadge {
  id: string
  name: string
  color: string | null
}

export interface TimeOffCardProps {
  id: string
  teacherName: string
  startDate: string
  endDate: string | null
  reason: string | null
  classrooms?: ClassroomBadge[]
  variant: TimeOffCardVariant
  // Coverage counts
  covered?: number
  uncovered?: number
  partial?: number
  totalShifts?: number
  // Shift details for dropdown (array of strings like "Mon AM", "Tues LB" or objects with label and status)
  shiftDetails?: string[] | Array<{ label: string; status: 'covered' | 'partial' | 'uncovered' }>
  // Optional props
  notes?: string | null
  isSelected?: boolean
  onSelect?: () => void
  onFindSubs?: () => void
  onEdit?: () => void // Callback for editing (opens panel instead of navigating)
  loading?: boolean
  className?: string
}

const formatFullDateLabel = (value: string) => {
  const date = parseLocalDate(value)
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date)
  const dateLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
  return `${weekday} ${dateLabel}`
}

export default function TimeOffCard({
  id,
  teacherName,
  startDate,
  endDate,
  reason,
  classrooms = [],
  variant,
  covered = 0,
  uncovered = 0,
  partial = 0,
  totalShifts,
  shiftDetails = [],
  notes,
  isSelected = false,
  onSelect,
  onFindSubs,
  onEdit,
  loading = false,
  className,
}: TimeOffCardProps) {
  const router = useRouter()
  const [isExpanded, setIsExpanded] = useState(false)
  const hasShiftsDropdown = variant !== 'sub-finder' && totalShifts !== undefined && shiftDetails.length > 0

  const startDateLabel = formatFullDateLabel(startDate)
  const endDateLabel = endDate && endDate !== startDate ? formatFullDateLabel(endDate) : null
  const dateRange = endDateLabel ? `${startDateLabel} - ${endDateLabel}` : startDateLabel

  const handleCardClick = () => {
    if (onSelect) {
      onSelect()
    }
  }

  const handleFindSubsClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onFindSubs) {
      onFindSubs()
    }
  }

  const handleTimeOffCardClick = () => {
    if (onEdit) {
      onEdit()
    } else {
      router.push(`/time-off/${id}`)
    }
  }

  // Sub Finder variant - different layout
  if (variant === 'sub-finder') {
    return (
      <Card
        className={cn(
          'group cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] border border-slate-200 relative',
          isSelected && 'ring-1 ring-slate-300 shadow-md border-l-4 border-l-blue-500',
          className
        )}
        onClick={handleCardClick}
      >
        {notes && (
          <span
            className="group/note absolute right-0 top-0 h-4 w-4 cursor-pointer rounded-tr-lg bg-[linear-gradient(225deg,#e2e8f0_0_50%,transparent_50%)] z-10"
            aria-label="Note"
          >
            <span className="absolute right-0 top-4 z-10 hidden w-56 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 shadow-sm group-hover/note:block">
              {notes}
            </span>
          </span>
        )}
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg text-slate-800">{teacherName}</h3>
                {reason && (
                  <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', getNeutralChipClasses())}>
                    {reason}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <CalendarDays className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-800">{dateRange}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {classrooms.map((classroom) => (
                  <span
                    key={classroom.id || classroom.name}
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                    style={getClassroomPillStyle(classroom.color)}
                  >
                    {classroom.name}
                  </span>
                ))}
                {classrooms.length === 0 && (
                  <span className="text-xs text-muted-foreground">Classroom unavailable</span>
                )}
              </div>
            </div>
            {uncovered > 0 && partial === 0 && (
              <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0" />
            )}
            {partial > 0 && <PieChart className="h-5 w-5 text-yellow-600 flex-shrink-0" />}
            {uncovered === 0 && partial === 0 && covered > 0 && (
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
            )}
          </div>

          <div className="mt-3 border-t border-slate-200 pt-3">
            {/* Coverage badges in middle */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {covered > 0 && <CoverageBadge type="covered" count={covered} />}
                {partial > 0 && <CoverageBadge type="partial" count={partial} />}
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {uncovered > 0 && <CoverageBadge type="uncovered" count={uncovered} />}
              </div>
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              className="border-teal-700 text-teal-700 hover:bg-teal-700 hover:text-white hover:border-teal-700"
              onClick={handleFindSubsClick}
              disabled={loading}
            >
              Find Subs →
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Dashboard and Time Off variants - similar layout
  const isTimeOffVariant = variant === 'time-off'

  return (
    <div
      className={cn(
        'group relative rounded-lg border border-slate-200 bg-white px-4 py-4',
        isTimeOffVariant && 'cursor-pointer transition-all hover:shadow-md hover:border-slate-300',
        className
      )}
      onClick={isTimeOffVariant ? handleTimeOffCardClick : undefined}
    >
      {notes && (
        <span
          className="group/note absolute right-0 top-0 h-4 w-4 cursor-pointer rounded-tr-lg bg-[linear-gradient(225deg,#e2e8f0_0_50%,transparent_50%)] z-10"
          aria-label="Note"
        >
          <span className="absolute right-0 top-4 z-10 hidden w-56 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 shadow-sm group-hover/note:block">
            {notes}
          </span>
        </span>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-3 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-lg font-semibold text-slate-900">{teacherName}</div>
            {reason && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {reason}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <CalendarDays className="h-4 w-4 text-slate-500" />
            <div className="text-sm font-medium text-slate-800">{dateRange}</div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {hasShiftsDropdown && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsExpanded(!isExpanded)
                  }}
                  className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', getNeutralChipClasses(), 'hover:bg-slate-100')}
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? 'Hide shift details' : 'Show shift details'}
                >
                  {totalShifts} {totalShifts === 1 ? 'Shift' : 'Shifts'}
                  {isExpanded ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
                {classrooms.length > 0 && (
                  <>
                    <span className="h-4 w-px bg-slate-300 mx-2" aria-hidden="true" />
                  </>
                )}
              </>
            )}
            {classrooms.length > 0 ? (
              <>
                {classrooms.map((classroom) => (
                  <span
                    key={classroom.id}
                    className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                    style={getClassroomPillStyle(classroom.color)}
                  >
                    {classroom.name}
                  </span>
                ))}
                {classrooms.length > 1 && (
                  <span className="text-[11px] text-slate-500">(varies by shift)</span>
                )}
              </>
            ) : (
              !hasShiftsDropdown && <div className="text-xs text-slate-500">No classrooms specified</div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end self-stretch">
          <div className="flex items-center gap-2 mb-auto">
            {covered > 0 && <CoverageBadge type="covered" count={covered} />}
            {partial > 0 && <CoverageBadge type="partial" count={partial} />}
            {uncovered > 0 && <CoverageBadge type="uncovered" count={uncovered} />}
          </div>
          <div className="flex items-center justify-end gap-3 mt-auto">
            {onEdit ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit()
                }}
                className="text-sm font-semibold text-teal-700 hover:text-teal-800 hover:underline"
              >
                Edit
              </button>
            ) : (
              <Link
                href={`/time-off/${id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-semibold text-teal-700 hover:text-teal-800 hover:underline"
              >
                {isTimeOffVariant ? 'Edit' : 'View'}
              </Link>
            )}
            {uncovered > 0 && (
              <div onClick={(e) => e.stopPropagation()}>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className={getButtonColors('teal').base}
                >
                  <Link href={`/sub-finder?absence_id=${id}`}>Find Sub</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Shifts dropdown expanded details */}
      {hasShiftsDropdown && isExpanded && shiftDetails.length > 0 && (
        <div className="mt-3 border-t border-slate-200 pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {shiftDetails.map((shift, index) => {
              const label = typeof shift === 'string' ? shift : shift.label
              const status = typeof shift === 'object' ? shift.status : undefined
              
              // Get color values for inline styles (Safari compatibility)
              let colorValues
              if (status === 'covered') {
                colorValues = coverageColorValues.covered
              } else if (status === 'partial') {
                colorValues = coverageColorValues.partial
              } else if (status === 'uncovered') {
                colorValues = coverageColorValues.uncovered
              } else {
                // Neutral colors (no status)
                colorValues = {
                  bg: 'rgb(248, 250, 252)', // slate-50
                  border: 'rgb(226, 232, 240)', // slate-200
                  text: 'rgb(71, 85, 105)', // slate-600
                }
              }
              
              return (
                <span
                  key={index}
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-normal transition-colors"
                  style={{
                    backgroundColor: colorValues.bg,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: colorValues.border,
                    color: colorValues.text,
                  } as React.CSSProperties}
                >
                  {label}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
