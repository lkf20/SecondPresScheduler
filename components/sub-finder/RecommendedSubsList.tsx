'use client'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import SubFinderCard from '@/components/sub-finder/SubFinderCard'
import type { SubCandidate } from '@/components/sub-finder/hooks/useSubFinderData'
import type { SubFinderShift } from '@/lib/sub-finder/types'
import { filterVisibleShifts, getShiftKey } from '@/lib/sub-finder/shift-helpers'
import { formatAbsenceDateRange } from '@/lib/utils/date-format'
import { cn } from '@/lib/utils'

type RecommendedSub = SubCandidate

const getUnifiedContactStatus = (sub: RecommendedSub) => {
  const explicit = (sub as any).contact_status as string | null | undefined
  if (
    explicit === 'not_contacted' ||
    explicit === 'pending' ||
    explicit === 'awaiting_response' ||
    explicit === 'confirmed' ||
    explicit === 'declined_all'
  ) {
    return explicit
  }

  if (sub.response_status === 'declined_all') return 'declined_all'
  if (sub.response_status === 'confirmed') return 'confirmed'
  if (sub.response_status === 'pending' || sub.is_contacted === true) return 'pending'
  return 'not_contacted'
}

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
  onSaveNote?: (sub: SubCandidate, nextNote: string | null) => Promise<void> | void
  hideHeader?: boolean
  highlightedSubId?: string | null
  includePastShifts?: boolean
  selectedShift?: SubFinderShift | null
  stickyControls?: boolean
  activeFilter?: string | null
  onActiveFilterChange?: (filter: string | null) => void
  renderFiltersOnly?: boolean
  hideFilterControls?: boolean
  className?: string
}

export default function RecommendedSubsList({
  subs,
  loading,
  absence,
  shiftDetails,
  showAllSubs = false,
  onContactSub,
  onSaveNote,
  hideHeader = false,
  highlightedSubId = null,
  includePastShifts = false,
  selectedShift = null,
  stickyControls = false,
  activeFilter: controlledActiveFilter,
  onActiveFilterChange,
  renderFiltersOnly = false,
  hideFilterControls = false,
  className,
}: RecommendedSubsListProps) {
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    assigned: false,
    contacted: false,
    available: true,
    availableLimited: false,
    unavailable: false,
    declined: false,
  })

  const formatDateRange = () => formatAbsenceDateRange(absence.start_date, absence.end_date)
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

    const isDeclined = (sub: RecommendedSub) => getUnifiedContactStatus(sub) === 'declined_all'

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
    const declinedSubs = filteredSubs.filter(({ isDeclined }) => isDeclined)

    nonDeclinedSubs.sort((a, b) => b.shiftsCovered - a.shiftsCovered)
    declinedSubs.sort((a, b) => b.shiftsCovered - a.shiftsCovered)

    return {
      totalShiftsNeedingCoverage,
      remainingShiftCount: remainingShiftKeys.size,
      hasAssignedShifts,
      remainingShiftKeys,
      nonDeclinedSubs,
      declinedSubs,
      canPaginate: false, // Always show all subs in scrollable list
    }
  }, [loading, showAllSubs, subs, visibleShiftKeys, visibleAbsenceShifts])

  type SubBucket =
    | 'declined'
    | 'assigned'
    | 'contacted'
    | 'available'
    | 'availableLimited'
    | 'unavailable'

  const getSubBucket = useCallback(
    (sub: RecommendedSub, selectedShiftKey: string | null): SubBucket => {
      const coveragePercent = sub.coverage_percent ?? 0
      const isSub = sub.is_sub === true
      const isFlexibleStaff = sub.is_flexible_staff === true && !isSub
      const hasQualificationGap = (sub.cannot_cover || []).some(
        shift => shift.reason === 'Not qualified for this class'
      )
      const isAssigned = (sub.assigned_shifts?.length ?? 0) > 0
      const isAvailable = coveragePercent > 0
      const isDeclined = getUnifiedContactStatus(sub) === 'declined_all'
      const isPartiallyAvailable = false // TODO: detect partial-shift availability once data is available
      const unifiedStatus = getUnifiedContactStatus(sub)
      const isContacted = unifiedStatus === 'pending' || unifiedStatus === 'confirmed'
      const isAvailableMissingReqs = isAvailable && hasQualificationGap
      const isAvailableLimited =
        isAvailableMissingReqs || isPartiallyAvailable || (isAvailable && isFlexibleStaff)
      const isAssignedForSelected = selectedShiftKey
        ? (sub.assigned_shifts || []).some(
            shift => `${shift.date}|${shift.time_slot_code}` === selectedShiftKey
          )
        : false
      const isAvailableForSelected = selectedShiftKey
        ? (sub.can_cover || []).some(
            shift => `${shift.date}|${shift.time_slot_code}` === selectedShiftKey
          )
        : isAvailable
      const hasQualificationGapForSelected = selectedShiftKey
        ? (sub.cannot_cover || []).some(
            shift =>
              shift.reason === 'Not qualified for this class' &&
              `${shift.date}|${shift.time_slot_code}` === selectedShiftKey
          )
        : hasQualificationGap
      const isAvailableLimitedForSelected = selectedShiftKey
        ? isAvailableForSelected &&
          (hasQualificationGapForSelected || isPartiallyAvailable || isFlexibleStaff)
        : isAvailableLimited
      const isUnavailableForSelected = selectedShiftKey
        ? !isAvailableForSelected && !isAssignedForSelected && !isAvailableLimitedForSelected
        : coveragePercent === 0 && !isDeclined

      if (isDeclined) return 'declined'
      if (isAssigned) return 'assigned'
      if (isContacted) return 'contacted'
      if (isAvailableLimitedForSelected) return 'availableLimited'
      if (isAvailableForSelected) return 'available'
      if (isUnavailableForSelected) return 'unavailable'
      return 'unavailable'
    },
    []
  )

  const groupedSubs = useMemo(() => {
    if (!showAllSubs) {
      return null
    }
    const assigned: Array<{ sub: RecommendedSub; shiftsCovered: number }> = []
    const contacted: Array<{ sub: RecommendedSub; shiftsCovered: number }> = []
    const available: Array<{ sub: RecommendedSub; shiftsCovered: number }> = []
    const availableLimited: Array<{ sub: RecommendedSub; shiftsCovered: number }> = []
    const unavailable: Array<{ sub: RecommendedSub; shiftsCovered: number }> = []
    const declined: Array<{ sub: RecommendedSub; shiftsCovered: number }> = []
    const selectedShiftKey = selectedShift
      ? `${selectedShift.date}|${selectedShift.time_slot_code}`
      : null

    subs.forEach(sub => {
      const shiftsCovered = sub.shifts_covered ?? 0
      const bucket = getSubBucket(sub, selectedShiftKey)
      switch (bucket) {
        case 'declined':
          declined.push({ sub, shiftsCovered })
          break
        case 'assigned':
          assigned.push({ sub, shiftsCovered })
          break
        case 'contacted':
          contacted.push({ sub, shiftsCovered })
          break
        case 'availableLimited':
          availableLimited.push({ sub, shiftsCovered })
          break
        case 'available':
          available.push({ sub, shiftsCovered })
          break
        case 'unavailable':
        default:
          unavailable.push({ sub, shiftsCovered })
      }
    })

    const byAvailability = (
      a: { sub: RecommendedSub; shiftsCovered: number },
      b: { sub: RecommendedSub; shiftsCovered: number }
    ) => {
      const coverageA = a.sub.coverage_percent ?? 0
      const coverageB = b.sub.coverage_percent ?? 0
      if (coverageB !== coverageA) return coverageB - coverageA
      return (b.sub.shifts_covered ?? 0) - (a.sub.shifts_covered ?? 0)
    }

    available.sort(byAvailability)
    return {
      assigned,
      contacted,
      available,
      availableLimited,
      unavailable,
      declined,
    }
  }, [getSubBucket, showAllSubs, subs, selectedShift])

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

  const buildShiftChipsForSub = (sub: RecommendedSub) => {
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
    const selectedShiftKey = selectedShift
      ? `${selectedShift.date}|${selectedShift.time_slot_code}`
      : null
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
      if (shift.status !== 'uncovered' && !assignedMap.has(key) && key !== selectedShiftKey) {
        return acc
      }
      if (assignedMap.has(key)) {
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
    const filterBySelectedShift = <T extends { date?: string; time_slot_code?: string }>(
      shifts: T[] = []
    ) =>
      selectedShiftKey
        ? shifts.filter(
            shift => `${shift.date ?? ''}|${shift.time_slot_code ?? ''}` === selectedShiftKey
          )
        : shifts
    const filteredCanCover = filterBySelectedShift(canCoverWithClassrooms)
    const filteredCannotCover = filterBySelectedShift(cannotCoverWithClassrooms)
    const filteredAssigned = filterBySelectedShift(assignedWithClassrooms)
    const filteredShiftChips = filterBySelectedShift(shiftChips)

    return {
      visibleCanCover,
      visibleCannotCover,
      visibleAssigned,
      canCoverWithClassrooms,
      cannotCoverWithClassrooms,
      assignedWithClassrooms,
      filteredCanCover,
      filteredCannotCover,
      filteredAssigned,
      filteredShiftChips,
    }
  }

  const renderSubCard = ({
    sub,
    shiftsCovered,
  }: {
    sub: RecommendedSub
    shiftsCovered: number
  }) => {
    const {
      visibleCanCover,
      visibleCannotCover,
      visibleAssigned,
      filteredCanCover,
      filteredCannotCover,
      filteredAssigned,
      filteredShiftChips,
    } = buildShiftChipsForSub(sub)
    const coverageSegments = derived.hasAssignedShifts
      ? filteredShiftChips
          .filter(shift => derived.remainingShiftKeys.has(`${shift.date}|${shift.time_slot_code}`))
          .map(shift => shift.status)
      : filteredShiftChips.map(shift => shift.status)
    const unifiedStatus = getUnifiedContactStatus(sub)
    const remainingCoveredCount = derived.hasAssignedShifts
      ? filteredShiftChips.filter(
          shift =>
            derived.remainingShiftKeys.has(`${shift.date}|${shift.time_slot_code}`) &&
            shift.status !== 'unavailable'
        ).length
      : shiftsCovered

    return (
      <SubFinderCard
        key={sub.id}
        id={`sub-card-${sub.id}`}
        name={sub.name}
        phone={sub.phone}
        email={sub.email ?? null}
        shiftsCovered={remainingCoveredCount}
        totalShifts={
          derived.hasAssignedShifts
            ? derived.remainingShiftCount
            : derived.totalShiftsNeedingCoverage
        }
        useRemainingLabel={derived.hasAssignedShifts}
        canCover={filteredCanCover}
        cannotCover={filteredCannotCover}
        assigned={filteredAssigned}
        shiftChips={filteredShiftChips}
        coverageSegments={coverageSegments}
        notes={sub.notes}
        isDeclined={unifiedStatus === 'declined_all'}
        isContacted={unifiedStatus === 'pending' || unifiedStatus === 'confirmed'}
        responseStatus={
          unifiedStatus === 'confirmed'
            ? 'confirmed'
            : unifiedStatus === 'declined_all'
              ? 'declined_all'
              : unifiedStatus === 'pending' || unifiedStatus === 'awaiting_response'
                ? 'pending'
                : 'none'
        }
        onSaveNote={onSaveNote ? next => onSaveNote(sub, next) : undefined}
        highlighted={highlightedSubId === sub.id}
        onContact={() => onContactSub?.(sub)}
        allShifts={visibleAbsenceShifts}
        allCanCover={visibleCanCover}
        allCannotCover={visibleCannotCover}
        allAssigned={visibleAssigned}
        softChipColors={showAllSubs}
        condensedStatus={showAllSubs}
        showPrimaryShiftChips={!showAllSubs}
      />
    )
  }

  const renderSection = (
    key: 'assigned' | 'contacted' | 'available' | 'availableLimited' | 'unavailable' | 'declined',
    label: string,
    items: Array<{ sub: RecommendedSub; shiftsCovered: number }>,
    options: { collapsible?: boolean } = {}
  ) => {
    const { collapsible = true } = options
    const isExpanded = expandedSections[key]
    return (
      <div className="space-y-3">
        <Button
          variant="ghost"
          onClick={
            collapsible
              ? () =>
                  setExpandedSections(prev => ({
                    ...prev,
                    [key]: !prev[key],
                  }))
              : undefined
          }
          className="w-full flex items-center justify-between p-2 hover:bg-gray-100"
          disabled={items.length === 0}
        >
          <span className="font-medium text-sm">
            {label} ({items.length})
          </span>
          {collapsible &&
            (isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ))}
        </Button>
        {items.length > 0 && (!collapsible || isExpanded) && (
          <div className="space-y-4">
            {items.map(({ sub, shiftsCovered }) => renderSubCard({ sub, shiftsCovered }))}
          </div>
        )}
      </div>
    )
  }

  const sectionCounts = groupedSubs
    ? {
        assigned: groupedSubs.assigned.length,
        contacted: groupedSubs.contacted.length,
        available: groupedSubs.available.length,
        availableLimited: groupedSubs.availableLimited.length,
        unavailable: groupedSubs.unavailable.length,
        declined: groupedSubs.declined.length,
      }
    : {
        assigned: 0,
        contacted: 0,
        available: 0,
        availableLimited: 0,
        unavailable: 0,
        declined: 0,
      }

  const allCount = Object.values(sectionCounts).reduce((sum, count) => sum + count, 0)

  const sectionFilters = [
    { key: 'assigned', label: 'Assigned' },
    { key: 'contacted', label: 'Contacted' },
    { key: 'available', label: 'Available' },
    { key: 'availableLimited', label: 'Available with limitations' },
    { key: 'unavailable', label: 'Unavailable' },
    { key: 'declined', label: 'Declined' },
  ] as const
  const primaryFilters = sectionFilters.filter(
    filter => filter.key === 'available' || filter.key === 'contacted' || filter.key === 'assigned'
  )
  const moreFilters = sectionFilters.filter(
    filter =>
      filter.key === 'availableLimited' || filter.key === 'unavailable' || filter.key === 'declined'
  )

  const [internalActiveFilter, setInternalActiveFilter] = useState<string | null>('available')
  const activeFilter =
    controlledActiveFilter === undefined ? internalActiveFilter : controlledActiveFilter
  const setActiveFilter = useCallback(
    (nextFilter: string | null | ((prev: string | null) => string | null)) => {
      const resolvedNext =
        typeof nextFilter === 'function' ? nextFilter(activeFilter ?? null) : (nextFilter ?? null)
      if (controlledActiveFilter === undefined) {
        setInternalActiveFilter(resolvedNext)
      }
      onActiveFilterChange?.(resolvedNext)
    },
    [activeFilter, controlledActiveFilter, onActiveFilterChange]
  )
  const activeMoreFilter = moreFilters.find(filter => filter.key === activeFilter) ?? null
  const moreFilterLabel = activeMoreFilter
    ? `${activeMoreFilter.label} (${sectionCounts[activeMoreFilter.key]})`
    : activeFilter === null
      ? `All (${allCount})`
      : 'More filters'

  const toggleFilter = (key: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [key]: true,
    }))
    setActiveFilter(prev => (prev === key ? null : key))
  }

  const showSection = (key: string) => (activeFilter ? activeFilter === key : true)

  useEffect(() => {
    if (!activeFilter) return
    setExpandedSections(prev => ({
      ...prev,
      [activeFilter]: true,
    }))
  }, [activeFilter])

  if (renderFiltersOnly && (loading || subs.length === 0 || !showAllSubs || !groupedSubs)) {
    return null
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
          <p className="text-lg mb-2">
            {showAllSubs ? 'No subs found' : 'No recommended subs found'}
          </p>
          <p className="text-sm">Try adjusting your filters or check sub availability</p>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className={cn('space-y-4', className)}>
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

        {showAllSubs && groupedSubs ? (
          <div className={cn('space-y-4', stickyControls && 'bg-white')}>
            {!hideFilterControls && (
              <div
                className={cn(
                  'relative w-full flex flex-wrap gap-2',
                  stickyControls ? 'sticky top-0 z-40 bg-white px-0 pt-10 pb-3' : 'mt-2 pb-3'
                )}
              >
                {primaryFilters.map(filter => (
                  <Button
                    key={filter.key}
                    type="button"
                    variant="ghost"
                    onClick={() => toggleFilter(filter.key)}
                    className={cn(
                      'h-auto rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      activeFilter === filter.key
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-400 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    {filter.label} ({sectionCounts[filter.key]})
                  </Button>
                ))}
                <Popover open={isMoreFiltersOpen} onOpenChange={setIsMoreFiltersOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      className={cn(
                        'h-auto rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                        activeMoreFilter || activeFilter === null
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-400 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      {moreFilterLabel}
                      <ChevronDown className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="start">
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveFilter(null)
                          setIsMoreFiltersOpen(false)
                        }}
                        className={cn(
                          'flex w-full items-center justify-between rounded px-2 py-1.5 text-sm',
                          activeFilter === null
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-700 hover:bg-slate-100'
                        )}
                      >
                        <span>All</span>
                        <span
                          className={cn(
                            'text-xs',
                            activeFilter === null ? 'text-white/90' : 'text-slate-500'
                          )}
                        >
                          {allCount}
                        </span>
                      </button>
                      {moreFilters.map(filter => {
                        const isActive = activeFilter === filter.key
                        return (
                          <button
                            key={filter.key}
                            type="button"
                            onClick={() => {
                              setExpandedSections(prev => ({
                                ...prev,
                                [filter.key]: true,
                              }))
                              setActiveFilter(filter.key)
                              setIsMoreFiltersOpen(false)
                            }}
                            className={cn(
                              'flex w-full items-center justify-between rounded px-2 py-1.5 text-sm',
                              isActive
                                ? 'bg-slate-900 text-white'
                                : 'text-slate-700 hover:bg-slate-100'
                            )}
                          >
                            <span>{filter.label}</span>
                            <span
                              className={cn(
                                'text-xs',
                                isActive ? 'text-white/90' : 'text-slate-500'
                              )}
                            >
                              {sectionCounts[filter.key]}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
            {!renderFiltersOnly && (
              <div className={cn(hideFilterControls && 'pt-3')}>
                {showSection('assigned') &&
                  renderSection('assigned', 'Assigned', groupedSubs.assigned)}
                {showSection('contacted') &&
                  renderSection('contacted', 'Contacted', groupedSubs.contacted)}
                {showSection('available') &&
                  renderSection('available', 'Available', groupedSubs.available)}
                {showSection('availableLimited') &&
                  renderSection(
                    'availableLimited',
                    'Available with limitations',
                    groupedSubs.availableLimited
                  )}
                {showSection('unavailable') &&
                  renderSection('unavailable', 'Unavailable', groupedSubs.unavailable)}
                {showSection('declined') && (
                  <>
                    <div className="border-t border-slate-200" />
                    {renderSection('declined', 'Declined', groupedSubs.declined)}
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {derived.nonDeclinedSubs.map(({ sub, shiftsCovered }) =>
              renderSubCard({ sub, shiftsCovered })
            )}

            {derived.declinedSubs.length > 0 && (
              <div className="mt-6 border-t pt-4">
                {renderSection(
                  'declined',
                  'Declined',
                  derived.declinedSubs.map(({ sub, shiftsCovered }) => ({ sub, shiftsCovered }))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </TooltipProvider>
  )
}
