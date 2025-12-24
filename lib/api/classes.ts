import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type Class = Database['public']['Tables']['classes']['Row']

export async function getClasses() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw error
  return data as Class[]
}

export async function getClassById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Class
}

export async function createClass(classData: { name: string; parent_class_id?: string }) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('classes')
    .insert(classData)
    .select()
    .single()

  if (error) throw error
  return data as Class
}

export async function updateClass(id: string, updates: Partial<Class>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('classes')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Class
}

export async function deleteClass(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('classes').delete().eq('id', id)

  if (error) throw error
}

