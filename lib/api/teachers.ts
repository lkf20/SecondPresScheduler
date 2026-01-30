import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type Staff = Database['public']['Tables']['staff']['Row']
type StaffRoleType = Database['public']['Tables']['staff_role_types']['Row']

export type StaffWithRole = Staff & {
  staff_role_types?: StaffRoleType | null
}

export async function getTeachers() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staff')
    .select(
      `
      *,
      staff_role_types (*)
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
    .select('*')
    .eq('id', id)
    .eq('is_teacher', true)
    .single()

  if (error) throw error
  return data as Staff
}

export async function createTeacher(teacher: {
  id?: string
  first_name: string
  last_name: string
  display_name?: string
  phone?: string
  email?: string
  role_type_id?: string
  is_teacher: boolean
  is_sub?: boolean
  active?: boolean
  school_id?: string
}) {
  const supabase = await createClient()

  // Exclude id from the insert if it's undefined or empty
  const { id, ...teacherData } = teacher
  // Generate UUID if not provided
  const teacherId = id && id.trim() !== '' ? id : crypto.randomUUID()

  const insertData: Partial<Staff> & { id: string } = {
    ...teacherData,
    id: teacherId,
    email: teacher.email && teacher.email.trim() !== '' ? teacher.email : undefined,
    is_teacher: true,
    is_sub: teacher.is_sub ?? false, // Preserve is_sub flag
    role_type_id: teacher.role_type_id, // Include role_type_id
    school_id: teacher.school_id || '00000000-0000-0000-0000-000000000001',
  }

  const { data, error } = await supabase.from('staff').insert(insertData).select().single()

  if (error) throw error
  return data as Staff
}

export async function updateTeacher(id: string, updates: Partial<Staff>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staff')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Staff
}

export async function deleteTeacher(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('staff').delete().eq('id', id)

  if (error) throw error
}
