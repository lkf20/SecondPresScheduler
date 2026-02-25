import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { getUserSchoolId } from '@/lib/utils/auth'

type ClassGroup = Database['public']['Tables']['class_groups']['Row']

export async function getClassGroups(includeInactive = false, schoolId?: string) {
  const supabase = await createClient()
  const effectiveSchoolId = schoolId || (await getUserSchoolId())
  if (!effectiveSchoolId) {
    throw new Error('school_id is required to fetch class groups')
  }

  let query = supabase
    .from('class_groups')
    .select('*')
    .eq('school_id', effectiveSchoolId)
    .order('order', { ascending: true, nullsFirst: false }) // Sort by order, nulls last
    .order('name', { ascending: true }) // Then by name

  if (!includeInactive) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (error) throw error
  return data as ClassGroup[]
}

export async function getClassGroupById(id: string, schoolId?: string) {
  const supabase = await createClient()
  const effectiveSchoolId = schoolId || (await getUserSchoolId())
  if (!effectiveSchoolId) {
    throw new Error('school_id is required to fetch class group')
  }

  const { data, error } = await supabase
    .from('class_groups')
    .select('*')
    .eq('id', id)
    .eq('school_id', effectiveSchoolId)
    .single()

  if (error) throw error
  return data as ClassGroup
}

export async function createClassGroup(classGroupData: {
  name: string
  age_unit?: 'months' | 'years'
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
  school_id?: string
}) {
  const supabase = await createClient()
  const schoolId = classGroupData.school_id || (await getUserSchoolId())
  if (!schoolId) {
    throw new Error('school_id is required to create a class group')
  }

  // If order is not provided, set it to the end (highest order + 1)
  if (classGroupData.order === undefined || classGroupData.order === null) {
    const { data: existingClassGroups } = await supabase
      .from('class_groups')
      .select('order')
      .eq('school_id', schoolId)
      .order('order', { ascending: false, nullsFirst: false })
      .limit(1)

    const maxOrder = existingClassGroups?.[0]?.order ?? 0
    classGroupData.order = maxOrder + 1
  }

  // Default is_active to true if not provided
  const insertData = {
    ...classGroupData,
    school_id: schoolId,
    is_active: classGroupData.is_active ?? true,
  }

  const { data, error } = await supabase.from('class_groups').insert(insertData).select().single()

  if (error) throw error
  return data as ClassGroup
}

export async function updateClassGroup(
  id: string,
  updates: Partial<ClassGroup>,
  schoolId?: string
) {
  const supabase = await createClient()
  const effectiveSchoolId = schoolId || (await getUserSchoolId())
  if (!effectiveSchoolId) {
    throw new Error('school_id is required to update class group')
  }

  const { data, error } = await supabase
    .from('class_groups')
    .update(updates)
    .eq('id', id)
    .eq('school_id', effectiveSchoolId)
    .select()
    .single()

  if (error) throw error
  return data as ClassGroup
}

// Note: We use soft delete (is_active = false) instead of hard delete
// This function is kept for backward compatibility but should not be used
// Use updateClassGroup to set is_active = false instead
export async function deleteClassGroup(id: string, schoolId?: string) {
  const supabase = await createClient()
  const effectiveSchoolId = schoolId || (await getUserSchoolId())
  if (!effectiveSchoolId) {
    throw new Error('school_id is required to delete class group')
  }

  // Soft delete: set is_active to false
  const { data, error } = await supabase
    .from('class_groups')
    .update({ is_active: false })
    .eq('id', id)
    .eq('school_id', effectiveSchoolId)
    .select()
    .single()

  if (error) throw error
  return data as ClassGroup
}
