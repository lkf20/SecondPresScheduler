'use client'

import { useQuery } from '@tanstack/react-query'
import { useSchool } from '@/lib/contexts/SchoolContext'
import { assignSubTeachersQueryKeyPrefix } from '@/lib/utils/staff-picklist-query-keys'

/**
 * GET /api/teachers — permanent + flexible staff for pickers (Time Off, schedules, Sub Finder, Assign Sub).
 * Query key: `assignSubTeachersQueryKeyPrefix` in `lib/utils/staff-picklist-query-keys.ts`.
 * Invalidated by `invalidateStaffAssignmentPicklists` when staff/teacher records change.
 */
export async function fetchSchoolTeachersList(): Promise<unknown[]> {
  const response = await fetch('/api/teachers')
  if (!response.ok) throw new Error('Failed to fetch teachers')
  const data = await response.json()
  return Array.isArray(data) ? data : []
}

export function useSchoolTeachersQuery(options?: { enabled?: boolean }) {
  const schoolId = useSchool()
  const enabled = options?.enabled ?? true

  return useQuery({
    queryKey: [...assignSubTeachersQueryKeyPrefix, schoolId],
    queryFn: fetchSchoolTeachersList,
    enabled,
  })
}
