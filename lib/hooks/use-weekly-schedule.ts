'use client'

import { useQuery } from '@tanstack/react-query'
import { useSchool } from '@/lib/contexts/SchoolContext'
import { weeklyScheduleKey } from '@/lib/utils/query-keys'
import type { WeeklyScheduleDataByClassroom } from '@/lib/api/weekly-schedule'

async function fetchWeeklySchedule(): Promise<WeeklyScheduleDataByClassroom[]> {
  const response = await fetch('/api/weekly-schedule')
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch weekly schedule' }))
    throw new Error(error.error || 'Failed to fetch weekly schedule')
  }
  
  return response.json()
}

/**
 * Hook for fetching weekly schedule data
 * Note: The API returns all schedule data; filtering is done client-side
 * We use a weekStartISO key for consistency, but the API doesn't filter by week
 * For now, we use a constant weekStartISO since the schedule is not week-specific
 */
export function useWeeklySchedule(weekStartISO: string, initialData?: WeeklyScheduleDataByClassroom[]) {
  const schoolId = useSchool()

  return useQuery({
    queryKey: weeklyScheduleKey(schoolId, weekStartISO),
    queryFn: fetchWeeklySchedule,
    initialData,
    staleTime: 600000, // 10 minutes
    // refetchOnWindowFocus: false (inherits from global default)
  })
}
