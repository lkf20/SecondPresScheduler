'use client'

import { useQuery } from '@tanstack/react-query'
import { useSchool } from '@/lib/contexts/SchoolContext'
import { subRecommendationsKey, type SubRecommendationsQueryParams } from '@/lib/utils/query-keys'

type SubRecommendation = {
  id: string
  name: string
  phone?: string
  email?: string
  can_cover: Array<{
    date: string
    day_of_week_id: string
    time_slot_id: string
    classroom_id?: string
    classroom_name?: string
    classroom_color?: string | null
  }>
  cannot_cover: Array<{
    date: string
    day_of_week_id: string
    time_slot_id: string
    reason: string
    classroom_id?: string
    classroom_name?: string
  }>
  assigned: Array<{
    date: string
    day_of_week_id: string
    time_slot_id: string
    classroom_id?: string
    classroom_name?: string
  }>
  availability_score?: number
}

type SubRecommendationsResponse = {
  subs: SubRecommendation[]
  combinations?: Array<{
    subs: string[]
    shifts_covered: number
    total_shifts: number
  }>
  recommended_combination?: {
    subs: Array<{
      subId: string
      subName: string
      phone: string | null
      shifts: Array<{
        date: string
        day_name: string
        time_slot_code: string
        class_name: string | null
        diaper_changing_required?: boolean
        lifting_children_required?: boolean
      }>
      shiftsCovered: number
      totalShifts: number
      coveragePercent: number
      conflicts: {
        missingDiaperChanging: number
        missingLifting: number
        missingQualifications: number
        total: number
      }
    }>
    totalShiftsCovered: number
    totalShiftsNeeded: number
    totalConflicts: number
    coveragePercent: number
  } | null
  recommended_combinations?: Array<{
    subs: Array<{
      subId: string
      subName: string
      phone: string | null
      shifts: Array<{
        date: string
        day_name: string
        time_slot_code: string
        class_name: string | null
        diaper_changing_required?: boolean
        lifting_children_required?: boolean
      }>
      shiftsCovered: number
      totalShifts: number
      coveragePercent: number
      conflicts: {
        missingDiaperChanging: number
        missingLifting: number
        missingQualifications: number
        total: number
      }
    }>
    totalShiftsCovered: number
    totalShiftsNeeded: number
    totalConflicts: number
    coveragePercent: number
  }>
}

async function fetchSubRecommendations(
  coverageRequestId: string,
  params?: SubRecommendationsQueryParams
): Promise<SubRecommendationsResponse> {
  const body: any = {
    absence_id: coverageRequestId,
  }
  if (params?.includeFlexibleStaff !== undefined) {
    body.include_flexible_staff = params.includeFlexibleStaff
  }
  if (params?.includePastShifts !== undefined) {
    body.include_past_shifts = params.includePastShifts
  }

  const response = await fetch('/api/sub-finder/find-subs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch sub recommendations' }))
    throw new Error(error.error || 'Failed to fetch sub recommendations')
  }

  return response.json()
}

export function useSubRecommendations(
  coverageRequestId: string | null,
  params?: SubRecommendationsQueryParams,
  initialData?: SubRecommendationsResponse
) {
  const schoolId = useSchool()

  return useQuery({
    queryKey: coverageRequestId
      ? subRecommendationsKey(schoolId, coverageRequestId, params)
      : ['subRecommendations', schoolId, null, params],
    queryFn: () => {
      if (!coverageRequestId) {
        throw new Error('coverageRequestId is required')
      }
      return fetchSubRecommendations(coverageRequestId, params)
    },
    enabled: !!coverageRequestId,
    initialData,
    staleTime: 10 * 60 * 1000, // 10 minutes
    keepPreviousData: true,
    // refetchOnWindowFocus: false (inherits from global default)
  })
}
