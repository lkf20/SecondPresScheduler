'use client'

import {
  Check,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  XCircle,
  ArrowRightLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getClassroomPillStyle } from '@/lib/utils/classroom-style'
import { shiftStatusColorValues } from '@/lib/utils/colors'
import type { SubFinderShift } from '@/lib/sub-finder/types'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface ShiftStatusCardProps {
  shift: SubFinderShift
  teacherName: string
  contactedAvailableSubCount?: number
  responseSummary?: string
  onSelectShift?: (shift: SubFinderShift) => void
  onRemoveSub?: (shift: SubFinderShift) => void
  onChangeSub?: (shift: SubFinderShift) => void
}

function formatShiftLabel(shift: SubFinderShift) {
  const date = new Date(`${shift.date}T00:00:00`)
  const dayName = shift.day_name || date.toLocaleDateString('en-US', { weekday: 'short' })
  const monthName = date.toLocaleDateString('en-US', { month: 'short' })
  const day = date.getDate()
  return `${dayName} ${monthName} ${day} · ${shift.time_slot_code}`
}

function getCoverageStatus(shift: SubFinderShift) {
  if (shift.status === 'uncovered') {
    return { label: 'Uncovered', icon: AlertTriangle, className: 'text-amber-600' }
  }
  return { label: 'Covered', icon: CheckCircle, className: 'text-emerald-600' }
}

function getContactStatus(contactedAvailableSubCount: number) {
  if (contactedAvailableSubCount > 0) {
    return {
      label: `${contactedAvailableSubCount} Sub${contactedAvailableSubCount === 1 ? '' : 's'} contacted`,
      icon: CheckCircle,
      className: 'text-emerald-600',
    }
  }
  return { label: 'No subs contacted', icon: HelpCircle, className: 'text-slate-500' }
}

function getAssignmentStatus(shift: SubFinderShift) {
  // TODO: Wire to actual assignment status once available in shift view model.
  if (shift.status === 'fully_covered') {
    return { label: 'Confirmed', icon: CheckCircle, className: 'text-emerald-600' }
  }
  if (shift.status === 'partially_covered') {
    return { label: 'Pending', icon: AlertTriangle, className: 'text-amber-600' }
  }
  if (shift.status === 'uncovered') {
    return { label: 'No response', icon: HelpCircle, className: 'text-slate-500' }
  }
  return { label: 'Declined', icon: XCircle, className: 'text-red-600' }
}

export default function ShiftStatusCard({
  shift,
  teacherName,
  contactedAvailableSubCount = 0,
  responseSummary,
  onSelectShift,
  onRemoveSub,
  onChangeSub,
}: ShiftStatusCardProps) {
  const coverage = getCoverageStatus(shift)
  const contact = getContactStatus(contactedAvailableSubCount)
  const assignment = getAssignmentStatus(shift)
  const classroomStyle = getClassroomPillStyle(shift.classroom_color ?? null)
  const hasConfirmedSub = Boolean(shift.sub_name) && shift.status === 'fully_covered'
  const hasAssignedSub = Boolean(shift.sub_name) && Boolean(shift.sub_id)
  const isCovered = shift.status === 'fully_covered'

  const statusBorderColor = isCovered
    ? shiftStatusColorValues.available.border
    : shiftStatusColorValues.unavailable.border

  return (
    <div
      className={cn(
        'flex w-full max-w-none self-stretch min-w-0 items-start justify-between gap-6 rounded-lg border border-l-4 border-slate-300 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md',
        isCovered && 'opacity-80',
        onSelectShift && 'cursor-pointer'
      )}
      style={{ borderLeftColor: statusBorderColor }}
      role={onSelectShift ? 'button' : undefined}
      tabIndex={onSelectShift ? 0 : undefined}
      onClick={onSelectShift ? () => onSelectShift(shift) : undefined}
      onKeyDown={
        onSelectShift
          ? event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelectShift(shift)
              }
            }
          : undefined
      }
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">{formatShiftLabel(shift)}</span>
          {shift.classroom_name && (
            <span
              className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
              style={classroomStyle}
            >
              {shift.classroom_name}
            </span>
          )}
        </div>
        <div className="mt-1 text-sm text-slate-600">Absence: {teacherName}</div>
      </div>

      <div className="flex flex-col gap-1 text-xs text-slate-700 min-w-[210px] justify-center self-center">
        {hasAssignedSub ? (
          <div className="mt-2">
            <div className="flex items-center justify-between gap-3">
              <p className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-base font-semibold leading-tight text-slate-700">
                <Check className="h-4 w-4 text-emerald-600" />
                <span>Covered by {shift.sub_name}</span>
              </p>
              <TooltipProvider>
                <div className="flex items-center gap-1">
                  {onRemoveSub && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation()
                            onRemoveSub(shift)
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
                          style={{ color: '#9f1239', backgroundColor: '#fff7f8' }}
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Remove sub</TooltipContent>
                    </Tooltip>
                  )}
                  {(onChangeSub || onSelectShift) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation()
                            if (onChangeSub) {
                              onChangeSub(shift)
                              return
                            }
                            onSelectShift?.(shift)
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-teal-700 hover:bg-teal-50 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200"
                          style={{ backgroundColor: '#f5fbfa' }}
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Change sub</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </TooltipProvider>
            </div>
          </div>
        ) : hasConfirmedSub ? (
          <>
            <div className="flex items-center gap-2">
              <coverage.icon className={`h-4 w-4 ${coverage.className}`} />
              <span>{coverage.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <span>{shift.sub_name}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <coverage.icon className={`h-4 w-4 ${coverage.className}`} />
              <span>{coverage.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <contact.icon className={`h-4 w-4 ${contact.className}`} />
              <span>{contact.label}</span>
            </div>
            {responseSummary && (
              <div className="flex items-center gap-2">
                <assignment.icon className={`h-4 w-4 ${assignment.className}`} />
                <span className="leading-snug">{responseSummary}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
