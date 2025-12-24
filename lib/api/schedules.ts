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

