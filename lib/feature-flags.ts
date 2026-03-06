/**
 * Feature flags for optional or in-progress features.
 * Toggle here to show/hide UI without removing code. Backend may still accept
 * and store the data so re-enabling is a single flip.
 */

/**
 * When false: Coverage Type (Extra vs Break) and Break Coverage fields
 * (teacher taking break, start/end time) are hidden in Add/Edit Temporary
 * Coverage. Grid and PDF do not show "Break Coverage" styling; existing
 * break assignments appear as standard temporary coverage.
 * Backend continues to accept event_category, covered_staff_id, start_time,
 * end_time for future re-enable.
 */
export const BREAK_COVERAGE_ENABLED = false
