'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import type { RecommendedCombination as RecommendedCombinationType } from '@/lib/utils/sub-combination'
import type { SubCandidate, Absence } from '@/components/sub-finder/hooks/useSubFinderData'
import SubFinderCard from '@/components/sub-finder/SubFinderCard'
import { getShiftKey } from '@/lib/sub-finder/shift-helpers'

interface RecommendedCombinationProps {
  combinations: RecommendedCombinationType[]
  /** Omit or pass undefined in preview mode to hide Contact & Assign */
  onContactSub?: (subId: string) => void
  /** When true, sub cards hide Contact & Assign buttons (preview-only mode). */
  previewMode?: boolean
  totalShifts: number
  useRemainingLabel?: boolean
  allSubs?: SubCandidate[] // All subs data to find can_cover/cannot_cover
  allShifts?: Absence['shifts']['shift_details'] // All shifts that need coverage
  includePastShifts?: boolean
  onShowAllSubs?: () => void
}

export default function RecommendedCombination({
  combinations,
  onContactSub,
  previewMode = false,
  totalShifts,
  useRemainingLabel = false,
  allSubs = [],
  allShifts = [],
  includePastShifts = false,
  onShowAllSubs,
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

  const isShiftVisible = (date?: string) => {
    if (!date) return false
    if (includePastShifts) return true
    const shiftDate = new Date(`${date}T00:00:00`)
    shiftDate.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return shiftDate >= today
  }

  const visibleAllShifts = allShifts.filter(shift => isShiftVisible(shift.date))
  const visibleRemainingShifts = useRemainingLabel
    ? visibleAllShifts.filter(shift => shift.status === 'uncovered')
    : visibleAllShifts
  const visibleTotalShifts = visibleRemainingShifts.length || totalShifts
  const toCoverageKey = (shift: {
    date: string
    time_slot_code: string
    classroom_id?: string | null
    classroom_name?: string | null
  }) =>
    getShiftKey({
      date: shift.date,
      time_slot_code: shift.time_slot_code,
      classroom_id: shift.classroom_id ?? null,
      classroom_name: shift.classroom_name ?? null,
    })

  const headerTotalShifts =
    visibleAllShifts.length || totalShifts || (currentCombination?.totalShiftsNeeded ?? 0)

  const headerCoveredShifts = useMemo(() => {
    if (!currentCombination || currentCombination.subs.length === 0) {
      return 0
    }
    if (allSubs.length === 0) {
      return Math.min(currentCombination.totalShiftsCovered, headerTotalShifts)
    }

    const targetShifts = useRemainingLabel ? visibleRemainingShifts : visibleAllShifts
    const targetKeys = new Set(targetShifts.map(shift => toCoverageKey(shift as any)))
    if (targetKeys.size === 0) {
      return Math.min(currentCombination.totalShiftsCovered, headerTotalShifts)
    }

    const coveredKeys = new Set<string>()
    currentCombination.subs.forEach(assignment => {
      const subData = allSubs.find(sub => sub.id === assignment.subId)
      ;(subData?.can_cover || []).forEach(shift => {
        const key = toCoverageKey({
          date: shift.date,
          time_slot_code: shift.time_slot_code,
          classroom_id: (shift as { classroom_id?: string | null }).classroom_id ?? null,
          classroom_name: shift.classroom_name ?? null,
        })
        if (targetKeys.has(key)) {
          coveredKeys.add(key)
        }
      })
    })

    return coveredKeys.size
  }, [
    allSubs,
    currentCombination,
    headerTotalShifts,
    useRemainingLabel,
    visibleAllShifts,
    visibleRemainingShifts,
  ])

  if (!currentCombination || currentCombination.subs.length === 0) {
    return null
  }
  const isSingleSub = currentCombination.subs.length === 1

  return (
    <Card
      className="mb-6 rounded-xl border-2 bg-white shadow-sm"
      style={{ borderColor: '#fbbf24' }}
    >
      <CardHeader className="pb-8">
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-normal">
              {isSingleSub ? 'Recommended Sub' : 'Recommended Sub Combination'}
            </CardTitle>
            <span className="h-4 w-px bg-slate-300" aria-hidden="true" />
            <div className="flex items-center gap-1.5 text-base">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-muted-foreground">
                {headerCoveredShifts} of {headerTotalShifts} shifts covered
                {!isSingleSub &&
                  ` by ${currentCombination.subs.length} sub${currentCombination.subs.length !== 1 ? 's' : ''}`}
              </span>
            </div>
          </div>
        </div>
        {currentCombination.totalConflicts > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-amber-700">
              {currentCombination.totalConflicts} conflict
              {currentCombination.totalConflicts !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </CardHeader>
      <div className="space-y-4 px-6 pb-6 pt-2">
        {currentCombination.subs.map(assignment => {
          // Find the sub in allSubs to get can_cover and cannot_cover
          const subData = allSubs.find(s => s.id === assignment.subId)
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
          const visibleCanCoverAll = canCoverAll.filter(shift => isShiftVisible(shift.date))
          const visibleCannotCoverAll = cannotCoverAll.filter(shift => isShiftVisible(shift.date))
          const visibleRecommendedShifts = assignment.shifts.filter(shift =>
            isShiftVisible(shift.date)
          )
          const visibleAssignedAll = assignedAll.filter(shift => isShiftVisible(shift.date))
          const canCoverMap = new Set(
            visibleCanCoverAll.map(shift =>
              getShiftKey({
                date: shift.date,
                time_slot_code: shift.time_slot_code,
                classroom_id: (shift as { classroom_id?: string | null }).classroom_id ?? null,
                classroom_name: shift.classroom_name ?? null,
              })
            )
          )
          const assignedMap = new Set(
            visibleAssignedAll.map(shift =>
              getShiftKey({
                date: shift.date,
                time_slot_code: shift.time_slot_code,
                classroom_id: (shift as { classroom_id?: string | null }).classroom_id ?? null,
                classroom_name: shift.classroom_name ?? null,
              })
            )
          )
          const remainingShiftKeys = new Set(
            visibleRemainingShifts.map(shift =>
              getShiftKey({
                date: shift.date,
                time_slot_code: shift.time_slot_code,
                classroom_id: shift.classroom_id ?? null,
                classroom_name: shift.classroom_name ?? null,
              })
            )
          )
          const shiftsCovered = visibleCanCoverAll.filter(shift =>
            remainingShiftKeys.has(
              getShiftKey({
                date: shift.date,
                time_slot_code: shift.time_slot_code,
                classroom_id: (shift as { classroom_id?: string | null }).classroom_id ?? null,
                classroom_name: shift.classroom_name ?? null,
              })
            )
          ).length
          const coverageSegments = visibleRemainingShifts.map(shift => {
            const key = getShiftKey({
              date: shift.date,
              time_slot_code: shift.time_slot_code,
              classroom_id: shift.classroom_id ?? null,
              classroom_name: shift.classroom_name ?? null,
            })
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
              email={assignment.email ?? subData?.email ?? null}
              shiftsCovered={shiftsCovered}
              totalShifts={visibleTotalShifts}
              useRemainingLabel={useRemainingLabel}
              canCover={visibleCanCoverAll}
              cannotCover={[]}
              assigned={[]}
              conflicts={assignment.conflicts}
              contactStatusLine="Not contacted."
              onContact={onContactSub ? () => onContactSub(assignment.subId) : undefined}
              previewMode={previewMode}
              recommendedShifts={visibleRecommendedShifts}
              recommendedShiftCount={visibleRecommendedShifts.length}
              allShifts={visibleAllShifts}
              allCanCover={visibleCanCoverAll}
              allCannotCover={visibleCannotCoverAll}
              allAssigned={visibleAssignedAll}
              coverageSegments={coverageSegments}
              useStatusBadgeOnly
              showPrimaryShiftChips={false}
              className="shadow-lg bg-slate-50"
            />
          )
        })}
      </div>
      {totalCombinations > 1 && (
        <div className="flex items-center justify-center px-6 pb-5">
          {totalCombinations > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                className="h-8 w-8 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                onClick={() => setCurrentIndex(prev => Math.max(prev - 1, 0))}
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
                onClick={() => setCurrentIndex(prev => Math.min(prev + 1, totalCombinations - 1))}
                disabled={currentIndex === totalCombinations - 1}
                aria-label="Next recommended combination"
              >
                <ChevronRight className="h-4 w-4 mx-auto" />
              </button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
