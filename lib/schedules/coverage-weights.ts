/**
 * Coverage weight rules for comparing slot staffing to required/preferred ratios.
 * Used by Weekly schedule, Baseline schedule, and Dashboard (below-staffing section).
 * See AGENTS.md "Coverage counting (staff who count toward ratios)" for context.
 *
 * Partial shift assignment weights (Phase 1):
 * - Full assignment = 1.0
 * - Partial assignment = 0.5 (approximate; time-weighted logic deferred to Phase 2)
 * - 2+ partials on the same shift = fully_covered (weights cap at 1.0 per shift)
 */

// ---------------------------------------------------------------------------
// Shared copy constants — import from here; do NOT hardcode in UI components
// ---------------------------------------------------------------------------

/** Short "(approx.)" label appended to any partial coverage count/badge */
export const PARTIAL_APPROX_LABEL = '(approx.)'

/** Tooltip text explaining Phase 1 approximation used on all approx surfaces */
export const PARTIAL_APPROX_TOOLTIP =
  'Each partial assignment counts as approximately 50% coverage. Exact time-based coverage coming in a future update.'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AssignmentLike = {
  teacher_id?: string | null
  is_floater?: boolean
  is_substitute?: boolean
  is_flexible?: boolean
  /** Phase 1: set when this is a partial (split-shift) sub assignment */
  is_partial?: boolean
}

export type SlotLike = {
  assignments?: AssignmentLike[]
  absences?: unknown[]
}

/** Minimal shape needed to derive shift coverage status */
export type ShiftAssignmentSummary = {
  /** Each entry is one active sub_assignment for this shift */
  assignments: Array<{ is_partial: boolean }>
}

// ---------------------------------------------------------------------------
// Per-assignment weights
// ---------------------------------------------------------------------------

/**
 * Weight for a single assignment when counting toward coverage.
 * Permanent = 1, Flex = 1, Temp coverage = 1, Sub = 1, Floater = 0.5.
 * Partial sub = 0.5 (Phase 1 approximation).
 * (Floater and partial weights may become more sophisticated later; keep logic here.)
 */
export function getAssignmentCoverageWeight(a: AssignmentLike): number {
  if (!a.teacher_id) return 0
  if (a.is_floater) return 0.5
  if (a.is_partial) return 0.5
  return 1
}

/**
 * Weight for a partial sub assignment (Phase 1 fixed approximation).
 * Kept as a named constant so Phase 2 can swap in interval-based logic here.
 */
export function getPartialAssignmentWeight(): number {
  return 0.5
}

// ---------------------------------------------------------------------------
// Shift-level coverage status (centralized — use everywhere, no duplication)
// ---------------------------------------------------------------------------

/**
 * Derives coverage status for a single absence shift based on its active assignments.
 *
 * Rules (Phase 1):
 *  - uncovered:        zero active assignments
 *  - partially_covered: one or more partial assignments, combined weight < 1.0
 *  - fully_covered:    one full assignment OR 2+ partial assignments (weight >= 1.0)
 *
 * All API routes (find-subs-manual, dashboard/overview, assign-sub/shifts) must call this
 * helper instead of duplicating the logic inline.
 */
export function deriveShiftCoverageStatus(
  shift: ShiftAssignmentSummary
): 'uncovered' | 'partially_covered' | 'fully_covered' {
  const { assignments } = shift
  if (assignments.length === 0) return 'uncovered'

  const hasFull = assignments.some(a => !a.is_partial)
  if (hasFull) return 'fully_covered'

  // All are partial
  const totalWeight = assignments.reduce((sum, a) => sum + getPartialAssignmentWeight(), 0)
  return totalWeight >= 1.0 ? 'fully_covered' : 'partially_covered'
}

// ---------------------------------------------------------------------------
// Slot-level totals (used by Weekly and Baseline schedule grids)
// ---------------------------------------------------------------------------

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
