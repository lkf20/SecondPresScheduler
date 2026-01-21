import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { getUserSchoolId } from '@/lib/utils/auth'

type TeacherSchedule = Database['public']['Tables']['teacher_schedules']['Row']
type DayOfWeek = Database['public']['Tables']['days_of_week']['Row']
type TimeSlot = Database['public']['Tables']['time_slots']['Row']
type ClassGroup = Database['public']['Tables']['class_groups']['Row']
type Classroom = Database['public']['Tables']['classrooms']['Row']
type Staff = Database['public']['Tables']['staff']['Row']

type TeacherScheduleWithDetails = TeacherSchedule & {
  day_of_week: DayOfWeek | null
  time_slot: TimeSlot | null
  class: ClassGroup | null
  classroom: Classroom | null
}

type TeacherScheduleWithTeacher = TeacherScheduleWithDetails & {
  teacher: Staff | null
}

type SupabaseErrorDetails = Error & {
  code?: string | null
  details?: string | null
  hint?: string | null
}

export async function getTeacherSchedules(teacherId: string, schoolId?: string): Promise<TeacherScheduleWithDetails[]> {
  const supabase = await createClient()
  let query = supabase
    .from('teacher_schedules')
    .select('*, day_of_week:days_of_week(*), time_slot:time_slots(*), classroom:classrooms(*)')
    .eq('teacher_id', teacherId)

  const effectiveSchoolId = schoolId || await getUserSchoolId()
  if (effectiveSchoolId) {
    query = query.eq('school_id', effectiveSchoolId)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []) as TeacherScheduleWithDetails[]
}

export async function createTeacherSchedule(schedule: {
  teacher_id: string
  day_of_week_id: string
  time_slot_id: string
  class_id: string | null
  classroom_id: string
  is_floater?: boolean
  school_id?: string
}) {
  const supabase = await createClient()
  
  // Get school_id if not provided
  const schoolId = schedule.school_id || await getUserSchoolId()
  if (!schoolId) {
    throw new Error('school_id is required to create a teacher schedule')
  }

  const insertData = {
    ...schedule,
    school_id: schoolId,
    is_floater: schedule.is_floater ?? false,
  }
  
  const { data, error } = await supabase
    .from('teacher_schedules')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    // Preserve error details for better error messages
    const enhancedError: SupabaseErrorDetails = new Error(error.message)
    enhancedError.code = error.code
    enhancedError.details = error.details
    enhancedError.hint = error.hint
    throw enhancedError
  }
  return data as TeacherSchedule
}

export async function deleteTeacherSchedule(id: string, schoolId?: string) {
  const supabase = await createClient()
  let query = supabase.from('teacher_schedules').delete().eq('id', id)

  const effectiveSchoolId = schoolId || await getUserSchoolId()
  if (effectiveSchoolId) {
    query = query.eq('school_id', effectiveSchoolId)
  }

  const { error } = await query
  if (error) throw error
}

export async function getTeacherScheduleById(id: string, schoolId?: string): Promise<TeacherScheduleWithTeacher> {
  const supabase = await createClient()
  let query = supabase
    .from('teacher_schedules')
    .select('*, day_of_week:days_of_week(*), time_slot:time_slots(*), classroom:classrooms(*), teacher:staff(*)')
    .eq('id', id)

  const effectiveSchoolId = schoolId || await getUserSchoolId()
  if (effectiveSchoolId) {
    query = query.eq('school_id', effectiveSchoolId)
  }

  const { data, error } = await query.single()

  if (error) throw error
  return data as TeacherScheduleWithTeacher
}

export async function updateTeacherSchedule(id: string, updates: Partial<TeacherSchedule>, schoolId?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('teacher_schedules')
    .update(updates)
    .eq('id', id)

  const effectiveSchoolId = schoolId || await getUserSchoolId()
  if (effectiveSchoolId) {
    query = query.eq('school_id', effectiveSchoolId)
  }

  const { data, error } = await query.select().single()

  if (error) throw error
  return data as TeacherSchedule
}

export async function getAllTeacherSchedules(
  filters?: { teacher_id?: string },
  schoolId?: string
): Promise<TeacherScheduleWithTeacher[]> {
  const supabase = await createClient()
  let query = supabase
    .from('teacher_schedules')
    .select('*, day_of_week:days_of_week(*), time_slot:time_slots(*), classroom:classrooms(*), teacher:staff(*)')
    .order('teacher_id', { ascending: true })
    .order('day_of_week_id', { ascending: true })
    .order('time_slot_id', { ascending: true })

  const effectiveSchoolId = schoolId || await getUserSchoolId()
  if (effectiveSchoolId) {
    query = query.eq('school_id', effectiveSchoolId)
  }

  if (filters?.teacher_id) {
    query = query.eq('teacher_id', filters.teacher_id)
  }

  const { data, error } = await query

  if (error) throw error
  return (data || []) as TeacherScheduleWithTeacher[]
}

export async function bulkCreateTeacherSchedules(
  teacherId: string,
  schedules: Array<{
    day_of_week_id: string
    time_slot_id: string
    class_id: string
    classroom_id: string
  }>,
  schoolId?: string
) {
  const supabase = await createClient()
  
  const effectiveSchoolId = schoolId || await getUserSchoolId()
  if (!effectiveSchoolId) {
    throw new Error('school_id is required to create teacher schedules')
  }

  const scheduleData = schedules.map((schedule) => ({
    teacher_id: teacherId,
    school_id: effectiveSchoolId,
    ...schedule,
  }))

  const { data, error } = await supabase
    .from('teacher_schedules')
    .insert(scheduleData)
    .select()

  if (error) throw error
  return data as TeacherSchedule[]
}

export async function deleteTeacherSchedulesByTeacher(teacherId: string, schoolId?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('teacher_schedules')
    .delete()
    .eq('teacher_id', teacherId)

  const effectiveSchoolId = schoolId || await getUserSchoolId()
  if (effectiveSchoolId) {
    query = query.eq('school_id', effectiveSchoolId)
  }

  const { error } = await query
  if (error) throw error
}

export async function getScheduleByDayAndSlot(
  teacherId: string,
  dayOfWeekId: string,
  timeSlotId: string,
  schoolId?: string
): Promise<TeacherScheduleWithDetails | null> {
  const supabase = await createClient()
  const effectiveSchoolId = schoolId || await getUserSchoolId()
  
  let query = supabase
    .from('teacher_schedules')
    .select('*, day_of_week:days_of_week(*), time_slot:time_slots(*), classroom:classrooms(*)')
    .eq('teacher_id', teacherId)
    .eq('day_of_week_id', dayOfWeekId)
    .eq('time_slot_id', timeSlotId)
  
  if (effectiveSchoolId) {
    query = query.eq('school_id', effectiveSchoolId)
  }

  const { data, error } = await query.maybeSingle()

  if (error) throw error
  return data as TeacherScheduleWithDetails | null
}


