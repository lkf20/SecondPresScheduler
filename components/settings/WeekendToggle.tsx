'use client'

import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useEffect } from 'react'

interface WeekendToggleProps {
  includeWeekends: boolean
  onToggle: (value: boolean) => void
}

export default function WeekendToggle({ includeWeekends, onToggle }: WeekendToggleProps) {
  // Load preference from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('schedule_include_weekends')
    if (saved !== null) {
      onToggle(saved === 'true')
    }
  }, [onToggle])

  const handleToggle = (checked: boolean) => {
    onToggle(checked)
    localStorage.setItem('schedule_include_weekends', String(checked))
  }

  return (
    <div className="flex items-center space-x-2">
      <Switch id="include-weekends" checked={includeWeekends} onCheckedChange={handleToggle} />
      <Label htmlFor="include-weekends" className="cursor-pointer">
        Include weekends (Saturday & Sunday) in schedule
      </Label>
    </div>
  )
}
