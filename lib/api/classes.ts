import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type Class = Database['public']['Tables']['classes']['Row']

export async function getClasses() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .order('order', { ascending: true, nullsLast: true }) // Sort by order, nulls last
    .order('name', { ascending: true }) // Then by name

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

export async function createClass(classData: { 
  name: string
  parent_class_id?: string
  order?: number | null
}) {
  const supabase = await createClient()
  
  // If order is not provided, set it to the end (highest order + 1)
  if (classData.order === undefined || classData.order === null) {
    const { data: existingClasses } = await supabase
      .from('classes')
      .select('order')
      .order('order', { ascending: false, nullsLast: true })
      .limit(1)
    
    const maxOrder = existingClasses?.[0]?.order ?? 0
    classData.order = maxOrder + 1
  }
  
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



