import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'

const isDev = process.env.NODE_ENV !== 'production'

type CursorPayload = {
  createdAt: string
  id: string
}

function encodeCursor(payload: CursorPayload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function decodeCursor(raw: string): CursorPayload | null {
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8')
    const parsed = JSON.parse(decoded) as CursorPayload
    if (!parsed.createdAt || !parsed.id) return null
    return parsed
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const rawCategory = searchParams.get('category')
    const actorUserId = searchParams.get('actor_user_id')
    const rawCursor = searchParams.get('cursor')
    const rawLimit = Number(searchParams.get('limit') || 25)
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 25

    const categories =
      rawCategory
        ?.split(',')
        .map(value => value.trim())
        .filter(Boolean)
        .filter(value => value !== 'all') || []

    const cursor = rawCursor ? decodeCursor(rawCursor) : null

    const supabase = await createClient()

    const buildAuditQuery = (useCategoryFilter: boolean) => {
      let query = supabase
        .from('audit_log')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1)

      if (useCategoryFilter && categories.length > 0) {
        query = query.in('category', categories)
      }
      if (actorUserId) {
        query = query.eq('actor_user_id', actorUserId)
      }
      if (cursor) {
        query = query.or(
          `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
        )
      }
      return query
    }

    let usingV2Columns = true
    let { data: rows, error } = await buildAuditQuery(true)
    if (error && error.code === '42703') {
      usingV2Columns = false
      const fallback = await buildAuditQuery(false)
      rows = fallback.data
      error = fallback.error
    }

    if (error) {
      console.error('[activity] query failed', error)
      const isPermissionError = error.code === '42501'
      return NextResponse.json(
        {
          error: isPermissionError
            ? 'You do not have access to the Activity Log.'
            : 'Failed to fetch activity feed',
          ...(isDev
            ? {
                details: {
                  code: error.code,
                  message: error.message,
                  hint: error.hint,
                },
              }
            : {}),
        },
        { status: isPermissionError ? 403 : 500 }
      )
    }

    const records = (rows || []) as any[]
    const hasMore = records.length > limit
    const pageRows = (hasMore ? records.slice(0, limit) : records) as any[]

    const missingActorIds = Array.from(
      new Set(
        pageRows
          .filter(row => !(row as any).actor_display_name && row.actor_user_id)
          .map(row => row.actor_user_id as string)
      )
    )

    const actorNameByUserId = new Map<string, string>()
    if (missingActorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', missingActorIds)

      ;(profiles || []).forEach(profile => {
        const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
        if (fullName) {
          actorNameByUserId.set(profile.user_id, fullName)
        }
      })
    }

    const normalizedRows = pageRows.map(row => ({
      id: row.id,
      created_at: row.created_at,
      action: row.action,
      category: (row as any).category || 'unknown',
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      details: row.details,
      actor_user_id: row.actor_user_id,
      actor_display_name:
        (row as any).actor_display_name ||
        (row.actor_user_id ? actorNameByUserId.get(row.actor_user_id) : null) ||
        'System',
    }))

    // Actor filter options (simple/fast: latest 500 log rows)
    const { data: actorRows } = await supabase
      .from('audit_log')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(500)

    const actorIds = Array.from(
      new Set((actorRows || []).map(row => row.actor_user_id).filter(Boolean) as string[])
    )
    const actorProfileNameById = new Map<string, string>()

    if (actorIds.length > 0) {
      const { data: actorProfiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', actorIds)

      ;(actorProfiles || []).forEach(profile => {
        const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
        if (fullName) {
          actorProfileNameById.set(profile.user_id, fullName)
        }
      })
    }

    const actorMap = new Map<string, { id: string; name: string }>()
    ;((actorRows || []) as any[]).forEach(row => {
      if (!row.actor_user_id) return
      if (actorMap.has(row.actor_user_id)) return
      const name =
        (row as any).actor_display_name ||
        actorProfileNameById.get(row.actor_user_id) ||
        'Unknown User'
      actorMap.set(row.actor_user_id, { id: row.actor_user_id, name })
    })

    const actors = Array.from(actorMap.values()).sort((a, b) => a.name.localeCompare(b.name))
    const lastCreatedAt = pageRows[pageRows.length - 1]?.created_at
    const nextCursor =
      hasMore && pageRows.length > 0 && lastCreatedAt
        ? encodeCursor({
            createdAt: lastCreatedAt as string,
            id: pageRows[pageRows.length - 1].id,
          })
        : null

    return NextResponse.json({
      rows: normalizedRows,
      nextCursor,
      actors,
    })
  } catch (error) {
    console.error('[activity] unexpected error', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch activity feed',
        ...(isDev && error instanceof Error ? { details: { message: error.message } } : {}),
      },
      { status: 500 }
    )
  }
}
