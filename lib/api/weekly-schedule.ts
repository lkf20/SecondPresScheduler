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
    class_id?: string // Optional: teachers are assigned to classrooms, not specific class groups
    class_name?: string // Optional: teachers are assigned to classrooms, not specific class groups
    classroom_id: string
    classroom_name: string
    is_floater?: boolean
    is_substitute?: boolean // True if this assignment comes from sub_assignments (week-specific)
    absent_teacher_id?: string // If this is a substitute, the ID of the teacher being replaced
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
      time_slot_start_time: string | null
      time_slot_end_time: string | null
      assignments: WeeklyScheduleData['assignments']
      absences?: Array<{
        teacher_id: string
        teacher_name: string
        has_sub: boolean
        is_partial: boolean
        time_off_request_id?: string // ID of the time off request this absence belongs to
      }>
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

export async function getWeeklyScheduleData(schoolId: string, selectedDayIds?: string[], weekStartISO?: string) {
  const supabase = await createClient()
  
  // Fetch time off shifts for the week to identify uncovered absences
  let timeOffShifts: Array<{
    id: string
    date: string
    day_of_week_id: string | null
    time_slot_id: string
    teacher_id: string
    time_off_request_id: string
  }> = []
  
  if (weekStartISO) {
    try {
      const weekStart = new Date(weekStartISO + 'T00:00:00')
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      
      const { data: timeOffShiftsData, error: timeOffShiftsError } = await supabase
        .from('time_off_shifts')
        .select(`
          id,
          date,
          day_of_week_id,
          time_slot_id,
          time_off_request_id,
          time_off_requests!inner(teacher_id, status)
        `)
        .gte('date', weekStartISO)
        .lte('date', weekEnd.toISOString().split('T')[0])
        .eq('time_off_requests.status', 'active')
      
      if (timeOffShiftsError) {
        console.warn('Error fetching time_off_shifts:', timeOffShiftsError.message)
      } else if (timeOffShiftsData) {
        timeOffShifts = timeOffShiftsData.map((shift: any) => ({
          id: shift.id,
          date: shift.date,
          day_of_week_id: shift.day_of_week_id,
          time_slot_id: shift.time_slot_id,
          teacher_id: shift.time_off_requests?.teacher_id || '',
          time_off_request_id: shift.time_off_request_id,
        }))
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.warn('Error fetching time_off_shifts:', errorMessage)
    }
  }
  
  // Get all days of week (reference data - doesn't have school_id, shared across all schools)
  // Note: days_of_week and time_slots are reference data and don't have school_id columns
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
    .eq('school_id', schoolId)
    .order('display_order', { ascending: true })
  
  if (timeSlotsError) {
    console.error('Error fetching time slots:', {
      error: timeSlotsError,
      schoolId,
      message: timeSlotsError.message,
      code: timeSlotsError.code,
      details: timeSlotsError.details,
      hint: timeSlotsError.hint
    })
    throw new Error(`Failed to fetch time slots: ${timeSlotsError.message}`)
  }
  
  // Get classrooms ordered by order field, then name
  const { data: classrooms, error: classroomsError } = await supabase
    .from('classrooms')
    .select('*')
    .eq('school_id', schoolId)
    .order('order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })
  
  if (classroomsError) {
    console.error('Error fetching classrooms:', {
      error: classroomsError,
      schoolId,
      message: classroomsError.message,
      code: classroomsError.code,
      details: classroomsError.details,
      hint: classroomsError.hint
    })
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
      classroom:classrooms(*)
    `)
    .eq('school_id', schoolId)
  
  if (schedulesError) {
    console.error('API Error: Failed to fetch teacher schedules:', schedulesError)
    throw new Error(`Failed to fetch teacher schedules: ${schedulesError.message}`)
  }
  
  // Fetch class_groups separately if class_id exists
  // This avoids the schema cache issue with nullable foreign keys
  if (schedules && schedules.length > 0) {
    const classIds = [...new Set(schedules.map((s: any) => s.class_id).filter(Boolean))]
    if (classIds.length > 0) {
      const { data: classGroups } = await supabase
        .from('class_groups')
        .select('id, name')
        .in('id', classIds)
      
      const classGroupsMap = new Map((classGroups || []).map((cg: any) => [cg.id, cg]))
      schedules.forEach((schedule: any) => {
        if (schedule.class_id) {
          schedule.class = classGroupsMap.get(schedule.class_id) || null
        }
      })
    }
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
    .eq('school_id', schoolId)
  
  if (staffingRulesError) {
    console.error('API Error: Failed to fetch staffing rules:', staffingRulesError)
    throw new Error(`Failed to fetch staffing rules: ${staffingRulesError.message}`)
  }
  
  // Get schedule cells (gracefully handle if table doesn't exist yet)
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
      .eq('school_id', schoolId)
    
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
  
  // Fetch substitute assignments for the selected week (if weekStartISO is provided)
  let subAssignments: Array<{
    id: string
    date: string
    day_of_week_id: string | null
    time_slot_id: string
    classroom_id: string
    sub_id: string
    teacher_id: string
    sub_name: string
    teacher_name: string
    class_id: string | null
    class_name: string | null
  }> = []
  
  if (weekStartISO) {
    try {
      // Calculate week start and end dates
      const weekStart = new Date(weekStartISO + 'T00:00:00')
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6) // Add 6 days to get Sunday
      
      // Fetch sub_assignments for the week
      const { data: subAssignmentsData, error: subAssignmentsError } = await supabase
        .from('sub_assignments')
        .select(`
          id,
          date,
          day_of_week_id,
          time_slot_id,
          classroom_id,
          sub_id,
          teacher_id,
          sub:staff!sub_assignments_sub_id_fkey(id, first_name, last_name, display_name),
          teacher:staff!sub_assignments_teacher_id_fkey(id, first_name, last_name, display_name)
        `)
        .gte('date', weekStartISO)
        .lte('date', weekEnd.toISOString().split('T')[0])
      
      if (subAssignmentsError) {
        console.warn('Error fetching sub_assignments:', subAssignmentsError.message)
      } else if (subAssignmentsData) {
        // Map sub_assignments - day_of_week_id is already in the database
        subAssignments = subAssignmentsData.map((sa: any) => ({
          id: sa.id,
          date: sa.date,
          day_of_week_id: sa.day_of_week_id,
          time_slot_id: sa.time_slot_id,
          classroom_id: sa.classroom_id,
          sub_id: sa.sub_id,
          teacher_id: sa.teacher_id,
          sub_name: sa.sub?.display_name || 
                   `${sa.sub?.first_name || ''} ${sa.sub?.last_name || ''}`.trim() ||
                   'Unknown',
          teacher_name: sa.teacher?.display_name || 
                       `${sa.teacher?.first_name || ''} ${sa.teacher?.last_name || ''}`.trim() ||
                       'Unknown',
          class_id: null, // sub_assignments doesn't have class_id - will use first class group from schedule_cell
          class_name: null,
          // Note: teacher_id in sub_assignments represents the absent teacher
          // sub_id represents the substitute covering for them
        }))
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.warn('Error fetching sub_assignments:', errorMessage)
    }
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
        
        // Track absences from sub_assignments and time_off_shifts
        // Initialize outside the if block so it's always defined
        const absences: Array<{
          teacher_id: string
          teacher_name: string
          has_sub: boolean
          is_partial: boolean
          time_off_request_id?: string
        }> = []
        
        // Only process if schedule_cell exists and is active with class groups
        // Handle both class_groups (from transformed data) and schedule_cell_class_groups (from raw query)
        const classGroups = scheduleCell?.class_groups || []
        
        if (scheduleCell && classGroups && classGroups.length > 0 && scheduleCell.is_active) {
          const classGroupIds = classGroups.map((cg) => cg.id)
          
          // Get teachers assigned to this slot
          // Teachers are now assigned to classrooms, not specific class groups.
          // All teachers assigned to this classroom/day/time are included.
          const teachers = assignmentsForSlot
            .map(assignment => ({
              id: assignment.id,
              teacher_id: assignment.teacher_id,
              teacher_name: assignment.teacher?.display_name || 
                            `${assignment.teacher?.first_name || ''} ${assignment.teacher?.last_name || ''}`.trim() ||
                            'Unknown',
              class_id: assignment.class_id || undefined, // Include class_id for filtering
              class_name: assignment.class?.name || undefined, // Include class_name for display
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
          
          // Track unique absent teachers from sub_assignments (covered absences)
          const absentTeachers = new Map<string, { teacher_id: string; teacher_name: string; has_sub: boolean; is_partial: boolean; time_off_request_id?: string }>()
          
          // Add substitute assignments for this day/time/classroom (if weekStartISO is provided)
          if (weekStartISO && day.id) {
            const subsForSlot = subAssignments.filter(
              (sa) => sa.day_of_week_id === day.id &&
                     sa.time_slot_id === timeSlot.id &&
                     sa.classroom_id === classroom.id
            )
            
            for (const sub of subsForSlot) {
              // sub.teacher_id is the absent teacher, sub.sub_id is the substitute
              if (sub.teacher_id && !absentTeachers.has(sub.teacher_id)) {
                absentTeachers.set(sub.teacher_id, {
                  teacher_id: sub.teacher_id,
                  teacher_name: sub.teacher_name,
                  has_sub: true, // If there's a sub_assignment, there's a sub
                  is_partial: false, // TODO: Determine if partial based on is_partial field
                  time_off_request_id: undefined, // sub_assignments doesn't have time_off_request_id, will be set from time_off_shifts if needed
                })
              }
              
              // Find matching class group if class_id is set
              const matchingClassGroup = sub.class_id && classGroupIds.includes(sub.class_id)
                ? classGroups.find(cg => cg.id === sub.class_id)
                : null
              
              assignments.push({
                id: sub.id,
                teacher_id: sub.sub_id, // Use sub_id as teacher_id for substitutes
                teacher_name: sub.sub_name,
                class_id: sub.class_id || (matchingClassGroup ? matchingClassGroup.id : classGroupIds[0]),
                class_name: sub.class_name || (matchingClassGroup ? matchingClassGroup.name : 'Unknown'),
                classroom_id: sub.classroom_id,
                classroom_name: classroom.name,
                is_floater: false, // Substitutes are not floaters
                is_substitute: true, // Mark as substitute (week-specific)
                absent_teacher_id: sub.teacher_id, // Track which teacher this substitute is replacing
                enrollment: enrollment ?? 0,
                required_teachers: rule?.required_teachers,
                preferred_teachers: rule?.preferred_teachers,
                assigned_count: teachers.length + subsForSlot.length,
              })
            }
          }
          
          // Check for uncovered absences from time_off_shifts (if weekStartISO is provided)
          // Only add absences for teachers who are actually assigned to this classroom
          if (weekStartISO && day.id) {
            const timeOffForSlot = timeOffShifts.filter(
              (tos) => tos.day_of_week_id === day.id &&
                      tos.time_slot_id === timeSlot.id
            )
            
            // First, identify which teachers are assigned to this classroom at this time
            const teachersAssignedToThisClassroom = new Set<string>()
            
            // Check permanent assignments
            for (const assignment of assignmentsForSlot) {
              if (assignment.classroom_id === classroom.id && assignment.teacher_id) {
                teachersAssignedToThisClassroom.add(assignment.teacher_id)
              }
            }
            
            // Check sub_assignments - the absent teacher is assigned here
            const subsForSlot = subAssignments.filter(
              (sa) => sa.day_of_week_id === day.id &&
                     sa.time_slot_id === timeSlot.id &&
                     sa.classroom_id === classroom.id
            )
            for (const sub of subsForSlot) {
              if (sub.teacher_id) {
                teachersAssignedToThisClassroom.add(sub.teacher_id) // The absent teacher
              }
            }
            
            // Filter to only time_off_shifts for teachers assigned to this classroom
            const relevantTimeOffShifts = timeOffForSlot.filter(
              tos => teachersAssignedToThisClassroom.has(tos.teacher_id)
            )
            
            // Get teacher names for relevant time off shifts (batch fetch)
            if (relevantTimeOffShifts.length > 0) {
              const teacherIds = Array.from(new Set(relevantTimeOffShifts.map(tos => tos.teacher_id)))
              const { data: teachersData } = await supabase
                .from('staff')
                .select('id, first_name, last_name, display_name')
                .in('id', teacherIds)
              
              const teachersMap = new Map(
                (teachersData || []).map((t: any) => [
                  t.id,
                  t.display_name || `${t.first_name || ''} ${t.last_name || ''}`.trim() || 'Unknown'
                ])
              )
              
              for (const timeOff of relevantTimeOffShifts) {
                // Check if this absence is already covered by a sub_assignment
                const hasSub = subAssignments.some(
                  (sa) => sa.teacher_id === timeOff.teacher_id &&
                         sa.day_of_week_id === day.id &&
                         sa.time_slot_id === timeSlot.id &&
                         sa.classroom_id === classroom.id
                )
                
                // Only add if not already tracked (from sub_assignments)
                if (!absentTeachers.has(timeOff.teacher_id)) {
                  absentTeachers.set(timeOff.teacher_id, {
                    teacher_id: timeOff.teacher_id,
                    teacher_name: teachersMap.get(timeOff.teacher_id) || 'Unknown',
                    has_sub: hasSub,
                    is_partial: false, // TODO: Determine if partial based on coverage
                    time_off_request_id: timeOff.time_off_request_id, // Include time_off_request_id
                  })
                } else {
                  // Update existing absence with time_off_request_id if not already set
                  const existing = absentTeachers.get(timeOff.teacher_id)
                  if (existing && !existing.time_off_request_id) {
                    existing.time_off_request_id = timeOff.time_off_request_id
                  }
                }
              }
            }
          }
          
          // Convert absent teachers map to array
          for (const [_, absence] of absentTeachers) {
            absences.push(absence)
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
            ...(absences.length > 0 ? { absences } : {}),
            schedule_cell: scheduleCell ? {
              id: scheduleCell.id,
              is_active: scheduleCell.is_active,
              enrollment_for_staffing: scheduleCell.enrollment_for_staffing,
              notes: scheduleCell.notes,
              class_groups: classGroups || [],
            } : null,
          } as WeeklyScheduleDataByClassroom['days'][0]['time_slots'][0])
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
