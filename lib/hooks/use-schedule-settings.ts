'use client'

import { useQuery } from '@tanstack/react-query'
import { useSchool } from '@/lib/contexts/SchoolContext'

interface ScheduleSettings {
  selected_day_ids: string[]
}

async function fetchScheduleSettings(): Promise<ScheduleSettings> {
  const response = await fetch('/api/schedule-settings')
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch schedule settings' }))
    throw new Error(error.error || 'Failed to fetch schedule settings')
  }
  
  const data = await response.json()
  return {
    selected_day_ids: data.selected_day_ids || [],
  }
}

export function useScheduleSettings() {
  const schoolId = useSchool()

  return useQuery({
    queryKey: ['scheduleSettings', schoolId],
    queryFn: fetchScheduleSettings,
    staleTime: 600000, // 10 minutes
    refetchOnWindowFocus: false,
  })
}
