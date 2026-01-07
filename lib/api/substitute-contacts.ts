import { createClient } from '@/lib/supabase/server'

export type SubstituteContactStatus = 'not_contacted' | 'contacted' | 'pending' | 'declined' | 'assigned'

export interface SubstituteContact {
  id: string
  coverage_request_id: string
  sub_id: string
  status: SubstituteContactStatus
  notes: string | null
  contacted_at: string | null
  last_status_at: string
  assigned_at: string | null
  declined_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface SubstituteContactWithDetails extends SubstituteContact {
  sub: {
    id: string
    first_name: string
    last_name: string
    display_name: string | null
    phone: string | null
    email: string | null
  }
  shift_overrides: Array<{
    id: string
    coverage_request_shift_id: string
    selected: boolean
    is_partial: boolean
    partial_start_time: string | null
    partial_end_time: string | null
    notes: string | null
    shift: {
      id: string
      date: string
      day_of_week_id: string | null
      time_slot_id: string
      classroom_id: string
      class_group_id: string | null
    }
  }>
}

/**
 * Get or create a substitute contact for a coverage request and sub
 */
export async function getOrCreateSubstituteContact(
  coverageRequestId: string,
  subId: string
): Promise<SubstituteContact> {
  const supabase = await createClient()

  // Try to get existing contact
  const { data: existing, error: fetchError } = await supabase
    .from('substitute_contacts')
    .select('*')
    .eq('coverage_request_id', coverageRequestId)
    .eq('sub_id', subId)
    .single()

  if (existing) {
    return existing as SubstituteContact
  }

  // Create new contact if it doesn't exist
  const { data: created, error: createError } = await supabase
    .from('substitute_contacts')
    .insert({
      coverage_request_id: coverageRequestId,
      sub_id: subId,
      status: 'not_contacted',
    })
    .select()
    .single()

  if (createError) throw createError
  return created as SubstituteContact
}

/**
 * Get substitute contact with details
 */
export async function getSubstituteContact(
  coverageRequestId: string,
  subId: string
): Promise<SubstituteContactWithDetails | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('substitute_contacts')
    .select(`
      *,
      sub:staff!substitute_contacts_sub_id_fkey(
        id,
        first_name,
        last_name,
        display_name,
        phone,
        email
      ),
      shift_overrides:sub_contact_shift_overrides(
        id,
        coverage_request_shift_id,
        selected,
        is_partial,
        partial_start_time,
        partial_end_time,
        notes,
        shift:coverage_request_shifts(
          id,
          date,
          day_of_week_id,
          time_slot_id,
          classroom_id,
          class_group_id
        )
      )
    `)
    .eq('coverage_request_id', coverageRequestId)
    .eq('sub_id', subId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null
    }
    throw error
  }

  return data as any as SubstituteContactWithDetails
}

/**
 * Update substitute contact
 */
export async function updateSubstituteContact(
  id: string,
  updates: {
    status?: SubstituteContactStatus
    notes?: string | null
  }
): Promise<SubstituteContact> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('substitute_contacts')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as SubstituteContact
}

/**
 * Upsert shift overrides for a substitute contact
 */
export async function upsertShiftOverrides(
  substituteContactId: string,
  shiftOverrides: Array<{
    coverage_request_shift_id: string
    selected: boolean
    is_partial?: boolean
    partial_start_time?: string | null
    partial_end_time?: string | null
    notes?: string | null
  }>
): Promise<void> {
  const supabase = await createClient()

  // Delete existing overrides for shifts not in the new list
  const shiftIds = shiftOverrides.map((so) => so.coverage_request_shift_id)
  if (shiftIds.length > 0) {
    await supabase
      .from('sub_contact_shift_overrides')
      .delete()
      .eq('substitute_contact_id', substituteContactId)
      .not('coverage_request_shift_id', 'in', `(${shiftIds.map((id) => `"${id}"`).join(',')})`)
  }

  // Upsert the new overrides
  const overridesToUpsert = shiftOverrides.map((override) => ({
    substitute_contact_id: substituteContactId,
    coverage_request_shift_id: override.coverage_request_shift_id,
    selected: override.selected,
    is_partial: override.is_partial ?? false,
    partial_start_time: override.partial_start_time ?? null,
    partial_end_time: override.partial_end_time ?? null,
    notes: override.notes ?? null,
    updated_at: new Date().toISOString(),
  }))

  if (overridesToUpsert.length > 0) {
    const { error } = await supabase
      .from('sub_contact_shift_overrides')
      .upsert(overridesToUpsert, {
        onConflict: 'substitute_contact_id,coverage_request_shift_id',
      })

    if (error) throw error
  }
}

/**
 * Get all substitute contacts for a coverage request
 */
export async function getSubstituteContactsForRequest(
  coverageRequestId: string
): Promise<SubstituteContactWithDetails[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('substitute_contacts')
    .select(`
      *,
      sub:staff!substitute_contacts_sub_id_fkey(
        id,
        first_name,
        last_name,
        display_name,
        phone,
        email
      ),
      shift_overrides:sub_contact_shift_overrides(
        id,
        coverage_request_shift_id,
        selected,
        is_partial,
        partial_start_time,
        partial_end_time,
        notes
      )
    `)
    .eq('coverage_request_id', coverageRequestId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as any as SubstituteContactWithDetails[]
}

