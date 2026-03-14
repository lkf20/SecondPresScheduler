import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getTodayISO } from '@/lib/utils/date'

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
    .select(
      '*, day_of_week:days_of_week(*), time_slot:time_slots(*), classroom:classrooms(*), teacher:staff(*, staff_role_type_assignments(role_type_id, staff_role_types(*)))'
    )
    .eq('teacher_id', teacherId)

  const effectiveSchoolId = schoolId || (await getUserSchoolId())
  if (effectiveSchoolId) {
    query = query.eq('school_id', effectiveSchoolId)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []).map(row => normalizeTeacherSchedule(row)) as TeacherScheduleWithDetails[]
}

/** Thrown when assigning a teacher would create a double-booking (same day/slot, different classroom, not both floaters). */
export class TeacherScheduleConflictError extends Error {
  constructor(public readonly userMessage: string) {
    super(userMessage)
    this.name = 'TeacherScheduleConflictError'
  }
}

/**
 * Ensures the given assignment does not conflict with existing teacher_schedules.
 * Rule: same teacher + same day + same time_slot in a different classroom is a conflict,
 * unless both the new and existing assignment are floaters.
 * @param excludeScheduleId When updating, pass the schedule id being updated so it is excluded.
 */
export async function assertNoTeacherScheduleConflict(
  assignment: {
    teacher_id: string
    day_of_week_id: string
    time_slot_id: string
    classroom_id: string
    is_floater?: boolean
  },
  excludeScheduleId?: string
): Promise<void> {
  const supabase = await createClient()
  let query = supabase
    .from('teacher_schedules')
    .select(
      'id, classroom_id, is_floater, classroom:classrooms(name), day_of_week:days_of_week(name), time_slot:time_slots(code)'
    )
    .eq('teacher_id', assignment.teacher_id)
    .eq('day_of_week_id', assignment.day_of_week_id)
    .eq('time_slot_id', assignment.time_slot_id)
    .neq('classroom_id', assignment.classroom_id)
  if (excludeScheduleId) {
    query = query.neq('id', excludeScheduleId)
  }
  const { data: existing, error } = await query
  if (error) throw error
  const newIsFloater = assignment.is_floater === true
  for (const row of existing ?? []) {
    const rowFloater = (row as { is_floater?: boolean }).is_floater === true
    if (rowFloater && newIsFloater) continue
    const classroom = (row as { classroom?: { name?: string } }).classroom
    const dayOfWeek = (row as { day_of_week?: { name?: string } }).day_of_week
    const timeSlot = (row as { time_slot?: { code?: string } }).time_slot
    const roomName = classroom?.name ?? 'another room'
    const dayName = dayOfWeek?.name ?? 'this day'
    const slotCode = timeSlot?.code ?? 'this time'
    throw new TeacherScheduleConflictError(
      `This teacher is already scheduled in ${roomName} for ${dayName} ${slotCode}. Resolve the conflict first or assign as Floater in both classrooms.`
    )
  }
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

  await assertNoTeacherScheduleConflict({
    teacher_id: insertData.teacher_id,
    day_of_week_id: insertData.day_of_week_id,
    time_slot_id: insertData.time_slot_id,
    classroom_id: insertData.classroom_id,
    is_floater: insertData.is_floater,
  })

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
      '*, day_of_week:days_of_week(*), time_slot:time_slots(*), classroom:classrooms(*), teacher:staff(*, staff_role_type_assignments(role_type_id, staff_role_types(*)))'
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

  const conflictRelevantKeys = [
    'teacher_id',
    'day_of_week_id',
    'time_slot_id',
    'classroom_id',
    'is_floater',
  ] as const
  const hasConflictRelevantUpdate = conflictRelevantKeys.some(key => key in updates)
  if (hasConflictRelevantUpdate) {
    const existing = await getTeacherScheduleById(id, effectiveSchoolId)
    if (existing) {
      const merged = {
        teacher_id: (updates.teacher_id ?? existing.teacher_id) as string,
        day_of_week_id: (updates.day_of_week_id ?? existing.day_of_week_id) as string,
        time_slot_id: (updates.time_slot_id ?? existing.time_slot_id) as string,
        classroom_id: (updates.classroom_id ?? existing.classroom_id) as string,
        is_floater: updates.is_floater ?? existing.is_floater ?? false,
      }
      await assertNoTeacherScheduleConflict(merged, id)
    }
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
      '*, day_of_week:days_of_week(*), time_slot:time_slots(*), classroom:classrooms(*), teacher:staff(*, staff_role_type_assignments(role_type_id, staff_role_types(*)))'
    )
    .order('teacher_id', { ascending: true })
    .order('day_of_week_id', { ascending: true })
    .order('time_slot_id', { ascending: true })

  const effectiveSchoolId = schoolId || (await getUserSchoolId())
  if (!effectiveSchoolId) {
    throw new Error('school_id is required to fetch teacher schedules')
  }
  query = query.eq('school_id', effectiveSchoolId)

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

/**
 * Checks if there are any non-cancelled future events (time off, coverage requests, sub assignments)
 * that depend on the given baseline schedule slot.
 * Used to block structural changes (day/time changes or deletions) that would orphan these events.
 */
export async function checkDependentFutureEvents(
  teacherId: string,
  dayOfWeekId: string,
  timeSlotId: string,
  schoolId?: string
): Promise<{ hasDependents: boolean; message?: string }> {
  const supabase = await createClient()
  const effectiveSchoolId = schoolId || (await getUserSchoolId())
  if (!effectiveSchoolId) {
    throw new Error('school_id is required to check dependent events')
  }

  const today = getTodayISO()

  // 1. Check for future time_off_requests that overlap with this day/slot.
  // time_off_shifts link the request to specific days/slots.
  const { data: timeOffShifts, error: toError } = await supabase
    .from('time_off_shifts')
    .select('id, time_off_requests!inner(status, teacher_id)')
    .eq('time_off_requests.teacher_id', teacherId)
    .eq('day_of_week_id', dayOfWeekId)
    .eq('time_slot_id', timeSlotId)
    .gte('date', today)
    .neq('time_off_requests.status', 'cancelled')

  if (toError) throw toError

  if (timeOffShifts && timeOffShifts.length > 0) {
    return {
      hasDependents: true,
      message: `Cannot modify schedule. The teacher has ${timeOffShifts.length} future time-off shift(s) for this slot. Please cancel or adjust them first.`,
    }
  }

  // 2. Check for future coverage_request_shifts (which also implies sub_assignments).
  // These could be from time off or from extra coverage/flex.
  const { data: coverageShifts, error: covError } = await supabase
    .from('coverage_request_shifts')
    .select('id, coverage_requests!inner(teacher_id)')
    .eq('coverage_requests.teacher_id', teacherId)
    .eq('day_of_week_id', dayOfWeekId)
    .eq('time_slot_id', timeSlotId)
    .eq('school_id', effectiveSchoolId)
    .gte('date', today)
    .neq('status', 'cancelled')

  if (covError) throw covError

  if (coverageShifts && coverageShifts.length > 0) {
    return {
      hasDependents: true,
      message: `Cannot modify schedule. The teacher has ${coverageShifts.length} future coverage request(s) or sub assignment(s) for this slot. Please cancel or adjust them first.`,
    }
  }

  return { hasDependents: false }
}

/**
 * Automatically syncs a new classroom_id to all future coverage_request_shifts and sub_assignments
 * for a specific teacher, day, and time slot.
 * Used when a baseline schedule is updated *only* with a new classroom_id.
 */
export async function syncFutureClassroom(
  teacherId: string,
  dayOfWeekId: string,
  timeSlotId: string,
  newClassroomId: string,
  schoolId?: string
): Promise<void> {
  const supabase = await createClient()
  const effectiveSchoolId = schoolId || (await getUserSchoolId())
  if (!effectiveSchoolId) {
    throw new Error('school_id is required to sync future classrooms')
  }

  const today = getTodayISO()

  // First, find the IDs of all relevant future coverage_request_shifts.
  const { data: shiftsToUpdate, error: findError } = await supabase
    .from('coverage_request_shifts')
    .select('id, coverage_requests!inner(teacher_id)')
    .eq('coverage_requests.teacher_id', teacherId)
    .eq('day_of_week_id', dayOfWeekId)
    .eq('time_slot_id', timeSlotId)
    .eq('school_id', effectiveSchoolId)
    .gte('date', today)

  if (findError) throw findError

  if (!shiftsToUpdate || shiftsToUpdate.length === 0) {
    return // Nothing to update
  }

  const shiftIds = shiftsToUpdate.map(s => s.id)

  // Update the classroom on coverage_request_shifts
  const { error: updateShiftsError } = await supabase
    .from('coverage_request_shifts')
    .update({ classroom_id: newClassroomId })
    .in('id', shiftIds)

  if (updateShiftsError) throw updateShiftsError

  // Update the classroom on linked sub_assignments (if sub_assignments has classroom_id)
  // Wait, let's verify if sub_assignments has classroom_id...
  // Looking at docs/reference/DATABASE_SCHEMA.md:
  // "sub_assignments - Has classroom_id and date; tied to a coverage_request_shift"
  const { error: updateSubsError } = await supabase
    .from('sub_assignments')
    .update({ classroom_id: newClassroomId })
    .in('coverage_request_shift_id', shiftIds)

  if (updateSubsError) throw updateSubsError
}
