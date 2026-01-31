export type TimeOffStatus = 'draft' | 'active' | 'cancelled'
export type CoverageRequestStatus = 'open' | 'filled' | 'cancelled'
export type CoverageRequestShiftStatus = 'active' | 'cancelled'
export type SubAssignmentStatus = 'active' | 'cancelled'

const TIME_OFF_TRANSITIONS: Record<TimeOffStatus, TimeOffStatus[]> = {
  draft: ['active', 'cancelled'],
  active: ['cancelled'],
  cancelled: [],
}

const COVERAGE_REQUEST_TRANSITIONS: Record<CoverageRequestStatus, CoverageRequestStatus[]> = {
  open: ['filled', 'cancelled'],
  filled: ['cancelled'],
  cancelled: [],
}

const COVERAGE_REQUEST_SHIFT_TRANSITIONS: Record<
  CoverageRequestShiftStatus,
  CoverageRequestShiftStatus[]
> = {
  active: ['cancelled'],
  cancelled: [],
}

const SUB_ASSIGNMENT_TRANSITIONS: Record<SubAssignmentStatus, SubAssignmentStatus[]> = {
  active: ['cancelled'],
  cancelled: [],
}

export function canTransitionTimeOffStatus(current: TimeOffStatus, next: TimeOffStatus): boolean {
  if (current === next) return true
  return TIME_OFF_TRANSITIONS[current].includes(next)
}

export function canTransitionCoverageRequestStatus(
  current: CoverageRequestStatus,
  next: CoverageRequestStatus
): boolean {
  if (current === next) return true
  return COVERAGE_REQUEST_TRANSITIONS[current].includes(next)
}

export function canTransitionCoverageRequestShiftStatus(
  current: CoverageRequestShiftStatus,
  next: CoverageRequestShiftStatus
): boolean {
  if (current === next) return true
  return COVERAGE_REQUEST_SHIFT_TRANSITIONS[current].includes(next)
}

export function canTransitionSubAssignmentStatus(
  current: SubAssignmentStatus,
  next: SubAssignmentStatus
): boolean {
  if (current === next) return true
  return SUB_ASSIGNMENT_TRANSITIONS[current].includes(next)
}

export function formatTransitionError(current: string, next: string): string {
  return `Invalid status transition: ${current} → ${next}`
}
