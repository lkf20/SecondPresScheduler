'use client'

import { useQuery } from '@tanstack/react-query'
import { useSchool } from '@/lib/contexts/SchoolContext'
import { subFinderAbsencesKey, type SubFinderAbsencesQueryParams } from '@/lib/utils/query-keys'

type Absence = {
  id: string
  teacher_id: string
  teacher_name: string
  start_date: string
  end_date: string | null
  reason: string | null
  notes: string | null
  status: 'needs_coverage' | 'partially_covered' | 'covered'
  shifts: {
    total: number
    uncovered: number
    covered?: number
    partial?: number
    fully_covered?: number
    partially_covered?: number
    shift_details: Array<{
      date: string
      day_name: string
      time_slot_code: string
      classroom_name: string
      classroom_color: string | null
      status: 'covered' | 'partial' | 'fully_covered' | 'partially_covered' | 'uncovered'
      assigned_sub?: {
        name: string
      }
    }>
  }
  classrooms: Array<{
    id: string
    name: string
    color: string | null
  }>
}

async function fetchSubFinderAbsences(params?: SubFinderAbsencesQueryParams): Promise<Absence[]> {
  const searchParams = new URLSearchParams()
  if (params?.includePartiallyCovered) {
    searchParams.set('include_partially_covered', 'true')
  }

  const url = `/api/sub-finder/absences${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
  const response = await fetch(url)
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch absences' }))
    throw new Error(error.error || 'Failed to fetch absences')
  }
  
  return response.json()
}

export function useSubFinderAbsences(params?: SubFinderAbsencesQueryParams, initialData?: Absence[]) {
  const schoolId = useSchool()

  return useQuery({
    queryKey: subFinderAbsencesKey(schoolId, params),
    queryFn: () => fetchSubFinderAbsences(params),
    initialData,
    staleTime: 600000, // 10 minutes
    // refetchOnWindowFocus: false (inherits from global default)
  })
}
