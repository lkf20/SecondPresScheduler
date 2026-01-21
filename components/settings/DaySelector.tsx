'use client'

import { useState, useEffect } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Database } from '@/types/database'

type DayOfWeek = Database['public']['Tables']['days_of_week']['Row']

interface DaySelectorProps {
  selectedDayIds: string[]
  onSelectionChange: (dayIds: string[]) => void
}

export default function DaySelector({
  selectedDayIds,
  onSelectionChange,
}: DaySelectorProps) {
  const [daysOfWeek, setDaysOfWeek] = useState<DayOfWeek[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/days-of-week')
      .then((r) => r.json())
      .then((data) => {
        // Sort by day_number: Mon(1), Tue(2), Wed(3), Thu(4), Fri(5), Sat(6), Sun(7)
        // Handle both old (0) and new (7) Sunday values for sorting
        const sorted = (data as DayOfWeek[]).sort((a, b) => {
          const aNum = a.day_number === 0 ? 7 : a.day_number
          const bNum = b.day_number === 0 ? 7 : b.day_number
          return aNum - bNum
        })
        setDaysOfWeek(sorted)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (daysOfWeek.length === 0) return
    if (selectedDayIds.length > 0) return
    const defaultDays = daysOfWeek
      .filter((d) => d.day_number >= 1 && d.day_number <= 5)
      .map((d) => d.id)
    onSelectionChange(defaultDays)
  }, [daysOfWeek, onSelectionChange, selectedDayIds.length])

  const handleDayToggle = (dayId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedDayIds, dayId])
    } else {
      onSelectionChange(selectedDayIds.filter((id) => id !== dayId))
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading days...</div>
  }

  return (
    <div className="flex items-center gap-6 flex-wrap">
      {daysOfWeek.map((day) => {
        const isChecked = selectedDayIds.includes(day.id)
        return (
          <div key={day.id} className="flex items-center space-x-2">
            <Checkbox
              id={`day-${day.id}`}
              checked={isChecked}
              onCheckedChange={(checked) => handleDayToggle(day.id, checked === true)}
            />
            <Label
              htmlFor={`day-${day.id}`}
              className="cursor-pointer text-sm font-normal"
            >
              {day.name.slice(0, 3)}
            </Label>
          </div>
        )
      })}
    </div>
  )
}
