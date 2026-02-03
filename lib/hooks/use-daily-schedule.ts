'use client'

import { useQuery } from '@tanstack/react-query'
import { useSchool } from '@/lib/contexts/SchoolContext'
import type { WeeklyScheduleDataByClassroom } from '@/lib/api/weekly-schedule'

export type DailyScheduleResponse = {
  date: string
  day_of_week_id: string
  day_name: string
  data: WeeklyScheduleDataByClassroom[]
}

async function fetchDailySchedule(date: string): Promise<DailyScheduleResponse> {
  const url = new URL('/api/daily-schedule', window.location.origin)
  url.searchParams.set('date', date)

  const response = await fetch(url.toString())
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch daily schedule' }))
    throw new Error(error.error || 'Failed to fetch daily schedule')
  }

  return response.json()
}

export function useDailySchedule(date: string) {
  const schoolId = useSchool()

  return useQuery({
    queryKey: ['dailySchedule', schoolId, date],
    queryFn: () => fetchDailySchedule(date),
    enabled: Boolean(date),
    staleTime: 600000,
  })
}
