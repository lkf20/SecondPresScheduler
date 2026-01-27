import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { getUserSchoolId } from '@/lib/utils/auth'

type Classroom = Database['public']['Tables']['classrooms']['Row']
type AllowedClassJoin = { class_group: { id: string; name: string } | null }
type ClassroomRaw = Classroom & { allowed_classes?: AllowedClassJoin[] }
type ClassroomWithAllowedClasses = Classroom & {
  allowed_classes_names: string
  allowed_classes_count: number
}

export async function getClassrooms(
  includeInactive = false,
  schoolId?: string
): Promise<ClassroomWithAllowedClasses[]> {
  const supabase = await createClient()
  let query = supabase
    .from('classrooms')
    .select(
      `
      *,
      allowed_classes:classroom_allowed_classes(
        class_group:class_groups(id, name)
      )
    `
    )
    .order('order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })

  // Filter by school_id
  const effectiveSchoolId = schoolId || (await getUserSchoolId())
  if (effectiveSchoolId) {
    query = query.eq('school_id', effectiveSchoolId)
  }

  if (!includeInactive) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (error) throw error

  // Transform the data to include allowed classes names
  return (data as ClassroomRaw[]).map(classroom => ({
    ...classroom,
    allowed_classes_names:
      classroom.allowed_classes
        ?.map(ac => ac.class_group?.name)
        .filter((name): name is string => Boolean(name))
        .join(', ') || 'None',
    allowed_classes_count: classroom.allowed_classes?.length || 0,
  }))
}

export async function getClassroomById(id: string, schoolId?: string) {
  const supabase = await createClient()
  let query = supabase.from('classrooms').select('*').eq('id', id)

  const effectiveSchoolId = schoolId || (await getUserSchoolId())
  if (effectiveSchoolId) {
    query = query.eq('school_id', effectiveSchoolId)
  }

  const { data, error } = await query.single()

  if (error) throw error
  return data as Classroom
}

export async function createClassroom(classroom: {
  name: string
  capacity?: number | null
  order?: number | null
  is_active?: boolean
  school_id?: string
}) {
  const supabase = await createClient()

  // Get school_id if not provided
  const schoolId = classroom.school_id || (await getUserSchoolId())
  if (!schoolId) {
    throw new Error('school_id is required to create a classroom')
  }

  // If order is not provided, set it to the end (highest order + 1) for this school
  if (classroom.order === undefined || classroom.order === null) {
    const { data: existingClassrooms } = await supabase
      .from('classrooms')
      .select('order')
      .eq('school_id', schoolId)
      .order('order', { ascending: false, nullsFirst: false })
      .limit(1)

    const maxOrder = existingClassrooms?.[0]?.order ?? 0
    classroom.order = maxOrder + 1
  }

  // Default is_active to true if not provided
  const insertData = {
    ...classroom,
    school_id: schoolId,
    is_active: classroom.is_active ?? true,
  }

  const { data, error } = await supabase.from('classrooms').insert(insertData).select().single()

  if (error) throw error
  return data as Classroom
}

export async function updateClassroom(id: string, updates: Partial<Classroom>, schoolId?: string) {
  const supabase = await createClient()
  let query = supabase.from('classrooms').update(updates).eq('id', id)

  const effectiveSchoolId = schoolId || (await getUserSchoolId())
  if (effectiveSchoolId) {
    query = query.eq('school_id', effectiveSchoolId)
  }

  const { data, error } = await query.select().single()

  if (error) throw error
  return data as Classroom
}

// Note: We use soft delete (is_active = false) instead of hard delete
// This function is kept for backward compatibility but should not be used
// Use updateClassroom to set is_active = false instead
export async function deleteClassroom(id: string, schoolId?: string) {
  const supabase = await createClient()
  let query = supabase.from('classrooms').update({ is_active: false }).eq('id', id)

  const effectiveSchoolId = schoolId || (await getUserSchoolId())
  if (effectiveSchoolId) {
    query = query.eq('school_id', effectiveSchoolId)
  }

  const { data, error } = await query.select().single()

  if (error) throw error
  return data as Classroom
}

export async function getClassroomAllowedClasses(classroomId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('classroom_allowed_classes')
    .select('class_group_id, class_group:class_groups(id, name)')
    .eq('classroom_id', classroomId)

  if (error) throw error
  return data.map(item => item.class_group_id)
}

export async function setClassroomAllowedClasses(
  classroomId: string,
  classGroupIds: string[]
) {
  const supabase = await createClient()

  // Delete existing allowed classes
  const { error: deleteError } = await supabase
    .from('classroom_allowed_classes')
    .delete()
    .eq('classroom_id', classroomId)

  if (deleteError) throw deleteError

  // Insert new allowed classes
  if (classGroupIds.length > 0) {
    const insertData = classGroupIds.map(classGroupId => {
      return {
        classroom_id: classroomId,
        class_group_id: classGroupId,
      }
    })

    const { error: insertError } = await supabase
      .from('classroom_allowed_classes')
      .insert(insertData)

    if (insertError) throw insertError
  }
}
