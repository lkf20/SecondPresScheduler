import { createClient } from '@/lib/supabase/server'
import { getStaffDisplayName as formatDisplayName } from '@/lib/utils/staff-display-name'
import type { DisplayNameFormat } from '@/lib/utils/staff-display-name'
import { Database } from '@/types/database'

type ClassGroupRow = Database['public']['Tables']['class_groups']['Row']
type ScheduleCellRow = Database['public']['Tables']['schedule_cells']['Row']
type StaffRow = Database['public']['Tables']['staff']['Row']
type StaffLite = Pick<StaffRow, 'id' | 'first_name' | 'last_name' | 'display_name'>
type TimeOffRequestRow = Database['public']['Tables']['time_off_requests']['Row']
type TimeOffShiftRowFromQuery = {
  id: string
  date: string
  day_of_week_id: string | null
  time_slot_id: string
  time_off_request_id: string
  time_off_requests?:
    | Pick<TimeOffRequestRow, 'teacher_id' | 'status'>
    | Array<Pick<TimeOffRequestRow, 'teacher_id' | 'status'>>
    | null
}
type SubAssignmentRowFromQuery = {
  id: string
  date: string
  day_of_week_id: string | null
  time_slot_id: string
  classroom_id: string
  sub_id: string
  teacher_id: string
  sub?: StaffLite | StaffLite[] | null
  teacher?: StaffLite | StaffLite[] | null
}

const getStaffDisplayName = (
  staff: StaffLite | StaffLite[] | null | undefined,
  displayNameFormat: DisplayNameFormat
) => {
  const staffItem = Array.isArray(staff) ? staff[0] : staff
  if (!staffItem) return 'Unknown'
  return (
    formatDisplayName(
      {
        first_name: staffItem.first_name ?? '',
        last_name: staffItem.last_name ?? '',
        display_name: staffItem.display_name ?? null,
      },
      displayNameFormat
    ) || 'Unknown'
  )
}

const getStaffNameParts = (
  staff: StaffLite | StaffLite[] | null | undefined,
  displayNameFormat: DisplayNameFormat
) => {
  const staffItem = Array.isArray(staff) ? staff[0] : staff
  return {
    first_name: staffItem?.first_name ?? null,
    last_name: staffItem?.last_name ?? null,
    display_name: staffItem
      ? formatDisplayName(
          {
            first_name: staffItem.first_name ?? '',
            last_name: staffItem.last_name ?? '',
            display_name: staffItem.display_name ?? null,
          },
          displayNameFormat
        )
      : null,
  }
}

type ScheduleCellRaw = ScheduleCellRow & {
  schedule_cell_class_groups?: Array<{ class_group: ClassGroupRow | null }>
  class_groups?: ClassGroupRow[]
}

type WeeklySubAssignment = {
  id: string
  date: string
  day_of_week_id: string | null
  time_slot_id: string
  classroom_id: string
  sub_id: string
  teacher_id: string
  sub_name: string
  sub_first_name?: string | null
  sub_last_name?: string | null
  sub_display_name?: string | null
  teacher_name: string
  teacher_first_name?: string | null
  teacher_last_name?: string | null
  teacher_display_name?: string | null
  class_group_id: string | null
  class_name: string | null
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
    teacher_first_name?: string | null
    teacher_last_name?: string | null
    teacher_display_name?: string | null
    class_group_id?: string // Optional: teachers are assigned to classrooms, not specific class groups
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
        teacher_first_name?: string | null
        teacher_last_name?: string | null
        teacher_display_name?: string | null
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

export async function getScheduleSnapshotData({
  schoolId,
  selectedDayIds,
  startDateISO,
  endDateISO,
}: {
  schoolId: string
  selectedDayIds?: string[]
  startDateISO?: string
  endDateISO?: string
}) {
  const supabase = await createClient()
  const defaultDisplayNameFormat: DisplayNameFormat = 'first_last_initial'
  let displayNameFormat: DisplayNameFormat = defaultDisplayNameFormat

  try {
    const { data: settingsData, error: settingsError } = await supabase
      .from('schedule_settings')
      .select('default_display_name_format')
      .eq('school_id', schoolId)
      .maybeSingle()

    if (!settingsError && settingsData?.default_display_name_format) {
      displayNameFormat = settingsData.default_display_name_format as DisplayNameFormat
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.warn('Error fetching schedule settings:', errorMessage)
  }

  // Fetch time off shifts for the week to identify uncovered absences
  let timeOffShifts: Array<{
    id: string
    date: string
    day_of_week_id: string | null
    time_slot_id: string
    teacher_id: string
    time_off_request_id: string
  }> = []

  const hasDateRange = Boolean(startDateISO && endDateISO)

  if (hasDateRange && startDateISO && endDateISO) {
    try {
      const { data: timeOffShiftsData, error: timeOffShiftsError } = await supabase
        .from('time_off_shifts')
        .select(
          `
          id,
          date,
          day_of_week_id,
          time_slot_id,
          time_off_request_id,
          time_off_requests!inner(teacher_id, status)
        `
        )
        .gte('date', startDateISO)
        .lte('date', endDateISO)
        .eq('time_off_requests.status', 'active')

      if (timeOffShiftsError) {
        console.warn('Error fetching time_off_shifts:', timeOffShiftsError.message)
      } else if (timeOffShiftsData) {
        timeOffShifts = timeOffShiftsData.map((shift: TimeOffShiftRowFromQuery) => {
          const timeOffRequest = Array.isArray(shift.time_off_requests)
            ? (shift.time_off_requests[0] ?? null)
            : (shift.time_off_requests ?? null)
          return {
            id: shift.id,
            date: shift.date,
            day_of_week_id: shift.day_of_week_id,
            time_slot_id: shift.time_slot_id,
            teacher_id: timeOffRequest?.teacher_id || '',
            time_off_request_id: shift.time_off_request_id,
          }
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.warn('Error fetching time_off_shifts:', errorMessage)
    }
  }

  // Get all days of week (reference data - doesn't have school_id, shared across all schools)
  // Note: days_of_week and time_slots are reference data and don't have school_id columns
  let daysQuery = supabase.from('days_of_week').select('*')

  // Filter by selected days if provided
  if (selectedDayIds && selectedDayIds.length > 0) {
    daysQuery = daysQuery.in('id', selectedDayIds)
  }

  const { data: daysOfWeekData, error: daysError } = await daysQuery

  if (daysError) {
    throw new Error(`Failed to fetch days of week: ${daysError.message}`)
  }

  // Sort days by day_number
  const daysOfWeek =
    daysOfWeekData?.sort((a, b) => {
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
      hint: timeSlotsError.hint,
    })
    throw new Error(`Failed to fetch time slots: ${timeSlotsError.message}`)
  }

  // Get classrooms ordered by order field, then name
  const { data: classrooms, error: classroomsError } = await supabase
    .from('classrooms')
    .select('*')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })

  if (classroomsError) {
    console.error('Error fetching classrooms:', {
      error: classroomsError,
      schoolId,
      message: classroomsError.message,
      code: classroomsError.code,
      details: classroomsError.details,
      hint: classroomsError.hint,
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
    .select(
      `
      *,
      teacher:staff!teacher_schedules_teacher_id_fkey(id, first_name, last_name, display_name),
      day_of_week:days_of_week(*),
      time_slot:time_slots(*),
      classroom:classrooms(*)
    `
    )
    .eq('school_id', schoolId)

  if (schedulesError) {
    console.error('API Error: Failed to fetch teacher schedules:', schedulesError)
    throw new Error(`Failed to fetch teacher schedules: ${schedulesError.message}`)
  }

  // Get schedule cells (gracefully handle if table doesn't exist yet)
  let scheduleCells: ScheduleCellRaw[] | null = null
  try {
    const { data, error: scheduleCellsError } = await supabase
      .from('schedule_cells')
      .select(
        `
        *,
        schedule_cell_class_groups(
          class_group:class_groups(id, name, min_age, max_age, required_ratio, preferred_ratio)
        )
      `
      )
      .eq('school_id', schoolId)

    if (scheduleCellsError) {
      // If table doesn't exist (migration not run), continue without schedule cells
      if (
        scheduleCellsError.code === '42P01' ||
        scheduleCellsError.message?.includes('does not exist')
      ) {
        console.warn(
          'schedule_cells table does not exist yet. Please run migration 021_create_schedule_cells.sql'
        )
        scheduleCells = null
      } else {
        console.error('API Error: Failed to fetch schedule cells:', scheduleCellsError)
        scheduleCells = null
      }
    } else {
      // Transform the nested structure to flatten class_groups array
      scheduleCells = (data || []).map(cell => {
        const raw = cell as ScheduleCellRaw
        const classGroups = raw.schedule_cell_class_groups
          ? raw.schedule_cell_class_groups
              .map(j => j.class_group)
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

  // Fetch substitute assignments for the selected date range (if provided)
  type SubAssignmentKey = string
  let subAssignments: WeeklySubAssignment[] = []
  const getSubAssignmentKey = (sub: WeeklySubAssignment): SubAssignmentKey =>
    [
      sub.date,
      sub.day_of_week_id ?? 'null',
      sub.time_slot_id,
      sub.classroom_id,
      sub.teacher_id,
      sub.sub_id,
    ].join('|')

  if (hasDateRange && startDateISO && endDateISO) {
    try {
      // Fetch sub_assignments for the date range
      const { data: subAssignmentsData, error: subAssignmentsError } = await supabase
        .from('sub_assignments')
        .select(
          `
          id,
          date,
          day_of_week_id,
          time_slot_id,
          classroom_id,
          sub_id,
          teacher_id,
          sub:staff!sub_assignments_sub_id_fkey(id, first_name, last_name, display_name),
          teacher:staff!sub_assignments_teacher_id_fkey(id, first_name, last_name, display_name)
        `
        )
        .gte('date', startDateISO)
        .lte('date', endDateISO)

      if (subAssignmentsError) {
        console.warn('Error fetching sub_assignments:', subAssignmentsError.message)
      } else if (subAssignmentsData) {
        // Map sub_assignments - day_of_week_id is already in the database
        subAssignments = subAssignmentsData.map((sa: SubAssignmentRowFromQuery) => {
          const subParts = getStaffNameParts(sa.sub, displayNameFormat)
          const teacherParts = getStaffNameParts(sa.teacher, displayNameFormat)
          return {
            id: sa.id,
            date: sa.date,
            day_of_week_id: sa.day_of_week_id,
            time_slot_id: sa.time_slot_id,
            classroom_id: sa.classroom_id,
            sub_id: sa.sub_id,
            teacher_id: sa.teacher_id,
            sub_name: getStaffDisplayName(sa.sub, displayNameFormat),
            sub_first_name: subParts.first_name,
            sub_last_name: subParts.last_name,
            sub_display_name: subParts.display_name,
            teacher_name: getStaffDisplayName(sa.teacher, displayNameFormat),
            teacher_first_name: teacherParts.first_name,
            teacher_last_name: teacherParts.last_name,
            teacher_display_name: teacherParts.display_name,
            class_group_id: null, // sub_assignments doesn't have class_group_id
            class_name: null,
            // Note: teacher_id in sub_assignments represents the absent teacher
            // sub_id represents the substitute covering for them
          }
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.warn('Error fetching sub_assignments:', errorMessage)
    }
  }

  // Build the schedule data structure grouped by classroom
  const weeklyDataByClassroom: WeeklyScheduleDataByClassroom[] = []

  // Process each classroom
  for (const classroom of classrooms) {
    const classroomDays: WeeklyScheduleDataByClassroom['days'] = []

    // Process each day - only include selected days if selectedDayIds is provided
    const daysToProcess =
      selectedDayIds && selectedDayIds.length > 0
        ? daysOfWeek.filter(d => selectedDayIds.includes(d.id))
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
        const scheduleCell =
          scheduleCells && scheduleCells.length > 0
            ? scheduleCells.find(
                c =>
                  c.classroom_id === classroom.id &&
                  c.day_of_week_id === day.id &&
                  c.time_slot_id === timeSlot.id
              )
            : null

        // Get assignments for this day/time/classroom
        const assignmentsForSlot =
          schedules?.filter(
            s =>
              s.day_of_week_id === day.id &&
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
          teacher_first_name?: string | null
          teacher_last_name?: string | null
          teacher_display_name?: string | null
          has_sub: boolean
          is_partial: boolean
          time_off_request_id?: string
        }> = []

        // Only process if schedule_cell exists and is active with class groups
        // Handle both class_groups (from transformed data) and schedule_cell_class_groups (from raw query)
        const classGroups = scheduleCell?.class_groups || []

        if (scheduleCell && classGroups && classGroups.length > 0 && scheduleCell.is_active) {
          const classGroupIds = classGroups.map(cg => cg.id)

          // Get teachers assigned to this slot
          // Teachers are now assigned to classrooms, not specific class groups.
          // All teachers assigned to this classroom/day/time are included.
          const teachers = assignmentsForSlot.map(assignment => {
            const teacherInfo = assignment.teacher
              ? {
                  first_name: assignment.teacher.first_name ?? '',
                  last_name: assignment.teacher.last_name ?? '',
                  display_name: assignment.teacher.display_name ?? null,
                }
              : null

            return {
              id: assignment.id,
              teacher_id: assignment.teacher_id,
              teacher_name: teacherInfo
                ? formatDisplayName(teacherInfo, displayNameFormat) || 'Unknown'
                : 'Unknown',
              teacher_first_name: assignment.teacher?.first_name ?? null,
              teacher_last_name: assignment.teacher?.last_name ?? null,
              teacher_display_name: teacherInfo
                ? formatDisplayName(teacherInfo, displayNameFormat)
                : null,
              classroom_id: assignment.classroom_id,
              classroom_name: assignment.classroom?.name || 'Unknown',
              is_floater: assignment.is_floater || false,
            }
          })

          // Get enrollment from schedule_cell (enrollment is for the whole slot, not per class group)
          const enrollment = scheduleCell.enrollment_for_staffing ?? null

          // Add teacher assignments for this slot
          for (const teacher of teachers) {
            assignments.push({
              ...teacher,
              enrollment: enrollment ?? 0,
              required_teachers: undefined,
              preferred_teachers: undefined,
              assigned_count: teachers.length,
            })
          }

          const subsForSlot =
            hasDateRange && day.id
              ? subAssignments.filter(
                  sa =>
                    sa.day_of_week_id === day.id &&
                    sa.time_slot_id === timeSlot.id &&
                    sa.classroom_id === classroom.id
                )
              : []
          const uniqueSubsForSlot =
            subsForSlot.length > 0
              ? Array.from(
                  new Map(subsForSlot.map(sub => [getSubAssignmentKey(sub), sub])).values()
                )
              : []

          // Track unique absent teachers from sub_assignments (covered absences)
          const absentTeachers = new Map<
            string,
            {
              teacher_id: string
              teacher_name: string
              teacher_first_name?: string | null
              teacher_last_name?: string | null
              teacher_display_name?: string | null
              has_sub: boolean
              is_partial: boolean
              time_off_request_id?: string
            }
          >()

          // Add substitute assignments for this day/time/classroom (if date range is provided)
          if (hasDateRange && day.id) {
            for (const sub of uniqueSubsForSlot) {
              if (sub.teacher_id && !absentTeachers.has(sub.teacher_id)) {
                absentTeachers.set(sub.teacher_id, {
                  teacher_id: sub.teacher_id,
                  teacher_name: sub.teacher_name,
                  teacher_first_name: sub.teacher_first_name ?? null,
                  teacher_last_name: sub.teacher_last_name ?? null,
                  teacher_display_name: sub.teacher_display_name ?? null,
                  has_sub: true,
                  is_partial: false,
                  time_off_request_id: undefined,
                })
              }

              const subClassGroupId = sub.class_group_id ?? null
              const matchingClassGroup =
                subClassGroupId && classGroupIds.includes(subClassGroupId)
                  ? classGroups.find(cg => cg.id === subClassGroupId)
                  : null

              assignments.push({
                id: sub.id,
                teacher_id: sub.sub_id,
                teacher_name: sub.sub_name,
                teacher_first_name: sub.sub_first_name ?? null,
                teacher_last_name: sub.sub_last_name ?? null,
                teacher_display_name: sub.sub_display_name ?? null,
                class_group_id:
                  subClassGroupId ||
                  (matchingClassGroup ? matchingClassGroup.id : classGroupIds[0]),
                class_name:
                  sub.class_name || (matchingClassGroup ? matchingClassGroup.name : 'Unknown'),
                classroom_id: sub.classroom_id,
                classroom_name: classroom.name,
                is_floater: false,
                is_substitute: true,
                absent_teacher_id: sub.teacher_id,
                enrollment: enrollment ?? 0,
                required_teachers: undefined,
                preferred_teachers: undefined,
                assigned_count: teachers.length + uniqueSubsForSlot.length,
              })
            }
          }

          // Check for uncovered absences from time_off_shifts (if date range is provided)
          // Only add absences for teachers who are actually assigned to this classroom
          if (hasDateRange && day.id) {
            const timeOffForSlot = timeOffShifts.filter(
              tos => tos.day_of_week_id === day.id && tos.time_slot_id === timeSlot.id
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
            for (const sub of uniqueSubsForSlot) {
              if (sub.teacher_id) {
                teachersAssignedToThisClassroom.add(sub.teacher_id)
              }
            }

            // Filter to only time_off_shifts for teachers assigned to this classroom
            const relevantTimeOffShifts = timeOffForSlot.filter(tos =>
              teachersAssignedToThisClassroom.has(tos.teacher_id)
            )

            // Get teacher names for relevant time off shifts (batch fetch)
            if (relevantTimeOffShifts.length > 0) {
              const teacherIds = Array.from(
                new Set(relevantTimeOffShifts.map(tos => tos.teacher_id))
              )
              const { data: teachersData } = await supabase
                .from('staff')
                .select('id, first_name, last_name, display_name')
                .in('id', teacherIds)

              const teachersMap = new Map(
                (teachersData || []).map((t: StaffLite) => [
                  t.id,
                  {
                    name:
                      formatDisplayName(
                        {
                          first_name: t.first_name ?? '',
                          last_name: t.last_name ?? '',
                          display_name: t.display_name ?? null,
                        },
                        displayNameFormat
                      ) || 'Unknown',
                    first_name: t.first_name ?? null,
                    last_name: t.last_name ?? null,
                    display_name:
                      formatDisplayName(
                        {
                          first_name: t.first_name ?? '',
                          last_name: t.last_name ?? '',
                          display_name: t.display_name ?? null,
                        },
                        displayNameFormat
                      ) || null,
                  },
                ])
              )

              for (const timeOff of relevantTimeOffShifts) {
                // Check if this absence is already covered by a sub_assignment
                const hasSub = subAssignments.some(
                  sa =>
                    sa.teacher_id === timeOff.teacher_id &&
                    sa.day_of_week_id === day.id &&
                    sa.time_slot_id === timeSlot.id &&
                    sa.classroom_id === classroom.id
                )

                // Only add if not already tracked (from sub_assignments)
                if (!absentTeachers.has(timeOff.teacher_id)) {
                  const teacherInfo = teachersMap.get(timeOff.teacher_id)
                  absentTeachers.set(timeOff.teacher_id, {
                    teacher_id: timeOff.teacher_id,
                    teacher_name: teacherInfo?.name || 'Unknown',
                    teacher_first_name: teacherInfo?.first_name ?? null,
                    teacher_last_name: teacherInfo?.last_name ?? null,
                    teacher_display_name: teacherInfo?.display_name ?? null,
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
          for (const absence of absentTeachers.values()) {
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
          schedule_cell: scheduleCell
            ? {
                id: scheduleCell.id,
                is_active: scheduleCell.is_active,
                enrollment_for_staffing: scheduleCell.enrollment_for_staffing,
                notes: scheduleCell.notes,
                class_groups: classGroups || [],
              }
            : null,
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

export async function getWeeklyScheduleData(
  schoolId: string,
  selectedDayIds?: string[],
  weekStartISO?: string
) {
  if (!weekStartISO) {
    return getScheduleSnapshotData({ schoolId, selectedDayIds })
  }

  const weekStart = new Date(weekStartISO + 'T00:00:00')
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const weekEndISO = weekEnd.toISOString().split('T')[0]

  return getScheduleSnapshotData({
    schoolId,
    selectedDayIds,
    startDateISO: weekStartISO,
    endDateISO: weekEndISO,
  })
}
