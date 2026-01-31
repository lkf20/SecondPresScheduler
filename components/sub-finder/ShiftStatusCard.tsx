'use client'

import { CheckCircle, AlertTriangle, HelpCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getClassroomPillStyle } from '@/lib/utils/classroom-style'
import type { SubFinderShift } from '@/lib/sub-finder/types'

interface ShiftStatusCardProps {
  shift: SubFinderShift
  teacherName: string
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

function getContactStatus(shift: SubFinderShift) {
  // TODO: Wire to actual contact status once available in shift view model.
  if (shift.sub_name) {
    return { label: 'Contacted', icon: CheckCircle, className: 'text-emerald-600' }
  }
  return { label: 'Not contacted', icon: HelpCircle, className: 'text-slate-500' }
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

export default function ShiftStatusCard({ shift, teacherName }: ShiftStatusCardProps) {
  const coverage = getCoverageStatus(shift)
  const contact = getContactStatus(shift)
  const assignment = getAssignmentStatus(shift)
  const classroomStyle = getClassroomPillStyle(shift.classroom_color ?? null)
  const hasConfirmedSub = Boolean(shift.sub_name) && shift.status === 'fully_covered'
  const isCovered = shift.status === 'fully_covered'

  return (
    <div
      className={cn(
        'flex w-full max-w-none self-stretch min-w-0 items-start justify-between gap-6 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm',
        isCovered && 'opacity-60'
      )}
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
        <div className="mt-1 text-xs text-slate-600">Absence: {teacherName}</div>
      </div>

      <div className="flex flex-col gap-1 text-xs text-slate-700 min-w-[125px] justify-center self-center">
        <div className="flex items-center gap-2">
          <coverage.icon className={`h-4 w-4 ${coverage.className}`} />
          <span>{coverage.label}</span>
        </div>
        {hasConfirmedSub ? (
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <span>{shift.sub_name}</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <contact.icon className={`h-4 w-4 ${contact.className}`} />
              <span>{contact.label}</span>
            </div>
            {contact.label !== 'Not contacted' && (
              <div className="flex items-center gap-2">
                <assignment.icon className={`h-4 w-4 ${assignment.className}`} />
                <span>{assignment.label}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
