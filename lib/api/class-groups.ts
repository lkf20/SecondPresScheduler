import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type ClassGroup = Database['public']['Tables']['class_groups']['Row']

export async function getClassGroups(includeInactive = false) {
  const supabase = await createClient()
  let query = supabase
    .from('class_groups')
    .select('*')
    .order('order', { ascending: true, nullsFirst: false }) // Sort by order, nulls last
    .order('name', { ascending: true }) // Then by name

  if (!includeInactive) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (error) throw error
  return data as ClassGroup[]
}

export async function getClassGroupById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('class_groups')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as ClassGroup
}

export async function createClassGroup(classGroupData: { 
  name: string
  parent_class_id?: string
  order?: number | null
  min_age?: number | null
  max_age?: number | null
  required_ratio?: number
  preferred_ratio?: number | null
  diaper_changing_required?: boolean | null
  lifting_children_required?: boolean | null
  toileting_assistance_required?: boolean | null
  is_active?: boolean
}) {
  const supabase = await createClient()
  
  // If order is not provided, set it to the end (highest order + 1)
  if (classGroupData.order === undefined || classGroupData.order === null) {
    const { data: existingClassGroups } = await supabase
      .from('class_groups')
      .select('order')
      .order('order', { ascending: false, nullsFirst: false })
      .limit(1)
    
    const maxOrder = existingClassGroups?.[0]?.order ?? 0
    classGroupData.order = maxOrder + 1
  }
  
  // Default is_active to true if not provided
  const insertData = {
    ...classGroupData,
    is_active: classGroupData.is_active ?? true,
  }
  
  const { data, error } = await supabase
    .from('class_groups')
    .insert(insertData)
    .select()
    .single()

  if (error) throw error
  return data as ClassGroup
}

export async function updateClassGroup(id: string, updates: Partial<ClassGroup>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('class_groups')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as ClassGroup
}

// Note: We use soft delete (is_active = false) instead of hard delete
// This function is kept for backward compatibility but should not be used
// Use updateClassGroup to set is_active = false instead
export async function deleteClassGroup(id: string) {
  const supabase = await createClient()
  // Soft delete: set is_active to false
  const { data, error } = await supabase
    .from('class_groups')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as ClassGroup
}

