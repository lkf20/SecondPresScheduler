import { createClient } from '@/lib/supabase/server'

export interface WeeklyScheduleData {
  day_of_week_id: string
  day_name: string
  day_number: number
  time_slot_id: string
  time_slot_code: string
  time_slot_name: string | null
  time_slot_display_order: number | null
  assignments: Array<{
    id: string
    teacher_id: string
    teacher_name: string
    class_id: string
    class_name: string
    classroom_id: string
    classroom_name: string
    enrollment?: number
    required_teachers?: number
    preferred_teachers?: number
    assigned_count?: number
  }>
}

export interface WeeklyScheduleDataByClassroom {
  classroom_id: string
  classroom_name: string
  days: Array<{
    day_of_week_id: string
    day_name: string
    day_number: number
    time_slots: Array<{
      time_slot_id: string
      time_slot_code: string
      time_slot_name: string | null
      time_slot_display_order: number | null
      assignments: WeeklyScheduleData['assignments']
    }>
  }>
}

export async function getWeeklyScheduleData(selectedDayIds?: string[]) {
  const supabase = await createClient()
  
  // Get all days of week and time slots
  let daysQuery = supabase
    .from('days_of_week')
    .select('*')
  
  // Filter by selected days if provided
  if (selectedDayIds && selectedDayIds.length > 0) {
    daysQuery = daysQuery.in('id', selectedDayIds)
  }
  
  const { data: daysOfWeekData, error: daysError } = await daysQuery
  
  if (daysError) {
    throw new Error(`Failed to fetch days of week: ${daysError.message}`)
  }
  
  // Sort days by day_number
  const daysOfWeek = daysOfWeekData?.sort((a, b) => {
    // Handle Sunday (day_number 0 or 7)
    const aNum = a.day_number === 0 ? 7 : a.day_number
    const bNum = b.day_number === 0 ? 7 : b.day_number
    return aNum - bNum
  }) || []
  
  const { data: timeSlots, error: timeSlotsError } = await supabase
    .from('time_slots')
    .select('*')
    .order('display_order', { ascending: true })
  
  if (timeSlotsError) {
    throw new Error(`Failed to fetch time slots: ${timeSlotsError.message}`)
  }
  
  // Get classrooms ordered by order field, then name
  const { data: classrooms, error: classroomsError } = await supabase
    .from('classrooms')
    .select('*')
    .order('order', { ascending: true, nullsLast: true })
    .order('name', { ascending: true })
  
  if (classroomsError) {
    throw new Error(`Failed to fetch classrooms: ${classroomsError.message}`)
  }
  
  if (!daysOfWeek || daysOfWeek.length === 0) {
    return []
  }
  
  if (!timeSlots || timeSlots.length === 0) {
    return []
  }
  
  if (!classrooms || classrooms.length === 0) {
    return []
  }
  
  // Get all teacher schedules with related data
  const { data: schedules } = await supabase
    .from('teacher_schedules')
    .select(`
      *,
      teacher:staff!teacher_schedules_teacher_id_fkey(id, first_name, last_name, display_name),
      day_of_week:days_of_week(*),
      time_slot:time_slots(*),
      class:classes(*),
      classroom:classrooms(*)
    `)
  
  // Get enrollments
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select(`
      *,
      class:classes(*),
      day_of_week:days_of_week(*),
      time_slot:time_slots(*)
    `)
  
  // Get staffing rules
  const { data: staffingRules } = await supabase
    .from('staffing_rules')
    .select(`
      *,
      class:classes(*),
      day_of_week:days_of_week(*),
      time_slot:time_slots(*)
    `)
  
  // Get class-classroom mappings
  const { data: classMappings } = await supabase
    .from('class_classroom_mappings')
    .select(`
      *,
      class:classes(*),
      classroom:classrooms(*),
      day_of_week:days_of_week(*),
      time_slot:time_slots(*)
    `)
  
  // Build the weekly schedule data structure grouped by classroom
  const weeklyDataByClassroom: WeeklyScheduleDataByClassroom[] = []
  
  // Process each classroom
  for (const classroom of classrooms) {
    const classroomDays: WeeklyScheduleDataByClassroom['days'] = []
    
    // Process each day
    for (const day of daysOfWeek) {
      const dayTimeSlots: Array<{
        time_slot_id: string
        time_slot_code: string
        time_slot_name: string | null
        time_slot_display_order: number | null
        assignments: WeeklyScheduleData['assignments']
      }> = []
      
      // Process each time slot
      for (const timeSlot of timeSlots) {
        // Get all class-classroom mappings for this day/time/classroom
        const mappingsForSlot = classMappings?.filter(
          (m) => m.day_of_week_id === day.id && 
                 m.time_slot_id === timeSlot.id &&
                 m.classroom_id === classroom.id
        ) || []
        
        // Get assignments for this day/time/classroom
        const assignmentsForSlot = schedules?.filter(
          (s) => s.day_of_week_id === day.id && 
                 s.time_slot_id === timeSlot.id &&
                 s.classroom_id === classroom.id
        ) || []
        
        // Group assignments by class
        const assignmentMap = new Map<string, any[]>()
        
        for (const assignment of assignmentsForSlot) {
          const key = assignment.class_id
          if (!assignmentMap.has(key)) {
            assignmentMap.set(key, [])
          }
          assignmentMap.get(key)!.push({
            id: assignment.id,
            teacher_id: assignment.teacher_id,
            teacher_name: assignment.teacher?.display_name || 
                          `${assignment.teacher?.first_name || ''} ${assignment.teacher?.last_name || ''}`.trim() ||
                          'Unknown',
            class_id: assignment.class_id,
            class_name: assignment.class?.name || 'Unknown',
            classroom_id: assignment.classroom_id,
            classroom_name: assignment.classroom?.name || 'Unknown',
          })
        }
        
        // Build assignments array with enrollment and staffing data
        const assignments: WeeklyScheduleData['assignments'] = []
        
        for (const mapping of mappingsForSlot) {
          const key = mapping.class_id
          const teachers = assignmentMap.get(key) || []
          
          // Get enrollment for this class/day/time
          const enrollment = enrollments?.find(
            (e) => e.class_id === mapping.class_id && 
                   e.day_of_week_id === day.id && 
                   e.time_slot_id === timeSlot.id
          )
          
          // Get staffing rule for this class/day/time
          const rule = staffingRules?.find(
            (r) => r.class_id === mapping.class_id && 
                   r.day_of_week_id === day.id && 
                   r.time_slot_id === timeSlot.id
          )
          
          assignments.push({
            id: mapping.id,
            teacher_id: '', // Not applicable for mapping
            teacher_name: '', // Not applicable
            class_id: mapping.class_id,
            class_name: mapping.class?.name || 'Unknown',
            classroom_id: mapping.classroom_id,
            classroom_name: mapping.classroom?.name || 'Unknown',
            enrollment: enrollment?.enrollment_count || 0,
            required_teachers: rule?.required_teachers,
            preferred_teachers: rule?.preferred_teachers,
            assigned_count: teachers.length,
          })
          
          // Add teacher assignments
          for (const teacher of teachers) {
            assignments.push({
              ...teacher,
              enrollment: enrollment?.enrollment_count || 0,
              required_teachers: rule?.required_teachers,
              preferred_teachers: rule?.preferred_teachers,
              assigned_count: teachers.length,
            })
          }
        }
        
        dayTimeSlots.push({
          time_slot_id: timeSlot.id,
          time_slot_code: timeSlot.code,
          time_slot_name: timeSlot.name,
          time_slot_display_order: timeSlot.display_order,
          assignments,
        })
      }
      
      classroomDays.push({
        day_of_week_id: day.id,
        day_name: day.name,
        day_number: day.day_number,
        time_slots: dayTimeSlots,
      })
    }
    
    weeklyDataByClassroom.push({
      classroom_id: classroom.id,
      classroom_name: classroom.name,
      days: classroomDays,
    })
  }
  
  return weeklyDataByClassroom
}

