import { NextRequest, NextResponse } from 'next/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import {
  getCalendarSettings,
  updateCalendarSettings,
  getSchoolClosuresForDateRange,
  getSchoolClosuresByIds,
  createSchoolClosure,
  createSchoolClosureRange,
  updateSchoolClosure,
  deleteSchoolClosure,
  applySchoolClosureChanges,
} from '@/lib/api/school-calendar'
import {
  validateCalendarPatchBody,
  isAddClosureRange,
  type NormalizedCalendarPatch,
  type AddClosureSingle,
  type AddClosureRange,
} from '@/lib/api/calendar-patch-validation'
import { getAuditActorContext, logAuditEvent } from '@/lib/audit/logAuditEvent'
import { validateAuditLogEntry } from '@/lib/audit/validateAuditLog'

/**
 * GET /api/settings/calendar
 * Returns calendar settings (first_day_of_school, last_day_of_school) and optionally
 * school closures for a date range (query params: startDate, endDate).
 */
export async function GET(request: NextRequest) {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json(
        { error: 'User profile not found or missing school_id.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const [settings, closures] = await Promise.all([
      getCalendarSettings(schoolId),
      startDate && endDate
        ? getSchoolClosuresForDateRange(schoolId, startDate, endDate)
        : Promise.resolve([]),
    ])

    return NextResponse.json({
      first_day_of_school: settings?.first_day_of_school ?? null,
      last_day_of_school: settings?.last_day_of_school ?? null,
      school_closures: closures,
    })
  } catch (error: unknown) {
    console.error('Error fetching calendar settings:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch calendar settings' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/settings/calendar
 * Updates calendar settings and/or manages school closures.
 * Body: { first_day_of_school?, last_day_of_school?, update_closure?, update_closures?, add_closure?, add_closures?, delete_closure_ids? }
 * Closure body is validated before any mutation. When both delete and add are present, an RPC runs them in one transaction.
 */
export async function PATCH(request: NextRequest) {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json(
        { error: 'User profile not found or missing school_id.' },
        { status: 403 }
      )
    }

    const actor = await getAuditActorContext()
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    // Validate closure-related fields before any mutation
    const validation = validateCalendarPatchBody(body)
    if (!validation.valid) return validation.response
    const normalized: NormalizedCalendarPatch = validation.normalized

    // --- Calendar settings (first/last day of school) ---
    if (body.first_day_of_school !== undefined || body.last_day_of_school !== undefined) {
      const before = await getCalendarSettings(schoolId)
      await updateCalendarSettings(schoolId, {
        first_day_of_school: body.first_day_of_school as string | null | undefined,
        last_day_of_school: body.last_day_of_school as string | null | undefined,
      })
      const after = await getCalendarSettings(schoolId)
      const updatedFields: string[] = []
      if (body.first_day_of_school !== undefined) updatedFields.push('first_day_of_school')
      if (body.last_day_of_school !== undefined) updatedFields.push('last_day_of_school')
      const summary = [
        after?.first_day_of_school ? `First day: ${after.first_day_of_school}` : null,
        after?.last_day_of_school ? `Last day: ${after.last_day_of_school}` : null,
      ]
        .filter(Boolean)
        .join(', ')
      const auditEntry = {
        schoolId,
        actorUserId: actor.actorUserId,
        actorDisplayName: actor.actorDisplayName,
        action: 'update' as const,
        category: 'school_calendar' as const,
        entityType: 'calendar_settings',
        entityId: null,
        details: {
          updated_fields: updatedFields,
          before: {
            first_day_of_school: before?.first_day_of_school ?? null,
            last_day_of_school: before?.last_day_of_school ?? null,
          },
          after: {
            first_day_of_school: after?.first_day_of_school ?? null,
            last_day_of_school: after?.last_day_of_school ?? null,
          },
          summary: summary || 'School year dates',
        },
      }
      if (validateAuditLogEntry(auditEntry).valid) {
        await logAuditEvent(auditEntry)
      }
    }

    // --- Update closures in place (reason/notes only; preserves row ids) ---
    for (const item of normalized.updateClosures) {
      const { id: closureId, reason, notes } = item
      const before = await getSchoolClosuresByIds(schoolId, [closureId]).then(a => a[0])
      if (!before) {
        return NextResponse.json({ error: `Closure not found: ${closureId}` }, { status: 404 })
      }
      const updated = await updateSchoolClosure(schoolId, closureId, {
        reason: reason !== undefined ? reason : before.reason,
        notes: notes !== undefined ? notes : before.notes,
      })
      const wholeDay = updated.time_slot_id === null
      const summary = wholeDay
        ? `${updated.date} (whole day)${updated.reason ? `: ${updated.reason}` : ''}`
        : `${updated.date} (time slot)${updated.reason ? `: ${updated.reason}` : ''}`
      const auditEntry = {
        schoolId,
        actorUserId: actor.actorUserId,
        actorDisplayName: actor.actorDisplayName,
        action: 'update' as const,
        category: 'school_calendar' as const,
        entityType: 'school_closure',
        entityId: updated.id,
        details: {
          before: { reason: before.reason, notes: before.notes },
          after: { reason: updated.reason, notes: updated.notes },
          date: updated.date,
          time_slot_id: updated.time_slot_id,
          whole_day: wholeDay,
          summary,
        },
      }
      if (validateAuditLogEntry(auditEntry).valid) {
        await logAuditEvent(auditEntry)
      }
    }

    // --- Add / delete closures ---
    const hasDeletes = normalized.deleteClosureIds.length > 0
    const hasAdds = normalized.addClosures.length > 0
    const hasShapeUpdates = normalized.updateClosureShapes.length > 0

    if (hasShapeUpdates) {
      // In-place path: delete surplus, update shapes, add extras. Preserves row ids for audit.
      for (const id of normalized.deleteClosureIds) {
        const toDelete = await getSchoolClosuresByIds(schoolId, [id]).then(a => a[0])
        if (!toDelete) {
          return NextResponse.json({ error: `Closure not found: ${id}` }, { status: 404 })
        }
        await deleteSchoolClosure(schoolId, id)
        const wholeDay = toDelete.time_slot_id === null
        const summary = wholeDay
          ? `${toDelete.date} (whole day)${toDelete.reason ? `: ${toDelete.reason}` : ''}`
          : `${toDelete.date} (time slot)${toDelete.reason ? `: ${toDelete.reason}` : ''}`
        const auditEntry = {
          schoolId,
          actorUserId: actor.actorUserId,
          actorDisplayName: actor.actorDisplayName,
          action: 'delete' as const,
          category: 'school_calendar' as const,
          entityType: 'school_closure',
          entityId: toDelete.id,
          details: {
            date: toDelete.date,
            time_slot_id: toDelete.time_slot_id,
            reason: toDelete.reason,
            whole_day: wholeDay,
            summary,
          },
        }
        if (validateAuditLogEntry(auditEntry).valid) await logAuditEvent(auditEntry)
      }
      for (const item of normalized.updateClosureShapes) {
        const before = await getSchoolClosuresByIds(schoolId, [item.id]).then(a => a[0])
        if (!before) {
          return NextResponse.json({ error: `Closure not found: ${item.id}` }, { status: 404 })
        }
        const updated = await updateSchoolClosure(schoolId, item.id, {
          time_slot_id: item.time_slot_id,
          reason: item.reason,
          notes: item.notes,
        })
        const wholeDay = updated.time_slot_id === null
        const summary = wholeDay
          ? `${updated.date} (whole day)${updated.reason ? `: ${updated.reason}` : ''}`
          : `${updated.date} (time slot)${updated.reason ? `: ${updated.reason}` : ''}`
        const auditEntry = {
          schoolId,
          actorUserId: actor.actorUserId,
          actorDisplayName: actor.actorDisplayName,
          action: 'update' as const,
          category: 'school_calendar' as const,
          entityType: 'school_closure',
          entityId: updated.id,
          details: {
            before: {
              time_slot_id: before.time_slot_id,
              reason: before.reason,
              notes: before.notes,
            },
            after: {
              time_slot_id: updated.time_slot_id,
              reason: updated.reason,
              notes: updated.notes,
            },
            date: updated.date,
            whole_day: wholeDay,
            summary,
          },
        }
        if (validateAuditLogEntry(auditEntry).valid) await logAuditEvent(auditEntry)
      }
      const createdClosureIdsToRollback: string[] = []
      const auditEntriesToLog: Parameters<typeof logAuditEvent>[0][] = []
      try {
        for (const addOne of normalized.addClosures) {
          if (isAddClosureRange(addOne)) {
            const { start_date, end_date, reason, notes } = addOne
            const { created, createdIds } = await createSchoolClosureRange(
              schoolId,
              start_date,
              end_date,
              reason ?? null,
              notes ?? null
            )
            for (const id of createdIds) createdClosureIdsToRollback.push(id)
            const summary = `${start_date}–${end_date} (${created} day(s))${reason ? `: ${reason}` : ''}`
            auditEntriesToLog.push({
              schoolId,
              actorUserId: actor.actorUserId,
              actorDisplayName: actor.actorDisplayName,
              action: 'create' as const,
              category: 'school_calendar' as const,
              entityType: 'school_closure',
              entityId: null,
              details: {
                start_date,
                end_date,
                reason: reason ?? null,
                notes: notes ?? null,
                created_count: created,
                whole_day: true,
                summary,
              },
            })
          } else {
            const { date, time_slot_id, reason, notes } = addOne
            const created = await createSchoolClosure(schoolId, {
              date,
              time_slot_id: time_slot_id ?? null,
              reason: reason ?? null,
              notes: notes ?? null,
            })
            createdClosureIdsToRollback.push(created.id)
            const wholeDay = created.time_slot_id === null
            const summary = wholeDay
              ? `${date} (whole day)${reason ? `: ${reason}` : ''}`
              : `${date} (time slot)${reason ? `: ${reason}` : ''}`
            auditEntriesToLog.push({
              schoolId,
              actorUserId: actor.actorUserId,
              actorDisplayName: actor.actorDisplayName,
              action: 'create' as const,
              category: 'school_calendar' as const,
              entityType: 'school_closure',
              entityId: created.id,
              details: {
                date: created.date,
                time_slot_id: created.time_slot_id,
                reason: created.reason,
                notes: created.notes,
                whole_day: wholeDay,
                summary,
              },
            })
          }
        }
        for (const auditEntry of auditEntriesToLog) {
          if (validateAuditLogEntry(auditEntry).valid) await logAuditEvent(auditEntry)
        }
      } catch (addErr: unknown) {
        for (const id of createdClosureIdsToRollback) {
          await deleteSchoolClosure(schoolId, id)
        }
        throw addErr
      }
    } else if (hasDeletes && hasAdds) {
      // Atomic path: single RPC runs delete + add in one transaction (no manual rollback).
      const toDelete = await getSchoolClosuresByIds(schoolId, normalized.deleteClosureIds)
      const addSingle = normalized.addClosures
        .filter((a): a is AddClosureSingle => !isAddClosureRange(a))
        .map(a => ({
          date: a.date,
          time_slot_id: a.time_slot_id ?? null,
          reason: a.reason ?? null,
          notes: a.notes ?? null,
        }))
      const addRanges = normalized.addClosures
        .filter((a): a is AddClosureRange => isAddClosureRange(a))
        .map(a => ({
          start_date: a.start_date,
          end_date: a.end_date,
          reason: a.reason ?? null,
          notes: a.notes ?? null,
        }))
      const created = await applySchoolClosureChanges(
        schoolId,
        normalized.deleteClosureIds,
        addSingle,
        addRanges
      )
      for (const c of toDelete) {
        const wholeDay = c.time_slot_id === null
        const summary = wholeDay
          ? `${c.date} (whole day)${c.reason ? `: ${c.reason}` : ''}`
          : `${c.date} (time slot)${c.reason ? `: ${c.reason}` : ''}`
        const auditEntry = {
          schoolId,
          actorUserId: actor.actorUserId,
          actorDisplayName: actor.actorDisplayName,
          action: 'delete' as const,
          category: 'school_calendar' as const,
          entityType: 'school_closure',
          entityId: c.id,
          details: {
            date: c.date,
            time_slot_id: c.time_slot_id,
            reason: c.reason,
            whole_day: wholeDay,
            summary,
          },
        }
        if (validateAuditLogEntry(auditEntry).valid) await logAuditEvent(auditEntry)
      }
      for (const c of created) {
        const wholeDay = c.time_slot_id === null
        const summary = wholeDay
          ? `${c.date} (whole day)${c.reason ? `: ${c.reason}` : ''}`
          : `${c.date} (time slot)${c.reason ? `: ${c.reason}` : ''}`
        const auditEntry = {
          schoolId,
          actorUserId: actor.actorUserId,
          actorDisplayName: actor.actorDisplayName,
          action: 'create' as const,
          category: 'school_calendar' as const,
          entityType: 'school_closure',
          entityId: c.id,
          details: {
            date: c.date,
            time_slot_id: c.time_slot_id,
            reason: c.reason,
            notes: c.notes,
            whole_day: wholeDay,
            summary,
          },
        }
        if (validateAuditLogEntry(auditEntry).valid) await logAuditEvent(auditEntry)
      }
    } else if (hasAdds) {
      // Adds only: run add loop with rollback on failure. Log audit only after full success.
      const createdClosureIdsToRollback: string[] = []
      const auditEntriesToLog: Parameters<typeof logAuditEvent>[0][] = []
      try {
        for (const addOne of normalized.addClosures) {
          if (isAddClosureRange(addOne)) {
            const { start_date, end_date, reason, notes } = addOne
            const { created, createdIds } = await createSchoolClosureRange(
              schoolId,
              start_date,
              end_date,
              reason ?? null,
              notes ?? null
            )
            for (const id of createdIds) createdClosureIdsToRollback.push(id)
            const summary = `${start_date}–${end_date} (${created} day(s))${reason ? `: ${reason}` : ''}`
            const auditEntry = {
              schoolId,
              actorUserId: actor.actorUserId,
              actorDisplayName: actor.actorDisplayName,
              action: 'create' as const,
              category: 'school_calendar' as const,
              entityType: 'school_closure' as const,
              entityId: null,
              details: {
                start_date,
                end_date,
                reason: reason ?? null,
                notes: notes ?? null,
                created_count: created,
                whole_day: true,
                summary,
              },
            }
            if (validateAuditLogEntry(auditEntry).valid) auditEntriesToLog.push(auditEntry)
          } else {
            const { date, time_slot_id, reason, notes } = addOne
            const created = await createSchoolClosure(schoolId, {
              date,
              time_slot_id: time_slot_id ?? null,
              reason: reason ?? null,
              notes: notes ?? null,
            })
            createdClosureIdsToRollback.push(created.id)
            const wholeDay = created.time_slot_id === null
            const summary = wholeDay
              ? `${date} (whole day)${reason ? `: ${reason}` : ''}`
              : `${date} (time slot)${reason ? `: ${reason}` : ''}`
            const auditEntry = {
              schoolId,
              actorUserId: actor.actorUserId,
              actorDisplayName: actor.actorDisplayName,
              action: 'create' as const,
              category: 'school_calendar' as const,
              entityType: 'school_closure' as const,
              entityId: created.id,
              details: {
                date: created.date,
                time_slot_id: created.time_slot_id,
                reason: created.reason,
                notes: created.notes,
                whole_day: wholeDay,
                summary,
              },
            }
            if (validateAuditLogEntry(auditEntry).valid) auditEntriesToLog.push(auditEntry)
          }
        }
        for (const auditEntry of auditEntriesToLog) {
          await logAuditEvent(auditEntry)
        }
      } catch (addErr: unknown) {
        for (const id of createdClosureIdsToRollback) {
          await deleteSchoolClosure(schoolId, id)
        }
        throw addErr
      }
    }

    // --- Delete-only (no adds, no shape-update path) ---
    if (hasDeletes && !hasAdds && !hasShapeUpdates) {
      const toDelete = await getSchoolClosuresByIds(schoolId, normalized.deleteClosureIds)
      await Promise.all(
        normalized.deleteClosureIds.map((id: string) => deleteSchoolClosure(schoolId, id))
      )
      for (const c of toDelete) {
        const wholeDay = c.time_slot_id === null
        const summary = wholeDay
          ? `${c.date} (whole day)${c.reason ? `: ${c.reason}` : ''}`
          : `${c.date} (time slot)${c.reason ? `: ${c.reason}` : ''}`
        const auditEntry = {
          schoolId,
          actorUserId: actor.actorUserId,
          actorDisplayName: actor.actorDisplayName,
          action: 'delete' as const,
          category: 'school_calendar' as const,
          entityType: 'school_closure',
          entityId: c.id,
          details: {
            date: c.date,
            time_slot_id: c.time_slot_id,
            reason: c.reason,
            whole_day: wholeDay,
            summary,
          },
        }
        if (validateAuditLogEntry(auditEntry).valid) {
          await logAuditEvent(auditEntry)
        }
      }
    }

    // Use same ±1 year range as calendar page GET so PATCH response is consistent and avoids UI flicker
    const rangeStart = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const rangeEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const [settings, closures] = await Promise.all([
      getCalendarSettings(schoolId),
      getSchoolClosuresForDateRange(schoolId, rangeStart, rangeEnd),
    ])

    return NextResponse.json({
      first_day_of_school: settings?.first_day_of_school ?? null,
      last_day_of_school: settings?.last_day_of_school ?? null,
      school_closures: closures,
    })
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code
    const message =
      error instanceof Error
        ? error.message
        : typeof (error as { message?: string })?.message === 'string'
          ? (error as { message: string }).message
          : 'Failed to update calendar settings'
    console.error('[calendar PATCH] error:', message, error)
    const status = code === 'DUPLICATE_CLOSURE' ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
