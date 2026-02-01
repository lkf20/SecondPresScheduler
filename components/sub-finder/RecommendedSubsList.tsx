'use client'

import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import SubFinderCard from '@/components/sub-finder/SubFinderCard'
import type { SubCandidate } from '@/components/sub-finder/hooks/useSubFinderData'
import type { SubFinderShift } from '@/lib/sub-finder/types'
import { filterVisibleShifts, getShiftKey } from '@/lib/sub-finder/shift-helpers'
import { parseLocalDate } from '@/lib/utils/date'
import { DAY_NAMES, MONTH_NAMES } from '@/lib/utils/date-format'

type RecommendedSub = SubCandidate

interface RecommendedSubsListProps {
  subs: SubCandidate[]
  loading: boolean
  absence: {
    id: string
    teacher_name: string
    start_date: string
    end_date: string | null
  }
  shiftDetails: SubFinderShift[]
  showAllSubs?: boolean
  onContactSub?: (sub: SubCandidate) => void
  hideHeader?: boolean
  highlightedSubId?: string | null
  includePastShifts?: boolean
}

export default function RecommendedSubsList({
  subs,
  loading,
  absence,
  shiftDetails,
  showAllSubs = false,
  onContactSub,
  hideHeader = false,
  highlightedSubId = null,
  includePastShifts = false,
}: RecommendedSubsListProps) {
  const [isDeclinedExpanded, setIsDeclinedExpanded] = useState(false)
  const loggedCoverageMismatchRef = useRef(new Set<string>())
  const loggedAssignedMismatchRef = useRef<Set<string>>(new Set())

  // Format date as "Mon Jan 11"
  const formatDate = (dateString: string) => {
    const date = parseLocalDate(dateString)
    const dayName = DAY_NAMES[date.getDay()]
    const month = MONTH_NAMES[date.getMonth()]
    const day = date.getDate()
    return `${dayName} ${month} ${day}`
  }

  // Format date range for display
  const formatDateRange = () => {
    const startDate = formatDate(absence.start_date)
    if (absence.end_date && absence.end_date !== absence.start_date) {
      const endDate = formatDate(absence.end_date)
      return `${startDate} - ${endDate}`
    }
    return startDate
  }
  const classroomLookup = useMemo(() => {
    if (loading || subs.length === 0) {
      return new Map<string, string>()
    }

    const lookup = new Map<string, string>()
    shiftDetails.forEach(shift => {
      if (shift.classroom_name) {
        lookup.set(getShiftKey(shift), shift.classroom_name)
      }
    })
    return lookup
  }, [shiftDetails, loading, subs])

  const visibleAbsenceShifts = useMemo(
    () => filterVisibleShifts(shiftDetails, includePastShifts),
    [shiftDetails, includePastShifts]
  )

  const visibleShiftKeys = useMemo(() => {
    const keys = new Set<string>()
    visibleAbsenceShifts.forEach(shift => {
      keys.add(getShiftKey(shift))
    })
    return keys
  }, [visibleAbsenceShifts])

  const derived = useMemo(() => {
    if (loading || subs.length === 0) {
      return {
        totalShiftsNeedingCoverage: 0,
        remainingShiftCount: 0,
        hasAssignedShifts: false,
        remainingShiftKeys: new Set<string>(),
        nonDeclinedSubs: [] as Array<{
          sub: RecommendedSub
          shiftsCovered: number
          isDeclined: boolean
        }>,
        declinedSubs: [] as Array<{
          sub: RecommendedSub
          shiftsCovered: number
          isDeclined: boolean
        }>,
        canPaginate: false,
      }
    }

    const fallbackShiftKeys = new Set(visibleAbsenceShifts.map(shift => getShiftKey(shift)))
    const totalShiftsNeedingCoverage = subs[0]?.total_shifts || fallbackShiftKeys.size
    const hasRemainingShiftMeta = Array.isArray(subs[0]?.remaining_shift_keys)
    const remainingShiftKeys = hasRemainingShiftMeta
      ? new Set(subs[0]?.remaining_shift_keys)
      : new Set<string>()
    let hasAssignedShifts = subs[0]?.has_assigned_shifts ?? false

    if (!hasRemainingShiftMeta) {
      const allShiftsNeedingCoverage = new Set<string>()
      subs.forEach(s => {
        s.can_cover?.forEach(shift => {
          const key = `${shift.date}|${shift.time_slot_code}`
          allShiftsNeedingCoverage.add(key)
        })
        s.cannot_cover?.forEach(shift => {
          const key = `${shift.date}|${shift.time_slot_code}`
          allShiftsNeedingCoverage.add(key)
        })
        s.assigned_shifts?.forEach(shift => {
          const key = `${shift.date}|${shift.time_slot_code}`
          allShiftsNeedingCoverage.add(key)
        })
      })

      const allAssignedShifts = new Set<string>()
      subs.forEach(s => {
        s.assigned_shifts?.forEach(shift => {
          const key = `${shift.date}|${shift.time_slot_code}`
          allAssignedShifts.add(key)
        })
      })

      allShiftsNeedingCoverage.forEach(shiftKey => {
        if (!allAssignedShifts.has(shiftKey)) {
          remainingShiftKeys.add(shiftKey)
        }
      })

      hasAssignedShifts = allAssignedShifts.size > 0
    }
    if (remainingShiftKeys.size === 0 && fallbackShiftKeys.size > 0) {
      fallbackShiftKeys.forEach(key => remainingShiftKeys.add(key))
    }
    if (visibleShiftKeys.size > 0) {
      Array.from(remainingShiftKeys).forEach(key => {
        if (!visibleShiftKeys.has(key)) {
          remainingShiftKeys.delete(key)
        }
      })
    }
    const uncoveredShiftKeys = new Set(
      visibleAbsenceShifts
        .filter(shift => shift.status === 'uncovered')
        .map(shift => `${shift.date}|${shift.time_slot_code}`)
    )
    if (uncoveredShiftKeys.size > 0) {
      Array.from(remainingShiftKeys).forEach(key => {
        if (!uncoveredShiftKeys.has(key)) {
          remainingShiftKeys.delete(key)
        }
      })
    }
    if (!hasAssignedShifts) {
      hasAssignedShifts = visibleAbsenceShifts.some(
        shift => shift.status && shift.status !== 'uncovered'
      )
    }

    const isDeclined = (sub: RecommendedSub) => sub.response_status === 'declined_all'

    const processedSubs = subs.map(sub => {
      let shiftsCovered = 0
      const countedShiftKeys = new Set<string>()
      sub.can_cover?.forEach(shift => {
        const shiftKey = `${shift.date}|${shift.time_slot_code}`
        if (remainingShiftKeys.has(shiftKey) && !countedShiftKeys.has(shiftKey)) {
          shiftsCovered++
          countedShiftKeys.add(shiftKey)
        }
      })
      const isTargetAbsence =
        absence.teacher_name === 'Kim B.' &&
        absence.start_date === '2026-01-19' &&
        absence.end_date === '2026-01-23'
      const isTargetSub = sub.name?.startsWith('Laura O.')
      if (isTargetAbsence && isTargetSub) {
        const logKey = `${absence.id}|${sub.id}`
        if (!loggedCoverageMismatchRef.current.has(logKey)) {
          loggedCoverageMismatchRef.current.add(logKey)
          console.warn('[Sub Finder Debug] Remaining coverage mismatch check', {
            absence_id: absence.id,
            sub_id: sub.id,
            shiftsCovered,
            remainingShiftCount: remainingShiftKeys.size,
            remainingShiftKeys: Array.from(remainingShiftKeys),
            countedShiftKeys: Array.from(countedShiftKeys),
          })
        }
      }

      return { sub, shiftsCovered, isDeclined: isDeclined(sub) }
    })

    let filteredSubs = processedSubs.filter(({ shiftsCovered, isDeclined }) => {
      if (isDeclined) return true
      if (!showAllSubs) {
        return shiftsCovered > 0
      }
      return true
    })

    if (!showAllSubs && filteredSubs.length === 0 && processedSubs.length > 0) {
      filteredSubs = processedSubs
    }

    const nonDeclinedSubs = filteredSubs.filter(({ isDeclined }) => !isDeclined)
    let declinedSubs: Array<{ sub: RecommendedSub; shiftsCovered: number; isDeclined: boolean }> =
      []

    nonDeclinedSubs.sort((a, b) => b.shiftsCovered - a.shiftsCovered)
    if (isDeclinedExpanded) {
      declinedSubs = filteredSubs.filter(({ isDeclined }) => isDeclined)
      declinedSubs.sort((a, b) => b.shiftsCovered - a.shiftsCovered)
    }

    return {
      totalShiftsNeedingCoverage,
      remainingShiftCount: remainingShiftKeys.size,
      hasAssignedShifts,
      remainingShiftKeys,
      nonDeclinedSubs,
      declinedSubs,
      canPaginate: false, // Always show all subs in scrollable list
    }
  }, [
    isDeclinedExpanded,
    loading,
    showAllSubs,
    subs,
    visibleShiftKeys,
    visibleAbsenceShifts,
    absence.id,
    absence.start_date,
    absence.end_date,
    absence.teacher_name,
  ])

  const filterSubShifts = <
    T extends {
      date?: string
      time_slot_code?: string
      classroom_name?: string | null
      class_name?: string | null
      status?: 'uncovered' | 'partially_covered' | 'fully_covered'
    },
  >(
    shifts?: T[]
  ) => {
    const filtered = (shifts || []).filter(
      (
        shift
      ): shift is T & {
        date: string
        time_slot_code: string
        classroom_name?: string | null
        class_name?: string | null
        status?: 'uncovered' | 'partially_covered' | 'fully_covered'
      } => {
        if (!shift?.date || !shift.time_slot_code) return false
        const key = `${shift.date}|${shift.time_slot_code}`
        if (visibleShiftKeys.size > 0 && !visibleShiftKeys.has(key)) return false
        return true
      }
    )
    return filtered
  }

  const withClassroomName = <
    T extends { date: string; time_slot_code: string; classroom_name?: string | null },
  >(
    shifts: T[]
  ) =>
    shifts.map(shift => ({
      ...shift,
      classroom_name:
        shift.classroom_name ??
        classroomLookup.get(`${shift.date}|${shift.time_slot_code}`) ??
        null,
    }))

  const renderSubCard = ({
    sub,
    shiftsCovered,
  }: {
    sub: RecommendedSub
    shiftsCovered: number
  }) => {
    const visibleCanCover = filterSubShifts(sub.can_cover)
    const visibleCannotCover = filterSubShifts(sub.cannot_cover)
    const visibleAssigned = filterSubShifts(sub.assigned_shifts ?? [])
    const canCoverWithClassrooms = withClassroomName(visibleCanCover)
    const cannotCoverWithClassrooms = withClassroomName(visibleCannotCover)
    const assignedWithClassrooms = withClassroomName(visibleAssigned)
    const canCoverMap = new Set(
      canCoverWithClassrooms.map(shift => `${shift.date}|${shift.time_slot_code}`)
    )
    const assignedMap = new Set(
      assignedWithClassrooms.map(shift => `${shift.date}|${shift.time_slot_code}`)
    )
    const cannotCoverMap = new Map(
      cannotCoverWithClassrooms.map(shift => [
        `${shift.date}|${shift.time_slot_code}`,
        shift.reason,
      ])
    )
    const shiftChips = visibleAbsenceShifts.reduce<
      Array<{
        date: string
        time_slot_code: string
        status: 'assigned' | 'available' | 'unavailable'
        reason?: string
        classroom_name?: string | null
        class_name?: string | null
      }>
    >((acc, shift) => {
      const key = `${shift.date}|${shift.time_slot_code}`
      if (shift.status !== 'uncovered' && !assignedMap.has(key)) {
        return acc
      }
      if (assignedMap.has(key)) {
        if (shift.status === 'uncovered') {
          const logKey = `${absence.id}|${sub.id}|${key}`
          if (!loggedAssignedMismatchRef.current.has(logKey)) {
            loggedAssignedMismatchRef.current.add(logKey)
            console.warn('[Sub Finder] Assigned shift marked uncovered in absence data', {
              absence_id: absence.id,
              sub_id: sub.id,
              shift_key: key,
              shift_status: shift.status,
              shift_date: shift.date,
              shift_time_slot_code: shift.time_slot_code,
            })
          }
        }
        acc.push({
          date: shift.date as string,
          time_slot_code: shift.time_slot_code as string,
          status: 'assigned' as const,
          classroom_name: shift.classroom_name ?? null,
          class_name: shift.class_name ?? null,
        })
        return acc
      }
      if (canCoverMap.has(key)) {
        acc.push({
          date: shift.date as string,
          time_slot_code: shift.time_slot_code as string,
          status: 'available' as const,
          classroom_name: shift.classroom_name ?? null,
          class_name: shift.class_name ?? null,
        })
        return acc
      }
      const reason = cannotCoverMap.get(key)
      acc.push({
        date: shift.date as string,
        time_slot_code: shift.time_slot_code as string,
        status: 'unavailable' as const,
        reason: reason || undefined,
        classroom_name: shift.classroom_name ?? null,
        class_name: shift.class_name ?? null,
      })
      return acc
    }, [])
    const coverageSegments = derived.hasAssignedShifts
      ? shiftChips
          .filter(shift => derived.remainingShiftKeys.has(`${shift.date}|${shift.time_slot_code}`))
          .map(shift => shift.status)
      : shiftChips.map(shift => shift.status)

    return (
      <SubFinderCard
        key={sub.id}
        id={`sub-card-${sub.id}`}
        name={sub.name}
        phone={sub.phone}
        shiftsCovered={shiftsCovered}
        totalShifts={
          derived.hasAssignedShifts
            ? derived.remainingShiftCount
            : derived.totalShiftsNeedingCoverage
        }
        useRemainingLabel={derived.hasAssignedShifts}
        canCover={canCoverWithClassrooms}
        cannotCover={cannotCoverWithClassrooms}
        assigned={assignedWithClassrooms}
        shiftChips={shiftChips}
        coverageSegments={coverageSegments}
        notes={sub.notes}
        isDeclined={sub.response_status === 'declined_all'}
        highlighted={highlightedSubId === sub.id}
        onContact={() => onContactSub?.(sub)}
        allShifts={visibleAbsenceShifts}
        allCanCover={visibleCanCover}
        allCannotCover={visibleCannotCover}
        allAssigned={visibleAssigned}
      />
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
          <p className="text-muted-foreground">Finding recommended subs...</p>
        </div>
      </div>
    )
  }

  if (subs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <p className="text-lg mb-2">No recommended subs found</p>
          <p className="text-sm">Try adjusting your filters or check sub availability</p>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Conditionally render header only if not hidden */}
        {!hideHeader && (
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-1 flex items-center gap-3">
              <span>
                {showAllSubs ? 'All Subs' : 'Recommended Subs'} for {absence.teacher_name}
              </span>
              <span className="h-5 w-px bg-border" aria-hidden="true" />
              <span className="text-muted-foreground font-normal">{formatDateRange()}</span>
            </h2>
            <p className="text-sm text-muted-foreground">
              {showAllSubs
                ? 'Showing all subs with coverage details'
                : 'Sorted by coverage percentage (highest first)'}
            </p>
          </div>
        )}

        {derived.nonDeclinedSubs.map(({ sub, shiftsCovered }) =>
          renderSubCard({ sub, shiftsCovered })
        )}

        {/* Declined Subs Collapsible Section */}
        {derived.declinedSubs.length > 0 && (
          <div className="mt-6 border-t pt-4">
            <Button
              variant="ghost"
              onClick={() => setIsDeclinedExpanded(!isDeclinedExpanded)}
              className="w-full flex items-center justify-between p-2 hover:bg-gray-100"
            >
              <span className="font-medium text-sm">Declined ({derived.declinedSubs.length})</span>
              {isDeclinedExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>

            {isDeclinedExpanded && (
              <div className="mt-4 space-y-4">
                {derived.declinedSubs.map(({ sub, shiftsCovered }) => {
                  const visibleCanCover = filterSubShifts(sub.can_cover)
                  const visibleCannotCover = filterSubShifts(sub.cannot_cover)
                  const visibleAssigned = filterSubShifts(sub.assigned_shifts ?? [])
                  const canCoverWithClassrooms = withClassroomName(visibleCanCover)
                  const cannotCoverWithClassrooms = withClassroomName(visibleCannotCover)
                  const assignedWithClassrooms = withClassroomName(visibleAssigned)
                  const canCoverMap = new Set(
                    canCoverWithClassrooms.map(shift => `${shift.date}|${shift.time_slot_code}`)
                  )
                  const assignedMap = new Set(
                    assignedWithClassrooms.map(shift => `${shift.date}|${shift.time_slot_code}`)
                  )
                  const cannotCoverMap = new Map(
                    cannotCoverWithClassrooms.map(shift => [
                      `${shift.date}|${shift.time_slot_code}`,
                      shift.reason,
                    ])
                  )
                  const shiftChips = visibleAbsenceShifts.reduce<
                    Array<{
                      date: string
                      time_slot_code: string
                      status: 'assigned' | 'available' | 'unavailable'
                      reason?: string
                      classroom_name?: string | null
                      class_name?: string | null
                    }>
                  >((acc, shift) => {
                    const key = `${shift.date}|${shift.time_slot_code}`
                    if (shift.status !== 'uncovered' && !assignedMap.has(key)) {
                      return acc
                    }
                    if (assignedMap.has(key)) {
                      if (shift.status === 'uncovered') {
                        const logKey = `${absence.id}|${sub.id}|${key}`
                        if (!loggedAssignedMismatchRef.current.has(logKey)) {
                          loggedAssignedMismatchRef.current.add(logKey)
                          console.warn(
                            '[Sub Finder] Assigned shift marked uncovered in absence data',
                            {
                              absence_id: absence.id,
                              sub_id: sub.id,
                              shift_key: key,
                              shift_status: shift.status,
                              shift_date: shift.date,
                              shift_time_slot_code: shift.time_slot_code,
                            }
                          )
                        }
                      }
                      acc.push({
                        date: shift.date as string,
                        time_slot_code: shift.time_slot_code as string,
                        status: 'assigned' as const,
                        classroom_name: shift.classroom_name ?? null,
                        class_name: shift.class_name ?? null,
                      })
                      return acc
                    }
                    if (canCoverMap.has(key)) {
                      acc.push({
                        date: shift.date as string,
                        time_slot_code: shift.time_slot_code as string,
                        status: 'available' as const,
                        classroom_name: shift.classroom_name ?? null,
                        class_name: shift.class_name ?? null,
                      })
                      return acc
                    }
                    const reason = cannotCoverMap.get(key)
                    acc.push({
                      date: shift.date as string,
                      time_slot_code: shift.time_slot_code as string,
                      status: 'unavailable' as const,
                      reason: reason || undefined,
                      classroom_name: shift.classroom_name ?? null,
                      class_name: shift.class_name ?? null,
                    })
                    return acc
                  }, [])
                  const coverageSegments = derived.hasAssignedShifts
                    ? shiftChips
                        .filter(shift =>
                          derived.remainingShiftKeys.has(`${shift.date}|${shift.time_slot_code}`)
                        )
                        .map(shift => shift.status)
                    : shiftChips.map(shift => shift.status)

                  return (
                    <SubFinderCard
                      key={sub.id}
                      id={`sub-card-${sub.id}`}
                      name={sub.name}
                      phone={sub.phone}
                      shiftsCovered={shiftsCovered}
                      totalShifts={
                        derived.hasAssignedShifts
                          ? derived.remainingShiftCount
                          : derived.totalShiftsNeedingCoverage
                      }
                      useRemainingLabel={derived.hasAssignedShifts}
                      canCover={canCoverWithClassrooms}
                      cannotCover={cannotCoverWithClassrooms}
                      assigned={assignedWithClassrooms}
                      shiftChips={shiftChips}
                      coverageSegments={coverageSegments}
                      notes={sub.notes}
                      isDeclined={true}
                      highlighted={highlightedSubId === sub.id}
                      className="bg-gray-100/50 opacity-75"
                      onContact={() => onContactSub?.(sub)}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
