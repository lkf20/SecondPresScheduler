'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  HelpCircle,
  Mail,
  Phone,
  PhoneOff,
  XCircle,
} from 'lucide-react'
import ShiftChips from '@/components/sub-finder/ShiftChips'
import SubCardHeader from '@/components/sub-finder/SubCardHeader'
import { formatUSPhone, getPhoneDigits } from '@/lib/utils/phone'
import { cn } from '@/lib/utils'
import type { SubFinderShift } from '@/lib/sub-finder/types'
import { sortShiftDetailsByDisplayOrder } from '@/lib/utils/shift-display-order'

type Shift = {
  date: string
  day_name?: string
  time_slot_code: string
  class_name?: string | null
  classroom_name?: string | null
  classroom_color?: string | null
  reason?: string
  sub_name?: string | null
  assigned_sub_names?: string[]
  day_display_order?: number | null
  time_slot_display_order?: number | null
}

type ConflictCounts = {
  total: number
  missingDiaperChanging: number
  missingLifting: number
  missingQualifications: number
}

interface SubFinderCardProps {
  id?: string
  name: string
  phone: string | null
  email?: string | null
  shiftsCovered: number
  totalShifts: number
  useRemainingLabel?: boolean
  canCover: Shift[]
  cannotCover: Shift[]
  assigned?: Shift[]
  shiftChips?: Array<{
    date: string
    time_slot_code: string
    status: 'assigned' | 'available' | 'unavailable'
    reason?: string
    classroom_id?: string | null
    classroom_name?: string | null
    class_name?: string | null
    classroom_color?: string | null
    day_display_order?: number | null
    time_slot_display_order?: number | null
  }>
  coverageSegments?: Array<'assigned' | 'available' | 'unavailable'>
  notes?: string | null
  conflicts?: ConflictCounts
  isDeclined?: boolean
  highlighted?: boolean
  className?: string
  onContact?: () => void
  isContacted?: boolean
  responseStatus?: string | null
  /** Optional line shown under name (e.g. "Not contacted." or "Pending · Last contacted Monday Feb 4 at 2:15pm.") in small light gray */
  contactStatusLine?: string | null
  onSaveNote?: (nextNote: string | null) => Promise<void> | void
  recommendedShiftCount?: number // Number of recommended shifts for this sub
  /** When in recommended-combo mode, shifts we recommend assigning (amber dot). If omitted, canCover is used. */
  recommendedShifts?: Shift[]
  allShifts?: SubFinderShift[] // All shifts that need coverage
  allCanCover?: Shift[] // All shifts this sub can cover
  allCannotCover?: Shift[] // All shifts this sub cannot cover
  allAssigned?: Shift[] // All shifts this sub is assigned to
  softChipColors?: boolean
  condensedStatus?: boolean // Experimental: single-line status summary
  showPrimaryShiftChips?: boolean // Experimental: hide inline chips, show only "View all shifts"
  useStatusBadgeOnly?: boolean // Show compact status badge by name instead of right status stack
  /** When true, hide Contact & Assign (and Update) buttons. Use in Sub Finder preview mode. */
  previewMode?: boolean
}

export default function SubFinderCard({
  id,
  name,
  phone,
  email = null,
  shiftsCovered,
  totalShifts,
  useRemainingLabel = false,
  canCover = [],
  cannotCover = [],
  assigned = [],
  shiftChips,
  coverageSegments,
  notes,
  conflicts,
  isDeclined = false,
  highlighted = false,
  className,
  onContact,
  isContacted = false,
  responseStatus = null,
  contactStatusLine = null,
  onSaveNote,
  recommendedShiftCount,
  recommendedShifts,
  allShifts = [],
  allCanCover = [],
  allCannotCover = [],
  allAssigned = [],
  softChipColors = true,
  condensedStatus = false,
  showPrimaryShiftChips = true,
  useStatusBadgeOnly = false,
  previewMode = false,
}: SubFinderCardProps) {
  const [isAllShiftsExpanded, setIsAllShiftsExpanded] = useState(false)
  const [noteDraft, setNoteDraft] = useState(notes || '')
  const [isSavingNote, setIsSavingNote] = useState(false)
  const coveredSegments = Math.min(shiftsCovered, totalShifts)
  const thisSubAssignedKeys = new Set(
    allAssigned.map(shift => `${shift.date}|${shift.time_slot_code}`)
  )
  const thisSubCanCoverKeys = new Set(
    allCanCover.map(shift => `${shift.date}|${shift.time_slot_code}`)
  )
  const recommendedShiftKeys = new Set(
    (recommendedShifts ?? canCover).map(shift => `${shift.date}|${shift.time_slot_code}`)
  )
  const thisSubCannotCoverReason = new Map(
    allCannotCover.map(shift => [
      `${shift.date}|${shift.time_slot_code}`,
      shift.reason ?? undefined,
    ])
  )

  const isAssigned = assigned.length > 0
  const resolvedResponseStatus = responseStatus ?? (isDeclined ? 'declined_all' : null)
  const responseMeta =
    resolvedResponseStatus === 'confirmed'
      ? { label: 'Confirmed', icon: CheckCircle, className: 'text-emerald-600' }
      : resolvedResponseStatus === 'pending'
        ? { label: 'Pending', icon: Clock, className: 'text-amber-600' }
        : resolvedResponseStatus === 'declined_all'
          ? { label: 'Declined', icon: XCircle, className: 'text-rose-600' }
          : { label: 'No response yet', icon: HelpCircle, className: 'text-slate-500' }
  const shouldShowResponseStatus =
    isContacted ||
    resolvedResponseStatus === 'pending' ||
    resolvedResponseStatus === 'confirmed' ||
    resolvedResponseStatus === 'declined_all'
  const statusBadge = isDeclined
    ? {
        label: 'Declined',
        icon: XCircle,
        className: 'border-rose-200 bg-rose-50 text-rose-600',
      }
    : isAssigned
      ? {
          label: 'Assigned',
          icon: CheckCircle,
          className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        }
      : isContacted
        ? {
            label: 'Contacted',
            icon: Phone,
            className: 'border-sky-200 bg-sky-50 text-sky-700',
          }
        : {
            label: 'Not contacted',
            icon: PhoneOff,
            className: 'border-slate-200 bg-slate-100 text-slate-500',
          }
  const showCompactStatusBadge = condensedStatus || useStatusBadgeOnly
  const isCompactLayout = condensedStatus || useStatusBadgeOnly
  const hasRecommendedSubset = recommendedShiftCount !== undefined && recommendedShiftCount > 0
  const orderedShiftsForStrip =
    allShifts && allShifts.length > 0 ? sortShiftDetailsByDisplayOrder([...allShifts]) : []
  const declinedCardStyle = isDeclined
    ? ({
        backgroundColor: 'rgb(241, 245, 249)', // slate-100
        borderColor: 'rgb(203, 213, 225)', // slate-300
      } as React.CSSProperties)
    : undefined

  useEffect(() => {
    setNoteDraft(notes || '')
  }, [notes])

  const handleNoteBlur = async () => {
    if (!onSaveNote) return
    const next = noteDraft.trim()
    const normalizedNext = next.length > 0 ? next : null
    const normalizedCurrent = notes?.trim() ? notes.trim() : null
    if (normalizedNext === normalizedCurrent) return

    try {
      setIsSavingNote(true)
      await onSaveNote(normalizedNext)
    } catch (error) {
      console.error('Failed to save sub note', error)
      setNoteDraft(notes || '')
    } finally {
      setIsSavingNote(false)
    }
  }

  return (
    <Card
      id={id}
      className={cn(
        'group/subcard border border-slate-200 transition-all hover:shadow-md hover:scale-[1.01]',
        isDeclined && 'border-slate-300',
        highlighted && 'ring-2 ring-blue-500 ring-offset-2 animate-pulse',
        className
      )}
      style={declinedCardStyle}
      role={undefined}
      tabIndex={undefined}
    >
      <CardContent
        className={cn(
          'px-4 flex flex-col',
          isCompactLayout ? 'pt-2.5 pb-0.5 gap-0.5' : 'pt-4 pb-1.5 gap-2'
        )}
      >
        <div className="flex w-full items-start justify-between gap-4">
          <div className="min-w-0 flex-1 pr-2">
            <SubCardHeader
              name={name}
              phone={phone}
              email={email}
              statusBadge={showCompactStatusBadge ? statusBadge : null}
              statusLine={
                contactStatusLine ? (
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border border-slate-200 bg-slate-100 font-medium text-slate-600',
                      isCompactLayout ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
                    )}
                  >
                    {contactStatusLine}
                  </span>
                ) : undefined
              }
              shiftsCovered={shiftsCovered}
              totalShifts={totalShifts}
              isDeclined={isDeclined}
              showCoverage={false}
              showCoverageBadge={true}
              hideContactInHeader
              compactSpacing={isCompactLayout}
              compactBadge={isCompactLayout}
            />
          </div>
        </div>

        {/* Shifts dropdown: own row below sub name, left (declined / non-recommended cards only) */}
        {!hasRecommendedSubset &&
          allShifts &&
          allShifts.length > 0 &&
          (allCanCover.length > 0 || allCannotCover.length > 0) && (
            <div className="flex items-center">
              <Button
                type="button"
                variant="ghost"
                onClick={event => {
                  event.stopPropagation()
                  setIsAllShiftsExpanded(!isAllShiftsExpanded)
                }}
                className="flex items-center gap-1.5 p-2 -ml-2 hover:bg-transparent hover:text-slate-700 text-sm font-medium text-slate-700 justify-start"
              >
                <span className="text-slate-400">Shifts</span>
                <span className="inline-flex items-center">
                  {isAllShiftsExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </span>
              </Button>
            </div>
          )}

        {hasRecommendedSubset && orderedShiftsForStrip.length > 0 && (
          <div className="w-full mt-3 mb-2">
            <ShiftChips
              mode="availability"
              canCover={allCanCover}
              cannotCover={allCannotCover}
              thisSubName={name}
              shifts={orderedShiftsForStrip.map(shift => {
                const key = `${shift.date}|${shift.time_slot_code}`
                const explicitlyCannotCover = thisSubCannotCoverReason.has(key)
                const canCoverThisSub =
                  thisSubAssignedKeys.has(key) ||
                  thisSubCanCoverKeys.has(key) ||
                  recommendedShiftKeys.has(key)
                const assignedToThisSub = thisSubAssignedKeys.has(key)
                const assignedToOtherSub = shift.status !== 'uncovered' && !assignedToThisSub
                const inferredAvailableFromExistingCoverage =
                  assignedToOtherSub && !explicitlyCannotCover
                const mappedAssignedSubNames =
                  Array.isArray(shift.assigned_sub_names) && shift.assigned_sub_names.length > 0
                    ? shift.assigned_sub_names
                    : shift.sub_name
                      ? [shift.sub_name]
                      : []
                return {
                  date: shift.date,
                  time_slot_code: shift.time_slot_code,
                  status: assignedToThisSub
                    ? ('assigned' as const)
                    : canCoverThisSub || inferredAvailableFromExistingCoverage
                      ? ('available' as const)
                      : ('unavailable' as const),
                  assignment_owner: assignedToThisSub
                    ? ('this_sub' as const)
                    : assignedToOtherSub
                      ? ('other_sub' as const)
                      : undefined,
                  assigned_sub_name: assignedToOtherSub
                    ? (mappedAssignedSubNames[0] ?? shift.sub_name ?? null)
                    : null,
                  assigned_sub_names:
                    assignedToOtherSub && mappedAssignedSubNames.length > 0
                      ? mappedAssignedSubNames
                      : undefined,
                  reason: thisSubCannotCoverReason.get(key),
                  classroom_id: shift.classroom_id ?? null,
                  classroom_name: shift.classroom_name ?? null,
                  class_name: shift.class_name ?? null,
                  classroom_color: shift.classroom_color ?? null,
                  day_display_order: shift.day_display_order ?? null,
                  time_slot_display_order: shift.time_slot_display_order ?? null,
                }
              })}
              recommendedShifts={hasRecommendedSubset ? (recommendedShifts ?? canCover) : []}
              softAvailableStyle={softChipColors}
            />
            {!previewMode && onContact && (
              <div className="mt-6 border-t border-slate-200 pt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  {phone && (
                    <a
                      href={`tel:+1${getPhoneDigits(phone).replace(/^1/, '')}`}
                      className="inline-flex items-center gap-1.5 font-medium hover:text-slate-800 hover:underline"
                      onClick={e => e.stopPropagation()}
                    >
                      <Phone className="h-4 w-4 text-slate-500 shrink-0" />
                      {formatUSPhone(phone)}
                    </a>
                  )}
                  {email && (
                    <a
                      href={`mailto:${email}`}
                      className="inline-flex items-center gap-1.5 font-medium hover:text-slate-800 hover:underline"
                      onClick={e => e.stopPropagation()}
                    >
                      <Mail className="h-4 w-4 text-slate-500 shrink-0" />
                      {email}
                    </a>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="default"
                  className="text-base shrink-0"
                  onClick={event => {
                    event.stopPropagation()
                    onContact?.()
                  }}
                >
                  Contact & Assign
                </Button>
              </div>
            )}
          </div>
        )}

        <div
          className={cn(
            'flex w-full items-start justify-between gap-4',
            isCompactLayout && '-mt-1.5'
          )}
        >
          <div className={cn('min-w-0 flex-1 pr-2', isCompactLayout ? 'pb-2' : 'pb-4')}>
            {recommendedShiftCount !== undefined && recommendedShiftCount > 0
              ? null
              : showPrimaryShiftChips &&
                (canCover.length > 0 ||
                  cannotCover.length > 0 ||
                  assigned.length > 0 ||
                  (shiftChips?.length ?? 0) > 0) && (
                  <ShiftChips
                    mode="availability"
                    canCover={canCover}
                    cannotCover={cannotCover}
                    assigned={assigned}
                    shifts={shiftChips}
                    isDeclined={isDeclined}
                    recommendedShifts={canCover}
                    softAvailableStyle={softChipColors}
                  />
                )}

            {conflicts && conflicts.total > 0 && (
              <div className="mb-3 rounded-md bg-amber-50 border border-amber-200 p-2.5 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Conflicts:</span>
                </div>
                <div className="text-xs text-amber-700 space-y-0.5 ml-5">
                  {conflicts.missingDiaperChanging > 0 && (
                    <div>
                      • Missing diaper changing skill for {conflicts.missingDiaperChanging} shift
                      {conflicts.missingDiaperChanging !== 1 ? 's' : ''}
                    </div>
                  )}
                  {conflicts.missingLifting > 0 && (
                    <div>
                      • Missing lifting children skill for {conflicts.missingLifting} shift
                      {conflicts.missingLifting !== 1 ? 's' : ''}
                    </div>
                  )}
                  {conflicts.missingQualifications > 0 && (
                    <div>
                      • Missing class qualifications for {conflicts.missingQualifications} shift
                      {conflicts.missingQualifications !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          {!showCompactStatusBadge && (
            <div
              className={cn(
                'ml-auto flex flex-col items-end gap-2 shrink-0',
                condensedStatus ? 'pb-2' : 'pb-4'
              )}
            >
              <div
                className={cn(
                  'flex flex-col items-start gap-2 border-l-4 pl-2 text-sm leading-5 text-slate-600',
                  responseMeta.className === 'text-emerald-600'
                    ? 'border-emerald-500'
                    : responseMeta.className === 'text-amber-600'
                      ? 'border-amber-500'
                      : responseMeta.className === 'text-rose-600'
                        ? 'border-rose-500'
                        : 'border-slate-300'
                )}
              >
                <div className="flex items-center gap-2">
                  {isAssigned ? (
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span>{isAssigned ? 'Assigned' : 'Unassigned'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone
                    className={cn(
                      'h-3.5 w-3.5',
                      isContacted ? 'text-emerald-600' : 'text-slate-400'
                    )}
                  />
                  <span>{isContacted ? 'Contacted' : 'Not contacted'}</span>
                </div>
                {shouldShowResponseStatus && (
                  <div className={cn('flex items-center gap-2', responseMeta.className)}>
                    <responseMeta.icon className="h-3.5 w-3.5" />
                    <span>{responseMeta.label}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {onSaveNote && (
          <div className={cn('w-full', isCompactLayout ? 'mt-1' : 'mt-0')}>
            <textarea
              value={noteDraft}
              onChange={event => setNoteDraft(event.target.value)}
              onBlur={handleNoteBlur}
              rows={1}
              placeholder="Add note..."
              className={cn(
                'w-full resize-none rounded-md border border-transparent bg-transparent px-1 text-sm text-slate-600 placeholder:text-slate-400 focus:border-slate-200 focus:bg-white focus:outline-none',
                isCompactLayout ? 'py-0 leading-tight' : 'py-0.5'
              )}
            />
            {isSavingNote && <div className="px-1 text-xs text-slate-400">Saving...</div>}
          </div>
        )}

        {allShifts &&
          allShifts.length > 0 &&
          (allCanCover.length > 0 || allCannotCover.length > 0) &&
          isAllShiftsExpanded && (
            <div className="mb-4 mt-1 border-t border-slate-200 pt-2">
              {hasRecommendedSubset && (
                <p className="mb-2 text-xs text-slate-500">
                  Recommended shifts are marked with an amber dot.
                </p>
              )}
              <ShiftChips
                mode="availability"
                canCover={allCanCover}
                cannotCover={allCannotCover}
                thisSubName={name}
                shifts={allShifts.map(shift => {
                  const key = `${shift.date}|${shift.time_slot_code}`
                  const explicitlyCannotCover = thisSubCannotCoverReason.has(key)
                  const canCoverThisSub =
                    thisSubAssignedKeys.has(key) || thisSubCanCoverKeys.has(key)
                  const assignedToThisSub = thisSubAssignedKeys.has(key)
                  const assignedToOtherSub = shift.status !== 'uncovered' && !assignedToThisSub
                  const inferredAvailableFromExistingCoverage =
                    assignedToOtherSub && !explicitlyCannotCover
                  // Chip color reflects whether this sub can cover; if assigned elsewhere but sub can cover, show green
                  const status = assignedToThisSub
                    ? 'assigned'
                    : canCoverThisSub || inferredAvailableFromExistingCoverage
                      ? 'available'
                      : 'unavailable'
                  return {
                    date: shift.date,
                    time_slot_code: shift.time_slot_code,
                    status: status as 'assigned' | 'available' | 'unavailable',
                    assignment_owner: assignedToThisSub
                      ? ('this_sub' as const)
                      : assignedToOtherSub
                        ? ('other_sub' as const)
                        : undefined,
                    assigned_sub_name: assignedToOtherSub ? shift.sub_name || null : null,
                    assigned_sub_names:
                      assignedToOtherSub &&
                      Array.isArray(shift.assigned_sub_names) &&
                      shift.assigned_sub_names.length > 0
                        ? shift.assigned_sub_names
                        : undefined,
                    reason: thisSubCannotCoverReason.get(key),
                    classroom_id: shift.classroom_id ?? null,
                    classroom_name: shift.classroom_name || null,
                    class_name: shift.class_name || null,
                    classroom_color: shift.classroom_color ?? null,
                    day_display_order: shift.day_display_order ?? null,
                    time_slot_display_order: shift.time_slot_display_order ?? null,
                  }
                })}
                isDeclined={isDeclined}
                recommendedShifts={hasRecommendedSubset ? (recommendedShifts ?? canCover) : []}
                softAvailableStyle={softChipColors}
                showLegend
              />
            </div>
          )}

        {/* Bottom section: divider above, then phone/email bottom left, Update / Contact & Assign right */}
        {!previewMode && !hasRecommendedSubset && onContact && (
          <div
            className={cn('mt-6 border-t border-slate-200 pt-4 pb-4', isCompactLayout && '-mt-2')}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                {phone && (
                  <a
                    href={`tel:+1${getPhoneDigits(phone).replace(/^1/, '')}`}
                    className="inline-flex items-center gap-1.5 font-medium hover:text-slate-800 hover:underline"
                    onClick={e => e.stopPropagation()}
                  >
                    <Phone className="h-4 w-4 text-slate-500 shrink-0" />
                    {formatUSPhone(phone)}
                  </a>
                )}
                {email && (
                  <a
                    href={`mailto:${email}`}
                    className="inline-flex items-center gap-1.5 font-medium hover:text-slate-800 hover:underline"
                    onClick={e => e.stopPropagation()}
                  >
                    <Mail className="h-4 w-4 text-slate-500 shrink-0" />
                    {email}
                  </a>
                )}
              </div>
              <Button
                size="sm"
                variant="teal"
                className={cn(
                  'text-base shrink-0',
                  isDeclined && 'bg-slate-100 hover:bg-teal-700 hover:text-white'
                )}
                onClick={event => {
                  event.stopPropagation()
                  onContact?.()
                }}
              >
                {isDeclined ? 'Update' : 'Contact & Assign'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
