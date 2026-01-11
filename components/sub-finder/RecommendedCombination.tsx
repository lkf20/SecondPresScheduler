'use client'

import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { RecommendedCombination as RecommendedCombinationType } from '@/lib/utils/sub-combination'
import SubFinderCard from '@/components/sub-finder/SubFinderCard'

interface RecommendedCombinationProps {
  combination: RecommendedCombinationType | null
  onContactSub: (subId: string) => void
}

export default function RecommendedCombination({
  combination,
  onContactSub,
}: RecommendedCombinationProps) {
  // Only show if combination requires more than 1 sub
  if (!combination || combination.subs.length <= 1) {
    return null
  }

  return (
    <Card className="mb-6 border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Recommended Combination</CardTitle>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-muted-foreground">
                {combination.totalShiftsCovered} of {combination.totalShiftsNeeded} shifts covered
              </span>
            </div>
            {combination.totalConflicts > 0 && (
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-amber-700">
                  {combination.totalConflicts} conflict{combination.totalConflicts !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Best combination using {combination.subs.length} sub{combination.subs.length !== 1 ? 's' : ''} to cover{' '}
          {combination.coveragePercent}% of shifts
        </p>
      </CardHeader>
      <div className="space-y-4 px-6 pb-6">
        {combination.subs.map((assignment) => (
          <SubFinderCard
            key={assignment.subId}
            name={assignment.subName}
            phone={assignment.phone}
            shiftsCovered={assignment.shiftsCovered}
            totalShifts={assignment.totalShifts}
            canCover={assignment.shifts}
            cannotCover={[]}
            assigned={[]}
            conflicts={assignment.conflicts}
            onContact={() => onContactSub(assignment.subId)}
          />
        ))}
      </div>
    </Card>
  )
}
