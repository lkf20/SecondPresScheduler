'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Phone, User, CheckCircle2, CircleX, ChevronDown, ChevronUp } from 'lucide-react'
import { parseLocalDate } from '@/lib/utils/date'
import { useState } from 'react'

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
  // Track which subs have unavailable shifts expanded
  const [expandedUnavailable, setExpandedUnavailable] = useState<Set<string>>(new Set())
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

  // Format shift label as "Mon AM • Feb 9"
  const formatShiftLabel = (dateString: string, timeSlotCode: string) => {
    const date = parseLocalDate(dateString)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const dayName = dayNames[date.getDay()]
    const month = monthNames[date.getMonth()]
    const day = date.getDate()
    return `${dayName} ${timeSlotCode} • ${month} ${day}`
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

      {subs.map((sub) => {
        const showUnavailable = expandedUnavailable.has(sub.id)
        const toggleUnavailable = () => {
          setExpandedUnavailable((prev) => {
            const next = new Set(prev)
            if (next.has(sub.id)) {
              next.delete(sub.id)
            } else {
              next.add(sub.id)
            }
            return next
          })
        }
        
        return (
        <Card key={sub.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-5">
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
                <p className="text-xs text-muted-foreground">
                  {sub.shifts_covered}/{sub.total_shifts} shifts
                </p>
              </div>
            </div>

            {/* Can Cover: Shifts that can be covered */}
            {sub.can_cover && sub.can_cover.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Can Cover:</p>
                <div className="flex flex-wrap gap-1.5">
                  {sub.can_cover.map((shift, idx) => {
                    const shiftLabel = formatShiftLabel(shift.date, shift.time_slot_code)
                    return (
                      <Badge
                        key={`can-cover-${shift.date}-${shift.time_slot_code}-${idx}`}
                        variant="outline"
                        className="text-xs bg-slate-100 text-slate-900 border-slate-200 flex items-center gap-1"
                      >
                        {shiftLabel}
                        <CheckCircle2 className="h-3 w-3" />
                      </Badge>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Unavailable: Collapsible section */}
            {sub.cannot_cover && sub.cannot_cover.length > 0 && (
              <div className="mb-3">
                <button
                  onClick={toggleUnavailable}
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-1.5"
                >
                  {showUnavailable ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                  <span>Unavailable ({sub.cannot_cover.length})</span>
                </button>
                {showUnavailable && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {sub.cannot_cover.map((shift, idx) => {
                        const shiftLabel = formatShiftLabel(shift.date, shift.time_slot_code)
                        return (
                          <Badge
                            key={`cannot-cover-${shift.date}-${shift.time_slot_code}-${idx}`}
                            variant="outline"
                            className="text-xs bg-muted/50 text-muted-foreground border-dashed border-gray-300 flex items-center gap-1"
                          >
                            {shiftLabel}
                            <CircleX className="h-3 w-3 text-muted-foreground" />
                          </Badge>
                        )
                      })}
                    </div>
                    <div className="space-y-1">
                      {sub.cannot_cover.map((shift, idx) => (
                        <div key={idx} className="text-xs text-muted-foreground">
                          <span className="font-medium">
                            {formatShiftLabel(shift.date, shift.time_slot_code)}:
                          </span>{' '}
                          {shift.reason}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {sub.notes && (
              <div className="mb-3 p-2 bg-muted rounded text-xs text-muted-foreground">
                {sub.notes}
              </div>
            )}

            <div className="mt-4">
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => onContactSub?.(sub)}
              >
                View & Contact
              </Button>
            </div>
          </CardContent>
        </Card>
        )
      })}
    </div>
  )
}



