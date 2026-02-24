import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { getUserSchoolId } from '@/lib/utils/auth'

type TeacherSchedule = Database['public']['Tables']['teacher_schedules']['Row']
type DayOfWeek = Database['public']['Tables']['days_of_week']['Row']
type TimeSlot = Database['public']['Tables']['time_slots']['Row']
type Classroom = Database['public']['Tables']['classrooms']['Row']
type Staff = Database['public']['Tables']['staff']['Row']

type TeacherScheduleWithDetails = TeacherSchedule & {
  day_of_week: DayOfWeek | null
  time_slot: TimeSlot | null
  classroom: Classroom | null
}

type TeacherScheduleWithTeacher = TeacherScheduleWithDetails & {
  teacher: Staff | null
}

function normalizeTeacherSchedule<T extends Record<string, unknown>>(row: T): T {
  return row
}

async function assertActiveTeachers(
  teacherIds: string[],
  schoolId: string,
  messagePrefix: string
): Promise<void> {
  if (teacherIds.length === 0) return
  const uniqueIds = [...new Set(teacherIds)]
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staff')
    .select('id, school_id, active')
    .in('id', uniqueIds)

  if (error) throw error

  const rowById = new Map((data || []).map(row => [row.id, row]))
  for (const teacherId of uniqueIds) {
    const row = rowById.get(teacherId)
    if (!row || row.school_id !== schoolId || row.active === false) {
      throw new Error(
        `${messagePrefix}: staff member is inactive, missing, or out of school scope.`
      )
    }
  }
}

async function assertActiveClassrooms(
  classroomIds: string[],
  schoolId: string,
  messagePrefix: string
): Promise<void> {
  if (classroomIds.length === 0) return
  const uniqueIds = [...new Set(classroomIds)]
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('classrooms')
    .select('id, school_id, is_active')
    .in('id', uniqueIds)

  if (error) throw error

  const rowById = new Map((data || []).map(row => [row.id, row]))
  for (const classroomId of uniqueIds) {
    const row = rowById.get(classroomId)
    if (!row || row.school_id !== schoolId || row.is_active === false) {
      throw new Error(`${messagePrefix}: classroom is inactive, missing, or out of school scope.`)
    }
  }
}

async function assertActiveTimeSlots(
  timeSlotIds: string[],
  schoolId: string,
  messagePrefix: string
): Promise<void> {
  if (timeSlotIds.length === 0) return
  const uniqueIds = [...new Set(timeSlotIds)]
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('time_slots')
    .select('id, school_id, is_active')
    .in('id', uniqueIds)

  if (error) throw error

  const rowById = new Map((data || []).map(row => [row.id, row]))
  for (const timeSlotId of uniqueIds) {
    const row = rowById.get(timeSlotId)
    if (!row || row.school_id !== schoolId || row.is_active === false) {
      throw new Error(`${messagePrefix}: time slot is inactive, missing, or out of school scope.`)
    }
  }
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

  await assertActiveTeachers([schedule.teacher_id], schoolId, 'Cannot create teacher schedule')
  await assertActiveClassrooms([schedule.classroom_id], schoolId, 'Cannot create teacher schedule')
  await assertActiveTimeSlots([schedule.time_slot_id], schoolId, 'Cannot create teacher schedule')

  const insertData = {
    teacher_id: schedule.teacher_id,
    day_of_week_id: schedule.day_of_week_id,
    time_slot_id: schedule.time_slot_id,
    classroom_id: schedule.classroom_id,
    school_id: schoolId,
    is_floater: schedule.is_floater ?? false,
  }

  const { data, error } = await supabase
    .from('teacher_schedules')
    .insert(insertData)
    .select()
    .single()

  if (error) throw error
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
  updates: Partial<TeacherSchedule>,
  schoolId?: string
): Promise<TeacherSchedule | null> {
  const supabase = await createClient()
  const effectiveSchoolId = schoolId || (await getUserSchoolId())
  if (!effectiveSchoolId) {
    throw new Error('school_id is required to update teacher schedule')
  }

  if (updates.teacher_id) {
    await assertActiveTeachers(
      [updates.teacher_id],
      effectiveSchoolId,
      'Cannot update teacher schedule'
    )
  }
  if (updates.classroom_id) {
    await assertActiveClassrooms(
      [updates.classroom_id],
      effectiveSchoolId,
      'Cannot update teacher schedule'
    )
  }
  if (updates.time_slot_id) {
    await assertActiveTimeSlots(
      [updates.time_slot_id],
      effectiveSchoolId,
      'Cannot update teacher schedule'
    )
  }

  const updateData: Record<string, unknown> = {
    ...updates,
  }

  let query = supabase.from('teacher_schedules').update(updateData).eq('id', id)
  if (effectiveSchoolId) {
    query = query.eq('school_id', effectiveSchoolId)
  }

  const { data, error } = await query.select().maybeSingle()

  if (error) throw error
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
    classroom_id: string
  }>,
  schoolId?: string
) {
  const supabase = await createClient()

  const effectiveSchoolId = schoolId || (await getUserSchoolId())
  if (!effectiveSchoolId) {
    throw new Error('school_id is required to create teacher schedules')
  }

  await assertActiveTeachers([teacherId], effectiveSchoolId, 'Cannot create teacher schedules')
  await assertActiveClassrooms(
    schedules.map(schedule => schedule.classroom_id),
    effectiveSchoolId,
    'Cannot create teacher schedules'
  )
  await assertActiveTimeSlots(
    schedules.map(schedule => schedule.time_slot_id),
    effectiveSchoolId,
    'Cannot create teacher schedules'
  )

  const scheduleData = schedules.map(schedule => ({
    teacher_id: teacherId,
    school_id: effectiveSchoolId,
    day_of_week_id: schedule.day_of_week_id,
    time_slot_id: schedule.time_slot_id,
    classroom_id: schedule.classroom_id,
  }))

  const { data, error } = await supabase.from('teacher_schedules').insert(scheduleData).select()

  if (error) throw error
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
