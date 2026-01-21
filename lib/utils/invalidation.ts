import { QueryClient } from '@tanstack/react-query'

/**
 * Invalidation helpers for React Query
 * All invalidation functions include schoolId for multi-tenant support
 */

/**
 * Invalidate all dashboard queries for a school
 */
export function invalidateDashboard(queryClient: QueryClient, schoolId: string) {
  return queryClient.invalidateQueries({
    queryKey: ['dashboard', schoolId],
  })
}

/**
 * Invalidate all weekly schedule queries for a school
 */
export function invalidateWeeklySchedule(queryClient: QueryClient, schoolId: string) {
  return queryClient.invalidateQueries({
    queryKey: ['weeklySchedule', schoolId],
  })
}

/**
 * Invalidate time off requests queries for a school
 */
export function invalidateTimeOffRequests(queryClient: QueryClient, schoolId: string) {
  return queryClient.invalidateQueries({
    queryKey: ['timeOffRequests', schoolId],
  })
}

/**
 * Invalidate Sub Finder absences queries for a school
 */
export function invalidateSubFinderAbsences(queryClient: QueryClient, schoolId: string) {
  return queryClient.invalidateQueries({
    queryKey: ['subFinder', schoolId, 'absences'],
  })
}

/**
 * Invalidate sub recommendations for a specific coverage request
 * This invalidates all filter variants for that request
 */
export function invalidateSubRecommendations(
  queryClient: QueryClient,
  schoolId: string,
  coverageRequestId: string
) {
  return queryClient.invalidateQueries({
    queryKey: ['subRecommendations', schoolId, coverageRequestId],
  })
}

/**
 * Invalidate coverage summary for a specific coverage request
 */
export function invalidateCoverageSummary(
  queryClient: QueryClient,
  schoolId: string,
  coverageRequestId: string
) {
  return queryClient.invalidateQueries({
    queryKey: ['coverageSummary', schoolId, coverageRequestId],
  })
}

/**
 * Invalidate all queries affected by a sub assignment/unassignment
 */
export function invalidateSubAssignment(
  queryClient: QueryClient,
  schoolId: string,
  coverageRequestId?: string
) {
  const promises = [
    invalidateDashboard(queryClient, schoolId),
    invalidateWeeklySchedule(queryClient, schoolId),
  ]

  if (coverageRequestId) {
    promises.push(invalidateSubRecommendations(queryClient, schoolId, coverageRequestId))
    promises.push(invalidateCoverageSummary(queryClient, schoolId, coverageRequestId))
  }

  return Promise.all(promises)
}

/**
 * Invalidate all queries affected by a time off request change
 */
export function invalidateTimeOffRequest(
  queryClient: QueryClient,
  schoolId: string,
  coverageRequestId?: string
) {
  const promises = [
    invalidateTimeOffRequests(queryClient, schoolId),
    invalidateDashboard(queryClient, schoolId),
    invalidateSubFinderAbsences(queryClient, schoolId),
  ]

  if (coverageRequestId) {
    promises.push(invalidateSubRecommendations(queryClient, schoolId, coverageRequestId))
  }

  return Promise.all(promises)
}

/**
 * Invalidate all queries affected by coverage request shift changes
 */
export function invalidateCoverageRequestShifts(
  queryClient: QueryClient,
  schoolId: string,
  coverageRequestId: string
) {
  const promises = [
    invalidateSubRecommendations(queryClient, schoolId, coverageRequestId),
    invalidateDashboard(queryClient, schoolId),
    invalidateWeeklySchedule(queryClient, schoolId),
  ]

  return Promise.all(promises)
}
