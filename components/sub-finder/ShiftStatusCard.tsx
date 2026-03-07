'use client'

import { useMemo } from 'react'
import {
  Check,
  CheckCircle,
  AlertTriangle,
  Phone,
  PhoneOff,
  XCircle,
  ArrowRightLeft,
  ArrowRight,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { getClassroomPillStyle } from '@/lib/utils/classroom-style'
import {
  coverageColorValues,
  contactStatusColorValues,
  shiftStatusColorValues,
} from '@/lib/utils/colors'
import type { SubFinderShift } from '@/lib/sub-finder/types'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export type ContactedSubStatus = 'pending' | 'confirmed' | 'declined'

interface ShiftStatusCardProps {
  shift: SubFinderShift
  teacherName: string
  contactedAvailableSubCount?: number
  /** Per-sub list for uncovered shifts: used for counts and tooltips (e.g. "4 contacted · 3 pending · 1 declined"). Include id for clickable names. */
  contactedSubsForShift?: Array<{ id: string; name: string; status: ContactedSubStatus }>
  responseSummary?: string
  onSelectShift?: (shift: SubFinderShift) => void
  onRemoveSub?: (shift: SubFinderShift) => void
  onChangeSub?: (shift: SubFinderShift) => void
  /** When provided, tooltip names are clickable and open the Contact & Assign panel for that sub. */
  onSelectSubForContact?: (subId: string) => void
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
      icon: PhoneOff,
      className: 'text-slate-500',
    }
  }
  return { label: 'No subs contacted', icon: PhoneOff, className: 'text-slate-500' }
}

type ContactedSubItem = { id: string; name: string }

function UncoveredCountsRow({
  contactedSubsForShift,
  contact,
  statusIconCircleClass,
  onSelectSubForContact,
}: {
  contactedSubsForShift: Array<{ id: string; name: string; status: ContactedSubStatus }>
  contact: { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
  statusIconCircleClass: string
  onSelectSubForContact?: (subId: string) => void
}) {
  const { contacted, pending, declined } = useMemo(() => {
    const pendingList: ContactedSubItem[] = []
    const declinedList: ContactedSubItem[] = []
    const confirmedList: ContactedSubItem[] = []
    contactedSubsForShift.forEach(({ id, name, status }) => {
      const item = { id, name }
      if (status === 'pending') pendingList.push(item)
      else if (status === 'declined') declinedList.push(item)
      else confirmedList.push(item)
    })
    const sortByName = (a: ContactedSubItem, b: ContactedSubItem) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    return {
      contacted: [...pendingList, ...confirmedList, ...declinedList].sort(sortByName),
      pending: pendingList.sort(sortByName),
      declined: declinedList.sort(sortByName),
    }
  }, [contactedSubsForShift])

  const segmentSpacing = { marginRight: '2rem' }
  return (
    <div className="flex min-w-0 flex-wrap items-center text-base text-slate-700">
      {contacted.length > 0 ? (
        <TooltipProvider>
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex cursor-default items-center gap-1.5"
                  style={segmentSpacing}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: contactStatusColorValues.contacted.circleBg }}
                    aria-hidden
                  >
                    <Phone
                      className="h-4 w-4"
                      style={{ color: contactStatusColorValues.contacted.icon }}
                      aria-hidden
                    />
                  </span>
                  {contacted.length} contacted
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="font-medium text-slate-800">Contacted</p>
                <ul className="mt-1 list-none text-sm text-slate-700">
                  {contacted.map(({ id, name }) =>
                    onSelectSubForContact ? (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation()
                            onSelectSubForContact(id)
                          }}
                          className="text-left text-teal-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 rounded px-0.5 -mx-0.5"
                        >
                          {name}
                        </button>
                      </li>
                    ) : (
                      <li key={id}>{name}</li>
                    )
                  )}
                </ul>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex cursor-default items-center gap-1.5"
                  style={segmentSpacing}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: contactStatusColorValues.pending.circleBg }}
                    aria-hidden
                  >
                    <Clock
                      className="h-4 w-4"
                      style={{ color: contactStatusColorValues.pending.icon }}
                      aria-hidden
                    />
                  </span>
                  {pending.length} pending
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="font-medium text-slate-800">Pending</p>
                <ul className="mt-1 list-none text-sm text-slate-700">
                  {pending.length > 0 ? (
                    pending.map(({ id, name }) =>
                      onSelectSubForContact ? (
                        <li key={id}>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              onSelectSubForContact(id)
                            }}
                            className="text-left text-teal-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 rounded px-0.5 -mx-0.5"
                          >
                            {name}
                          </button>
                        </li>
                      ) : (
                        <li key={id}>{name}</li>
                      )
                    )
                  ) : (
                    <li className="text-slate-500">None</li>
                  )}
                </ul>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex cursor-default items-center gap-1.5">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: contactStatusColorValues.declined.circleBg }}
                    aria-hidden
                  >
                    <XCircle
                      className="h-4 w-4"
                      style={{ color: contactStatusColorValues.declined.icon }}
                      aria-hidden
                    />
                  </span>
                  {declined.length} declined
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="font-medium text-slate-800">Declined</p>
                <ul className="mt-1 list-none text-sm text-slate-700">
                  {declined.length > 0 ? (
                    declined.map(({ id, name }) =>
                      onSelectSubForContact ? (
                        <li key={id}>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              onSelectSubForContact(id)
                            }}
                            className="text-left text-teal-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 rounded px-0.5 -mx-0.5"
                          >
                            {name}
                          </button>
                        </li>
                      ) : (
                        <li key={id}>{name}</li>
                      )
                    )
                  ) : (
                    <li className="text-slate-500">None</li>
                  )}
                </ul>
              </TooltipContent>
            </Tooltip>
          </>
        </TooltipProvider>
      ) : (
        <div className="flex items-center gap-2">
          <span className={statusIconCircleClass}>
            <contact.icon className={`h-4 w-4 ${contact.className}`} />
          </span>
          <span>{contact.label}</span>
        </div>
      )}
    </div>
  )
}

export default function ShiftStatusCard({
  shift,
  teacherName,
  contactedAvailableSubCount = 0,
  contactedSubsForShift = [],
  responseSummary,
  onSelectShift,
  onRemoveSub,
  onChangeSub,
  onSelectSubForContact,
}: ShiftStatusCardProps) {
  const coverage = getCoverageStatus(shift)
  const contact = getContactStatus(contactedAvailableSubCount)
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
        'flex w-full max-w-none self-stretch min-w-0 items-start justify-between gap-6 rounded-lg border border-l-4 border-slate-200 bg-white px-4 py-3 shadow transition-all hover:shadow-lg hover:scale-[1.01]',
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
      {!hasAssignedSub && !hasConfirmedSub ? (
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex justify-between items-start gap-6">
            <div className="min-w-0 flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-slate-900">
                {formatShiftLabel(shift)}
              </span>
              {shift.classroom_name && (
                <span
                  className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700"
                  style={classroomStyle}
                >
                  {shift.classroom_name}
                </span>
              )}
            </div>
            <span
              className="inline-flex min-h-[1.5rem] shrink-0 items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-medium"
              style={{
                backgroundColor: coverageColorValues.uncovered.bg,
                borderColor: coverageColorValues.uncovered.border,
                color: coverageColorValues.uncovered.text,
              }}
            >
              <coverage.icon className="h-4 w-4 shrink-0" style={coverage.iconStyle} aria-hidden />
              {coverage.label}
            </span>
          </div>
          <div className="text-base text-slate-500">Absence: {teacherName}</div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <UncoveredCountsRow
              contactedSubsForShift={contactedSubsForShift}
              contact={contact}
              statusIconCircleClass={statusIconCircleClass}
              onSelectSubForContact={onSelectSubForContact}
            />
            {onSelectShift && (
              <Button
                type="button"
                variant="teal"
                size="sm"
                aria-label="Find sub for this shift"
                onClick={e => {
                  e.stopPropagation()
                  onSelectShift(shift)
                }}
                className="shrink-0 gap-1.5"
              >
                Find Sub <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold text-slate-900">
                  {formatShiftLabel(shift)}
                </span>
                {shift.classroom_name && (
                  <span
                    className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700"
                    style={classroomStyle}
                  >
                    {shift.classroom_name}
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-base text-slate-600">Absence: {teacherName}</div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 text-base text-slate-700 min-w-[220px] justify-center self-center">
            {hasAssignedSub ? (
              <div className="mt-2">
                <div className="flex items-center justify-between gap-3">
                  <p
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-base font-semibold leading-tight"
                    style={{
                      backgroundColor: 'rgb(204, 251, 241)',
                      color: 'rgb(15, 118, 110)',
                      borderColor: 'rgb(153, 246, 228)',
                    }}
                  >
                    <Check className="h-4 w-4" style={{ color: 'rgb(15, 118, 110)' }} />
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
                      className={`h-4 w-4 ${coverage.className}`}
                      style={coverage.iconStyle}
                    />
                  </span>
                  <span className="text-base font-medium">{coverage.label}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={statusIconCircleClass}>
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                  </span>
                  <span className="text-base">{shift.sub_name}</span>
                </div>
              </>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
