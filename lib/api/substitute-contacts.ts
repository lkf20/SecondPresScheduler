import { createClient } from '@/lib/supabase/server'

export type ResponseStatus = 'none' | 'pending' | 'confirmed' | 'declined_all'

export interface SubstituteContact {
  id: string
  coverage_request_id: string
  sub_id: string
  response_status: ResponseStatus
  is_contacted: boolean
  contacted_at: string | null
  notes: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  // Legacy field - kept for backward compatibility during migration
  status?: string
}

export interface AssignedShift {
  coverage_request_shift_id: string
  date: string
  day_name: string
  time_slot_code: string
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
    override_availability: boolean
    shift: {
      id: string
      date: string
      day_of_week_id: string | null
      time_slot_id: string
      classroom_id: string
      class_group_id: string | null
    }
  }>
  assigned_shifts: AssignedShift[]
  assigned_count: number
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
      response_status: 'none',
      is_contacted: false,
    })
    .select()
    .single()

  if (createError) throw createError
  return created as SubstituteContact
}

/**
 * Get substitute contact with details including assigned shifts
 */
export async function getSubstituteContact(
  coverageRequestId: string,
  subId: string
): Promise<SubstituteContactWithDetails | null> {
  const supabase = await createClient()

  // First, get the contact with basic details
  const { data: contactData, error: contactError } = await supabase
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
        override_availability,
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

  if (contactError) {
    if (contactError.code === 'PGRST116') {
      // Not found
      return null
    }
    throw contactError
  }

  // Get teacher_id from coverage_request
  const { data: coverageRequest } = await supabase
    .from('coverage_requests')
    .select('time_off_request_id, time_off_requests:time_off_request_id(teacher_id)')
    .eq('id', coverageRequestId)
    .single()

  const teacherId = (coverageRequest as any)?.time_off_requests?.teacher_id

  // Get assigned shifts by matching sub_assignments with coverage_request_shifts
  let assignedShifts: AssignedShift[] = []
  if (teacherId) {
    // First, get all sub_assignments for this sub and teacher
    const { data: subAssignments } = await supabase
      .from('sub_assignments')
      .select('date, time_slot_id')
      .eq('sub_id', subId)
      .eq('teacher_id', teacherId)

    if (subAssignments && subAssignments.length > 0) {
      // Get all coverage_request_shifts for this request
      const { data: coverageShifts } = await supabase
        .from('coverage_request_shifts')
        .select(`
          id,
          date,
          time_slot_id,
          time_slots:time_slots(code),
          days_of_week:day_of_week_id(name)
        `)
        .eq('coverage_request_id', coverageRequestId)

      if (coverageShifts) {
        // Create a map of (date, time_slot_id) -> coverage_request_shift for quick lookup
        const shiftMap = new Map<string, any>()
        coverageShifts.forEach((shift: any) => {
          const key = `${shift.date}|${shift.time_slot_id}`
          shiftMap.set(key, shift)
        })

        // Match sub_assignments with coverage_request_shifts
        assignedShifts = subAssignments
          .map((assignment) => {
            const key = `${assignment.date}|${assignment.time_slot_id}`
            return shiftMap.get(key)
          })
          .filter(Boolean)
          .map((shift: any) => ({
            coverage_request_shift_id: shift.id,
            date: shift.date,
            day_name: shift.days_of_week?.name || '',
            time_slot_code: shift.time_slots?.code || '',
          }))
      }
    }
  }

  return {
    ...(contactData as any),
    assigned_shifts: assignedShifts,
    assigned_count: assignedShifts.length,
  } as SubstituteContactWithDetails
}

/**
 * Update substitute contact
 */
export async function updateSubstituteContact(
  id: string,
  updates: {
    response_status?: ResponseStatus
    is_contacted?: boolean
    notes?: string | null
  }
): Promise<SubstituteContact> {
  const supabase = await createClient()

  // Get current contact to check contacted_at
  const { data: current } = await supabase
    .from('substitute_contacts')
    .select('contacted_at')
    .eq('id', id)
    .single()

  const updateData: any = {
    ...updates,
    updated_at: new Date().toISOString(),
  }

  // Handle is_contacted: set contacted_at only if it's null when checking
  if (updates.is_contacted !== undefined) {
    updateData.is_contacted = updates.is_contacted
    if (updates.is_contacted && !current?.contacted_at) {
      updateData.contacted_at = new Date().toISOString()
    }
    // If unchecking, don't clear contacted_at (preserve history)
  }

  const { data, error } = await supabase
    .from('substitute_contacts')
    .update(updateData)
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
    override_availability?: boolean
  }>
): Promise<void> {
  const supabase = await createClient()

  // Get all existing overrides for this contact
  const { data: existingOverrides } = await supabase
    .from('sub_contact_shift_overrides')
    .select('coverage_request_shift_id')
    .eq('substitute_contact_id', substituteContactId)

  if (existingOverrides) {
    const existingShiftIds = new Set(existingOverrides.map((eo) => eo.coverage_request_shift_id))
    const newShiftIds = new Set(shiftOverrides.map((so) => so.coverage_request_shift_id))
    
    // Find shift IDs to delete (exist in DB but not in new list)
    const toDelete = Array.from(existingShiftIds).filter((id) => !newShiftIds.has(id))
    
    if (toDelete.length > 0) {
      await supabase
        .from('sub_contact_shift_overrides')
        .delete()
        .eq('substitute_contact_id', substituteContactId)
        .in('coverage_request_shift_id', toDelete)
    }
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
    override_availability: override.override_availability ?? false,
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
        notes,
        override_availability
      )
    `)
    .eq('coverage_request_id', coverageRequestId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as any as SubstituteContactWithDetails[]
}

