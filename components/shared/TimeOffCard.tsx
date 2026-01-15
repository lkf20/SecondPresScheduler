'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, ChevronDown, ChevronUp, Check, AlertTriangle, PieChart, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { parseLocalDate } from '@/lib/utils/date'
import { getClassroomPillStyle } from '@/lib/utils/classroom-style'

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
    router.push(`/time-off/${id}`)
  }

  // Sub Finder variant - different layout
  if (variant === 'sub-finder') {
    return (
      <Card
        className={cn(
          'group cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] border border-slate-200 relative',
          isSelected && 'ring-1 ring-slate-300 shadow-md border-l-4 border-l-blue-500 animate-in fade-in-50 duration-200',
          className
        )}
        onClick={handleCardClick}
      >
        {notes && (
          <span
            className="group/note absolute right-0 top-0 h-4 w-4 cursor-pointer rounded-tr-lg bg-[linear-gradient(225deg,#fbbf24_0_50%,transparent_50%)] z-10"
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
                <h3 className="font-semibold text-base text-slate-800">{teacherName}</h3>
                {reason && (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
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
                    className="rounded-full border px-2.5 py-1 text-[11px] font-semibold"
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
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            )}
            {partial > 0 && <PieChart className="h-5 w-5 text-amber-600 flex-shrink-0" />}
            {uncovered === 0 && partial === 0 && covered > 0 && (
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
            )}
          </div>

          <div className="mt-3 border-t border-slate-200 pt-3">
            {/* Coverage badges in middle */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {covered > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs rounded-full px-3.5 py-1 bg-blue-50 border border-blue-400 text-blue-700 font-medium">
                    <Check className="h-3 w-3" />
                    Covered: {covered}
                  </span>
                )}
                {partial > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs rounded-full px-3.5 py-1 bg-yellow-50 border border-yellow-300 text-yellow-700 font-medium">
                    Partial: {partial}
                  </span>
                )}
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {uncovered > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs rounded-full px-3.5 py-1 bg-amber-50 border border-amber-400 text-amber-700 font-medium">
                    <AlertTriangle className="h-3 w-3" />
                    Uncovered: {uncovered}
                  </span>
                )}
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
          className="group/note absolute right-0 top-0 h-4 w-4 cursor-pointer rounded-tr-lg bg-[linear-gradient(225deg,#fbbf24_0_50%,transparent_50%)] z-10"
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
            <div className="text-base font-semibold text-slate-900">{teacherName}</div>
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
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
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
                    className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
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
            {covered > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs rounded-full px-3.5 py-1 bg-blue-50 border border-blue-400 text-blue-700 font-medium">
                <Check className="h-3 w-3" />
                Covered: {covered}
              </span>
            )}
            {partial > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs rounded-full px-3.5 py-1 bg-yellow-50 border border-yellow-300 text-yellow-700 font-medium">
                Partial: {partial}
              </span>
            )}
            {uncovered > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs rounded-full px-3.5 py-1 bg-amber-50 border border-amber-400 text-amber-700 font-medium">
                <AlertTriangle className="h-3 w-3" />
                Uncovered: {uncovered}
              </span>
            )}
          </div>
          <div className="flex items-center justify-end gap-3 mt-auto">
            <Link
              href={`/time-off/${id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-semibold text-teal-700 hover:text-teal-800 hover:underline"
            >
              {isTimeOffVariant ? 'Edit' : 'View'}
            </Link>
            {uncovered > 0 && (
              <div onClick={(e) => e.stopPropagation()}>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="border-teal-700 text-teal-700 hover:bg-teal-700 hover:text-white hover:border-teal-700"
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
            {shiftDetails.map((shift, index) => (
              <span
                key={index}
                className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"
              >
                {shift}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
