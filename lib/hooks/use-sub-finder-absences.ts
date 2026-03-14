'use client'

import { useQuery } from '@tanstack/react-query'
import { useSchool } from '@/lib/contexts/SchoolContext'
import { subFinderAbsencesKey, type SubFinderAbsencesQueryParams } from '@/lib/utils/query-keys'

export type SubFinderAbsence = {
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
      class_name?: string | null
      date: string
      day_name: string
      time_slot_code: string
      classroom_name: string
      classroom_color: string | null
      id?: string
      status: 'covered' | 'partial' | 'fully_covered' | 'partially_covered' | 'uncovered'
      sub_name?: string | null
      sub_id?: string | null
      assignment_id?: string | null
      assignment_status?: 'pending' | 'confirmed' | 'declined' | 'no_response' | 'none' | null
      assigned_sub?: {
        name: string
      }
      day_display_order?: number | null
      time_slot_display_order?: number | null
    }>
    shift_details_sorted?: Array<{
      class_name?: string | null
      date: string
      day_name: string
      time_slot_code: string
      classroom_name: string
      classroom_color: string | null
      id?: string
      status: 'covered' | 'partial' | 'fully_covered' | 'partially_covered' | 'uncovered'
      sub_name?: string | null
      sub_id?: string | null
      assignment_id?: string | null
      assignment_status?: 'pending' | 'confirmed' | 'declined' | 'no_response' | 'none' | null
      assigned_sub?: { name: string }
      day_display_order?: number | null
      time_slot_display_order?: number | null
    }>
  }
  classrooms: Array<{
    id: string
    name: string
    color: string | null
  }>
  /** True when end_date is in the past (within last 90 days). Used for Sub Finder left panel Past section. */
  is_past?: boolean
}

async function fetchSubFinderAbsences(
  params?: SubFinderAbsencesQueryParams
): Promise<SubFinderAbsence[]> {
  const searchParams = new URLSearchParams()
  if (params?.includePartiallyCovered) {
    searchParams.set('include_partially_covered', 'true')
  }
  if (params?.includeFullyCovered) {
    searchParams.set('include_fully_covered', 'true')
  }

  const url = `/api/sub-finder/absences${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
  const response = await fetch(url)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch absences' }))
    throw new Error(error.error || 'Failed to fetch absences')
  }

  return response.json()
}

export function useSubFinderAbsences(
  params?: SubFinderAbsencesQueryParams,
  initialData?: SubFinderAbsence[]
) {
  const schoolId = useSchool()

  return useQuery({
    queryKey: subFinderAbsencesKey(schoolId, params),
    queryFn: () => fetchSubFinderAbsences(params),
    initialData,
    staleTime: 600000, // 10 minutes
    // refetchOnWindowFocus: false (inherits from global default)
  })
}
