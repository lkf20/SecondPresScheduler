import 'server-only'

import { createClient } from '@/lib/supabase/server'

export type AuditCategory =
  | 'time_off'
  | 'sub_assignment'
  | 'baseline_schedule'
  | 'flex_assignment'
  | 'staff'
  | 'coverage'
  | 'system'
  | 'unknown'

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'status_change'
  | 'assign'
  | 'unassign'
  | 'cancel'

type AuditActorContext = {
  actorUserId: string | null
  actorDisplayName: string | null
}

const isDev = process.env.NODE_ENV !== 'production'

function getBestDisplayName(profile: { first_name?: string | null; last_name?: string | null }) {
  const firstName = profile.first_name?.trim() || ''
  const lastName = profile.last_name?.trim() || ''
  const fullName = `${firstName} ${lastName}`.trim()
  return fullName || null
}

export async function getAuditActorContext(): Promise<AuditActorContext> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { actorUserId: null, actorDisplayName: null }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('user_id', user.id)
    .maybeSingle()

  return {
    actorUserId: user.id,
    actorDisplayName: getBestDisplayName(profile || {}),
  }
}

export async function logAuditEvent(params: {
  schoolId: string
  actorUserId: string | null
  actorDisplayName?: string | null
  action: AuditAction
  category: AuditCategory
  entityType: string
  entityId?: string | null
  details?: Record<string, any> | null
}): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('audit_log').insert({
      school_id: params.schoolId,
      actor_user_id: params.actorUserId ?? null,
      actor_display_name: params.actorDisplayName ?? null,
      action: params.action,
      category: params.category,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      details: params.details ?? null,
    })

    if (error) {
      if (isDev) {
        console.error('[audit] insert failed', error)
      }
      return false
    }

    return true
  } catch (error) {
    if (isDev) {
      console.error('[audit] unexpected error', error)
    }
    return false
  }
}
