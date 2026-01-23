'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import type { RecommendedCombination as RecommendedCombinationType } from '@/lib/utils/sub-combination'
import type { SubCandidate, Absence } from '@/components/sub-finder/hooks/useSubFinderData'
import SubFinderCard from '@/components/sub-finder/SubFinderCard'

interface RecommendedCombinationProps {
  combinations: RecommendedCombinationType[]
  onContactSub: (subId: string) => void
  totalShifts: number
  useRemainingLabel?: boolean
  allSubs?: SubCandidate[] // All subs data to find can_cover/cannot_cover
  allShifts?: Absence['shifts']['shift_details'] // All shifts that need coverage
  includePastShifts?: boolean
}

export default function RecommendedCombination({
  combinations,
  onContactSub,
  totalShifts,
  useRemainingLabel = false,
  allSubs = [],
  allShifts = [],
  includePastShifts = false,
}: RecommendedCombinationProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  const totalCombinations = combinations.length
  const currentCombination = useMemo(
    () => combinations[currentIndex] ?? null,
    [combinations, currentIndex]
  )

  useEffect(() => {
    setCurrentIndex(0)
  }, [totalCombinations])

  if (!currentCombination || currentCombination.subs.length === 0) {
    return null
  }
  const isSingleSub = currentCombination.subs.length === 1

  const isShiftVisible = (date?: string) => {
    if (!date) return false
    if (includePastShifts) return true
    const shiftDate = new Date(`${date}T00:00:00`)
    shiftDate.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return shiftDate >= today
  }

  const visibleAllShifts = allShifts.filter((shift) => isShiftVisible(shift.date))
  const visibleTotalShifts = visibleAllShifts.length || totalShifts

  return (
    <Card className="mb-6 border border-amber-100 bg-amber-50/40 border-l-4 border-l-amber-400 shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">
              {isSingleSub ? 'Recommended Sub' : 'Recommended Combination'}
            </CardTitle>
          </div>
          <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-muted-foreground">
                {currentCombination.totalShiftsCovered} of {currentCombination.totalShiftsNeeded} shifts covered
            </span>
          </div>
            {currentCombination.totalConflicts > 0 && (
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-amber-700">
                  {currentCombination.totalConflicts} conflict
                  {currentCombination.totalConflicts !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Best combination using {currentCombination.subs.length} sub
          {currentCombination.subs.length !== 1 ? 's' : ''} to cover{' '}
          {currentCombination.coveragePercent}% of shifts
        </p>
      </CardHeader>
      <div className="space-y-4 px-6 pb-6">
        {currentCombination.subs.map((assignment) => {
          // Find the sub in allSubs to get can_cover and cannot_cover
          const subData = allSubs.find((s) => s.id === assignment.subId)
          const canCoverAll = (subData?.can_cover || []) as Array<{
            date: string
            time_slot_code: string
            classroom_name?: string | null
            class_name?: string | null
          }>
          const cannotCoverAll = (subData?.cannot_cover || []) as Array<{
            date: string
            time_slot_code: string
            classroom_name?: string | null
            class_name?: string | null
            reason?: string
          }>
          const assignedAll = (subData?.assigned_shifts || []) as Array<{
            date: string
            time_slot_code: string
            classroom_name?: string | null
            class_name?: string | null
          }>
          const visibleCanCoverAll = canCoverAll.filter((shift) => isShiftVisible(shift.date))
          const visibleCannotCoverAll = cannotCoverAll.filter((shift) => isShiftVisible(shift.date))
          const visibleRecommendedShifts = assignment.shifts.filter((shift) => isShiftVisible(shift.date))
          const visibleAssignedAll = assignedAll.filter((shift) => isShiftVisible(shift.date))
          const canCoverMap = new Set(
            visibleCanCoverAll.map((shift) => `${shift.date}|${shift.time_slot_code}`)
          )
          const assignedMap = new Set(
            visibleAssignedAll.map((shift) => `${shift.date}|${shift.time_slot_code}`)
          )
          const coverageSegments = visibleAllShifts.map((shift) => {
            const key = `${shift.date}|${shift.time_slot_code}`
            if (assignedMap.has(key)) {
              return 'assigned' as const
            }
            if (canCoverMap.has(key)) {
              return 'available' as const
            }
            return 'unavailable' as const
          })

          return (
            <SubFinderCard
              key={assignment.subId}
              id={`sub-card-${assignment.subId}`}
              name={assignment.subName}
              phone={assignment.phone}
              shiftsCovered={visibleCanCoverAll.length}
              totalShifts={visibleTotalShifts}
              useRemainingLabel={useRemainingLabel}
              canCover={visibleRecommendedShifts}
              cannotCover={[]}
              assigned={[]}
              conflicts={assignment.conflicts}
              onContact={() => onContactSub(assignment.subId)}
              recommendedShiftCount={visibleRecommendedShifts.length}
              allShifts={visibleAllShifts}
              allCanCover={visibleCanCoverAll}
              allCannotCover={visibleCannotCoverAll}
              allAssigned={visibleAssignedAll}
              coverageSegments={coverageSegments}
            />
          )
        })}
      </div>
      {totalCombinations > 1 && (
        <div className="flex items-center justify-center gap-3 px-6 pb-5">
          <button
            type="button"
            className="h-8 w-8 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
            disabled={currentIndex === 0}
            aria-label="Previous recommended combination"
          >
            <ChevronLeft className="h-4 w-4 mx-auto" />
          </button>
          <div className="flex items-center gap-2">
            {combinations.map((_, index) => (
              <button
                key={`combo-dot-${index}`}
                type="button"
                onClick={() => setCurrentIndex(index)}
                className={`h-2.5 w-2.5 rounded-full ${
                  index === currentIndex ? 'bg-amber-400' : 'bg-slate-300'
                }`}
                aria-label={`Recommended combination ${index + 1}`}
              />
            ))}
          </div>
          <button
            type="button"
            className="h-8 w-8 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            onClick={() => setCurrentIndex((prev) => Math.min(prev + 1, totalCombinations - 1))}
            disabled={currentIndex === totalCombinations - 1}
            aria-label="Next recommended combination"
          >
            <ChevronRight className="h-4 w-4 mx-auto" />
          </button>
        </div>
      )}
    </Card>
  )
}
