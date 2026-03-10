export const NEEDS_REVIEW_CLASSROOM_NAME = 'Unknown (needs review)'

export function isNeedsReviewClassroomName(name?: string | null): boolean {
  if (!name) return false
  return name.trim().toLowerCase() === NEEDS_REVIEW_CLASSROOM_NAME.toLowerCase()
}
