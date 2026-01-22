'use client'

import { useQuery } from '@tanstack/react-query'
import { useSchool } from '@/lib/contexts/SchoolContext'
import { dashboardKey, type DashboardQueryParams } from '@/lib/utils/query-keys'

type DashboardOverview = {
  summary: {
    absences: number
    uncovered_shifts: number
    partially_covered_shifts: number
    scheduled_subs: number
  }
  coverage_requests: Array<{
    id: string
    source_request_id: string | null
    request_type: string
    teacher_name: string
    start_date: string
    end_date: string
    reason: string | null
    notes: string | null
    classrooms: Array<{ id: string; name: string; color: string | null }>
    classroom_label: string
    total_shifts: number
    assigned_shifts: number
    uncovered_shifts: number
    partial_shifts: number
    remaining_shifts: number
    status: 'needs_coverage' | 'partially_covered' | 'covered'
    shift_details?: Array<{ label: string; status: 'covered' | 'partial' | 'uncovered' }>
  }>
  staffing_targets: Array<{
    id: string
    day_of_week_id: string
    day_name: string
    day_number: number
    day_order: number
    time_slot_id: string
    time_slot_code: string
    time_slot_order: number
    classroom_id: string
    classroom_name: string
    classroom_color: string | null
    required_staff: number
    preferred_staff: number | null
    scheduled_staff: number
    status: 'below_required' | 'below_preferred'
  }>
  scheduled_subs: Array<{
    id: string
    date: string
    day_name: string
    time_slot_code: string
    classroom_name: string
    classroom_color: string | null
    notes: string | null
    sub_name: string
    teacher_name: string
  }>
}

async function fetchDashboard(params: DashboardQueryParams): Promise<DashboardOverview> {
  const url = `/api/dashboard/overview?start_date=${params.startDate}&end_date=${params.endDate}`
  const response = await fetch(url)
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch dashboard' }))
    throw new Error(error.error || 'Failed to fetch dashboard')
  }
  
  return response.json()
}

export function useDashboard(params: DashboardQueryParams, initialData?: DashboardOverview) {
  const schoolId = useSchool()

  return useQuery({
    queryKey: dashboardKey(schoolId, params),
    queryFn: () => fetchDashboard(params),
    initialData,
    staleTime: 600000, // 10 minutes
    refetchOnWindowFocus: true, // Keep enabled for Dashboard to show latest data
  })
}
