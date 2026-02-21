import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { normalizeEmailForStorage } from '@/lib/utils/email'
import { normalizeUSPhoneForStorage } from '@/lib/utils/phone'

type Staff = Database['public']['Tables']['staff']['Row']
type StaffRoleType = Database['public']['Tables']['staff_role_types']['Row']
type StaffRoleAssignment = Database['public']['Tables']['staff_role_type_assignments']['Row']

export type StaffWithRole = Staff & {
  staff_role_type_assignments?: Array<
    StaffRoleAssignment & { staff_role_types?: StaffRoleType | null }
  >
}

export async function getTeachers() {
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
    .eq('is_teacher', true)
    .order('last_name', { ascending: true })

  if (error) throw error
  return data as StaffWithRole[]
}

export async function getTeacherById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staff')
    .select(
      `
      *,
      staff_role_type_assignments (
        role_type_id
      )
    `
    )
    .eq('id', id)
    .eq('is_teacher', true)
    .single()

  if (error) throw error
  const role_type_ids =
    data?.staff_role_type_assignments?.map(
      (assignment: { role_type_id: string }) => assignment.role_type_id
    ) || []
  return { ...(data as Staff), role_type_ids }
}

export async function createTeacher(teacher: {
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
  if (!teacher.school_id) {
    throw new Error('school_id is required to create teacher')
  }

  const { id, role_type_ids, ...teacherData } = teacher
  const teacherId = id && id.trim() !== '' ? id : crypto.randomUUID()
  const roleTypeIds = role_type_ids && role_type_ids.length > 0 ? role_type_ids : []
  const normalizedEmail = normalizeEmailForStorage(teacher.email)
  if (teacher.email && teacher.email.trim() !== '' && !normalizedEmail) {
    throw new Error('Invalid email address')
  }

  const insertData: Partial<Staff> & { id: string } = {
    ...teacherData,
    id: teacherId,
    phone: normalizeUSPhoneForStorage(teacher.phone),
    email: normalizedEmail ?? undefined,
    is_teacher: true,
    is_sub: teacher.is_sub ?? false,
    school_id: teacher.school_id,
  }

  const { data, error } = await supabase.rpc('create_staff_with_role_assignments', {
    p_staff: insertData,
    p_role_type_ids: roleTypeIds,
  })

  if (error) throw error

  return data as Staff
}

export async function updateTeacher(
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

export async function setStaffRoleAssignments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  staffId: string,
  roleTypeIds: string[],
  schoolId: string
) {
  const { error } = await supabase.rpc('set_staff_role_assignments_atomic', {
    p_staff_id: staffId,
    p_role_type_ids: roleTypeIds,
    p_school_id: schoolId,
  })
  if (error) throw error
}

export async function deleteTeacher(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('staff').delete().eq('id', id)

  if (error) throw error
}
