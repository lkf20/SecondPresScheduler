import { parseLocalDate, toDateStringISO } from './date'
import { MONTH_NAMES } from './date-format'
import { getStaffDisplayName, type DisplayNameFormat } from './staff-display-name'

/**
 * Shared utility for transforming time off request data into a consistent format
 * for use across Dashboard, Sub Finder, and Time Off pages.
 *
 * Source of truth for coverage counts: covered (fully covered shifts), partial
 * (partially covered), uncovered. Time Off list and Sub Finder absences use
 * this transform. Dashboard overview computes equivalent counts server-side.
 * TimeOffCard displays up to three badges (Uncovered, Covered, Partial), each
 * only when its count > 0.
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
  // Coverage status (for display/filtering)
  status: 'covered' | 'partially_covered' | 'needs_coverage'
  // Request lifecycle status (draft | active | cancelled)
  request_status: 'draft' | 'active' | 'cancelled'
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
    assigned_sub_names?: string[]
    sub_id?: string | null
    assignment_id?: string | null
    is_partial?: boolean
    /** For display order: date → day → time_slot (AGENTS.md) */
    day_display_order?: number | null
    time_slot_display_order?: number | null
  }>
}

export interface TimeOffRequestInput {
  id: string
  teacher_id: string
  start_date: string
  end_date: string | null
  reason: string | null
  notes: string | null
  request_status?: 'draft' | 'active' | 'cancelled'
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
  day_of_week?: { name: string | null; display_order?: number | null } | null
  time_slot?: { code: string | null; display_order?: number | null } | null
}

export interface AssignmentInput {
  id?: string
  date: string
  time_slot_id: string
  is_partial?: boolean | null
  assignment_type?: string | null
  sub?: {
    id?: string | null
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
   * All classrooms when the teacher is scheduled in multiple rooms for the same slot (floater).
   * When provided, shift labels include a "(N rooms: …)" suffix for multi-room slots.
   */
  getClassroomsForShift?: (
    teacherId: string,
    dayOfWeekId: string | null,
    timeSlotId: string
  ) => ClassroomInput[]
  /**
   * Get class name for a shift (for detailed shifts)
   */
  getClassNameForShift?: (
    teacherId: string,
    dayOfWeekId: string | null,
    timeSlotId: string
  ) => string | null
  /**
   * Display name format for staff names
   */
  displayNameFormat?: DisplayNameFormat
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
    getClassroomsForShift,
    getClassNameForShift,
    displayNameFormat,
  } = options

  // Build assignment map: key = `${date}|${time_slot_id}` -> { hasFull, hasPartial, sub }
  // Use toDateStringISO so keys match regardless of DB date format (YYYY-MM-DD vs timestamp)
  const assignmentMap = new Map<
    string,
    {
      hasFull: boolean
      hasPartial: boolean
      partialCount: number
      subName: string | null
      subNames: Set<string>
      subId: string | null
      assignmentId: string | null
    }
  >()

  assignments.forEach(assignment => {
    const key = `${toDateStringISO(assignment.date)}|${assignment.time_slot_id}`
    const existing = assignmentMap.get(key) || {
      hasFull: false,
      hasPartial: false,
      partialCount: 0,
      subName: null,
      subNames: new Set<string>(),
      subId: null,
      assignmentId: null,
    }

    const isPartial = assignment.is_partial || assignment.assignment_type === 'Partial Sub Shift'

    if (isPartial) {
      existing.hasPartial = true
      existing.partialCount += 1
    } else {
      existing.hasFull = true
    }

    // Get sub name if available
    if (assignment.sub) {
      const displayName =
        getStaffDisplayName(
          {
            first_name: assignment.sub.first_name ?? '',
            last_name: assignment.sub.last_name ?? '',
            display_name: assignment.sub.display_name ?? null,
          },
          displayNameFormat
        ) || null
      existing.subName = displayName
      if (displayName) {
        existing.subNames.add(displayName)
      }
      existing.subId = assignment.sub.id ?? null
    }
    existing.assignmentId = assignment.id ?? null

    assignmentMap.set(key, existing)
  })

  // Count coverage
  let covered = 0
  let partial = 0
  let uncovered = 0

  // Build shift details
  const shiftDetails: TimeOffCardData['shift_details'] = []

  shifts.forEach(shift => {
    const key = `${toDateStringISO(shift.date)}|${shift.time_slot_id}`
    const assignment = assignmentMap.get(key)

    let status: 'covered' | 'partial' | 'uncovered' = 'uncovered'
    if (assignment?.hasFull) {
      status = 'covered'
      covered += 1
    } else if (assignment?.hasPartial) {
      status = 'partial'
      // Phase 1 approximation: each partial contributes 0.5 toward coverage.
      // A shift with two or more partial assignments counts as covered in summary cards.
      if ((assignment.partialCount || 0) * 0.5 >= 1) {
        covered += 1
      } else {
        partial += 1
      }
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
      const classroomsList =
        getClassroomsForShift?.(request.teacher_id, shift.day_of_week_id, shift.time_slot_id) ??
        (() => {
          const one = getClassroomForShift
            ? getClassroomForShift(request.teacher_id, shift.day_of_week_id, shift.time_slot_id)
            : null
          return one ? [one] : []
        })()
      const classroom = classroomsList[0] ?? null
      const multiRoomSuffix =
        classroomsList.length > 1
          ? ` (${classroomsList.length} rooms: ${classroomsList.map(c => c.name).join(', ')})`
          : ''
      const labelWithRooms = `${dayName} ${timeCode}${multiRoomSuffix} • ${month} ${day}`
      const className = getClassNameForShift
        ? getClassNameForShift(request.teacher_id, shift.day_of_week_id, shift.time_slot_id)
        : null

      shiftDetails.push({
        id: shift.id,
        label: labelWithRooms,
        status,
        date: shift.date,
        day_name: shift.day_of_week?.name || undefined,
        time_slot_code: shift.time_slot?.code || undefined,
        class_name: className || undefined,
        classroom_name: classroom?.name || undefined,
        classroom_color: classroom?.color || undefined,
        sub_name: assignment?.subName || undefined,
        assigned_sub_names:
          assignment?.subNames && assignment.subNames.size > 0
            ? Array.from(assignment.subNames).sort((a, b) =>
                a.localeCompare(b, undefined, { sensitivity: 'base' })
              )
            : undefined,
        sub_id: assignment?.subId || undefined,
        assignment_id: assignment?.assignmentId || undefined,
        is_partial: assignment?.hasPartial && !assignment?.hasFull,
        day_display_order: shift.day_of_week?.display_order ?? undefined,
        time_slot_display_order: shift.time_slot?.display_order ?? undefined,
      })
    } else {
      // Simple format
      shiftDetails.push({
        label,
        status,
      })
    }
  })

  // Invariant: counts must sum to total shifts (catch logic bugs in dev/test)
  if (
    typeof process !== 'undefined' &&
    process.env?.NODE_ENV !== 'production' &&
    covered + partial + uncovered !== shifts.length
  ) {
    throw new Error(
      `TimeOffCardData invariant: covered(${covered}) + partial(${partial}) + uncovered(${uncovered}) !== shifts.length(${shifts.length})`
    )
  }

  // Determine status. Zero-shift requests (e.g. draft with no shifts) must not be
  // classified as 'covered' so they appear in "needs coverage" filters and don't
  // inflate covered counts.
  const status: TimeOffCardData['status'] =
    shifts.length === 0
      ? 'needs_coverage'
      : uncovered === 0 && partial === 0
        ? 'covered'
        : covered === 0
          ? 'needs_coverage'
          : 'partially_covered'

  // Get teacher name
  const teacherName =
    getStaffDisplayName(
      {
        first_name: request.teacher?.first_name ?? '',
        last_name: request.teacher?.last_name ?? '',
        display_name: request.teacher?.display_name ?? null,
      },
      displayNameFormat
    ) ||
    request.teacher?.first_name ||
    request.teacher?.last_name ||
    'Unknown Teacher'

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
    request_status: request.request_status ?? 'active',
    shift_details: shiftDetails.length > 0 ? shiftDetails : undefined,
  }
}
