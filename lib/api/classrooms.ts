import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type Classroom = Database['public']['Tables']['classrooms']['Row']

export async function getClassrooms() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('classrooms')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw error
  return data as Classroom[]
}

export async function getClassroomById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('classrooms')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Classroom
}

export async function createClassroom(classroom: { name: string; capacity?: number }) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('classrooms')
    .insert(classroom)
    .select()
    .single()

  if (error) throw error
  return data as Classroom
}

export async function updateClassroom(id: string, updates: Partial<Classroom>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('classrooms')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Classroom
}

export async function deleteClassroom(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('classrooms').delete().eq('id', id)

  if (error) throw error
}

