'use client'

import { useQuery } from '@tanstack/react-query'
import { useSchool } from '@/lib/contexts/SchoolContext'
import { weeklyScheduleKey } from '@/lib/utils/query-keys'
import type { WeeklyScheduleDataByClassroom } from '@/lib/api/weekly-schedule'

async function fetchWeeklySchedule(weekStartISO: string): Promise<WeeklyScheduleDataByClassroom[]> {
  const url = new URL('/api/weekly-schedule', window.location.origin)
  if (weekStartISO) {
    url.searchParams.set('weekStartISO', weekStartISO)
  }
  const response = await fetch(url.toString())

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch weekly schedule' }))
    throw new Error(error.error || 'Failed to fetch weekly schedule')
  }

  return response.json()
}

/**
 * Hook for fetching weekly schedule data
 * The API fetches recurring teacher schedules and date-specific substitute assignments for the selected week
 * weekStartISO should be the Monday of the week in ISO format (YYYY-MM-DD)
 */
export function useWeeklySchedule(
  weekStartISO: string,
  initialData?: WeeklyScheduleDataByClassroom[]
) {
  const schoolId = useSchool()

  return useQuery({
    queryKey: weeklyScheduleKey(schoolId, weekStartISO),
    queryFn: () => fetchWeeklySchedule(weekStartISO),
    initialData,
    staleTime: 600000, // 10 minutes
    // refetchOnWindowFocus: false (inherits from global default)
  })
}
