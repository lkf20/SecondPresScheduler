'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Phone, User } from 'lucide-react'

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
  notes?: string
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
}

export default function RecommendedSubsList({
  subs,
  loading,
  absence,
  showAllSubs = false,
  onContactSub,
  onViewDetails,
  hideHeader = false,
}: RecommendedSubsListProps) {
  // Format date as "Mon Jan 11"
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
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

  return (
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

      {subs.map((sub) => (
        <Card key={sub.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-lg">{sub.name}</h3>
                </div>
                {sub.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span>{sub.phone}</span>
                  </div>
                )}
              </div>
              <div className="text-right">
                <Badge
                  variant={sub.coverage_percent >= 80 ? 'default' : sub.coverage_percent >= 50 ? 'secondary' : 'outline'}
                  className="text-sm"
                >
                  {sub.coverage_percent}% coverage
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  {sub.shifts_covered}/{sub.total_shifts} shifts
                </p>
              </div>
            </div>

            {/* Coverage: All shifts displayed together */}
            {(sub.can_cover && sub.can_cover.length > 0) || (sub.cannot_cover && sub.cannot_cover.length > 0) ? (
              <div className="mb-3">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Coverage:</p>
                <div className="flex flex-wrap gap-1.5">
                  {/* Combine and sort all shifts by date and time slot */}
                  {(() => {
                    type ShiftItem = {
                      date: string
                      day_name: string
                      time_slot_code: string
                      canCover: boolean
                    }
                    
                    const allShiftsMap = new Map<string, ShiftItem>()
                    
                    // Add can_cover shifts
                    sub.can_cover?.forEach((shift) => {
                      const key = `${shift.date}|${shift.day_name}|${shift.time_slot_code}`
                      allShiftsMap.set(key, {
                        date: shift.date,
                        day_name: shift.day_name,
                        time_slot_code: shift.time_slot_code,
                        canCover: true,
                      })
                    })
                    
                    // Add cannot_cover shifts (will overwrite if duplicate, which shouldn't happen)
                    sub.cannot_cover?.forEach((shift) => {
                      const key = `${shift.date}|${shift.day_name}|${shift.time_slot_code}`
                      allShiftsMap.set(key, {
                        date: shift.date,
                        day_name: shift.day_name,
                        time_slot_code: shift.time_slot_code,
                        canCover: false,
                      })
                    })
                    
                    // Convert to array and sort by date, then time slot
                    const allShifts = Array.from(allShiftsMap.values()).sort((a, b) => {
                      const dateA = new Date(a.date).getTime()
                      const dateB = new Date(b.date).getTime()
                      if (dateA !== dateB) return dateA - dateB
                      // If same date, sort by time slot code (AM before PM, etc.)
                      return a.time_slot_code.localeCompare(b.time_slot_code)
                    })
                    
                    return allShifts.map((shift, idx) => {
                      const shiftLabel = `${formatDate(shift.date)} ${shift.time_slot_code}`
                      
                      return (
                        <Badge
                          key={`${shift.date}-${shift.time_slot_code}-${idx}`}
                          variant={shift.canCover ? 'default' : 'outline'}
                          className={`text-xs ${
                            shift.canCover
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground opacity-60'
                          }`}
                        >
                          {shiftLabel}
                        </Badge>
                      )
                    })
                  })()}
                </div>
              </div>
            ) : null}

            {/* Cannot Cover: Reasons section */}
            {sub.cannot_cover && sub.cannot_cover.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Cannot Cover:</p>
                <div className="space-y-1">
                  {sub.cannot_cover.map((shift, idx) => (
                    <div key={idx} className="text-xs text-muted-foreground">
                      <span className="font-medium">
                        {formatDate(shift.date)} {shift.time_slot_code}:
                      </span>{' '}
                      {shift.reason}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sub.notes && (
              <div className="mb-3 p-2 bg-muted rounded text-xs text-muted-foreground">
                {sub.notes}
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => onViewDetails?.(sub)}
              >
                View Details
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => onContactSub?.(sub)}
              >
                Contact
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}



