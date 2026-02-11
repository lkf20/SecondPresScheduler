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

  // Exclude id from the insert if it's undefined or empty
  const { id, role_type_ids, ...teacherData } = teacher
  // Generate UUID if not provided
  const teacherId = id && id.trim() !== '' ? id : crypto.randomUUID()

  const insertData: Partial<Staff> & { id: string } = {
    ...teacherData,
    id: teacherId,
    email: teacher.email && teacher.email.trim() !== '' ? teacher.email : undefined,
    is_teacher: true,
    is_sub: teacher.is_sub ?? false, // Preserve is_sub flag
    school_id: teacher.school_id || '00000000-0000-0000-0000-000000000001',
  }

  const { data, error } = await supabase.from('staff').insert(insertData).select().single()

  if (error) throw error

  const roleTypeIds = role_type_ids && role_type_ids.length > 0 ? role_type_ids : []

  if (roleTypeIds.length > 0) {
    await setStaffRoleAssignments(supabase, data.id, roleTypeIds, insertData.school_id!)
  }

  return data as Staff
}

export async function updateTeacher(
  id: string,
  updates: Partial<Staff> & { role_type_ids?: string[] }
) {
  const supabase = await createClient()
  const { role_type_ids, ...staffUpdates } = updates
  const { data, error } = await supabase
    .from('staff')
    .update(staffUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  const roleTypeIds = role_type_ids && role_type_ids.length > 0 ? role_type_ids : []

  if (role_type_ids) {
    await setStaffRoleAssignments(supabase, id, roleTypeIds, data.school_id!)
  }

  return data as Staff
}

export async function setStaffRoleAssignments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  staffId: string,
  roleTypeIds: string[],
  schoolId: string
) {
  const { error: deleteError } = await supabase
    .from('staff_role_type_assignments')
    .delete()
    .eq('staff_id', staffId)

  if (deleteError) throw deleteError

  if (roleTypeIds.length === 0) {
    return
  }

  const assignments = roleTypeIds.map(roleTypeId => ({
    staff_id: staffId,
    role_type_id: roleTypeId,
    school_id: schoolId,
  }))

  const { error: insertError } = await supabase
    .from('staff_role_type_assignments')
    .insert(assignments)

  if (insertError) throw insertError
}

export async function deleteTeacher(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('staff').delete().eq('id', id)

  if (error) throw error
}
