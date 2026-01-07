import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId, getCurrentUserId } from '@/lib/utils/auth'

interface AuditLogEntry {
  action: string
  entity_type: string
  entity_id?: string | null
  details?: Record<string, any>
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
