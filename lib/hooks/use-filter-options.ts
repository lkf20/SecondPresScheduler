'use client'

import { useQuery } from '@tanstack/react-query'
import { useSchool } from '@/lib/contexts/SchoolContext'
import type { Database } from '@/types/database'

type DayOfWeek = Database['public']['Tables']['days_of_week']['Row']
type TimeSlot = Database['public']['Tables']['time_slots']['Row']
type Classroom = Database['public']['Tables']['classrooms']['Row']

interface FilterOptions {
  days: DayOfWeek[]
  timeSlots: TimeSlot[]
  classrooms: Classroom[]
}

async function fetchFilterOptions(): Promise<FilterOptions> {
  const [daysRes, timeSlotsRes, classroomsRes] = await Promise.all([
    fetch('/api/days-of-week'),
    fetch('/api/timeslots?includeInactive=true'),
    fetch('/api/classrooms?includeInactive=true'),
  ])

  if (!daysRes.ok || !timeSlotsRes.ok || !classroomsRes.ok) {
    throw new Error('Failed to fetch filter options')
  }

  const [days, timeSlots, classrooms] = await Promise.all([
    daysRes.json(),
    timeSlotsRes.json(),
    classroomsRes.json(),
  ])

  return {
    days: days || [],
    timeSlots: timeSlots || [],
    classrooms: classrooms || [],
  }
}

export function useFilterOptions() {
  const schoolId = useSchool()

  return useQuery({
    queryKey: ['filterOptions', schoolId],
    queryFn: fetchFilterOptions,
    // Keep this query fresh because classrooms/time slots can be edited from Settings,
    // then users navigate straight into schedule views expecting immediate updates.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
}
