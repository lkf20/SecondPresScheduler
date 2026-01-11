import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type ClassGroupRow = Database['public']['Tables']['class_groups']['Row']
type ScheduleCellRow = Database['public']['Tables']['schedule_cells']['Row']

type ScheduleCellRaw = ScheduleCellRow & {
  schedule_cell_class_groups?: Array<{ class_group: ClassGroupRow | null }>
  class_groups?: ClassGroupRow[]
}

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
    is_floater?: boolean
    enrollment?: number
    required_teachers?: number
    preferred_teachers?: number
    assigned_count?: number
  }>
}

export interface WeeklyScheduleDataByClassroom {
  classroom_id: string
  classroom_name: string
  classroom_color: string | null
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
          schedule_cell: {
            id: string
            is_active: boolean
            enrollment_for_staffing: number | null
            notes: string | null
            class_groups?: Array<{
              id: string
              name: string
              min_age: number | null
              max_age: number | null
              required_ratio: number
              preferred_ratio: number | null
            }>
          } | null
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
    .order('order', { ascending: true, nullsFirst: false })
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
  const { data: schedules, error: schedulesError } = await supabase
    .from('teacher_schedules')
    .select(`
      *,
      teacher:staff!teacher_schedules_teacher_id_fkey(id, first_name, last_name, display_name),
      day_of_week:days_of_week(*),
      time_slot:time_slots(*),
      class:class_groups(*),
      classroom:classrooms(*)
    `)
  
  if (schedulesError) {
    console.error('API Error: Failed to fetch teacher schedules:', schedulesError)
    throw new Error(`Failed to fetch teacher schedules: ${schedulesError.message}`)
  }
  
  // Get staffing rules
  const { data: staffingRules, error: staffingRulesError } = await supabase
    .from('staffing_rules')
    .select(`
      *,
      class:class_groups(*),
      day_of_week:days_of_week(*),
      time_slot:time_slots(*)
    `)
  
  if (staffingRulesError) {
    console.error('API Error: Failed to fetch staffing rules:', staffingRulesError)
    throw new Error(`Failed to fetch staffing rules: ${staffingRulesError.message}`)
  }
  
  // Get schedule cells (gracefully handle if table doesn't exist yet)
  // Note: We fetch all schedule cells and filter in memory for flexibility
  // Future optimization: Add WHERE clauses if selectedDayIds is provided
  let scheduleCells: ScheduleCellRaw[] | null = null
  try {
    const { data, error: scheduleCellsError } = await supabase
      .from('schedule_cells')
      .select(`
        *,
        schedule_cell_class_groups(
          class_group:class_groups(id, name, min_age, max_age, required_ratio, preferred_ratio)
        )
      `)
    
    if (scheduleCellsError) {
      // If table doesn't exist (migration not run), continue without schedule cells
      if (scheduleCellsError.code === '42P01' || scheduleCellsError.message?.includes('does not exist')) {
        console.warn('schedule_cells table does not exist yet. Please run migration 021_create_schedule_cells.sql')
        scheduleCells = null
      } else {
        console.error('API Error: Failed to fetch schedule cells:', scheduleCellsError)
        scheduleCells = null
      }
    } else {
      // Transform the nested structure to flatten class_groups array
      scheduleCells = (data || []).map((cell) => {
        const raw = cell as ScheduleCellRaw
        const classGroups = raw.schedule_cell_class_groups
          ? raw.schedule_cell_class_groups
              .map((j) => j.class_group)
              .filter((cg): cg is NonNullable<typeof cg> => cg !== null)
          : []
        const flattened: ScheduleCellRaw = {
          ...raw,
          class_groups: classGroups,
        }
        delete flattened.schedule_cell_class_groups
        return flattened
      })
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.warn('Error fetching schedule cells (table may not exist):', errorMessage)
    scheduleCells = null
  }
  
  // Build the weekly schedule data structure grouped by classroom
  const weeklyDataByClassroom: WeeklyScheduleDataByClassroom[] = []
  
  // Process each classroom
  for (const classroom of classrooms) {
    const classroomDays: WeeklyScheduleDataByClassroom['days'] = []
    
    // Process each day - only include selected days if selectedDayIds is provided
    const daysToProcess = selectedDayIds && selectedDayIds.length > 0
      ? daysOfWeek.filter((d) => selectedDayIds.includes(d.id))
      : daysOfWeek
    
    for (const day of daysToProcess) {
      const dayTimeSlots: Array<{
        time_slot_id: string
        time_slot_code: string
        time_slot_name: string | null
        time_slot_display_order: number | null
        time_slot_start_time: string | null
        time_slot_end_time: string | null
        assignments: WeeklyScheduleData['assignments']
        schedule_cell: {
          id: string
          is_active: boolean
          enrollment_for_staffing: number | null
          notes: string | null
          class_groups?: Array<{
            id: string
            name: string
            min_age: number | null
            max_age: number | null
            required_ratio: number
            preferred_ratio: number | null
          }>
        } | null
      }> = []
      
      // Process each time slot
      for (const timeSlot of timeSlots) {
        // Get schedule cell for this day/time/classroom
        const scheduleCell = scheduleCells && scheduleCells.length > 0
          ? scheduleCells.find(
              (c) => c.classroom_id === classroom.id &&
                     c.day_of_week_id === day.id &&
                     c.time_slot_id === timeSlot.id
            )
          : null

        // Get assignments for this day/time/classroom
        const assignmentsForSlot = schedules?.filter(
          (s) => s.day_of_week_id === day.id && 
                 s.time_slot_id === timeSlot.id &&
                 s.classroom_id === classroom.id
        ) || []
        
        // Build assignments array - use schedule_cell as the source of truth
        const assignments: WeeklyScheduleData['assignments'] = []
        
        // Only process if schedule_cell exists and is active with class groups
        // Handle both class_groups (from transformed data) and schedule_cell_class_groups (from raw query)
        const classGroups = scheduleCell?.class_groups || []
        
        if (scheduleCell && classGroups && classGroups.length > 0 && scheduleCell.is_active) {
          const classGroupIds = classGroups.map((cg) => cg.id)
          
          // Get teachers assigned to this slot (teachers are assigned to the slot, not individual class groups)
          // Filter by any of the class groups in the slot
          const teachers = assignmentsForSlot
            .filter(a => a.class_id && classGroupIds.includes(a.class_id))
            .map(assignment => ({
              id: assignment.id,
              teacher_id: assignment.teacher_id,
              teacher_name: assignment.teacher?.display_name || 
                            `${assignment.teacher?.first_name || ''} ${assignment.teacher?.last_name || ''}`.trim() ||
                            'Unknown',
              class_id: assignment.class_id,
              class_name: assignment.class?.name || 'Unknown',
              classroom_id: assignment.classroom_id,
              classroom_name: assignment.classroom?.name || 'Unknown',
              is_floater: assignment.is_floater || false,
            }))
          
          // Get enrollment from schedule_cell (enrollment is for the whole slot, not per class group)
          const enrollment = scheduleCell.enrollment_for_staffing ?? null
          
          // Get staffing rule for the primary class group/day/time
          const primaryClassGroupId = classGroupIds[0]
          const rule = staffingRules?.find(
            (r) => r.class_id === primaryClassGroupId && 
                   r.day_of_week_id === day.id && 
                   r.time_slot_id === timeSlot.id
          )
          
          // Add teacher assignments for this slot
          for (const teacher of teachers) {
            assignments.push({
              ...teacher,
              enrollment: enrollment ?? 0,
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
            time_slot_start_time: timeSlot.default_start_time,
            time_slot_end_time: timeSlot.default_end_time,
            assignments,
            schedule_cell: scheduleCell ? {
              id: scheduleCell.id,
              is_active: scheduleCell.is_active,
              enrollment_for_staffing: scheduleCell.enrollment_for_staffing,
              notes: scheduleCell.notes,
              class_groups: classGroups || [],
            } : null,
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
      classroom_color: classroom.color ?? null,
      days: classroomDays,
    })
  }
  
  return weeklyDataByClassroom
}
