import { getUserSchoolId, getCurrentUserId } from '@/lib/utils/auth'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'

interface AuditLogEntry {
  action: string
  entity_type: string
  entity_id?: string | null
  details?: Record<string, unknown>
}

function normalizeAuditAction(action: string) {
  const normalized = action.toLowerCase()
  if (normalized.includes('create')) return 'create' as const
  if (normalized.includes('delete') || normalized.includes('remove')) return 'delete' as const
  if (normalized.includes('cancel')) return 'cancel' as const
  if (normalized.includes('assign')) return 'assign' as const
  if (normalized.includes('unassign')) return 'unassign' as const
  if (normalized.includes('status')) return 'status_change' as const
  return 'update' as const
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  const schoolId = await getUserSchoolId()
  const userId = await getCurrentUserId()

  if (!schoolId || !userId) {
    console.error('Cannot create audit log: missing school_id or user_id')
    return
  }

  await logAuditEvent({
    schoolId,
    actorUserId: userId,
    action: normalizeAuditAction(entry.action),
    category: 'unknown',
    entityType: entry.entity_type,
    entityId: entry.entity_id || null,
    details: {
      legacy_action: entry.action,
      ...(entry.details || {}),
    },
  })
}

/**
 * Create a teacher schedule audit log entry
 * Wrapper function for teacher schedule specific audit logging
 */
export async function createTeacherScheduleAuditLog(data: {
  teacher_schedule_id?: string
  teacher_id: string
  action: string
  action_details?: Record<string, unknown>
  removed_from_classroom_id?: string
  removed_from_day_id?: string
  removed_from_time_slot_id?: string
  added_to_classroom_id?: string
  added_to_day_id?: string
  added_to_time_slot_id?: string
  reason?: string
}): Promise<void> {
  await createAuditLog({
    action: data.action,
    entity_type: 'teacher_schedule',
    entity_id: data.teacher_schedule_id || null,
    details: {
      teacher_id: data.teacher_id,
      action_details: data.action_details,
      removed_from_classroom_id: data.removed_from_classroom_id,
      removed_from_day_id: data.removed_from_day_id,
      removed_from_time_slot_id: data.removed_from_time_slot_id,
      added_to_classroom_id: data.added_to_classroom_id,
      added_to_day_id: data.added_to_day_id,
      added_to_time_slot_id: data.added_to_time_slot_id,
      reason: data.reason,
    },
  })
}
