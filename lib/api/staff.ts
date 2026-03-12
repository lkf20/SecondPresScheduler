import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { normalizeUSPhoneForStorage } from '@/lib/utils/phone'
import { normalizeEmailForStorage } from '@/lib/utils/email'

type Staff = Database['public']['Tables']['staff']['Row']
type StaffRoleType = Database['public']['Tables']['staff_role_types']['Row']
type StaffRoleAssignment = Database['public']['Tables']['staff_role_type_assignments']['Row']

export type PreferredClassGroup = { id: string; name: string }

export type StaffWithRole = Staff & {
  staff_role_type_assignments?: Array<
    StaffRoleAssignment & { staff_role_types?: StaffRoleType | null }
  >
  preferred_class_groups?: PreferredClassGroup[]
}

export async function getStaff() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staff')
    .select(
      `
      *,
      staff_role_type_assignments (
        role_type_id,
        staff_role_types (*)
      )
    `
    )
    .order('last_name', { ascending: true })

  if (error) throw error
  const staffList = (data ?? []) as StaffWithRole[]

  const subIds = staffList.filter(s => s.is_sub === true).map(s => s.id)
  if (subIds.length === 0) return staffList

  const { data: prefs } = await supabase
    .from('sub_class_preferences')
    .select('sub_id, class_group:class_groups(id, name)')
    .in('sub_id', subIds)
    .eq('can_teach', true)

  const prefsBySub = new Map<string, PreferredClassGroup[]>()
  for (const row of prefs ?? []) {
    const r = row as unknown as {
      sub_id: string
      class_group?: { id: string; name: string } | null
    }
    const cg = r.class_group
    if (!cg?.id) continue
    const list = prefsBySub.get(r.sub_id) ?? []
    list.push({ id: cg.id, name: cg.name })
    prefsBySub.set(r.sub_id, list)
  }
  return staffList.map(s => ({
    ...s,
    preferred_class_groups: prefsBySub.get(s.id) ?? [],
  }))
}

export async function getStaffById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staff')
    .select(
      `
      *,
      staff_role_type_assignments (
        role_type_id,
        staff_role_types (*)
      )
    `
    )
    .eq('id', id)
    .single()

  if (error) throw error
  const role_type_ids =
    data?.staff_role_type_assignments?.map(
      (assignment: { role_type_id: string }) => assignment.role_type_id
    ) || []
  const role_type_codes =
    data?.staff_role_type_assignments
      ?.map(
        (assignment: { staff_role_types?: StaffRoleType | null }) =>
          assignment.staff_role_types?.code
      )
      .filter(Boolean) || []
  return { ...(data as Staff), role_type_ids, role_type_codes }
}

export async function createStaff(staff: {
  id?: string
  first_name: string
  last_name: string
  display_name?: string
  phone?: string
  email?: string
  role_type_ids?: string[]
  is_sub?: boolean
  active?: boolean
  school_id?: string
}) {
  const supabase = await createClient()
  if (!staff.school_id) {
    throw new Error('school_id is required to create staff')
  }

  const { id, role_type_ids, ...staffData } = staff
  const staffId = id && id.trim() !== '' ? id : crypto.randomUUID()
  const roleTypeIds = role_type_ids && role_type_ids.length > 0 ? role_type_ids : []
  const normalizedEmail = normalizeEmailForStorage(staff.email)
  if (staff.email && staff.email.trim() !== '' && !normalizedEmail) {
    throw new Error('Invalid email address')
  }

  const insertData: Partial<Staff> & { id: string } = {
    ...staffData,
    id: staffId,
    phone: normalizeUSPhoneForStorage(staff.phone),
    email: normalizedEmail ?? undefined,
    is_sub: staff.is_sub ?? false,
    school_id: staff.school_id,
  }

  const { data, error } = await supabase.rpc('create_staff_with_role_assignments', {
    p_staff: insertData,
    p_role_type_ids: roleTypeIds,
  })

  if (error) throw error

  return data as Staff
}

export async function updateStaff(
  id: string,
  updates: Partial<Staff> & { role_type_ids?: string[] }
) {
  const supabase = await createClient()
  const { role_type_ids, ...staffUpdates } = updates
  const hasEmailInUpdate = Object.prototype.hasOwnProperty.call(staffUpdates, 'email')
  const rawEmail = (staffUpdates.email as string | null | undefined) ?? null
  const normalizedEmail = normalizeEmailForStorage(rawEmail)
  if (hasEmailInUpdate && rawEmail && rawEmail.trim() !== '' && !normalizedEmail) {
    throw new Error('Invalid email address')
  }
  const normalizedStaffUpdates = {
    ...staffUpdates,
    ...(Object.prototype.hasOwnProperty.call(staffUpdates, 'phone')
      ? { phone: normalizeUSPhoneForStorage(staffUpdates.phone ?? null) }
      : {}),
    ...(hasEmailInUpdate ? { email: normalizedEmail } : {}),
  }
  const roleTypeIds = role_type_ids === undefined ? null : role_type_ids
  const { data, error } = await supabase.rpc('update_staff_with_role_assignments', {
    p_staff_id: id,
    p_updates: normalizedStaffUpdates,
    p_role_type_ids: roleTypeIds,
  })

  if (error) throw error

  return data as Staff
}

export async function deactivateStaff(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('staff').update({ active: false }).eq('id', id)

  if (error) throw error
}
