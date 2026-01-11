'use client'

import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { CheckCircle2, CircleX, ChevronDown, ChevronUp } from 'lucide-react'
import { parseLocalDate } from '@/lib/utils/date'
import { useState } from 'react'
import SubFinderCard from '@/components/sub-finder/SubFinderCard'

interface RecommendedSub {
  id: string
  name: string
  phone: string | null
  coverage_percent: number
  shifts_covered: number
  total_shifts: number
  can_cover: Array<{
    date: string
    day_name: string
    time_slot_code: string
    class_name: string | null
  }>
  cannot_cover: Array<{
    date: string
    day_name: string
    time_slot_code: string
    reason: string
  }>
  assigned_shifts?: Array<{
    date: string
    day_name: string
    time_slot_code: string
  }>
  notes?: string
  response_status?: string | null
}

interface RecommendedSubsListProps {
  subs: RecommendedSub[]
  loading: boolean
  absence: {
    id: string
    teacher_name: string
    start_date: string
    end_date: string | null
  }
  showAllSubs?: boolean
  onContactSub?: (sub: RecommendedSub) => void
  onViewDetails?: (sub: RecommendedSub) => void
  hideHeader?: boolean
  highlightedSubId?: string | null
}

export default function RecommendedSubsList({
  subs,
  loading,
  absence,
  showAllSubs = false,
  onContactSub,
  onViewDetails,
  hideHeader = false,
  highlightedSubId = null,
}: RecommendedSubsListProps) {
  const [isDeclinedExpanded, setIsDeclinedExpanded] = useState(false)
  // Format date as "Mon Jan 11"
  const formatDate = (dateString: string) => {
    const date = parseLocalDate(dateString)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const dayName = dayNames[date.getDay()]
    const month = monthNames[date.getMonth()]
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

  // Calculate uncovered shifts and process subs once
  const allShiftsNeedingCoverage = new Set<string>()
  subs.forEach((s) => {
    s.can_cover?.forEach((shift) => {
      const key = `${shift.date}|${shift.time_slot_code}`
      allShiftsNeedingCoverage.add(key)
    })
    s.cannot_cover?.forEach((shift) => {
      const key = `${shift.date}|${shift.time_slot_code}`
      allShiftsNeedingCoverage.add(key)
    })
    s.assigned_shifts?.forEach((shift) => {
      const key = `${shift.date}|${shift.time_slot_code}`
      allShiftsNeedingCoverage.add(key)
    })
  })
  
  const allAssignedShifts = new Set<string>()
  subs.forEach((s) => {
    s.assigned_shifts?.forEach((shift) => {
      const key = `${shift.date}|${shift.time_slot_code}`
      allAssignedShifts.add(key)
    })
  })
  
  const uncoveredShifts = new Set<string>()
  allShiftsNeedingCoverage.forEach((shiftKey) => {
    if (!allAssignedShifts.has(shiftKey)) {
      uncoveredShifts.add(shiftKey)
    }
  })

  const filterRemainingShifts = (shifts?: { date: string; time_slot_code: string }[]) =>
    (shifts || []).filter((shift) => uncoveredShifts.has(`${shift.date}|${shift.time_slot_code}`))
  
  const totalShiftsNeedingCoverage = subs[0]?.total_shifts || 0
  const totalUncoveredShifts = totalShiftsNeedingCoverage - allAssignedShifts.size
  
  const isDeclined = (sub: RecommendedSub) => sub.response_status === 'declined_all'

  
  const processedSubs = subs.map((sub) => {
    let shiftsCovered = 0
    sub.can_cover?.forEach((shift) => {
      const shiftKey = `${shift.date}|${shift.time_slot_code}`
      if (uncoveredShifts.has(shiftKey)) {
        shiftsCovered++
      }
    })
    
    return { sub, shiftsCovered, remainingShifts: totalUncoveredShifts, isDeclined: isDeclined(sub) }
  })
  
  const filteredSubs = processedSubs.filter(({ shiftsCovered, isDeclined }) => {
    if (isDeclined) return true
    if (!showAllSubs) {
      return shiftsCovered > 0
    }
    return true
  })
  
  const nonDeclinedSubs = filteredSubs.filter(({ isDeclined }) => !isDeclined)
  const declinedSubs = filteredSubs.filter(({ isDeclined }) => isDeclined)
  
  nonDeclinedSubs.sort((a, b) => b.shiftsCovered - a.shiftsCovered)
  declinedSubs.sort((a, b) => b.shiftsCovered - a.shiftsCovered)

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Conditionally render header only if not hidden */}
        {!hideHeader && (
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-1 flex items-center gap-3">
              <span>{showAllSubs ? 'All Subs' : 'Recommended Subs'} for {absence.teacher_name}</span>
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

        {nonDeclinedSubs.map(({ sub, shiftsCovered, remainingShifts }) => {
          const remainingCanCover = filterRemainingShifts(sub.can_cover)
          const remainingCannotCover = filterRemainingShifts(sub.cannot_cover)

          return (
            <SubFinderCard
              key={sub.id}
              name={sub.name}
              phone={sub.phone}
              shiftsCovered={shiftsCovered}
              totalShifts={remainingShifts}
              canCover={remainingCanCover}
              cannotCover={remainingCannotCover}
              assigned={[]}
              notes={sub.notes}
              isDeclined={isDeclined(sub)}
              highlighted={highlightedSubId === sub.id}
              onContact={() => onContactSub?.(sub)}
            />
          )
        })}
        
        {/* Declined Subs Collapsible Section */}
        {declinedSubs.length > 0 && (
          <div className="mt-6 border-t pt-4">
              <Button
                variant="ghost"
                onClick={() => setIsDeclinedExpanded(!isDeclinedExpanded)}
                className="w-full flex items-center justify-between p-2 hover:bg-gray-100"
              >
                <span className="font-medium text-sm">
                  Declined ({declinedSubs.length})
                </span>
                {isDeclinedExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
              
              {isDeclinedExpanded && (
                <div className="mt-4 space-y-4">
                  {declinedSubs.map(({ sub, shiftsCovered, remainingShifts }) => {
                    const remainingCanCover = filterRemainingShifts(sub.can_cover)
                    const remainingCannotCover = filterRemainingShifts(sub.cannot_cover)

                    return (
                      <SubFinderCard
                        key={sub.id}
                        name={sub.name}
                        phone={sub.phone}
                        shiftsCovered={shiftsCovered}
                        totalShifts={remainingShifts}
                        canCover={remainingCanCover}
                        cannotCover={remainingCannotCover}
                        assigned={[]}
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
