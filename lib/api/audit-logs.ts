import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import type { TeacherScheduleAuditLog } from '@/types/api'

type AuditLogRow = Database['public']['Tables']['teacher_schedule_audit_log']['Row']
type AuditLogInsert = Database['public']['Tables']['teacher_schedule_audit_log']['Insert']

export interface AuditLogData {
  teacher_schedule_id?: string | null
  teacher_id: string
  action: 'created' | 'updated' | 'deleted' | 'conflict_resolved'
  action_details?: Record<string, unknown> | null
  removed_from_classroom_id?: string | null
  removed_from_day_id?: string | null
  removed_from_time_slot_id?: string | null
  added_to_classroom_id?: string | null
  added_to_day_id?: string | null
  added_to_time_slot_id?: string | null
  reason?: string | null
  user_id?: string | null
}

export interface AuditLogFilters {
  teacher_id?: string
  teacher_schedule_id?: string
  action?: 'created' | 'updated' | 'deleted' | 'conflict_resolved'
  reason?: string
  start_date?: string
  end_date?: string
}

export async function createTeacherScheduleAuditLog(log: AuditLogData): Promise<AuditLogRow> {
  const supabase = await createClient()
  
  const insertData: AuditLogInsert = {
    teacher_schedule_id: log.teacher_schedule_id ?? null,
    teacher_id: log.teacher_id,
    action: log.action,
    action_details: log.action_details ?? null,
    removed_from_classroom_id: log.removed_from_classroom_id ?? null,
    removed_from_day_id: log.removed_from_day_id ?? null,
    removed_from_time_slot_id: log.removed_from_time_slot_id ?? null,
    added_to_classroom_id: log.added_to_classroom_id ?? null,
    added_to_day_id: log.added_to_day_id ?? null,
    added_to_time_slot_id: log.added_to_time_slot_id ?? null,
    reason: log.reason ?? null,
    user_id: log.user_id ?? null,
  }

  const { data, error } = await supabase
    .from('teacher_schedule_audit_log')
    .insert(insertData)
    .select()
    .single()

  if (error) throw error
  return data as AuditLogRow
}

export async function getTeacherScheduleAuditLogs(
  filters?: AuditLogFilters
): Promise<TeacherScheduleAuditLog[]> {
  const supabase = await createClient()
  
  let query = supabase
    .from('teacher_schedule_audit_log')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters?.teacher_id) {
    query = query.eq('teacher_id', filters.teacher_id)
  }

  if (filters?.teacher_schedule_id) {
    query = query.eq('teacher_schedule_id', filters.teacher_schedule_id)
  }

  if (filters?.action) {
    query = query.eq('action', filters.action)
  }

  if (filters?.reason) {
    query = query.eq('reason', filters.reason)
  }

  if (filters?.start_date) {
    query = query.gte('created_at', filters.start_date)
  }

  if (filters?.end_date) {
    query = query.lte('created_at', filters.end_date)
  }

  const { data, error } = await query

  if (error) throw error
  return data as TeacherScheduleAuditLog[]
}


