/**
 * Query key factory for React Query
 * All keys include schoolId as the second parameter for multi-tenant support
 */

export type CoverageRangePreset = '1 week' | '2 weeks' | '1 month' | '2 months'

export interface DashboardQueryParams {
  preset: CoverageRangePreset
  startDate: string
  endDate: string
}

export interface TimeOffRequestsQueryParams {
  statuses?: Array<'draft' | 'active' | 'cancelled'>
  teacherId?: string
  startDate?: string
  endDate?: string
}

export interface SubFinderAbsencesQueryParams {
  includePartiallyCovered?: boolean
}

export interface SubRecommendationsQueryParams {
  includePartial?: boolean
  includeDeclined?: boolean
  sort?: string
  includeFlexibleStaff?: boolean
}

/**
 * Dashboard query key
 */
export function dashboardKey(schoolId: string, params: DashboardQueryParams) {
  return ['dashboard', schoolId, params] as const
}

/**
 * Weekly Schedule query key
 */
export function weeklyScheduleKey(schoolId: string, weekStartISO: string) {
  return ['weeklySchedule', schoolId, weekStartISO] as const
}

/**
 * Time Off Requests query key
 */
export function timeOffRequestsKey(schoolId: string, params?: TimeOffRequestsQueryParams) {
  return ['timeOffRequests', schoolId, params || {}] as const
}

/**
 * Sub Finder absences query key
 */
export function subFinderAbsencesKey(schoolId: string, params?: SubFinderAbsencesQueryParams) {
  return ['subFinder', schoolId, 'absences', params || {}] as const
}

/**
 * Sub recommendations query key
 */
export function subRecommendationsKey(
  schoolId: string,
  coverageRequestId: string,
  params?: SubRecommendationsQueryParams
) {
  return ['subRecommendations', schoolId, coverageRequestId, params || {}] as const
}

/**
 * Coverage summary query key (if needed)
 */
export function coverageSummaryKey(schoolId: string, coverageRequestId: string) {
  return ['coverageSummary', schoolId, coverageRequestId] as const
}
