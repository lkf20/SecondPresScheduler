import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type TeacherSchedule = Database['public']['Tables']['teacher_schedules']['Row']

export async function getTeacherSchedules(teacherId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('teacher_schedules')
    .select('*, day_of_week:days_of_week(*), time_slot:time_slots(*), class:classes(*), classroom:classrooms(*)')
    .eq('teacher_id', teacherId)

  if (error) throw error
  return data as any[]
}

export async function createTeacherSchedule(schedule: {
  teacher_id: string
  day_of_week_id: string
  time_slot_id: string
  class_id: string
  classroom_id: string
}) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('teacher_schedules')
    .insert(schedule)
    .select()
    .single()

  if (error) throw error
  return data as TeacherSchedule
}

export async function deleteTeacherSchedule(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('teacher_schedules').delete().eq('id', id)

  if (error) throw error
}

export async function getTeacherScheduleById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('teacher_schedules')
    .select('*, day_of_week:days_of_week(*), time_slot:time_slots(*), class:classes(*), classroom:classrooms(*), teacher:staff(*)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as any
}

export async function updateTeacherSchedule(id: string, updates: Partial<TeacherSchedule>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('teacher_schedules')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as TeacherSchedule
}

export async function getAllTeacherSchedules(filters?: { teacher_id?: string }) {
  const supabase = await createClient()
  let query = supabase
    .from('teacher_schedules')
    .select('*, day_of_week:days_of_week(*), time_slot:time_slots(*), class:classes(*), classroom:classrooms(*), teacher:staff(*)')
    .order('teacher_id', { ascending: true })
    .order('day_of_week_id', { ascending: true })
    .order('time_slot_id', { ascending: true })

  if (filters?.teacher_id) {
    query = query.eq('teacher_id', filters.teacher_id)
  }

  const { data, error } = await query

  if (error) throw error
  return data as any[]
}

export async function bulkCreateTeacherSchedules(
  teacherId: string,
  schedules: Array<{
    day_of_week_id: string
    time_slot_id: string
    class_id: string
    classroom_id: string
  }>
) {
  const supabase = await createClient()
  const scheduleData = schedules.map((schedule) => ({
    teacher_id: teacherId,
    ...schedule,
  }))

  const { data, error } = await supabase
    .from('teacher_schedules')
    .insert(scheduleData)
    .select()

  if (error) throw error
  return data as TeacherSchedule[]
}

export async function deleteTeacherSchedulesByTeacher(teacherId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('teacher_schedules')
    .delete()
    .eq('teacher_id', teacherId)

  if (error) throw error
}

export async function getScheduleByDayAndSlot(
  teacherId: string,
  dayOfWeekId: string,
  timeSlotId: string
) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('teacher_schedules')
    .select('*, day_of_week:days_of_week(*), time_slot:time_slots(*), class:classes(*), classroom:classrooms(*)')
    .eq('teacher_id', teacherId)
    .eq('day_of_week_id', dayOfWeekId)
    .eq('time_slot_id', timeSlotId)
    .maybeSingle()

  if (error) throw error
  return data as any
}



