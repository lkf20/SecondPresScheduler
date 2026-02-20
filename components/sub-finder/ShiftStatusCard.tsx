'use client'

import {
  Check,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  Phone,
  PhoneOff,
  XCircle,
  ArrowRightLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getClassroomPillStyle } from '@/lib/utils/classroom-style'
import { coverageColorValues, shiftStatusColorValues } from '@/lib/utils/colors'
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
    return {
      label: 'Uncovered',
      icon: AlertTriangle,
      className: '',
      iconStyle: { color: coverageColorValues.uncovered.icon } as React.CSSProperties,
    }
  }
  return {
    label: 'Covered',
    icon: CheckCircle,
    className: 'text-emerald-600',
    iconStyle: undefined as React.CSSProperties | undefined,
  }
}

function getContactStatus(contactedAvailableSubCount: number) {
  if (contactedAvailableSubCount > 0) {
    return {
      label: `${contactedAvailableSubCount} Sub${contactedAvailableSubCount === 1 ? '' : 's'} contacted`,
      icon: Phone,
      className: 'text-slate-500',
    }
  }
  return { label: 'No subs contacted', icon: PhoneOff, className: 'text-slate-500' }
}

function getAssignmentStatus(shift: SubFinderShift, responseSummary?: string | null) {
  const normalizedSummary = (responseSummary || '').toLowerCase()
  if (normalizedSummary.includes('declined')) {
    return {
      label: 'Declined',
      icon: XCircle,
      className: '',
      iconStyle: { color: 'rgb(190, 24, 93)' } as React.CSSProperties, // rose-700
    }
  }
  if (normalizedSummary.includes('confirmed')) {
    return {
      label: 'Confirmed',
      icon: CheckCircle,
      className: 'text-emerald-600',
      iconStyle: undefined as React.CSSProperties | undefined,
    }
  }
  if (normalizedSummary.includes('pending')) {
    return {
      label: 'Pending',
      icon: AlertTriangle,
      className: 'text-amber-600',
      iconStyle: undefined as React.CSSProperties | undefined,
    }
  }
  if (shift.status === 'fully_covered') {
    return {
      label: 'Confirmed',
      icon: CheckCircle,
      className: 'text-emerald-600',
      iconStyle: undefined as React.CSSProperties | undefined,
    }
  }
  return {
    label: 'No response',
    icon: HelpCircle,
    className: 'text-slate-500',
    iconStyle: undefined as React.CSSProperties | undefined,
  }
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
  const assignment = getAssignmentStatus(shift, responseSummary)
  const classroomStyle = getClassroomPillStyle(shift.classroom_color ?? null)
  const hasConfirmedSub = Boolean(shift.sub_name) && shift.status === 'fully_covered'
  const hasAssignedSub = Boolean(shift.sub_name) && Boolean(shift.sub_id)
  const isCovered = shift.status === 'fully_covered'

  const statusBorderColor = isCovered
    ? shiftStatusColorValues.available.border
    : shiftStatusColorValues.unavailable.border
  const statusIconCircleClass =
    'inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-slate-50'

  return (
    <div
      className={cn(
        'flex w-full max-w-none self-stretch min-w-0 items-start justify-between gap-6 rounded-lg border border-l-4 border-slate-200 bg-white px-4 py-3 shadow-sm transition-all hover:shadow-md hover:scale-[1.01]',
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

      <div className="flex flex-col gap-1 text-sm text-slate-700 min-w-[210px] justify-center self-center">
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
              <span className={statusIconCircleClass}>
                <coverage.icon
                  className={`h-3.5 w-3.5 ${coverage.className}`}
                  style={coverage.iconStyle}
                />
              </span>
              <span>{coverage.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={statusIconCircleClass}>
                <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
              </span>
              <span>{shift.sub_name}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className={statusIconCircleClass}>
                <coverage.icon
                  className={`h-3.5 w-3.5 ${coverage.className}`}
                  style={coverage.iconStyle}
                />
              </span>
              <span>{coverage.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={statusIconCircleClass}>
                <contact.icon className={`h-3.5 w-3.5 ${contact.className}`} />
              </span>
              <span>{contact.label}</span>
            </div>
            {responseSummary && contactedAvailableSubCount > 0 && (
              <div className="flex items-center gap-2">
                <span className={statusIconCircleClass}>
                  <assignment.icon
                    className={`h-3.5 w-3.5 ${assignment.className}`}
                    style={assignment.iconStyle}
                  />
                </span>
                <span className="leading-snug">{responseSummary}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
