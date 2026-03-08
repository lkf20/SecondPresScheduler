/**
 * Filters coverage requests so only those backed by an active time off request
 * are kept. Used by the dashboard overview so "Upcoming Time Off & Coverage"
 * shows only active time off, not drafts.
 *
 * See docs/data-lifecycle.md and scenarios/gold/08-time-off-list-draft-badge-and-status.md.
 */
export function filterCoverageRequestsToActiveTimeOffOnly<
  T extends { request_type?: string; source_request_id?: string | null },
>(requests: T[], activeTimeOffRequestIds: Set<string>): T[] {
  return requests.filter(
    cr =>
      cr.request_type !== 'time_off' ||
      (cr.source_request_id != null && activeTimeOffRequestIds.has(cr.source_request_id))
  )
}
