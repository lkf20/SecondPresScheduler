/**
 * Validates an audit log entry against the contract in docs/contracts/AUDIT_LOG_CONTRACT.md.
 * Use this to ensure every log answers: who, what, to what, when, what changed, context.
 */

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'status_change'
  | 'assign'
  | 'unassign'
  | 'cancel'

export type AuditCategory =
  | 'time_off'
  | 'sub_assignment'
  | 'baseline_schedule'
  | 'flex_assignment'
  | 'staff'
  | 'coverage'
  | 'system'
  | 'unknown'

export type AuditLogEntryInput = {
  schoolId: string
  actorUserId?: string | null
  actorDisplayName?: string | null
  action: AuditAction
  category: AuditCategory
  entityType: string
  entityId?: string | null
  details?: Record<string, unknown> | null
}

export type ValidationResult = {
  valid: boolean
  errors: string[]
}

const ACTIONS: AuditAction[] = [
  'create',
  'update',
  'delete',
  'status_change',
  'assign',
  'unassign',
  'cancel',
]
const CATEGORIES: AuditCategory[] = [
  'time_off',
  'sub_assignment',
  'baseline_schedule',
  'flex_assignment',
  'staff',
  'coverage',
  'system',
  'unknown',
]

/** Human-readable detail keys that must appear when the entity involves people or places. */
const HUMAN_READABLE_KEYS = [
  'teacher_name',
  'sub_name',
  'classroom_name',
  'day_name',
  'time_slot_code',
  'time_slot_codes',
  'summary',
  'added_to_classroom_name',
  'removed_from_classroom_name',
  'added_to_day_name',
  'removed_from_day_name',
  'added_to_time_slot_code',
  'removed_from_time_slot_code',
] as const

/** For these action+entity combos, at least one human-readable key is required in details. */
const REQUIRES_READABLE: Array<{
  category: AuditCategory
  entityType: string
  action: AuditAction
}> = [
  { category: 'baseline_schedule', entityType: 'teacher_schedule', action: 'assign' },
  { category: 'baseline_schedule', entityType: 'teacher_schedule', action: 'unassign' },
  { category: 'baseline_schedule', entityType: 'teacher_schedule', action: 'update' },
  { category: 'baseline_schedule', entityType: 'schedule_cell', action: 'create' },
  { category: 'baseline_schedule', entityType: 'schedule_cell', action: 'update' },
  { category: 'baseline_schedule', entityType: 'schedule_cell', action: 'delete' },
  { category: 'time_off', entityType: 'time_off_request', action: 'create' },
  { category: 'time_off', entityType: 'time_off_request', action: 'cancel' },
  { category: 'time_off', entityType: 'time_off_request', action: 'status_change' },
  { category: 'sub_assignment', entityType: 'coverage_request', action: 'assign' },
  { category: 'sub_assignment', entityType: 'coverage_request', action: 'unassign' },
]

/** Actions that must have non-empty details. */
const DETAILS_REQUIRED_ACTIONS: AuditAction[] = ['create', 'update', 'delete', 'assign', 'unassign']

/**
 * Validates an audit log entry against the contract.
 * Returns { valid: true } or { valid: false, errors: [...] }.
 */
export function validateAuditLogEntry(entry: AuditLogEntryInput): ValidationResult {
  const errors: string[] = []

  // --- Required top-level ---
  if (!entry.schoolId || typeof entry.schoolId !== 'string') {
    errors.push('school_id is required and must be a non-empty string')
  }
  if (!ACTIONS.includes(entry.action)) {
    errors.push(`action must be one of: ${ACTIONS.join(', ')}`)
  }
  if (!CATEGORIES.includes(entry.category)) {
    errors.push(`category must be one of: ${CATEGORIES.join(', ')}`)
  }
  if (!entry.entityType || typeof entry.entityType !== 'string') {
    errors.push('entity_type is required and must be a non-empty string')
  }

  const hasActor = Boolean(entry.actorUserId ?? entry.actorDisplayName)
  if (!hasActor && entry.category !== 'system' && entry.category !== 'unknown') {
    errors.push('actor_user_id or actor_display_name should be set for user-initiated actions')
  }

  const details: Record<string, unknown> = entry.details ?? {}
  const detailsKeys = Object.keys(details)
  const isEmptyDetails = detailsKeys.length === 0

  // --- No empty/trivial details for key actions ---
  if (DETAILS_REQUIRED_ACTIONS.includes(entry.action) && isEmptyDetails) {
    errors.push(
      `details must be present and non-empty for action "${entry.action}" (contract: who, what, to what, what changed, context)`
    )
  }

  // --- Generic "update" rule: must indicate what changed ---
  if (entry.action === 'update' && !isEmptyDetails) {
    const hasUpdatedFields =
      Array.isArray(details.updated_fields) && details.updated_fields.length > 0
    const actionDetails = details.action_details as Record<string, unknown> | undefined
    const hasBeforeAfter =
      (details['before'] !== undefined && details['after'] !== undefined) ||
      (actionDetails?.['before'] !== undefined && actionDetails?.['after'] !== undefined)
    const hasBulkSummary =
      details.bulk === true &&
      (typeof details.cell_count === 'number' || typeof details.summary === 'string')
    if (!hasUpdatedFields && !hasBeforeAfter && !hasBulkSummary) {
      errors.push(
        'update action must include updated_fields, before/after, or (for bulk) cell_count/summary so "what changed" is clear'
      )
    }
  }

  // --- Human-readable names required for certain category+entity+action ---
  const needsReadable = REQUIRES_READABLE.some(
    r =>
      r.category === entry.category &&
      r.entityType === entry.entityType &&
      r.action === entry.action
  )
  if (needsReadable && !isEmptyDetails) {
    const hasAnyReadable = HUMAN_READABLE_KEYS.some(
      k => details[k] != null && String(details[k]).trim() !== ''
    )
    if (!hasAnyReadable) {
      errors.push(
        `details must include at least one human-readable field (e.g. teacher_name, classroom_name, day_name, time_slot_code, summary) for ${entry.category}/${entry.entityType}/${entry.action}`
      )
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
