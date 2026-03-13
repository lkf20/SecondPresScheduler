import { createClient } from '@/lib/supabase/server'

export interface SchoolClosure {
  id: string
  school_id: string
  date: string
  time_slot_id: string | null
  reason: string | null
  notes: string | null
  created_at: string
}

export interface CalendarSettings {
  first_day_of_school: string | null
  last_day_of_school: string | null
}

export async function getCalendarSettings(schoolId: string): Promise<CalendarSettings> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('schedule_settings')
    .select('first_day_of_school, last_day_of_school')
    .eq('school_id', schoolId)
    .limit(1)
    .maybeSingle()

  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return { first_day_of_school: null, last_day_of_school: null }
    }
    throw error
  }

  return {
    first_day_of_school: data?.first_day_of_school ?? null,
    last_day_of_school: data?.last_day_of_school ?? null,
  }
}

export async function updateCalendarSettings(
  schoolId: string,
  updates: {
    first_day_of_school?: string | null
    last_day_of_school?: string | null
  }
): Promise<CalendarSettings> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('schedule_settings')
    .select('id, first_day_of_school, last_day_of_school')
    .eq('school_id', schoolId)
    .limit(1)
    .maybeSingle()

  const firstDay =
    updates.first_day_of_school !== undefined
      ? updates.first_day_of_school
      : (existing?.first_day_of_school ?? null)
  const lastDay =
    updates.last_day_of_school !== undefined
      ? updates.last_day_of_school
      : (existing?.last_day_of_school ?? null)

  if (existing) {
    const { data, error } = await supabase
      .from('schedule_settings')
      .update({
        first_day_of_school: firstDay,
        last_day_of_school: lastDay,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('first_day_of_school, last_day_of_school')
      .single()

    if (error) throw error
    return {
      first_day_of_school: data.first_day_of_school ?? null,
      last_day_of_school: data.last_day_of_school ?? null,
    }
  }

  const { data, error } = await supabase
    .from('schedule_settings')
    .insert({
      school_id: schoolId,
      selected_day_ids: [],
      first_day_of_school: firstDay,
      last_day_of_school: lastDay,
    })
    .select('first_day_of_school, last_day_of_school')
    .single()

  if (error) throw error
  return {
    first_day_of_school: data.first_day_of_school ?? null,
    last_day_of_school: data.last_day_of_school ?? null,
  }
}

export async function getSchoolClosuresForDateRange(
  schoolId: string,
  startDateISO: string,
  endDateISO: string
): Promise<SchoolClosure[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('school_closures')
    .select('id, school_id, date, time_slot_id, reason, notes, created_at')
    .eq('school_id', schoolId)
    .gte('date', startDateISO)
    .lte('date', endDateISO)
    .order('date', { ascending: true })
    .order('time_slot_id', { ascending: true, nullsFirst: true })

  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return []
    }
    throw error
  }

  return (data ?? []).map(row => ({
    id: row.id,
    school_id: row.school_id,
    date: row.date,
    time_slot_id: row.time_slot_id,
    reason: row.reason,
    notes: row.notes ?? null,
    created_at: row.created_at,
  }))
}

export async function getSchoolClosures(schoolId: string): Promise<SchoolClosure[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('school_closures')
    .select('id, school_id, date, time_slot_id, reason, notes, created_at')
    .eq('school_id', schoolId)
    .order('date', { ascending: true })
    .order('time_slot_id', { ascending: true, nullsFirst: true })

  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return []
    }
    throw error
  }

  return (data ?? []).map(row => ({
    id: row.id,
    school_id: row.school_id,
    date: row.date,
    time_slot_id: row.time_slot_id,
    reason: row.reason,
    notes: row.notes ?? null,
    created_at: row.created_at,
  }))
}

/** Fetch closures by IDs (e.g. for audit log before delete). */
export async function getSchoolClosuresByIds(
  schoolId: string,
  closureIds: string[]
): Promise<SchoolClosure[]> {
  if (closureIds.length === 0) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('school_closures')
    .select('id, school_id, date, time_slot_id, reason, notes, created_at')
    .eq('school_id', schoolId)
    .in('id', closureIds)

  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return []
    }
    throw error
  }

  return (data ?? []).map(row => ({
    id: row.id,
    school_id: row.school_id,
    date: row.date,
    time_slot_id: row.time_slot_id,
    reason: row.reason,
    notes: row.notes ?? null,
    created_at: row.created_at,
  }))
}

export async function createSchoolClosure(
  schoolId: string,
  closure: {
    date: string
    time_slot_id?: string | null
    reason?: string | null
    notes?: string | null
  }
): Promise<SchoolClosure> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('school_closures')
    .insert({
      school_id: schoolId,
      date: closure.date,
      time_slot_id: closure.time_slot_id ?? null,
      reason: closure.reason ?? null,
      notes: closure.notes ?? null,
    })
    .select('id, school_id, date, time_slot_id, reason, notes, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('A closure already exists for this date and time slot.')
    }
    throw error
  }
  return {
    id: data.id,
    school_id: data.school_id,
    date: data.date,
    time_slot_id: data.time_slot_id,
    reason: data.reason,
    notes: data.notes ?? null,
    created_at: data.created_at,
  }
}

/** Iterate over dates from start to end (inclusive), YYYY-MM-DD format */
function* dateRange(startISO: string, endISO: string): Generator<string> {
  const start = new Date(startISO + 'T12:00:00')
  const end = new Date(endISO + 'T12:00:00')
  if (start > end) return
  const current = new Date(start)
  while (current <= end) {
    const y = current.getFullYear()
    const m = String(current.getMonth() + 1).padStart(2, '0')
    const d = String(current.getDate()).padStart(2, '0')
    yield `${y}-${m}-${d}`
    current.setDate(current.getDate() + 1)
  }
}

/**
 * Create whole-day closures for each day in the range. Skips days that already
 * have a whole-day closure. Max 365 days per call to prevent abuse.
 */
export async function createSchoolClosureRange(
  schoolId: string,
  startDateISO: string,
  endDateISO: string,
  reason: string | null,
  notes?: string | null
): Promise<{ created: number; skipped: number; createdIds: string[] }> {
  const dates = [...dateRange(startDateISO, endDateISO)]
  if (dates.length === 0) return { created: 0, skipped: 0, createdIds: [] }
  if (dates.length > 365) {
    throw new Error('Date range cannot exceed 365 days')
  }

  const existing = await getSchoolClosuresForDateRange(schoolId, startDateISO, endDateISO)
  const existingWholeDayDates = new Set(
    existing.filter(c => c.time_slot_id === null).map(c => c.date)
  )

  let created = 0
  let skipped = 0
  const createdIds: string[] = []
  for (const date of dates) {
    if (existingWholeDayDates.has(date)) {
      skipped++
      continue
    }
    try {
      const closure = await createSchoolClosure(schoolId, {
        date,
        time_slot_id: null,
        reason,
        notes: notes ?? null,
      })
      created++
      createdIds.push(closure.id)
      existingWholeDayDates.add(date)
    } catch (err) {
      const code = (err as { code?: string })?.code
      if (code === '23505') {
        skipped++
        existingWholeDayDates.add(date)
      } else {
        throw err
      }
    }
  }
  return { created, skipped, createdIds }
}

export async function updateSchoolClosure(
  schoolId: string,
  closureId: string,
  updates: { reason?: string | null; notes?: string | null }
): Promise<SchoolClosure> {
  const supabase = await createClient()
  const updatePayload: { reason?: string | null; notes?: string | null } = {}
  if (updates.reason !== undefined) updatePayload.reason = updates.reason ?? null
  if (updates.notes !== undefined) updatePayload.notes = updates.notes ?? null
  const { data, error } = await supabase
    .from('school_closures')
    .update(updatePayload)
    .eq('id', closureId)
    .eq('school_id', schoolId)
    .select('id, school_id, date, time_slot_id, reason, notes, created_at')
    .single()

  if (error) throw error
  return {
    id: data.id,
    school_id: data.school_id,
    date: data.date,
    time_slot_id: data.time_slot_id,
    reason: data.reason,
    notes: data.notes ?? null,
    created_at: data.created_at,
  }
}

export async function deleteSchoolClosure(schoolId: string, closureId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('school_closures')
    .delete()
    .eq('id', closureId)
    .eq('school_id', schoolId)

  if (error) throw error
}
