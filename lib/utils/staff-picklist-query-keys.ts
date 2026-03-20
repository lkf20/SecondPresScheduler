/**
 * React Query key prefixes for school-scoped teacher/sub picklists.
 * Used by `useSchoolTeachersQuery`, Assign Sub subs query, and `invalidateStaffAssignmentPicklists`.
 */
export const assignSubTeachersQueryKeyPrefix = ['assignSubTeachers'] as const
export const assignSubSubsQueryKeyPrefix = ['assignSubSubs'] as const
