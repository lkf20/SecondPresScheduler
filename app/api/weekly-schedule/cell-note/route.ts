import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getAuditActorContext, logAuditEvent } from '@/lib/audit/logAuditEvent'

const updateWeeklyCellNoteSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  day_of_week_id: z.string().uuid('day_of_week_id must be a valid UUID'),
  classroom_id: z.string().uuid('classroom_id must be a valid UUID'),
  time_slot_id: z.string().uuid('time_slot_id must be a valid UUID'),
  use_baseline_note: z.boolean(),
  override_mode: z.enum(['custom', 'hidden']).optional(),
  note: z.string().nullable().optional(),
})

type WeeklyScheduleCellNoteRow = {
  id: string
  override_mode: 'custom' | 'hidden'
  note: string | null
}

export async function PUT(request: NextRequest) {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json(
        { error: 'User profile not found or missing school_id.' },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => null)
    const parsed = updateWeeklyCellNoteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request payload.' },
        { status: 400 }
      )
    }

    const payload = parsed.data
    const supabase = await createClient()

    const [classroomResult, timeSlotResult] = await Promise.all([
      supabase
        .from('classrooms')
        .select('id, name')
        .eq('id', payload.classroom_id)
        .eq('school_id', schoolId)
        .maybeSingle(),
      supabase
        .from('time_slots')
        .select('id, code')
        .eq('id', payload.time_slot_id)
        .eq('school_id', schoolId)
        .maybeSingle(),
    ])

    if (!classroomResult.data || !timeSlotResult.data) {
      return NextResponse.json(
        { error: 'Classroom or time slot not found for this school.' },
        { status: 404 }
      )
    }

    const { data: baselineCell } = await supabase
      .from('schedule_cells')
      .select('id, notes')
      .eq('school_id', schoolId)
      .eq('classroom_id', payload.classroom_id)
      .eq('day_of_week_id', payload.day_of_week_id)
      .eq('time_slot_id', payload.time_slot_id)
      .maybeSingle()

    const { data: existingOverride } = await supabase
      .from('weekly_schedule_cell_notes')
      .select('id, override_mode, note')
      .eq('school_id', schoolId)
      .eq('date', payload.date)
      .eq('classroom_id', payload.classroom_id)
      .eq('time_slot_id', payload.time_slot_id)
      .maybeSingle()
    const existingOverrideRow = existingOverride as WeeklyScheduleCellNoteRow | null

    let nextOverride: WeeklyScheduleCellNoteRow | null = null
    if (payload.use_baseline_note) {
      const { error: deleteError } = await supabase
        .from('weekly_schedule_cell_notes')
        .delete()
        .eq('school_id', schoolId)
        .eq('date', payload.date)
        .eq('classroom_id', payload.classroom_id)
        .eq('time_slot_id', payload.time_slot_id)

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 })
      }
    } else {
      if (!payload.override_mode) {
        return NextResponse.json(
          { error: 'override_mode is required when use_baseline_note is false.' },
          { status: 400 }
        )
      }

      const noteText = payload.note?.trim() || null
      if (payload.override_mode === 'custom' && !noteText) {
        return NextResponse.json(
          { error: 'Note is required when override_mode is custom.' },
          { status: 400 }
        )
      }
      if (payload.override_mode === 'hidden' && noteText) {
        return NextResponse.json(
          { error: 'note must be empty when override_mode is hidden.' },
          { status: 400 }
        )
      }

      const { data: upserted, error: upsertError } = await supabase
        .from('weekly_schedule_cell_notes')
        .upsert(
          {
            school_id: schoolId,
            date: payload.date,
            classroom_id: payload.classroom_id,
            time_slot_id: payload.time_slot_id,
            override_mode: payload.override_mode,
            note: payload.override_mode === 'hidden' ? null : noteText,
          },
          { onConflict: 'school_id,date,classroom_id,time_slot_id' }
        )
        .select('id, override_mode, note')
        .single()

      if (upsertError) {
        return NextResponse.json({ error: upsertError.message }, { status: 500 })
      }
      nextOverride = upserted as WeeklyScheduleCellNoteRow
    }

    const effectiveNote =
      nextOverride?.override_mode === 'hidden'
        ? null
        : nextOverride?.override_mode === 'custom'
          ? (nextOverride.note ?? null)
          : (baselineCell?.notes ?? null)

    const { actorUserId, actorDisplayName } = await getAuditActorContext()
    await logAuditEvent({
      schoolId,
      actorUserId,
      actorDisplayName,
      action: 'update',
      category: 'baseline_schedule',
      entityType: 'schedule_cell',
      entityId:
        baselineCell?.id ??
        existingOverrideRow?.id ??
        `${payload.date}:${payload.classroom_id}:${payload.time_slot_id}`,
      details: {
        date: payload.date,
        classroom_id: payload.classroom_id,
        classroom_name: classroomResult.data.name,
        time_slot_id: payload.time_slot_id,
        time_slot_code: timeSlotResult.data.code,
        updated_fields: ['weekly_note_override'],
        before: existingOverrideRow
          ? { override_mode: existingOverrideRow.override_mode, note: existingOverrideRow.note }
          : null,
        after: nextOverride
          ? { override_mode: nextOverride.override_mode, note: nextOverride.note }
          : null,
        summary: nextOverride
          ? `Weekly note override set to ${nextOverride.override_mode} for ${payload.date}.`
          : `Weekly note override removed for ${payload.date}; using baseline note.`,
      },
    })

    return NextResponse.json({
      date: payload.date,
      classroom_id: payload.classroom_id,
      time_slot_id: payload.time_slot_id,
      baseline_note: baselineCell?.notes ?? null,
      weekly_note_override: nextOverride
        ? { override_mode: nextOverride.override_mode, note: nextOverride.note }
        : null,
      effective_note: effectiveNote,
      is_note_hidden_for_date: nextOverride?.override_mode === 'hidden',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to update weekly cell note.' },
      { status: 500 }
    )
  }
}
