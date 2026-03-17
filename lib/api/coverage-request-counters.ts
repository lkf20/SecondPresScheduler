/**
 * Shared reconcile helper for coverage_requests counters.
 *
 * The database trigger (update_coverage_request_covered_shifts) handles real-time
 * counter maintenance for individual INSERT/UPDATE/DELETE operations. This function
 * acts as a safety-net reconcile: it recomputes covered_shifts from scratch using
 * COUNT(DISTINCT coverage_request_shift_id) and corrects both the counter AND
 * the status ('open'/'filled').
 *
 * Call this after any write path that cancels sub_assignments (e.g. unassign-shifts,
 * time-off cancel flows) in addition to the assign-shifts route which already calls it.
 *
 * Naturally handles multi-partial assignments: COUNT(DISTINCT ...) counts a shift as
 * covered once regardless of how many partial assignments it has.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Reconcile covered_shifts and status for a single coverage request.
 * Updates the row only when values differ from the accurate count (avoids no-op writes).
 */
export async function reconcileCoverageRequestCounters(
  supabase: SupabaseClient,
  coverageRequestId: string
): Promise<void> {
  const [
    { count: totalActiveShifts, error: totalError },
    { data: coveredRows, error: coveredError },
  ] = await Promise.all([
    supabase
      .from('coverage_request_shifts')
      .select('id', { count: 'exact', head: true })
      .eq('coverage_request_id', coverageRequestId)
      .eq('status', 'active'),
    supabase
      .from('sub_assignments')
      .select(
        'coverage_request_shift_id, coverage_request_shifts!inner(coverage_request_id, status)'
      )
      .eq('status', 'active')
      .eq('coverage_request_shifts.coverage_request_id', coverageRequestId)
      .eq('coverage_request_shifts.status', 'active'),
  ])

  if (totalError) throw totalError
  if (coveredError) throw coveredError

  const total = totalActiveShifts || 0
  const coveredDistinct = new Set(
    (coveredRows || [])
      .map((row: { coverage_request_shift_id: unknown }) => row.coverage_request_shift_id)
      .filter((value): value is string => Boolean(value))
  ).size
  const covered = Math.min(coveredDistinct, total)
  const newStatus = total > 0 && covered === total ? 'filled' : 'open'

  const { error: updateError } = await supabase
    .from('coverage_requests')
    .update({
      total_shifts: total,
      covered_shifts: covered,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', coverageRequestId)
    .in('status', ['open', 'filled'])

  if (updateError) throw updateError
}
