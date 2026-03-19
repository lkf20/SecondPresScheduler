'use client'

import { useQuery } from '@tanstack/react-query'
import { useSchool } from '@/lib/contexts/SchoolContext'
import { timeOffRequestsKey, type TimeOffRequestsQueryParams } from '@/lib/utils/query-keys'

/** Matches API response from /api/time-off-requests (transformTimeOffCardData) */
type TimeOffCardData = {
  id: string
  teacher_id: string
  teacher_name: string
  start_date: string
  end_date: string | null
  reason: string | null
  notes: string | null
  /** Coverage status: covered | partially_covered | needs_coverage */
  status: 'covered' | 'partially_covered' | 'needs_coverage'
  /** Request lifecycle: draft | active | cancelled */
  request_status: 'draft' | 'active' | 'cancelled'
  total: number
  covered: number
  partial: number
  uncovered: number
  classrooms: Array<{ id: string; name: string; color: string | null }>
  shift_details?: Array<{
    label: string
    status: 'covered' | 'partial' | 'uncovered'
    id?: string
    date?: string
    day_name?: string
    time_slot_code?: string
    class_name?: string | null
    classroom_name?: string | null
    classroom_color?: string | null
    sub_name?: string | null
    assigned_sub_name?: string | null
    assigned_sub_names?: string[]
    assignment_id?: string | null
    day_display_order?: number | null
    time_slot_display_order?: number | null
  }>
}

type TimeOffRequestsResponse = {
  data: TimeOffCardData[]
  meta: {
    total: number
    filters: Record<string, string | number | boolean | null>
  }
}

async function fetchTimeOffRequests(
  params?: TimeOffRequestsQueryParams
): Promise<TimeOffRequestsResponse> {
  const searchParams = new URLSearchParams()
  if (params?.statuses) {
    searchParams.set('status', params.statuses.join(','))
  }
  if (params?.teacherId) {
    searchParams.set('teacher_id', params.teacherId)
  }
  if (params?.startDate) {
    searchParams.set('start_date', params.startDate)
  }
  if (params?.endDate) {
    searchParams.set('end_date', params.endDate)
  }
  if (params?.includeDetailedShifts === true) {
    searchParams.set('include_detailed_shifts', 'true')
  }

  const url = `/api/time-off-requests${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
  const response = await fetch(url, { cache: 'no-store' })

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: 'Failed to fetch time off requests' }))
    throw new Error(error.error || 'Failed to fetch time off requests')
  }

  return response.json()
}

export function useTimeOffRequests(
  params?: TimeOffRequestsQueryParams,
  initialData?: TimeOffRequestsResponse
) {
  const schoolId = useSchool()

  return useQuery({
    queryKey: timeOffRequestsKey(schoolId, params),
    queryFn: () => fetchTimeOffRequests(params),
    initialData,
    staleTime: 600000, // 10 minutes
    // refetchOnWindowFocus: false (inherits from global default)
  })
}
