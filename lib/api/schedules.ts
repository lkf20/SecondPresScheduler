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

type TeacherScheduleLike = {
  class_id?: string | null
  class_group_id?: string | null
} & Record<string, unknown>

function normalizeTeacherSchedule<T extends TeacherScheduleLike>(row: T): T {
  if (row && row.class_id == null && row.class_group_id != null) {
    return { ...row, class_id: row.class_group_id }
  }
  return row
}

function isMissingColumnError(error: SupabaseErrorDetails, column: string): boolean {
  const message = error?.message || ''
  const details = error?.details || ''
  return (
    message.includes(`'${column}'`) ||
    message.includes(`"${column}"`) ||
    details.includes(`'${column}'`) ||
    details.includes(`"${column}"`)
  )
}

export async function getTeacherSchedules(
  teacherId: string,
  schoolId?: string
): Promise<TeacherScheduleWithDetails[]> {
  const supabase = await createClient()
  let query = supabase
    .from('teacher_schedules')
    .select('*, day_of_week:days_of_week(*), time_slot:time_slots(*), classroom:classrooms(*)')
    .eq('teacher_id', teacherId)

  const effectiveSchoolId = schoolId || (await getUserSchoolId())
  if (effectiveSchoolId) {
    query = query.eq('school_id', effectiveSchoolId)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []).map(row => normalizeTeacherSchedule(row)) as TeacherScheduleWithDetails[]
}

export async function createTeacherSchedule(schedule: {
  teacher_id: string
  day_of_week_id: string
  time_slot_id: string
  class_id?: string | null
  class_group_id?: string | null
  classroom_id: string
  is_floater?: boolean
  school_id?: string
}) {
  const supabase = await createClient()

  // Get school_id if not provided
  const schoolId = schedule.school_id || (await getUserSchoolId())
  if (!schoolId) {
    throw new Error('school_id is required to create a teacher schedule')
  }

  const insertData = {
    teacher_id: schedule.teacher_id,
    day_of_week_id: schedule.day_of_week_id,
    time_slot_id: schedule.time_slot_id,
    classroom_id: schedule.classroom_id,
    class_group_id: schedule.class_group_id ?? schedule.class_id ?? null,
    school_id: schoolId,
    is_floater: schedule.is_floater ?? false,
  }

  const { data, error } = await supabase
    .from('teacher_schedules')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    const enhancedError: SupabaseErrorDetails = new Error(error.message)
    enhancedError.code = error.code
    enhancedError.details = error.details
    enhancedError.hint = error.hint

    // Fallback for legacy schema without class_group_id
    if (isMissingColumnError(enhancedError, 'class_group_id')) {
      const legacyInsert = {
        ...insertData,
        class_id: schedule.class_id ?? schedule.class_group_id ?? null,
      }
      delete (legacyInsert as { class_group_id?: string | null }).class_group_id
      const { data: legacyData, error: legacyError } = await supabase
        .from('teacher_schedules')
        .insert(legacyInsert)
        .select()
        .single()

      if (legacyError) {
        const legacyEnhanced: SupabaseErrorDetails = new Error(legacyError.message)
        legacyEnhanced.code = legacyError.code
        legacyEnhanced.details = legacyError.details
        legacyEnhanced.hint = legacyError.hint

        // Fallback for schema without class_id/class_group_id
        if (isMissingColumnError(legacyEnhanced, 'class_id')) {
          const minimalInsert = { ...insertData }
          delete (minimalInsert as { class_group_id?: string | null }).class_group_id
          const { data: minimalData, error: minimalError } = await supabase
            .from('teacher_schedules')
            .insert(minimalInsert)
            .select()
            .single()

          if (minimalError) throw minimalError
          return normalizeTeacherSchedule(minimalData) as TeacherSchedule
        }

        throw legacyEnhanced
      }
      return normalizeTeacherSchedule(legacyData) as TeacherSchedule
    }

    // Fallback for schema without class_id/class_group_id
    if (isMissingColumnError(enhancedError, 'class_id')) {
      const minimalInsert = { ...insertData }
      delete (minimalInsert as { class_group_id?: string | null }).class_group_id
      const { data: minimalData, error: minimalError } = await supabase
        .from('teacher_schedules')
        .insert(minimalInsert)
        .select()
        .single()

      if (minimalError) throw minimalError
      return normalizeTeacherSchedule(minimalData) as TeacherSchedule
    }

    throw enhancedError
  }
  return normalizeTeacherSchedule(data) as TeacherSchedule
}

export async function deleteTeacherSchedule(id: string, schoolId?: string) {
  const supabase = await createClient()
  let query = supabase.from('teacher_schedules').delete().eq('id', id)

  const effectiveSchoolId = schoolId || (await getUserSchoolId())
  if (effectiveSchoolId) {
    query = query.eq('school_id', effectiveSchoolId)
  }

  const { error } = await query
  if (error) throw error
}

export async function getTeacherScheduleById(
  id: string,
  schoolId?: string
): Promise<TeacherScheduleWithTeacher> {
  const supabase = await createClient()
  let query = supabase
    .from('teacher_schedules')
    .select(
      '*, day_of_week:days_of_week(*), time_slot:time_slots(*), classroom:classrooms(*), teacher:staff(*)'
    )
    .eq('id', id)

  const effectiveSchoolId = schoolId || (await getUserSchoolId())
  if (effectiveSchoolId) {
    query = query.eq('school_id', effectiveSchoolId)
  }

  const { data, error } = await query.single()

  if (error) throw error
  return normalizeTeacherSchedule(data) as TeacherScheduleWithTeacher
}

export async function updateTeacherSchedule(
  id: string,
  updates: Partial<TeacherSchedule> & { class_group_id?: string | null; class_id?: string | null },
  schoolId?: string
): Promise<TeacherSchedule | null> {
  const supabase = await createClient()
  const { class_id, class_group_id, ...rest } = updates
  const updateData: Record<string, unknown> = {
    ...rest,
  }
  if (class_group_id !== undefined || class_id !== undefined) {
    updateData.class_group_id = class_group_id ?? class_id ?? null
  }

  let query = supabase.from('teacher_schedules').update(updateData).eq('id', id)

  const effectiveSchoolId = schoolId || (await getUserSchoolId())
  if (effectiveSchoolId) {
    query = query.eq('school_id', effectiveSchoolId)
  }

  const { data, error } = await query.select().maybeSingle()

  if (error) {
    const enhancedError: SupabaseErrorDetails = new Error(error.message)
    enhancedError.code = error.code
    enhancedError.details = error.details
    enhancedError.hint = error.hint

    if (isMissingColumnError(enhancedError, 'class_group_id')) {
      const legacyUpdate: Record<string, unknown> = {
        ...rest,
      }
      if (class_group_id !== undefined || class_id !== undefined) {
        legacyUpdate.class_id = class_id ?? class_group_id ?? null
      }
      const { data: legacyData, error: legacyError } = await supabase
        .from('teacher_schedules')
        .update(legacyUpdate)
        .eq('id', id)
        .select()
        .maybeSingle()

      if (legacyError) {
        // Fallback for schema without class_id/class_group_id
        if (isMissingColumnError(legacyError as SupabaseErrorDetails, 'class_id')) {
          const minimalUpdate: Record<string, unknown> = { ...rest }
          const { data: minimalData, error: minimalError } = await supabase
            .from('teacher_schedules')
            .update(minimalUpdate)
            .eq('id', id)
            .select()
            .maybeSingle()

          if (minimalError) throw minimalError
          if (!minimalData) {
            return null
          }
          return normalizeTeacherSchedule(minimalData) as TeacherSchedule
        }

        throw legacyError
      }
      if (!legacyData) {
        return null
      }
      return normalizeTeacherSchedule(legacyData) as TeacherSchedule
    }

    if (isMissingColumnError(enhancedError, 'class_id')) {
      const minimalUpdate: Record<string, unknown> = { ...rest }
      const { data: minimalData, error: minimalError } = await supabase
        .from('teacher_schedules')
        .update(minimalUpdate)
        .eq('id', id)
        .select()
        .maybeSingle()

      if (minimalError) throw minimalError
      if (!minimalData) {
        return null
      }
      return normalizeTeacherSchedule(minimalData) as TeacherSchedule
    }

    throw enhancedError
  }
  if (!data) {
    return null
  }
  return normalizeTeacherSchedule(data) as TeacherSchedule
}

export async function getAllTeacherSchedules(
  filters?: { teacher_id?: string },
  schoolId?: string
): Promise<TeacherScheduleWithTeacher[]> {
  const supabase = await createClient()
  let query = supabase
    .from('teacher_schedules')
    .select(
      '*, day_of_week:days_of_week(*), time_slot:time_slots(*), classroom:classrooms(*), teacher:staff(*)'
    )
    .order('teacher_id', { ascending: true })
    .order('day_of_week_id', { ascending: true })
    .order('time_slot_id', { ascending: true })

  const effectiveSchoolId = schoolId || (await getUserSchoolId())
  if (effectiveSchoolId) {
    query = query.eq('school_id', effectiveSchoolId)
  }

  if (filters?.teacher_id) {
    query = query.eq('teacher_id', filters.teacher_id)
  }

  const { data, error } = await query

  if (error) throw error
  return (data || []).map(row => normalizeTeacherSchedule(row)) as TeacherScheduleWithTeacher[]
}

export async function bulkCreateTeacherSchedules(
  teacherId: string,
  schedules: Array<{
    day_of_week_id: string
    time_slot_id: string
    class_id?: string | null
    class_group_id?: string | null
    classroom_id: string
  }>,
  schoolId?: string
) {
  const supabase = await createClient()

  const effectiveSchoolId = schoolId || (await getUserSchoolId())
  if (!effectiveSchoolId) {
    throw new Error('school_id is required to create teacher schedules')
  }

  const scheduleData = schedules.map(schedule => ({
    teacher_id: teacherId,
    school_id: effectiveSchoolId,
    day_of_week_id: schedule.day_of_week_id,
    time_slot_id: schedule.time_slot_id,
    classroom_id: schedule.classroom_id,
    class_group_id: schedule.class_group_id ?? schedule.class_id ?? null,
  }))

  const { data, error } = await supabase.from('teacher_schedules').insert(scheduleData).select()

  if (error) {
    const enhancedError: SupabaseErrorDetails = new Error(error.message)
    enhancedError.code = error.code
    enhancedError.details = error.details
    enhancedError.hint = error.hint

    if (isMissingColumnError(enhancedError, 'class_group_id')) {
      const legacyScheduleData = schedules.map(schedule => ({
        teacher_id: teacherId,
        school_id: effectiveSchoolId,
        day_of_week_id: schedule.day_of_week_id,
        time_slot_id: schedule.time_slot_id,
        classroom_id: schedule.classroom_id,
        class_id: schedule.class_id ?? schedule.class_group_id ?? null,
      }))

      const { data: legacyData, error: legacyError } = await supabase
        .from('teacher_schedules')
        .insert(legacyScheduleData)
        .select()

      if (legacyError) {
        if (isMissingColumnError(legacyError as SupabaseErrorDetails, 'class_id')) {
          const minimalScheduleData = schedules.map(schedule => ({
            teacher_id: teacherId,
            school_id: effectiveSchoolId,
            day_of_week_id: schedule.day_of_week_id,
            time_slot_id: schedule.time_slot_id,
            classroom_id: schedule.classroom_id,
          }))
          const { data: minimalData, error: minimalError } = await supabase
            .from('teacher_schedules')
            .insert(minimalScheduleData)
            .select()

          if (minimalError) throw minimalError
          return (minimalData || []).map(row => normalizeTeacherSchedule(row)) as TeacherSchedule[]
        }
        throw legacyError
      }
      return (legacyData || []).map(row => normalizeTeacherSchedule(row)) as TeacherSchedule[]
    }

    if (isMissingColumnError(enhancedError, 'class_id')) {
      const minimalScheduleData = schedules.map(schedule => ({
        teacher_id: teacherId,
        school_id: effectiveSchoolId,
        day_of_week_id: schedule.day_of_week_id,
        time_slot_id: schedule.time_slot_id,
        classroom_id: schedule.classroom_id,
      }))
      const { data: minimalData, error: minimalError } = await supabase
        .from('teacher_schedules')
        .insert(minimalScheduleData)
        .select()

      if (minimalError) throw minimalError
      return (minimalData || []).map(row => normalizeTeacherSchedule(row)) as TeacherSchedule[]
    }

    throw enhancedError
  }
  return (data || []).map(row => normalizeTeacherSchedule(row)) as TeacherSchedule[]
}

export async function deleteTeacherSchedulesByTeacher(teacherId: string, schoolId?: string) {
  const supabase = await createClient()
  let query = supabase.from('teacher_schedules').delete().eq('teacher_id', teacherId)

  const effectiveSchoolId = schoolId || (await getUserSchoolId())
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
  const effectiveSchoolId = schoolId || (await getUserSchoolId())

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
  return data ? (normalizeTeacherSchedule(data) as TeacherScheduleWithDetails) : null
}
