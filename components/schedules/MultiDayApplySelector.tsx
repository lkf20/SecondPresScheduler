'use client'

import { useState, useEffect } from 'react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Database } from '@/types/database'

type DayOfWeek = Database['public']['Tables']['days_of_week']['Row']

interface TimeSlot {
  id: string
  code: string
  name: string | null
  display_order: number | null
}

interface MultiDayApplySelectorProps {
  currentDayId: string
  currentDayName: string
  currentTimeSlotCode: string
  currentTimeSlotId: string
  currentClassroomName: string
  selectedDayIds: string[] // Days that are in the weekly schedule
  timeSlots: TimeSlot[] // All available time slots
  disabled?: boolean
  onApplyScopeChange: (
    scope: 'single' | 'timeSlot' | 'day',
    dayIds: string[],
    timeSlotIds?: string[]
  ) => void
}

export default function MultiDayApplySelector({
  currentDayId,
  currentDayName,
  currentTimeSlotCode,
  currentTimeSlotId,
  currentClassroomName,
  selectedDayIds,
  timeSlots,
  disabled = false,
  onApplyScopeChange,
}: MultiDayApplySelectorProps) {
  const [days, setDays] = useState<DayOfWeek[]>([])
  const [scope, setScope] = useState<'single' | 'timeSlot' | 'day'>('single')
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set())
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<Set<string>>(
    new Set([currentTimeSlotId])
  )

  useEffect(() => {
    fetch('/api/days-of-week')
      .then(r => r.json())
      .then(data => {
        // Sort by day_number
        const sorted = (data as DayOfWeek[]).sort((a, b) => {
          const aNum = a.day_number === 0 ? 7 : a.day_number
          const bNum = b.day_number === 0 ? 7 : b.day_number
          return aNum - bNum
        })
        setDays(sorted)
        // Initialize with all available days selected (filtered by selectedDayIds)
        const availableDayIds = sorted
          .filter(day => selectedDayIds.includes(day.id))
          .map(day => day.id)
        setSelectedDays(new Set(availableDayIds))
      })
      .catch(console.error)
  }, [currentDayId, selectedDayIds])

  // Initialize time slots when they're provided
  useEffect(() => {
    if (timeSlots.length > 0) {
      const allTimeSlotIds = new Set(timeSlots.map(ts => ts.id))
      setSelectedTimeSlots(allTimeSlotIds)
    }
  }, [timeSlots])

  // Filter days to only show those in the weekly schedule
  const availableDays = days.filter(day => selectedDayIds.includes(day.id))

  // Sort time slots by display_order
  const sortedTimeSlots = [...timeSlots].sort((a, b) => {
    const orderA = a.display_order ?? 999
    const orderB = b.display_order ?? 999
    return orderA - orderB
  })

  const handleScopeChange = (newScope: 'single' | 'timeSlot' | 'day') => {
    if (disabled) return
    setScope(newScope)
    if (newScope === 'single') {
      setSelectedDays(new Set([currentDayId]))
      onApplyScopeChange('single', [currentDayId])
    } else if (newScope === 'timeSlot') {
      // For timeSlot scope, default to all available days checked
      const allAvailableDayIds = new Set(availableDays.map(day => day.id))
      setSelectedDays(allAvailableDayIds)
      onApplyScopeChange('timeSlot', Array.from(allAvailableDayIds))
    } else if (newScope === 'day') {
      // For day scope, default to all time slots checked
      const allTimeSlotIds = timeSlots.map(ts => ts.id)
      setSelectedTimeSlots(new Set(allTimeSlotIds))
      onApplyScopeChange('day', [currentDayId], allTimeSlotIds)
    }
  }

  const handleDayToggle = (dayId: string, checked: boolean) => {
    if (disabled) return
    const newSelected = new Set(selectedDays)
    if (checked) {
      newSelected.add(dayId)
    } else {
      // Don't allow unchecking the current day
      if (dayId !== currentDayId) {
        newSelected.delete(dayId)
      }
    }
    setSelectedDays(newSelected)
    if (scope === 'timeSlot') {
      onApplyScopeChange('timeSlot', Array.from(newSelected))
    }
  }

  const handleTimeSlotToggle = (timeSlotId: string, checked: boolean) => {
    if (disabled) return
    const newSelected = new Set(selectedTimeSlots)
    if (checked) {
      newSelected.add(timeSlotId)
    } else {
      newSelected.delete(timeSlotId)
    }
    setSelectedTimeSlots(newSelected)
    if (scope === 'day') {
      onApplyScopeChange('day', [currentDayId], Array.from(newSelected))
    }
  }

  // Format the option labels with specific examples
  // Abbreviate day name (e.g., "Monday" -> "Mon")
  const abbreviatedDayName = currentDayName.length > 3 ? currentDayName.slice(0, 3) : currentDayName
  const option1Label = `Only this time slot (${currentClassroomName} - ${abbreviatedDayName} - ${currentTimeSlotCode})`
  const option2Label = `${currentClassroomName} - ${currentTimeSlotCode} on:`
  const option3Label = `${currentClassroomName} - ${currentDayName} during:`

  return (
    <div className={`space-y-4 ${disabled ? 'opacity-60' : ''}`}>
      <Label className="text-base font-medium text-foreground block mb-6">
        Apply changes to...
      </Label>
      <RadioGroup
        value={scope}
        onValueChange={val => {
          handleScopeChange(val as 'single' | 'timeSlot' | 'day')
        }}
        className="space-y-3"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="single" id="scope-single" disabled={disabled} />
          <Label htmlFor="scope-single" className="cursor-pointer font-normal">
            {option1Label}
          </Label>
        </div>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="timeSlot" id="scope-timeSlot" disabled={disabled} />
            <Label htmlFor="scope-timeSlot" className="cursor-pointer font-normal">
              {option2Label}
            </Label>
          </div>
          {/* Checkboxes always visible below second option */}
          <div className="ml-6 mt-2 space-y-2">
            {availableDays.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No days available in weekly schedule
              </p>
            ) : (
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {availableDays.map(day => {
                  const isChecked = selectedDays.has(day.id)
                  const isCurrentDay = day.id === currentDayId
                  return (
                    <div key={day.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day.id}`}
                        checked={isChecked}
                        onCheckedChange={checked => handleDayToggle(day.id, checked === true)}
                        disabled={disabled || isCurrentDay || scope !== 'timeSlot'}
                      />
                      <Label
                        htmlFor={`day-${day.id}`}
                        className={`cursor-pointer text-sm font-normal ${isCurrentDay ? 'font-semibold' : ''} ${scope !== 'timeSlot' ? 'text-muted-foreground' : ''}`}
                      >
                        {day.name}
                        {isCurrentDay && ' (current)'}
                      </Label>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="day" id="scope-day" disabled={disabled} />
            <Label htmlFor="scope-day" className="cursor-pointer font-normal">
              {option3Label}
            </Label>
          </div>
          {/* Checkboxes always visible below third option */}
          <div className="ml-6 mt-2 space-y-2">
            {sortedTimeSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No time slots available</p>
            ) : (
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {sortedTimeSlots.map(timeSlot => {
                  const isChecked = selectedTimeSlots.has(timeSlot.id)
                  const isCurrentTimeSlot = timeSlot.id === currentTimeSlotId
                  return (
                    <div key={timeSlot.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`timeslot-${timeSlot.id}`}
                        checked={isChecked}
                        onCheckedChange={checked =>
                          handleTimeSlotToggle(timeSlot.id, checked === true)
                        }
                        disabled={disabled || scope !== 'day'}
                      />
                      <Label
                        htmlFor={`timeslot-${timeSlot.id}`}
                        className={`cursor-pointer text-sm font-normal ${isCurrentTimeSlot ? 'font-semibold' : ''} ${scope !== 'day' ? 'text-muted-foreground' : ''}`}
                      >
                        {timeSlot.code}
                        {isCurrentTimeSlot && ' (current)'}
                      </Label>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </RadioGroup>
    </div>
  )
}
