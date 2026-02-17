'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  HelpCircle,
  Phone,
  PhoneOff,
  XCircle,
} from 'lucide-react'
import ShiftChips from '@/components/sub-finder/ShiftChips'
import SubCardHeader from '@/components/sub-finder/SubCardHeader'
import { shiftStatusColorValues } from '@/lib/utils/colors'
import { cn } from '@/lib/utils'
import type { SubFinderShift } from '@/lib/sub-finder/types'

type Shift = {
  date: string
  day_name?: string
  time_slot_code: string
  class_name?: string | null
  classroom_name?: string | null
  reason?: string
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
    classroom_name?: string | null
    class_name?: string | null
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
  onSaveNote?: (nextNote: string | null) => Promise<void> | void
  recommendedShiftCount?: number // Number of recommended shifts for this sub
  allShifts?: SubFinderShift[] // All shifts that need coverage
  allCanCover?: Shift[] // All shifts this sub can cover
  allCannotCover?: Shift[] // All shifts this sub cannot cover
  allAssigned?: Shift[] // All shifts this sub is assigned to
  softChipColors?: boolean
  condensedStatus?: boolean // Experimental: single-line status summary
  showPrimaryShiftChips?: boolean // Experimental: hide inline chips, show only "View all shifts"
}

const SHOW_DEBUG_BORDERS = false

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
  onSaveNote,
  recommendedShiftCount,
  allShifts = [],
  allCanCover = [],
  allCannotCover = [],
  allAssigned = [],
  softChipColors = true,
  condensedStatus = false,
  showPrimaryShiftChips = true,
}: SubFinderCardProps) {
  const [isAllShiftsExpanded, setIsAllShiftsExpanded] = useState(false)
  const [noteDraft, setNoteDraft] = useState(notes || '')
  const [isSavingNote, setIsSavingNote] = useState(false)
  const coveredSegments = Math.min(shiftsCovered, totalShifts)
  // Build map of assigned/available/unavailable shifts for "View all shifts" section
  const allShiftsStatusMap = new Map<string, 'assigned' | 'available' | 'unavailable'>()
  if (
    allShifts &&
    allShifts.length > 0 &&
    (allCanCover.length > 0 || allCannotCover.length > 0 || allAssigned.length > 0)
  ) {
    allAssigned.forEach(shift => {
      const key = `${shift.date}|${shift.time_slot_code}`
      allShiftsStatusMap.set(key, 'assigned')
    })
    // Add can cover shifts
    allCanCover.forEach(shift => {
      const key = `${shift.date}|${shift.time_slot_code}`
      if (!allShiftsStatusMap.has(key)) {
        allShiftsStatusMap.set(key, 'available')
      }
    })

    // Add cannot cover shifts
    allCannotCover.forEach(shift => {
      const key = `${shift.date}|${shift.time_slot_code}`
      // Only set if not already marked as available
      if (!allShiftsStatusMap.has(key)) {
        allShiftsStatusMap.set(key, 'unavailable')
      }
    })
  }

  const renderCoverageBar = () => {
    if (isDeclined) {
      return <p className="text-xs text-muted-foreground">Declined all shifts</p>
    }
    const softSegmentColors = {
      assigned: 'rgb(191, 219, 254)', // blue-200
      available: 'rgb(186, 225, 210)', // soft mint-green with slight blue tone
      unavailable: 'rgb(229, 231, 235)', // gray-200
    } as const
    const normalizedSegments = coverageSegments?.length
      ? ([
          ...coverageSegments.slice(0, totalShifts),
          ...Array.from({ length: Math.max(0, totalShifts - coverageSegments.length) }).fill(
            'unavailable' as const
          ),
        ] as Array<'assigned' | 'available' | 'unavailable'>)
      : null
    const orderedSegments = normalizedSegments
      ? [...normalizedSegments].sort((a, b) => {
          const order: Record<'assigned' | 'available' | 'unavailable', number> = {
            assigned: 0,
            available: 1,
            unavailable: 2,
          }
          return order[a] - order[b]
        })
      : null
    return (
      <div className="text-right flex w-full flex-col items-end">
        <div className="mb-1.5 flex w-full justify-end">
          <div className="h-2 rounded-full overflow-hidden flex gap-0.5">
            {totalShifts === 0 ? (
              <div
                className="h-full w-[14px] rounded border"
                style={{
                  backgroundColor: shiftStatusColorValues.unavailable.border,
                  borderColor: shiftStatusColorValues.unavailable.border,
                }}
              />
            ) : (
              (orderedSegments ?? Array.from({ length: totalShifts }).map(() => 'available')).map(
                (status, index) => {
                  const segmentColor =
                    orderedSegments === null
                      ? index < coveredSegments
                        ? softSegmentColors.available
                        : softSegmentColors.unavailable
                      : status === 'assigned'
                        ? softSegmentColors.assigned
                        : status === 'available'
                          ? softSegmentColors.available
                          : softSegmentColors.unavailable
                  return (
                    <div
                      key={`segment-${index}`}
                      className="h-full rounded border"
                      style={{
                        width: '14px',
                        backgroundColor: segmentColor,
                        borderColor: segmentColor,
                      }}
                    />
                  )
                }
              )
            )}
          </div>
        </div>
        <p className="text-xs text-teal-600">
          {shiftsCovered} of {totalShifts} {useRemainingLabel ? 'remaining shifts' : 'shifts'}
        </p>
      </div>
    )
  }

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
  const statusBadge = isAssigned
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
        'group/subcard border border-slate-200 hover:shadow-md transition-shadow',
        highlighted && 'ring-2 ring-blue-500 ring-offset-2 animate-pulse',
        className
      )}
      role={undefined}
      tabIndex={undefined}
    >
      <CardContent
        className={cn(
          'px-4 flex flex-col',
          condensedStatus ? 'pt-2.5 pb-0.5 gap-0.5' : 'pt-4 pb-1.5 gap-2',
          SHOW_DEBUG_BORDERS && 'border border-fuchsia-400'
        )}
      >
        <div
          className={cn(
            'flex w-full items-start justify-between gap-4',
            SHOW_DEBUG_BORDERS && 'border border-blue-400'
          )}
        >
          <div
            className={cn('min-w-0 flex-1 pr-2', SHOW_DEBUG_BORDERS && 'border border-cyan-400')}
          >
            <SubCardHeader
              name={name}
              phone={phone}
              email={email}
              statusBadge={condensedStatus ? statusBadge : null}
              shiftsCovered={shiftsCovered}
              totalShifts={totalShifts}
              isDeclined={isDeclined}
              showCoverage={false}
              compactSpacing={condensedStatus}
            />
          </div>
          <div className={cn('ml-auto shrink-0', SHOW_DEBUG_BORDERS && 'border border-teal-400')}>
            {renderCoverageBar()}
          </div>
        </div>

        <div
          className={cn(
            'flex w-full items-start justify-between gap-4',
            condensedStatus && '-mt-1.5',
            SHOW_DEBUG_BORDERS && 'border border-violet-400'
          )}
        >
          <div
            className={cn(
              'min-w-0 flex-1 pr-2',
              condensedStatus ? 'pb-1' : 'pb-4',
              SHOW_DEBUG_BORDERS && 'border border-amber-400'
            )}
          >
            {recommendedShiftCount !== undefined && recommendedShiftCount > 0 ? (
              <>
                <p
                  className={cn(
                    'text-muted-foreground',
                    condensedStatus ? 'text-xs mb-1' : 'text-sm mb-2'
                  )}
                >
                  Recommended: {recommendedShiftCount} shift
                  {recommendedShiftCount !== 1 ? 's' : ''}
                </p>
                {showPrimaryShiftChips &&
                  (canCover.length > 0 ||
                    cannotCover.length > 0 ||
                    assigned.length > 0 ||
                    (shiftChips?.length ?? 0) > 0) && (
                    <div className="w-full">
                      <ShiftChips
                        canCover={canCover}
                        cannotCover={cannotCover}
                        assigned={assigned}
                        shifts={shiftChips}
                        isDeclined={isDeclined}
                        recommendedShifts={canCover}
                        softAvailableStyle={softChipColors}
                      />
                    </div>
                  )}
              </>
            ) : (
              showPrimaryShiftChips &&
              (canCover.length > 0 ||
                cannotCover.length > 0 ||
                assigned.length > 0 ||
                (shiftChips?.length ?? 0) > 0) && (
                <ShiftChips
                  canCover={canCover}
                  cannotCover={cannotCover}
                  assigned={assigned}
                  shifts={shiftChips}
                  isDeclined={isDeclined}
                  recommendedShifts={canCover}
                  softAvailableStyle={softChipColors}
                />
              )
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
          {!condensedStatus && (
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
          <div
            className={cn(
              'w-full',
              condensedStatus ? 'mt-2' : 'mt-0',
              SHOW_DEBUG_BORDERS && 'border border-red-400'
            )}
          >
            <textarea
              value={noteDraft}
              onChange={event => setNoteDraft(event.target.value)}
              onBlur={handleNoteBlur}
              rows={1}
              placeholder="Add note..."
              className={cn(
                'w-full resize-none rounded-md border border-transparent bg-transparent px-1 text-sm text-slate-600 placeholder:text-slate-400 focus:border-slate-200 focus:bg-white focus:outline-none',
                condensedStatus ? 'py-0 leading-tight' : 'py-0.5'
              )}
            />
            {isSavingNote && <div className="px-1 text-xs text-slate-400">Saving...</div>}
          </div>
        )}

        {/* View all shifts collapsible section and Contact & Assign button - full width */}
        {allShifts &&
          allShifts.length > 0 &&
          (allCanCover.length > 0 || allCannotCover.length > 0) && (
            <div
              className={cn(
                'mb-0 flex items-center justify-between gap-4',
                condensedStatus ? '-mt-2 pt-0.5' : '-mt-1 pt-1',
                SHOW_DEBUG_BORDERS && 'border border-lime-500'
              )}
            >
              <Button
                type="button"
                variant="ghost"
                onClick={event => {
                  event.stopPropagation()
                  setIsAllShiftsExpanded(!isAllShiftsExpanded)
                }}
                className="flex items-center gap-1.5 p-2 hover:bg-transparent hover:text-slate-700 text-sm font-medium text-slate-700 justify-start"
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
              {onContact && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="hover:bg-primary/10 -mr-2"
                  style={{ color: '#115E59' }}
                  onClick={event => {
                    event.stopPropagation()
                    onContact?.()
                  }}
                >
                  Contact & Assign <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
                </Button>
              )}
            </div>
          )}

        {/* Contact & Assign button when View all shifts is not shown */}
        {(!allShifts ||
          allShifts.length === 0 ||
          (allCanCover.length === 0 && allCannotCover.length === 0)) &&
          onContact && (
            <div className="mb-3 flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                className="hover:bg-primary/10 -mr-2"
                style={{ color: '#115E59' }}
                onClick={event => {
                  event.stopPropagation()
                  onContact?.()
                }}
              >
                Contact & Assign <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
              </Button>
            </div>
          )}

        {allShifts &&
          allShifts.length > 0 &&
          (allCanCover.length > 0 || allCannotCover.length > 0) &&
          isAllShiftsExpanded && (
            <div className={cn('mb-4 mt-0', SHOW_DEBUG_BORDERS && 'border border-orange-400')}>
              <ShiftChips
                canCover={allCanCover}
                cannotCover={allCannotCover}
                shifts={allShifts.map(shift => {
                  const key = `${shift.date}|${shift.time_slot_code}`
                  const status = allShiftsStatusMap.get(key) || 'unavailable'
                  return {
                    date: shift.date,
                    time_slot_code: shift.time_slot_code,
                    status:
                      status === 'assigned'
                        ? 'assigned'
                        : status === 'available'
                          ? 'available'
                          : 'unavailable',
                    classroom_name: shift.classroom_name || null,
                    class_name: shift.class_name || null,
                  }
                })}
                isDeclined={isDeclined}
                recommendedShifts={canCover}
                softAvailableStyle={softChipColors}
              />
            </div>
          )}
      </CardContent>
    </Card>
  )
}
