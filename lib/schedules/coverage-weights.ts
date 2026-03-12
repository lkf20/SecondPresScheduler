/**
 * Coverage weight rules for comparing slot staffing to required/preferred ratios.
 * Used by Weekly schedule, Baseline schedule, and Dashboard (below-staffing section).
 * See AGENTS.md "Coverage counting (staff who count toward ratios)" for context.
 */

export type AssignmentLike = {
  teacher_id?: string | null
  is_floater?: boolean
  is_substitute?: boolean
  is_flexible?: boolean
}

export type SlotLike = {
  assignments?: AssignmentLike[]
  absences?: unknown[]
}

/**
 * Weight for a single assignment when counting toward coverage.
 * Permanent = 1, Flex = 1, Temp coverage = 1, Sub = 1, Floater = 0.5.
 * (Floater may become more sophisticated later; keep logic here.)
 */
export function getAssignmentCoverageWeight(a: AssignmentLike): number {
  if (!a.teacher_id) return 0
  return a.is_floater ? 0.5 : 1
}

/**
 * Total coverage for a slot in Weekly schedule context.
 * Counts: Permanent (1), Flex (1), Temp coverage (1), Sub (1), Floater (0.5), Absence (-1 each).
 */
export function getSlotCoverageTotalWeekly(slot: SlotLike): number {
  const assignments = slot.assignments ?? []
  const totalFromAssignments = assignments.reduce(
    (sum, a) => sum + getAssignmentCoverageWeight(a),
    0
  )
  const absencePenalty = (slot.absences ?? []).length
  return totalFromAssignments - absencePenalty
}

/**
 * Total coverage for a slot in Baseline context.
 * Baseline does not consider time-based events: only Permanent (1), Flex (1), Floater (0.5).
 * Subs and absences are excluded; temp coverage (staffing_events) is excluded when present in data.
 */
export function getSlotCoverageTotalBaseline(slot: SlotLike): number {
  const assignments = slot.assignments ?? []
  const baselineAssignments = assignments.filter(a => a.teacher_id && !a.is_substitute)
  return baselineAssignments.reduce((sum, a) => sum + getAssignmentCoverageWeight(a), 0)
}
