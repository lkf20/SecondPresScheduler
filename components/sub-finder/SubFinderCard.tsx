'use client'

import { useEffect, useRef, useState } from 'react'
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
  showDebugOutlines?: boolean
  recommendedShiftCount?: number // Number of recommended shifts for this sub
  allShifts?: SubFinderShift[] // All shifts that need coverage
  allCanCover?: Shift[] // All shifts this sub can cover
  allCannotCover?: Shift[] // All shifts this sub cannot cover
  allAssigned?: Shift[] // All shifts this sub is assigned to
}

export default function SubFinderCard({
  id,
  name,
  phone,
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
  showDebugOutlines = false,
  recommendedShiftCount,
  allShifts = [],
  allCanCover = [],
  allCannotCover = [],
  allAssigned = [],
}: SubFinderCardProps) {
  const [isAllShiftsExpanded, setIsAllShiftsExpanded] = useState(false)
  const [isNoteExpanded, setIsNoteExpanded] = useState(false)
  const [isEditingNote, setIsEditingNote] = useState(false)
  const [noteDraft, setNoteDraft] = useState(notes || '')
  const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const coveredSegments = Math.min(shiftsCovered, totalShifts)
  const outline = (color: string) =>
    showDebugOutlines ? { outline: `1px solid ${color}` } : undefined

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
                  const colors =
                    orderedSegments === null
                      ? index < coveredSegments
                        ? shiftStatusColorValues.available
                        : shiftStatusColorValues.unavailable
                      : shiftStatusColorValues[status]
                  return (
                    <div
                      key={`segment-${index}`}
                      className="h-full rounded border"
                      style={{
                        width: '14px',
                        backgroundColor: colors.border,
                        borderColor: colors.border,
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

  useEffect(() => {
    if (!isEditingNote) {
      setNoteDraft(notes || '')
    }
  }, [notes, isEditingNote])

  useEffect(() => {
    if (isEditingNote) {
      noteTextareaRef.current?.focus()
    }
  }, [isEditingNote])

  return (
    <Card
      id={id}
      className={cn(
        'border border-slate-200 hover:shadow-md transition-shadow',
        highlighted && 'ring-2 ring-blue-500 ring-offset-2 animate-pulse',
        className
      )}
      role={undefined}
      tabIndex={undefined}
    >
      <CardContent className="pt-4 px-4 pb-1.5 flex flex-col gap-2" style={outline('#60a5fa')}>
        <div className="flex w-full items-start justify-between gap-4">
          <div className="min-w-0 flex-1 pr-2" style={outline('#34d399')}>
            <SubCardHeader
              name={name}
              phone={phone}
              shiftsCovered={shiftsCovered}
              totalShifts={totalShifts}
              isDeclined={isDeclined}
              showCoverage={false}
            />
          </div>
          <div className="ml-auto shrink-0" style={outline('#fbbf24')}>
            {renderCoverageBar()}
          </div>
        </div>

        <div className="flex w-full items-start justify-between gap-4">
          <div className="min-w-0 flex-1 pr-2 pb-4" style={outline('#7dd3fc')}>
            {(canCover.length > 0 ||
              cannotCover.length > 0 ||
              assigned.length > 0 ||
              (shiftChips?.length ?? 0) > 0) &&
              recommendedShiftCount === undefined && (
                <ShiftChips
                  canCover={canCover}
                  cannotCover={cannotCover}
                  assigned={assigned}
                  shifts={shiftChips}
                  isDeclined={isDeclined}
                  recommendedShifts={canCover}
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
          <div
            className="ml-auto flex flex-col items-end gap-2 shrink-0 pb-4"
            style={outline('#fbbf24')}
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
                  className={cn('h-3.5 w-3.5', isContacted ? 'text-emerald-600' : 'text-slate-400')}
                />
                <span>{isContacted ? 'Contacted' : 'Not contacted'}</span>
              </div>
              <div className={cn('flex items-center gap-2', responseMeta.className)}>
                <responseMeta.icon className="h-3.5 w-3.5" />
                <span>{responseMeta.label}</span>
              </div>
            </div>
          </div>
        </div>

        {(notes || isEditingNote || onSaveNote) && (
          <div className="w-full">
            <div className="flex w-full items-center justify-between rounded-md px-[3px] py-1 text-left text-sm font-medium text-slate-700 hover:bg-slate-100">
              {notes || isEditingNote ? (
                <button
                  type="button"
                  onClick={event => {
                    event.stopPropagation()
                    setIsNoteExpanded(prev => !prev)
                  }}
                  className="flex items-center gap-1"
                >
                  <span>Notes</span>
                  {isNoteExpanded ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </button>
              ) : null}
              {onSaveNote && !notes && !isEditingNote && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="pl-0"
                  onClick={event => {
                    event.stopPropagation()
                    setNoteDraft(notes || '')
                    setIsNoteExpanded(true)
                    setIsEditingNote(true)
                  }}
                >
                  + Add note
                </Button>
              )}
            </div>
            {isNoteExpanded && (
              <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {isEditingNote ? (
                  <div className="space-y-2">
                    <textarea
                      ref={noteTextareaRef}
                      value={noteDraft}
                      onChange={event => setNoteDraft(event.target.value)}
                      rows={3}
                      className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={event => {
                          event.stopPropagation()
                          setNoteDraft(notes || '')
                          setIsEditingNote(false)
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={async event => {
                          event.stopPropagation()
                          const next = noteDraft.trim()
                          try {
                            await onSaveNote?.(next.length > 0 ? next : null)
                          } catch (error) {
                            console.error('Failed to save sub note', error)
                          } finally {
                            setIsEditingNote(false)
                          }
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {notes ? <p>{notes}</p> : <p className="text-slate-500">No notes yet.</p>}
                    {onSaveNote && (
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={event => {
                            event.stopPropagation()
                            setNoteDraft(notes || '')
                            setIsNoteExpanded(true)
                            setIsEditingNote(true)
                          }}
                        >
                          {notes ? 'Edit' : 'Add note'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Recommended shifts section - full width */}
        {recommendedShiftCount !== undefined && recommendedShiftCount > 0 && (
          <div className="mb-0 -mt-1">
            <p className="text-sm text-muted-foreground mb-2">
              Recommended: {recommendedShiftCount} shift{recommendedShiftCount !== 1 ? 's' : ''}
            </p>
            {(canCover.length > 0 ||
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
                />
              </div>
            )}
          </div>
        )}

        {/* View all shifts collapsible section and Contact & Assign button - full width */}
        {allShifts &&
          allShifts.length > 0 &&
          (allCanCover.length > 0 || allCannotCover.length > 0) && (
            <div className="mb-0 -mt-1 flex items-center justify-between gap-4 border-t border-slate-200 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={event => {
                  event.stopPropagation()
                  setIsAllShiftsExpanded(!isAllShiftsExpanded)
                }}
                className="flex items-center gap-2 p-2 hover:underline hover:bg-transparent hover:text-slate-700 text-sm font-medium text-slate-700 justify-start"
              >
                <span>View all shifts</span>
                {isAllShiftsExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
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
            <div className="mb-4 mt-0">
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
              />
            </div>
          )}
      </CardContent>
    </Card>
  )
}
