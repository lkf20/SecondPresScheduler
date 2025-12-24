import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type Staff = Database['public']['Tables']['staff']['Row']

export async function getTeachers() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .eq('is_teacher', true)
    .order('last_name', { ascending: true })

  if (error) throw error
  return data as Staff[]
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
  is_teacher: boolean
  is_sub?: boolean
  active?: boolean
}) {
  const supabase = await createClient()
  
  // Exclude id from the insert if it's undefined or empty
  const { id, ...teacherData } = teacher
  const insertData: any = {
    ...teacherData,
    email: teacher.email && teacher.email.trim() !== '' ? teacher.email : null,
    is_teacher: true,
  }
  
  // Generate UUID if not provided
  // This ensures we always have an id, even if the database default isn't set
  if (id && id.trim() !== '') {
    insertData.id = id
  } else {
    // Generate UUID using crypto.randomUUID() which is available in Node.js
    insertData.id = crypto.randomUUID()
  }
  
  const { data, error } = await supabase
    .from('staff')
    .insert(insertData)
    .select()
    .single()

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

