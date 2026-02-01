import { parseLocalDate } from './date'
import { MONTH_NAMES } from './date-format'

/**
 * Shared utility for transforming time off request data into a consistent format
 * for use across Dashboard, Sub Finder, and Time Off pages.
 */

export type TimeOffCardData = {
  id: string
  teacher_id: string
  teacher_name: string
  start_date: string
  end_date: string | null
  reason: string | null
  notes: string | null
  classrooms: Array<{ id: string; name: string; color: string | null }>
  // Coverage counts - consistent naming
  covered: number
  partial: number
  uncovered: number
  total: number
  // Status
  status: 'covered' | 'partially_covered' | 'needs_coverage'
  // Shift details - can be simple or detailed
  shift_details?: Array<{
    label: string
    status: 'covered' | 'partial' | 'uncovered'
    // Optional detailed fields for Sub Finder
    id?: string
    date?: string
    day_name?: string
    time_slot_code?: string
    class_name?: string | null
    classroom_name?: string | null
    classroom_color?: string | null
    sub_name?: string | null
    is_partial?: boolean
  }>
}

export interface TimeOffRequestInput {
  id: string
  teacher_id: string
  start_date: string
  end_date: string | null
  reason: string | null
  notes: string | null
  teacher?: {
    first_name?: string | null
    last_name?: string | null
    display_name?: string | null
  } | null
}

export interface ShiftInput {
  id: string
  date: string
  day_of_week_id: string | null
  time_slot_id: string
  day_of_week?: { name: string | null } | null
  time_slot?: { code: string | null } | null
}

export interface AssignmentInput {
  date: string
  time_slot_id: string
  is_partial?: boolean | null
  assignment_type?: string | null
  sub?: {
    first_name?: string | null
    last_name?: string | null
    display_name?: string | null
  } | null
}

export interface ClassroomInput {
  id: string
  name: string
  color: string | null
}

export interface TransformOptions {
  /**
   * Include detailed shift information (for Sub Finder)
   * If false, only includes label and status
   */
  includeDetailedShifts?: boolean
  /**
   * Format day name (e.g., "Tuesday" -> "Tues")
   */
  formatDay?: (name: string | null | undefined) => string
  /**
   * Get classroom for a shift (for detailed shifts)
   */
  getClassroomForShift?: (
    teacherId: string,
    dayOfWeekId: string | null,
    timeSlotId: string
  ) => ClassroomInput | null
  /**
   * Get class name for a shift (for detailed shifts)
   */
  getClassNameForShift?: (
    teacherId: string,
    dayOfWeekId: string | null,
    timeSlotId: string
  ) => string | null
}

/**
 * Transforms time off request data into a consistent format
 */
export function transformTimeOffCardData(
  request: TimeOffRequestInput,
  shifts: ShiftInput[],
  assignments: AssignmentInput[],
  classrooms: ClassroomInput[],
  options: TransformOptions = {}
): TimeOffCardData {
  const {
    includeDetailedShifts = false,
    formatDay = name => {
      if (!name) return '—'
      if (name === 'Tuesday') return 'Tues'
      return name.slice(0, 3)
    },
    getClassroomForShift,
    getClassNameForShift,
  } = options

  // Build assignment map: key = `${date}|${time_slot_id}` -> { hasFull, hasPartial, sub }
  const assignmentMap = new Map<
    string,
    { hasFull: boolean; hasPartial: boolean; subName: string | null }
  >()

  assignments.forEach(assignment => {
    const key = `${assignment.date}|${assignment.time_slot_id}`
    const existing = assignmentMap.get(key) || {
      hasFull: false,
      hasPartial: false,
      subName: null,
    }

    const isPartial = assignment.is_partial || assignment.assignment_type === 'Partial Sub Shift'

    if (isPartial) {
      existing.hasPartial = true
    } else {
      existing.hasFull = true
    }

    // Get sub name if available
    if (assignment.sub) {
      existing.subName =
        assignment.sub.display_name ||
        (assignment.sub.first_name && assignment.sub.last_name
          ? `${assignment.sub.first_name} ${assignment.sub.last_name}`
          : null)
    }

    assignmentMap.set(key, existing)
  })

  // Count coverage
  let covered = 0
  let partial = 0
  let uncovered = 0

  // Build shift details
  const shiftDetails: TimeOffCardData['shift_details'] = []

  shifts.forEach(shift => {
    const key = `${shift.date}|${shift.time_slot_id}`
    const assignment = assignmentMap.get(key)

    let status: 'covered' | 'partial' | 'uncovered' = 'uncovered'
    if (assignment?.hasFull) {
      status = 'covered'
      covered += 1
    } else if (assignment?.hasPartial) {
      status = 'partial'
      partial += 1
    } else {
      uncovered += 1
    }

    // Build label in format "Mon AM • Jan 2" (matching formatShiftLabel from ShiftChips)
    const dayName = formatDay(shift.day_of_week?.name)
    const timeCode = shift.time_slot?.code || '—'
    const date = parseLocalDate(shift.date)
    const month = MONTH_NAMES[date.getMonth()]
    const day = date.getDate()
    const label = `${dayName} ${timeCode} • ${month} ${day}`

    if (includeDetailedShifts) {
      // Include detailed information
      const classroom = getClassroomForShift
        ? getClassroomForShift(request.teacher_id, shift.day_of_week_id, shift.time_slot_id)
        : null
      const className = getClassNameForShift
        ? getClassNameForShift(request.teacher_id, shift.day_of_week_id, shift.time_slot_id)
        : null

      shiftDetails.push({
        id: shift.id,
        label,
        status,
        date: shift.date,
        day_name: shift.day_of_week?.name || undefined,
        time_slot_code: shift.time_slot?.code || undefined,
        class_name: className || undefined,
        classroom_name: classroom?.name || undefined,
        classroom_color: classroom?.color || undefined,
        sub_name: assignment?.subName || undefined,
        is_partial: assignment?.hasPartial && !assignment?.hasFull,
      })
    } else {
      // Simple format
      shiftDetails.push({
        label,
        status,
      })
    }
  })

  // Determine status
  const status: TimeOffCardData['status'] =
    uncovered === 0 && partial === 0
      ? 'covered'
      : covered === 0
        ? 'needs_coverage'
        : 'partially_covered'

  // Get teacher name
  const teacherName =
    request.teacher?.display_name ||
    (request.teacher?.first_name && request.teacher?.last_name
      ? `${request.teacher.first_name} ${request.teacher.last_name}`
      : request.teacher?.first_name || 'Unknown Teacher')

  return {
    id: request.id,
    teacher_id: request.teacher_id,
    teacher_name: teacherName,
    start_date: request.start_date,
    end_date: request.end_date,
    reason: request.reason,
    notes: request.notes,
    classrooms,
    covered,
    partial,
    uncovered,
    total: shifts.length,
    status,
    shift_details: shiftDetails.length > 0 ? shiftDetails : undefined,
  }
}
