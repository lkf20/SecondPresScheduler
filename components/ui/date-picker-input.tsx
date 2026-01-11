'use client'

import { forwardRef, useEffect, useMemo, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const parseDate = (value: string) => {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

const formatISO = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatDisplay = (date: Date) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)

interface DatePickerInputProps {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  allowClear?: boolean
  className?: string
  tabIndex?: number
  closeOnSelect?: boolean
}

const DatePickerInput = forwardRef<HTMLButtonElement, DatePickerInputProps>(
  ({
  id,
  value,
  onChange,
  placeholder = 'Select date',
  allowClear = false,
  className,
  tabIndex,
  closeOnSelect = false,
}, ref) => {
  const selectedDate = useMemo(() => parseDate(value), [value])
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => {
    const base = selectedDate || new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  useEffect(() => {
    if (!selectedDate) return
    setViewDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
  }, [selectedDate])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startDay = new Date(year, month, 1).getDay()

  const weeks: Array<Array<number | null>> = []
  let day = 1
  for (let i = 0; i < 6; i += 1) {
    const week: Array<number | null> = []
    for (let j = 0; j < 7; j += 1) {
      if (i === 0 && j < startDay) {
        week.push(null)
      } else if (day > daysInMonth) {
        week.push(null)
      } else {
        week.push(day)
        day += 1
      }
    }
    weeks.push(week)
  }

  const handleSelect = (dayNumber: number) => {
    const next = new Date(year, month, dayNumber)
    onChange(formatISO(next))
    if (closeOnSelect) {
      setOpen(false)
    }
  }

  const isSelected = (dayNumber: number) =>
    selectedDate &&
    selectedDate.getFullYear() === year &&
    selectedDate.getMonth() === month &&
    selectedDate.getDate() === dayNumber

  const isToday = (dayNumber: number) => {
    const today = new Date()
    return (
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === dayNumber
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          tabIndex={tabIndex}
          ref={ref}
          className={cn(
            'flex h-12 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm text-left text-foreground shadow-none transition-colors focus:outline-none focus:ring-1 focus:ring-slate-300',
            className
          )}
        >
          <span className={cn(!value && 'text-muted-foreground')}>
            {selectedDate ? formatDisplay(selectedDate) : placeholder}
          </span>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[18rem] p-3" align="start">
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            className="rounded-md p-1 text-slate-600 hover:bg-slate-100"
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-sm font-medium text-slate-800">
            {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(viewDate)}
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-slate-600 hover:bg-slate-100"
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-1">
          {WEEKDAYS.map((dayLabel, index) => (
            <div key={`${dayLabel}-${index}`} className="py-1">
              {dayLabel}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 text-sm">
          {weeks.map((week, weekIndex) =>
            week.map((dayNumber, dayIndex) => {
              if (!dayNumber) {
                return <div key={`${weekIndex}-${dayIndex}`} className="h-8" />
              }
              const selected = isSelected(dayNumber)
              return (
                <button
                  key={`${weekIndex}-${dayIndex}`}
                  type="button"
                  onClick={() => handleSelect(dayNumber)}
                  className={cn(
                    'h-8 rounded-md text-slate-800 hover:bg-slate-100',
                    selected && 'bg-slate-800 text-white hover:bg-slate-800',
                    !selected && isToday(dayNumber) && 'border border-slate-300'
                  )}
                >
                  {dayNumber}
                </button>
              )
            })
          )}
        </div>
        {allowClear && value && (
          <button
            type="button"
            className="mt-3 w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
            onClick={() => onChange('')}
          >
            Clear date
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
})

DatePickerInput.displayName = 'DatePickerInput'

export default DatePickerInput
