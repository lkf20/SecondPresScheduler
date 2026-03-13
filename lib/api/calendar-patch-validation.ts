import { NextResponse } from 'next/server'

/** Single-day add: date + optional time_slot_id, reason, notes */
export interface AddClosureSingle {
  date: string
  time_slot_id?: string | null
  reason?: string | null
  notes?: string | null
}

/** Range add: start_date, end_date + optional reason, notes */
export interface AddClosureRange {
  start_date: string
  end_date: string
  reason?: string | null
  notes?: string | null
}

export type AddClosureItem = AddClosureSingle | AddClosureRange

export function isAddClosureRange(item: AddClosureItem): item is AddClosureRange {
  return (
    'start_date' in item && 'end_date' in item && item.start_date != null && item.end_date != null
  )
}

export interface UpdateClosureItem {
  id: string
  reason?: string | null
  notes?: string | null
}

export interface NormalizedCalendarPatch {
  updateClosures: UpdateClosureItem[]
  addClosures: AddClosureItem[]
  deleteClosureIds: string[]
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function parseBody(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

/**
 * Validate and normalize PATCH body for /api/settings/calendar.
 * Run before any DB mutation. Returns 400 response if invalid.
 */
export function validateCalendarPatchBody(body: unknown):
  | {
      valid: true
      normalized: NormalizedCalendarPatch
    }
  | {
      valid: false
      response: NextResponse
    } {
  const b = parseBody(body)
  if (!b) {
    return {
      valid: false,
      response: NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 }),
    }
  }

  const updateClosures: UpdateClosureItem[] = []
  const addClosures: AddClosureItem[] = []
  let deleteClosureIds: string[] = []

  // --- update_closure (singular) ---
  if (b.update_closure != null && typeof b.update_closure === 'object') {
    const u = b.update_closure as Record<string, unknown>
    const id = u.id
    if (!id || typeof id !== 'string') {
      return {
        valid: false,
        response: NextResponse.json({ error: 'update_closure.id is required' }, { status: 400 }),
      }
    }
    updateClosures.push({
      id,
      reason: u.reason !== undefined ? (u.reason as string | null) : undefined,
      notes: u.notes !== undefined ? (u.notes as string | null) : undefined,
    })
  }

  // --- update_closures (array) ---
  if (Array.isArray(b.update_closures)) {
    for (let i = 0; i < b.update_closures.length; i++) {
      const u = b.update_closures[i]
      if (u == null || typeof u !== 'object') {
        return {
          valid: false,
          response: NextResponse.json(
            { error: `update_closures[${i}] must be an object with id` },
            { status: 400 }
          ),
        }
      }
      const row = u as Record<string, unknown>
      const id = row.id
      if (!id || typeof id !== 'string') {
        return {
          valid: false,
          response: NextResponse.json(
            { error: 'update_closures[].id is required' },
            { status: 400 }
          ),
        }
      }
      updateClosures.push({
        id,
        reason: row.reason !== undefined ? (row.reason as string | null) : undefined,
        notes: row.notes !== undefined ? (row.notes as string | null) : undefined,
      })
    }
  }

  // --- add_closure (singular) ---
  if (b.add_closure != null && typeof b.add_closure === 'object') {
    const err = validateAddClosureItem(b.add_closure as Record<string, unknown>, 'add_closure')
    if (err) return { valid: false, response: err }
    addClosures.push(normalizeAddItem(b.add_closure as Record<string, unknown>))
  }

  // --- add_closures (array) ---
  if (Array.isArray(b.add_closures)) {
    for (let i = 0; i < b.add_closures.length; i++) {
      const item = b.add_closures[i]
      if (item == null || typeof item !== 'object') {
        return {
          valid: false,
          response: NextResponse.json(
            { error: `add_closures[${i}] must be an object` },
            { status: 400 }
          ),
        }
      }
      const err = validateAddClosureItem(item as Record<string, unknown>, `add_closures[${i}]`)
      if (err) return { valid: false, response: err }
      addClosures.push(normalizeAddItem(item as Record<string, unknown>))
    }
  }

  // --- delete_closure_ids ---
  if (Array.isArray(b.delete_closure_ids)) {
    for (const id of b.delete_closure_ids) {
      if (typeof id === 'string') deleteClosureIds.push(id)
    }
  }

  return {
    valid: true,
    normalized: {
      updateClosures,
      addClosures,
      deleteClosureIds,
    },
  }
}

function validateAddClosureItem(
  item: Record<string, unknown>,
  context: string
): NextResponse | null {
  const hasRange = item.start_date != null && item.end_date != null
  const hasSingle = item.date != null

  if (hasRange) {
    const start = item.start_date
    const end = item.end_date
    if (typeof start !== 'string' || typeof end !== 'string') {
      return NextResponse.json(
        { error: `${context}.start_date and end_date must be strings (YYYY-MM-DD)` },
        { status: 400 }
      )
    }
    if (!ISO_DATE.test(start) || !ISO_DATE.test(end)) {
      return NextResponse.json(
        { error: `${context}.start_date and end_date must be YYYY-MM-DD` },
        { status: 400 }
      )
    }
    if (start > end) {
      return NextResponse.json(
        { error: `${context}.start_date must be on or before end_date` },
        { status: 400 }
      )
    }
    const days =
      Math.ceil(
        (new Date(end + 'T12:00:00').getTime() - new Date(start + 'T12:00:00').getTime()) /
          (24 * 60 * 60 * 1000)
      ) + 1
    if (days > 365) {
      return NextResponse.json({ error: 'Date range cannot exceed 365 days' }, { status: 400 })
    }
    return null
  }

  if (hasSingle) {
    const date = item.date
    if (typeof date !== 'string') {
      return NextResponse.json(
        {
          error:
            context === 'add_closure'
              ? 'add_closure.date is required'
              : `${context}.date is required and must be a string`,
        },
        { status: 400 }
      )
    }
    if (!ISO_DATE.test(date)) {
      return NextResponse.json({ error: `${context}.date must be YYYY-MM-DD` }, { status: 400 })
    }
    return null
  }

  return NextResponse.json(
    {
      error:
        context === 'add_closure'
          ? 'add_closure.date is required'
          : `${context}: provide date (single day) or start_date and end_date (range)`,
    },
    { status: 400 }
  )
}

function normalizeAddItem(item: Record<string, unknown>): AddClosureItem {
  if (item.start_date != null && item.end_date != null) {
    return {
      start_date: item.start_date as string,
      end_date: item.end_date as string,
      reason: item.reason as string | null | undefined,
      notes: item.notes as string | null | undefined,
    }
  }
  return {
    date: item.date as string,
    time_slot_id: item.time_slot_id as string | null | undefined,
    reason: item.reason as string | null | undefined,
    notes: item.notes as string | null | undefined,
  }
}
