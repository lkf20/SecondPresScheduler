import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type Classroom = Database['public']['Tables']['classrooms']['Row']

export async function getClassrooms(includeInactive = false) {
  const supabase = await createClient()
  let query = supabase
    .from('classrooms')
    .select(`
      *,
      allowed_classes:classroom_allowed_classes(
        class:class_groups(id, name)
      )
    `)
    .order('order', { ascending: true, nullsLast: true })
    .order('name', { ascending: true })

  if (!includeInactive) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (error) throw error
  
  // Transform the data to include allowed classes names
  return data.map((classroom: any) => ({
    ...classroom,
    allowed_classes_names: classroom.allowed_classes
      ?.map((ac: any) => ac.class?.name)
      .filter(Boolean)
      .join(', ') || 'None',
    allowed_classes_count: classroom.allowed_classes?.length || 0,
  })) as any[]
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

export async function createClassroom(classroom: {
  name: string
  capacity?: number | null
  order?: number | null
  is_active?: boolean
}) {
  const supabase = await createClient()
  
  // If order is not provided, set it to the end (highest order + 1)
  if (classroom.order === undefined || classroom.order === null) {
    const { data: existingClassrooms } = await supabase
      .from('classrooms')
      .select('order')
      .order('order', { ascending: false, nullsLast: true })
      .limit(1)
    
    const maxOrder = existingClassrooms?.[0]?.order ?? 0
    classroom.order = maxOrder + 1
  }
  
  // Default is_active to true if not provided
  const insertData = {
    ...classroom,
    is_active: classroom.is_active ?? true,
  }
  
  const { data, error } = await supabase
    .from('classrooms')
    .insert(insertData)
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

// Note: We use soft delete (is_active = false) instead of hard delete
// This function is kept for backward compatibility but should not be used
// Use updateClassroom to set is_active = false instead
export async function deleteClassroom(id: string) {
  const supabase = await createClient()
  // Soft delete: set is_active to false
  const { data, error } = await supabase
    .from('classrooms')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Classroom
}

export async function getClassroomAllowedClasses(classroomId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('classroom_allowed_classes')
    .select('class_id, class:class_groups(id, name)')
    .eq('classroom_id', classroomId)

  if (error) throw error
  return data.map((item: any) => item.class_id)
}

export async function setClassroomAllowedClasses(
  classroomId: string,
  classIds: string[]
) {
  const supabase = await createClient()

  // Delete existing allowed classes
  const { error: deleteError } = await supabase
    .from('classroom_allowed_classes')
    .delete()
    .eq('classroom_id', classroomId)

  if (deleteError) throw deleteError

  // Insert new allowed classes
  if (classIds.length > 0) {
    const insertData = classIds.map((classId) => ({
      classroom_id: classroomId,
      class_id: classId,
    }))

    const { error: insertError } = await supabase
      .from('classroom_allowed_classes')
      .insert(insertData)

    if (insertError) throw insertError
  }
}



