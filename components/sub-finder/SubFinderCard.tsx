'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import ShiftChips from '@/components/sub-finder/ShiftChips'
import SubCardHeader from '@/components/sub-finder/SubCardHeader'
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
  notes?: string
  conflicts?: ConflictCounts
  isDeclined?: boolean
  highlighted?: boolean
  className?: string
  onContact?: () => void
  showDebugOutlines?: boolean
}

export default function SubFinderCard({
  id,
  name,
  phone,
  shiftsCovered,
  totalShifts,
  useRemainingLabel = false,
  canCover,
  cannotCover,
  assigned = [],
  shiftChips,
  notes,
  conflicts,
  isDeclined = false,
  highlighted = false,
  className,
  onContact,
  showDebugOutlines = false,
}: SubFinderCardProps) {
  const coveredSegments = Math.min(shiftsCovered, totalShifts)
  const outline = (color: string) => (showDebugOutlines ? { outline: `1px solid ${color}` } : undefined)

  const renderCoverageBar = () => {
    if (isDeclined) {
      return <p className="text-xs text-muted-foreground">Declined all shifts</p>
    }
    return (
      <div className="text-right flex flex-col items-end">
        <div className="mb-1.5">
          <div className="h-2 min-w-[64px] rounded-full overflow-hidden flex gap-0.5">
            {totalShifts === 0 ? (
              <div
                className="h-full w-[14px] rounded border"
                style={{
                  backgroundColor: '#d1d5db',
                  borderColor: '#d1d5db',
                }}
              />
            ) : (
              Array.from({ length: totalShifts }).map((_, index) => {
                const colors =
                  index < coveredSegments
                    ? { backgroundColor: '#a7f3d0', borderColor: '#a7f3d0' }
                    : { backgroundColor: '#d1d5db', borderColor: '#d1d5db' }
                return (
                  <div
                    key={`segment-${index}`}
                    className="h-full rounded border"
                    style={{
                      width: '14px',
                      ...colors,
                    }}
                  />
                )
              })
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
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
        className="pt-4 px-4 pb-1.5 flex items-stretch gap-4"
        style={outline('#60a5fa')}
      >
        <div className="min-w-0 flex-1 pr-2" style={outline('#34d399')}>
          <SubCardHeader
            name={name}
            phone={phone}
            shiftsCovered={shiftsCovered}
            totalShifts={totalShifts}
            isDeclined={isDeclined}
            showCoverage={false}
          />

          {(canCover.length > 0 || cannotCover.length > 0 || assigned.length > 0 || (shiftChips?.length ?? 0) > 0) && (
            <div className="mb-3 w-full" style={outline('#7dd3fc')}>
              <ShiftChips
                canCover={canCover}
                cannotCover={cannotCover}
                assigned={assigned}
                shifts={shiftChips}
                isDeclined={isDeclined}
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
        <div className="ml-auto flex flex-col justify-between items-end shrink-0" style={outline('#fbbf24')}>
          {renderCoverageBar()}
          <Button
            size="sm"
            variant="ghost"
            className="-mr-2 text-primary hover:text-primary hover:bg-primary/10"
            onClick={() => onContact?.()}
          >
            Contact & Assign <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
