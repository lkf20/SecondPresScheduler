'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface WeekPickerProps {
  weekStartISO: string
  onWeekChange: (weekStartISO: string) => void
  onTodayClick: () => void
}

/**
 * Formats a date as "Mon DD" (e.g., "Feb 18")
 */
function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Formats week range as "Week of Feb 18 - 24"
 */
function formatWeekRange(weekStartISO: string): string {
  const weekStart = new Date(weekStartISO + 'T00:00:00')
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6) // Add 6 days to get Sunday
  
  const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' })
  const startDay = weekStart.getDate()
  const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' })
  const endDay = weekEnd.getDate()
  
  // If same month, show "Feb 18 - 24"
  // If different months, show "Feb 28 - Mar 3"
  if (startMonth === endMonth) {
    return `Week of ${startMonth} ${startDay} - ${endDay}`
  } else {
    return `Week of ${startMonth} ${startDay} - ${endMonth} ${endDay}`
  }
}

export default function WeekPicker({ weekStartISO, onWeekChange, onTodayClick }: WeekPickerProps) {
  const handlePreviousWeek = () => {
    const weekStart = new Date(weekStartISO + 'T00:00:00')
    weekStart.setDate(weekStart.getDate() - 7)
    onWeekChange(weekStart.toISOString().split('T')[0])
  }

  const handleNextWeek = () => {
    const weekStart = new Date(weekStartISO + 'T00:00:00')
    weekStart.setDate(weekStart.getDate() + 7)
    onWeekChange(weekStart.toISOString().split('T')[0])
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePreviousWeek}
        className="h-9 w-9 -mr-4"
        aria-label="Previous week"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <div className="min-w-[200px] text-center font-medium text-gray-900">
        {formatWeekRange(weekStartISO)}
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={handleNextWeek}
        className="h-9 w-9 -ml-4"
        aria-label="Next week"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      
      <Button
        variant="ghost"
        onClick={onTodayClick}
        className="ml-2 bg-[#ebedef] hover:bg-[#d9dce0]"
      >
        Today
      </Button>
    </div>
  )
}
