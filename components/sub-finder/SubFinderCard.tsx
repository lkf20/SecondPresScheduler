'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'
import ShiftChips from '@/components/sub-finder/ShiftChips'
import SubCardHeader from '@/components/sub-finder/SubCardHeader'
import { shiftStatusColorValues } from '@/lib/utils/colors'
import { cn } from '@/lib/utils'

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
  showDebugOutlines?: boolean
  recommendedShiftCount?: number // Number of recommended shifts for this sub
  allShifts?: Array<{ // All shifts that need coverage
    id: string
    date: string
    day_name: string
    time_slot_code: string
    classroom_name?: string | null
    class_name?: string | null
  }>
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
  showDebugOutlines = false,
  recommendedShiftCount,
  allShifts = [],
  allCanCover = [],
  allCannotCover = [],
  allAssigned = [],
}: SubFinderCardProps) {
  const [isAllShiftsExpanded, setIsAllShiftsExpanded] = useState(false)
  const coveredSegments = Math.min(shiftsCovered, totalShifts)
  const outline = (color: string) => (showDebugOutlines ? { outline: `1px solid ${color}` } : undefined)

  // Build map of assigned/available/unavailable shifts for "View all shifts" section
  const allShiftsStatusMap = new Map<string, 'assigned' | 'available' | 'unavailable'>()
  if (allShifts && allShifts.length > 0 && (allCanCover.length > 0 || allCannotCover.length > 0 || allAssigned.length > 0)) {
    allAssigned.forEach((shift) => {
      const key = `${shift.date}|${shift.time_slot_code}`
      allShiftsStatusMap.set(key, 'assigned')
    })
    // Add can cover shifts
    allCanCover.forEach((shift) => {
      const key = `${shift.date}|${shift.time_slot_code}`
      if (!allShiftsStatusMap.has(key)) {
        allShiftsStatusMap.set(key, 'available')
      }
    })
    
    // Add cannot cover shifts
    allCannotCover.forEach((shift) => {
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
      ? [
          ...coverageSegments.slice(0, totalShifts),
          ...Array.from({ length: Math.max(0, totalShifts - coverageSegments.length) }).fill(
            'unavailable'
          ),
        ]
      : null
    const orderedSegments = normalizedSegments
      ? [...normalizedSegments].sort((a, b) => {
          const order = { assigned: 0, available: 1, unavailable: 2 }
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

  return (
    <Card
      id={id}
      className={cn(
        'hover:shadow-md transition-shadow',
        highlighted && 'ring-2 ring-blue-500 ring-offset-2 animate-pulse',
        className
      )}
    >
      <CardContent
        className="pt-4 px-4 pb-1.5 flex flex-col gap-2"
        style={outline('#60a5fa')}
      >
        <div className="flex w-full items-stretch justify-between gap-4">
          <div className="min-w-0 flex-1 pr-2" style={outline('#34d399')}>
            <SubCardHeader
              name={name}
              phone={phone}
              shiftsCovered={shiftsCovered}
              totalShifts={totalShifts}
              isDeclined={isDeclined}
              showCoverage={false}
            />

            {(canCover.length > 0 || cannotCover.length > 0 || assigned.length > 0 || (shiftChips?.length ?? 0) > 0) && recommendedShiftCount === undefined && (
              <div className="mb-3 w-full" style={outline('#7dd3fc')}>
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

          {notes && (
            <div className="mb-3 p-2 bg-muted rounded border border-border/50 text-xs text-muted-foreground">
              {notes}
            </div>
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
                    • Missing diaper changing skill for {conflicts.missingDiaperChanging} shift{conflicts.missingDiaperChanging !== 1 ? 's' : ''}
                  </div>
                )}
                {conflicts.missingLifting > 0 && (
                  <div>
                    • Missing lifting children skill for {conflicts.missingLifting} shift{conflicts.missingLifting !== 1 ? 's' : ''}
                  </div>
                )}
                {conflicts.missingQualifications > 0 && (
                  <div>
                    • Missing class qualifications for {conflicts.missingQualifications} shift{conflicts.missingQualifications !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div
          className="ml-auto flex flex-col justify-between items-end shrink-0"
          style={outline('#fbbf24')}
        >
          {renderCoverageBar()}
        </div>
      </div>

      {/* Recommended shifts section - full width */}
      {recommendedShiftCount !== undefined && recommendedShiftCount > 0 && (
        <div className="mb-0 -mt-1">
          <p className="text-sm text-muted-foreground mb-2">
            Recommended: {recommendedShiftCount} shift{recommendedShiftCount !== 1 ? 's' : ''}
          </p>
          {(canCover.length > 0 || cannotCover.length > 0 || assigned.length > 0 || (shiftChips?.length ?? 0) > 0) && (
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
      {allShifts && allShifts.length > 0 && (allCanCover.length > 0 || allCannotCover.length > 0) && (
        <div className="mb-0 -mt-1 flex items-center justify-between gap-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsAllShiftsExpanded(!isAllShiftsExpanded)}
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
              onClick={() => onContact?.()}
            >
              Contact & Assign <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
            </Button>
          )}
        </div>
      )}
      
      {/* Contact & Assign button when View all shifts is not shown */}
      {(!allShifts || allShifts.length === 0 || (allCanCover.length === 0 && allCannotCover.length === 0)) && onContact && (
        <div className="mb-3 flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            className="hover:bg-primary/10 -mr-2"
            style={{ color: '#115E59' }}
            onClick={() => onContact?.()}
          >
            Contact & Assign <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
          </Button>
        </div>
      )}
      
      {allShifts && allShifts.length > 0 && (allCanCover.length > 0 || allCannotCover.length > 0) && isAllShiftsExpanded && (
        <div className="mb-4 mt-0">
          <ShiftChips
            canCover={allCanCover}
            cannotCover={allCannotCover}
            shifts={allShifts.map((shift) => {
              const key = `${shift.date}|${shift.time_slot_code}`
      const status = allShiftsStatusMap.get(key) || 'unavailable'
      return {
        date: shift.date,
        time_slot_code: shift.time_slot_code,
        status: status === 'assigned' ? 'assigned' : status === 'available' ? 'available' : 'unavailable',
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
