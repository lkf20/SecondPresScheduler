'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Users, CheckCircle2, ArrowRight } from 'lucide-react'
import ShiftChips from '@/components/sub-finder/ShiftChips'
import SubCardHeader from '@/components/sub-finder/SubCardHeader'
import type { RecommendedCombination as RecommendedCombinationType } from '@/lib/utils/sub-combination'

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
      <CardContent className="space-y-4">
        {combination.subs.map((assignment) => (
          <div
            key={assignment.subId}
            className="border rounded-lg p-4 bg-gray-50/50 hover:shadow-md hover:bg-gray-50 transition-all"
          >
            <SubCardHeader
              name={assignment.subName}
              phone={assignment.phone}
              shiftsCovered={assignment.shiftsCovered}
              totalShifts={assignment.totalShifts}
              coveragePercent={assignment.coveragePercent}
            />

            {/* Shifts */}
            {assignment.shifts.length > 0 && (
              <div className="mb-3">
                <ShiftChips
                  canCover={assignment.shifts}
                  cannotCover={[]}
                  assigned={[]}
                />
              </div>
            )}

            {/* Conflicts Warning */}
            {assignment.conflicts.total > 0 && (
              <div className="mb-3 rounded-md bg-amber-50 border border-amber-200 p-2.5 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Conflicts:</span>
                </div>
                <div className="text-xs text-amber-700 space-y-0.5 ml-5">
                  {assignment.conflicts.missingDiaperChanging > 0 && (
                    <div>
                      • Missing diaper changing skill for {assignment.conflicts.missingDiaperChanging} shift{assignment.conflicts.missingDiaperChanging !== 1 ? 's' : ''}
                    </div>
                  )}
                  {assignment.conflicts.missingLifting > 0 && (
                    <div>
                      • Missing lifting children skill for {assignment.conflicts.missingLifting} shift{assignment.conflicts.missingLifting !== 1 ? 's' : ''}
                    </div>
                  )}
                  {assignment.conflicts.missingQualifications > 0 && (
                    <div>
                      • Missing class qualifications for {assignment.conflicts.missingQualifications} shift{assignment.conflicts.missingQualifications !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                className="text-primary hover:text-primary hover:bg-primary/10"
                onClick={() => onContactSub(assignment.subId)}
              >
                Contact & Assign <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

