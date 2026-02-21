import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type Staff = Database['public']['Tables']['staff']['Row']
type StaffRoleType = Database['public']['Tables']['staff_role_types']['Row']
type StaffRoleAssignment = Database['public']['Tables']['staff_role_type_assignments']['Row']

export type StaffWithRole = Staff & {
  staff_role_type_assignments?: Array<
    StaffRoleAssignment & { staff_role_types?: StaffRoleType | null }
  >
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
  return data as StaffWithRole[]
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
  is_teacher: boolean
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

  const insertData: Partial<Staff> & { id: string } = {
    ...staffData,
    id: staffId,
    email: staff.email && staff.email.trim() !== '' ? staff.email : undefined,
    is_sub: staff.is_sub ?? false,
    is_teacher: staff.is_teacher,
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
  const roleTypeIds = role_type_ids === undefined ? null : role_type_ids
  const { data, error } = await supabase.rpc('update_staff_with_role_assignments', {
    p_staff_id: id,
    p_updates: staffUpdates,
    p_role_type_ids: roleTypeIds,
  })

  if (error) throw error

  return data as Staff
}

export async function deleteStaff(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('staff').delete().eq('id', id)

  if (error) throw error
}
