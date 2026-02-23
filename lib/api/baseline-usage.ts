import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'

type BaselineUsageOptions = {
  schoolId?: string
}

async function resolveSchoolId(schoolId?: string): Promise<string | null> {
  if (schoolId) return schoolId
  return getUserSchoolId()
}

export async function isStaffUsedInBaselineSchedule(
  staffId: string,
  options: BaselineUsageOptions = {}
): Promise<boolean> {
  const schoolId = await resolveSchoolId(options.schoolId)
  if (!schoolId) return false

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('teacher_schedules')
    .select('id')
    .eq('school_id', schoolId)
    .eq('teacher_id', staffId)
    .limit(1)

  if (error) throw error
  return (data?.length || 0) > 0
}

export async function isClassroomUsedInBaselineSchedule(
  classroomId: string,
  options: BaselineUsageOptions = {}
): Promise<boolean> {
  const schoolId = await resolveSchoolId(options.schoolId)
  if (!schoolId) return false

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('schedule_cells')
    .select('id')
    .eq('school_id', schoolId)
    .eq('classroom_id', classroomId)
    .eq('is_active', true)
    .limit(1)

  if (error) throw error
  return (data?.length || 0) > 0
}

export async function isClassGroupUsedInBaselineSchedule(
  classGroupId: string,
  options: BaselineUsageOptions = {}
): Promise<boolean> {
  const schoolId = await resolveSchoolId(options.schoolId)
  if (!schoolId) return false

  const supabase = await createClient()
  const { data: joinRows, error: joinError } = await supabase
    .from('schedule_cell_class_groups')
    .select('schedule_cell_id')
    .eq('school_id', schoolId)
    .eq('class_group_id', classGroupId)
    .limit(500)

  if (joinError) throw joinError
  const scheduleCellIds = (joinRows || []).map(row => row.schedule_cell_id).filter(Boolean)
  if (scheduleCellIds.length === 0) return false

  const { data, error } = await supabase
    .from('schedule_cells')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .in('id', scheduleCellIds)
    .limit(1)

  if (error) throw error
  return (data?.length || 0) > 0
}

export async function isTimeSlotUsedInBaselineSchedule(
  timeSlotId: string,
  options: BaselineUsageOptions = {}
): Promise<boolean> {
  const schoolId = await resolveSchoolId(options.schoolId)
  if (!schoolId) return false

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('schedule_cells')
    .select('id')
    .eq('school_id', schoolId)
    .eq('time_slot_id', timeSlotId)
    .eq('is_active', true)
    .limit(1)

  if (error) throw error
  return (data?.length || 0) > 0
}
