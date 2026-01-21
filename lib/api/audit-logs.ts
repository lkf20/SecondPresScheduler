import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId, getCurrentUserId } from '@/lib/utils/auth'

interface AuditLogEntry {
  action: string
  entity_type: string
  entity_id?: string | null
  details?: Record<string, unknown>
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  const supabase = await createClient()
  
  const schoolId = await getUserSchoolId()
  const userId = await getCurrentUserId()
  
  if (!schoolId || !userId) {
    console.error('Cannot create audit log: missing school_id or user_id')
    return
  }

  const { error } = await supabase.from('audit_log').insert({
    school_id: schoolId,
    actor_user_id: userId,
    action: entry.action,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id || null,
    details: entry.details || null,
  })

  if (error) {
    console.error('Error creating audit log:', error)
  }
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
