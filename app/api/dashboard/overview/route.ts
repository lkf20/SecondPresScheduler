import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createErrorResponse } from '@/lib/utils/errors'

const toDateString = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const normalizeDate = (value: string) => value.slice(0, 10)

const getOverlap = (startDate: string, endDate: string, rangeStart: string, rangeEnd: string) => {
  const start = normalizeDate(startDate)
  const end = normalizeDate(endDate || startDate)
  return start <= rangeEnd && end >= rangeStart
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const today = new Date()
    const startDate = searchParams.get('start_date') || toDateString(today)
    const endDate = searchParams.get('end_date') || toDateString(addDays(today, 14))

    const supabase = await createClient()

    const { data: daysOfWeek } = await supabase
      .from('days_of_week')
      .select('id, name, day_number')

    const dayIdByNumber = new Map<number, { id: string; name: string }>()
    ;(daysOfWeek || []).forEach((day) => {
      if (typeof day.day_number === 'number') {
        dayIdByNumber.set(day.day_number, { id: day.id, name: day.name })
      }
    })

    const { data: timeOffRequests, error: requestsError } = await supabase
      .from('time_off_requests')
      .select(
        'id, teacher_id, start_date, end_date, reason, notes, status, teacher:staff(id, first_name, last_name, display_name)'
      )
      .eq('status', 'active')
      .lte('start_date', endDate)

    if (requestsError) {
      return createErrorResponse(requestsError, 'Failed to fetch time off requests', 500)
    }

    const requestsInRange = (timeOffRequests || []).filter((request) =>
      getOverlap(request.start_date, request.end_date || request.start_date, startDate, endDate)
    )

    const requestIds = requestsInRange.map((request) => request.id)
    const teacherIds = Array.from(
      new Set(requestsInRange.map((request) => request.teacher_id))
    )
    const requestTeacherMap = new Map(
      requestsInRange.map((request) => [request.id, request.teacher_id])
    )

    let timeOffShifts: any[] = []
    if (requestIds.length > 0) {
      const { data: shiftsData, error: shiftsError } = await supabase
        .from('time_off_shifts')
        .select(
          'id, time_off_request_id, date, day_of_week_id, time_slot_id, is_partial, time_slot:time_slots(code, display_order), day_of_week:days_of_week(name)'
        )
        .in('time_off_request_id', requestIds)
        .gte('date', startDate)
        .lte('date', endDate)

      if (shiftsError) {
        return createErrorResponse(shiftsError, 'Failed to fetch time off shifts', 500)
      }
      timeOffShifts = shiftsData || []
    }

    let teacherSchedules: any[] = []
    if (teacherIds.length > 0) {
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('teacher_schedules')
        .select(
          'teacher_id, day_of_week_id, time_slot_id, classroom_id, class_id, is_floater, classroom:classrooms(name, color)'
        )
        .in('teacher_id', teacherIds)

      if (schedulesError) {
        return createErrorResponse(schedulesError, 'Failed to fetch teacher schedules', 500)
      }
      teacherSchedules = schedulesData || []
    }

    const classroomMap = new Map<string, string>()
    const classroomIdMap = new Map<string, string>()
    const classroomDetailsById = new Map<
      string,
      { id: string; name: string; color: string | null }
    >()
    ;(teacherSchedules || []).forEach((schedule) => {
      const key = `${schedule.teacher_id}|${schedule.day_of_week_id}|${schedule.time_slot_id}`
      if (!classroomMap.has(key)) {
        classroomMap.set(key, schedule.classroom?.name || 'Classroom unavailable')
      }
      if (!classroomIdMap.has(key) && schedule.classroom_id) {
        classroomIdMap.set(key, schedule.classroom_id)
      }
      if (schedule.classroom_id && schedule.classroom?.name) {
        classroomDetailsById.set(schedule.classroom_id, {
          id: schedule.classroom_id,
          name: schedule.classroom.name,
          color: schedule.classroom.color ?? null,
        })
      }
    })

    const { data: subAssignments, error: assignmentsError } = await supabase
      .from('sub_assignments')
      .select(
        'id, sub_id, teacher_id, date, time_slot_id, day_of_week_id, is_partial, classroom_id, notes, sub:staff!sub_assignments_sub_id_fkey(first_name, last_name, display_name), teacher:staff!sub_assignments_teacher_id_fkey(first_name, last_name, display_name), time_slot:time_slots(code, display_order), classroom:classrooms(name, color)'
      )
      .gte('date', startDate)
      .lte('date', endDate)

    if (assignmentsError) {
      return createErrorResponse(assignmentsError, 'Failed to fetch sub assignments', 500)
    }

    let scheduleCells: Array<{
      id: string
      classroom_id: string
      day_of_week_id: string
      time_slot_id: string
      is_active: boolean
      enrollment_for_staffing: number | null
      classroom?: { name: string | null }
      time_slot?: { code: string | null; display_order: number | null }
      class_groups?: Array<{
        id: string
        name: string
        min_age: number | null
        required_ratio: number
        preferred_ratio: number | null
        is_active?: boolean | null
      }>
    }> = []

    try {
      const { data: rawScheduleCells, error: scheduleCellsError } = await supabase
        .from('schedule_cells')
        .select(
          `
          id,
          classroom_id,
          day_of_week_id,
          time_slot_id,
          is_active,
          enrollment_for_staffing,
          classroom:classrooms(name, color),
          time_slot:time_slots(code, display_order),
          schedule_cell_class_groups(
            class_group:class_groups(id, name, min_age, required_ratio, preferred_ratio, is_active)
          )
        `
        )

      if (scheduleCellsError) {
        if (
          scheduleCellsError.code !== '42P01' &&
          !scheduleCellsError.message?.includes('does not exist')
        ) {
          return createErrorResponse(scheduleCellsError, 'Failed to fetch schedule cells', 500)
        }
      } else {
        scheduleCells = (rawScheduleCells || []).map((cell: any) => {
          const classGroups = cell.schedule_cell_class_groups
            ? cell.schedule_cell_class_groups
                .map((j: any) => j.class_group)
                .filter((cg: any) => cg)
            : []
          return {
            ...cell,
            class_groups: classGroups,
          }
        })
      }
    } catch (error) {
      return createErrorResponse(error, 'Failed to fetch schedule cells', 500)
    }

    const staffingScheduleMap = new Map<
      string,
      Array<{ class_id: string | null; is_floater: boolean | null }>
    >()

    if (scheduleCells.length > 0) {
      const staffingClassroomIds = Array.from(
        new Set(scheduleCells.map((cell) => cell.classroom_id))
      )

      const { data: staffingSchedules, error: staffingSchedulesError } = await supabase
        .from('teacher_schedules')
        .select('classroom_id, day_of_week_id, time_slot_id, class_id, is_floater')
        .in('classroom_id', staffingClassroomIds)

      if (staffingSchedulesError) {
        return createErrorResponse(staffingSchedulesError, 'Failed to fetch staffing schedules', 500)
      }

      ;(staffingSchedules || []).forEach((schedule) => {
        const key = `${schedule.classroom_id}|${schedule.day_of_week_id}|${schedule.time_slot_id}`
        const entry = staffingScheduleMap.get(key) || []
        entry.push({ class_id: schedule.class_id, is_floater: schedule.is_floater })
        staffingScheduleMap.set(key, entry)
      })
    }

    const assignmentMap = new Map<
      string,
      { hasFull: boolean; hasPartial: boolean; assignmentIds: Set<string>; assignedCount: number }
    >()

    ;(subAssignments || []).forEach((assignment) => {
      const key = `${assignment.teacher_id}|${assignment.date}|${assignment.time_slot_id}`
      if (!assignmentMap.has(key)) {
        assignmentMap.set(key, {
          hasFull: false,
          hasPartial: false,
          assignmentIds: new Set<string>(),
          assignedCount: 0,
        })
      }
      const entry = assignmentMap.get(key)
      if (!entry) return
      entry.assignmentIds.add(assignment.id)
      entry.assignedCount += 1
      if (assignment.is_partial) {
        entry.hasPartial = true
      } else {
        entry.hasFull = true
      }
    })

    let uncoveredCount = 0
    let partiallyCoveredCount = 0

    const teacherNameById = new Map(
      requestsInRange.map((request) => [
        request.teacher_id,
        request.teacher?.display_name ||
          `${request.teacher?.first_name || ''} ${request.teacher?.last_name || ''}`.trim() ||
          'Teacher',
      ])
    )

    type CoverageRequestSummary = {
      id: string
      teacher_name: string
      start_date: string
      end_date: string
      reason: string | null
      notes: string | null
      classrooms: Array<{ id: string; name: string; color: string | null }>
      classroom_label: string
      total_shifts: number
      assigned_shifts: number
      uncovered_shifts: number
      remaining_shifts: number
      status: 'needs_coverage' | 'partially_covered' | 'covered'
    }

    const shiftsByRequest = new Map<
      string,
      Array<{
        teacher_id: string
        date: string
        day_of_week_id: string | null
        time_slot_id: string
      }>
    >()

    ;(timeOffShifts || []).forEach((shift) => {
      const teacherId = requestTeacherMap.get(shift.time_off_request_id)
      if (!teacherId) return
      const entry = shiftsByRequest.get(shift.time_off_request_id) || []
      entry.push({
        teacher_id: teacherId,
        date: shift.date,
        day_of_week_id: shift.day_of_week_id || null,
        time_slot_id: shift.time_slot_id,
      })
      shiftsByRequest.set(shift.time_off_request_id, entry)
    })

    const coverageRequests: CoverageRequestSummary[] = []

    requestsInRange.forEach((request) => {
      const shifts = shiftsByRequest.get(request.id) || []
      if (shifts.length === 0) return

      let assignedShifts = 0
      let uncoveredShifts = 0
      let partialShifts = 0
      const classroomEntries = new Map<string, { id: string; name: string; color: string | null }>()

      shifts.forEach((shift) => {
        const assignmentKey = `${shift.teacher_id}|${shift.date}|${shift.time_slot_id}`
        const assignmentEntry = assignmentMap.get(assignmentKey)
        if (!assignmentEntry) {
          uncoveredShifts += 1
          uncoveredCount += 1
        } else {
          assignedShifts += 1
          if (assignmentEntry.hasPartial && !assignmentEntry.hasFull) {
            partialShifts += 1
            partiallyCoveredCount += 1
          }
        }

        const classroomKey = `${shift.teacher_id}|${shift.day_of_week_id || ''}|${shift.time_slot_id}`
        const classroomId = classroomIdMap.get(classroomKey)
        const classroomName = classroomMap.get(classroomKey) || 'Classroom unavailable'
        const classroomDetails = classroomId ? classroomDetailsById.get(classroomId) : null
        const entry = {
          id: classroomId || `unknown-${classroomName}`,
          name: classroomDetails?.name || classroomName,
          color: classroomDetails?.color ?? null,
        }
        classroomEntries.set(entry.id, entry)
      })

      const totalShifts = shifts.length
      if (totalShifts === 0) return

      const teacherName = teacherNameById.get(request.teacher_id) || 'Teacher'
      const classroomList =
        classroomEntries.size > 0
          ? Array.from(classroomEntries.values())
          : [{ id: 'unknown', name: 'Classroom unavailable', color: null }]
      const classroomLabel =
        classroomList.length > 1
          ? `${classroomList.map((entry) => entry.name).join(', ')} (varies by shift)`
          : classroomList[0].name

      const status =
        uncoveredShifts === 0 && partialShifts === 0
          ? 'covered'
          : assignedShifts === 0
            ? 'needs_coverage'
            : 'partially_covered'
      const remainingShifts = uncoveredShifts + partialShifts

      coverageRequests.push({
        id: request.id,
        teacher_name: teacherName,
        start_date: request.start_date,
        end_date: request.end_date || request.start_date,
        reason: request.reason,
        notes: request.notes || null,
        classrooms: classroomList,
        classroom_label: classroomLabel,
        total_shifts: totalShifts,
        assigned_shifts: assignedShifts,
        uncovered_shifts: uncoveredShifts,
        remaining_shifts: remainingShifts,
        status,
      })

    })

    coverageRequests.sort((a, b) => {
      if (a.start_date !== b.start_date) {
        return a.start_date.localeCompare(b.start_date)
      }
      if (a.uncovered_shifts !== b.uncovered_shifts) {
        return b.uncovered_shifts - a.uncovered_shifts
      }
      return a.teacher_name.localeCompare(b.teacher_name)
    })

    const absenceSlotKeys = new Set<string>()
    coverageRequests
      .filter((request) => request.status !== 'covered')
      .forEach((request) => {
        const shifts = shiftsByRequest.get(request.id) || []
        shifts.forEach((shift) => {
          let dayOfWeekId = shift.day_of_week_id
          if (!dayOfWeekId) {
            const dayNumber = new Date(`${shift.date}T00:00:00`).getDay()
            const dayMatch = dayIdByNumber.get(dayNumber === 0 ? 7 : dayNumber)
            dayOfWeekId = dayMatch?.id || null
          }
          if (!dayOfWeekId) return
          const scheduleKey = `${shift.teacher_id}|${dayOfWeekId}|${shift.time_slot_id}`
          const classroomId = classroomIdMap.get(scheduleKey)
          if (!classroomId) return
          absenceSlotKeys.add(`${classroomId}|${dayOfWeekId}|${shift.time_slot_id}`)
        })
      })

    const dayInfoById = new Map<string, { name: string; day_number: number }>()
    ;(daysOfWeek || []).forEach((day) => {
      if (typeof day.day_number === 'number') {
        dayInfoById.set(day.id, { name: day.name, day_number: day.day_number })
      }
    })

    const datesByDayId = new Map<string, string[]>()
    const start = new Date(`${startDate}T00:00:00`)
    const end = new Date(`${endDate}T00:00:00`)
    dayInfoById.forEach((info, dayId) => {
      const targetDay = info.day_number === 7 ? 0 : info.day_number
      const dates: string[] = []
      const cursor = new Date(start)
      while (cursor <= end) {
        if (cursor.getDay() === targetDay) {
          dates.push(toDateString(cursor))
        }
        cursor.setDate(cursor.getDate() + 1)
      }
      datesByDayId.set(dayId, dates)
    })

    const subAssignmentCountByDateSlot = new Map<string, number>()
    ;(subAssignments || []).forEach((assignment) => {
      if (!assignment.classroom_id) return
      const key = `${assignment.classroom_id}|${assignment.date}|${assignment.time_slot_id}`
      subAssignmentCountByDateSlot.set(
        key,
        (subAssignmentCountByDateSlot.get(key) || 0) + 1
      )
    })

    type StaffingTargetSlot = {
      id: string
      day_of_week_id: string
      day_name: string
      day_number: number
      day_order: number
      time_slot_id: string
      time_slot_code: string
      time_slot_order: number
      classroom_id: string
      classroom_name: string
      classroom_color: string | null
      required_staff: number
      preferred_staff: number | null
      scheduled_staff: number
      status: 'below_required' | 'below_preferred'
    }

    const staffingTargets: StaffingTargetSlot[] = []

    scheduleCells.forEach((cell) => {
      if (!cell.is_active) return
      const enrollment = cell.enrollment_for_staffing
      if (!enrollment || enrollment <= 0) return
      const classGroups = (cell.class_groups || []).filter((cg) => cg && cg.is_active !== false)
      if (classGroups.length === 0) return

      const classGroupForRatio = classGroups.reduce((lowest, current) => {
        const currentMin = current.min_age ?? Number.POSITIVE_INFINITY
        const lowestMin = lowest.min_age ?? Number.POSITIVE_INFINITY
        return currentMin < lowestMin ? current : lowest
      })

      if (!classGroupForRatio.required_ratio) return

      const requiredStaff = Math.ceil(enrollment / classGroupForRatio.required_ratio)
      const preferredStaff = classGroupForRatio.preferred_ratio
        ? Math.ceil(enrollment / classGroupForRatio.preferred_ratio)
        : null

      const slotKey = `${cell.classroom_id}|${cell.day_of_week_id}|${cell.time_slot_id}`
      const scheduledAssignments = staffingScheduleMap.get(slotKey) || []
      const classGroupIds = new Set(classGroups.map((cg) => cg.id))
      const scheduledStaff = scheduledAssignments.reduce((count, assignment) => {
        if (!assignment.class_id || !classGroupIds.has(assignment.class_id)) {
          return count
        }
        return count + (assignment.is_floater ? 0.5 : 1)
      }, 0)

      const belowRequired = scheduledStaff < requiredStaff
      const belowPreferred =
        !belowRequired &&
        preferredStaff !== null &&
        scheduledStaff < preferredStaff

      if (!belowRequired && !belowPreferred) return

      const absenceKey = `${cell.classroom_id}|${cell.day_of_week_id}|${cell.time_slot_id}`
      if (absenceSlotKeys.has(absenceKey)) return

      const needed =
        belowRequired
          ? requiredStaff - scheduledStaff
          : preferredStaff !== null
            ? preferredStaff - scheduledStaff
            : 0
      if (needed <= 0) return

      const dayDates = datesByDayId.get(cell.day_of_week_id) || []
      if (dayDates.length > 0) {
        const allCovered = dayDates.every((date) => {
          const key = `${cell.classroom_id}|${date}|${cell.time_slot_id}`
          const subCount = subAssignmentCountByDateSlot.get(key) || 0
          return subCount >= needed
        })
        if (allCovered) return
      }

      const dayInfo = dayInfoById.get(cell.day_of_week_id)
      const dayNumber = dayInfo?.day_number ?? 0
      const dayOrder = dayNumber === 0 ? 7 : dayNumber
      staffingTargets.push({
        id: `${cell.classroom_id}-${cell.day_of_week_id}-${cell.time_slot_id}`,
        day_of_week_id: cell.day_of_week_id,
        day_name: dayInfo?.name || dayIdByNumber.get(dayOrder)?.name || '',
        day_number: dayNumber,
        day_order: dayOrder,
        time_slot_id: cell.time_slot_id,
        time_slot_code: cell.time_slot?.code || '—',
        time_slot_order: cell.time_slot?.display_order ?? 999,
        classroom_id: cell.classroom_id,
        classroom_name: cell.classroom?.name || 'Classroom',
        classroom_color: cell.classroom?.color || null,
        required_staff: requiredStaff,
        preferred_staff: preferredStaff,
        scheduled_staff: scheduledStaff,
        status: belowRequired ? 'below_required' : 'below_preferred',
      })
    })

    staffingTargets.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'below_required' ? -1 : 1
      }
      if (a.day_order !== b.day_order) {
        return a.day_order - b.day_order
      }
      return a.time_slot_order - b.time_slot_order
    })

    const scheduledSubs = (subAssignments || [])
      .map((assignment) => ({
        id: assignment.id,
        date: assignment.date,
        day_name:
          dayIdByNumber.get(
            new Date(`${assignment.date}T00:00:00`).getDay() === 0
              ? 7
              : new Date(`${assignment.date}T00:00:00`).getDay()
          )?.name || '',
        time_slot_code: assignment.time_slot?.code || '—',
        time_slot_order: assignment.time_slot?.display_order ?? 999,
        classroom_name: assignment.classroom?.name || 'Classroom unavailable',
        classroom_color: assignment.classroom?.color ?? null,
        notes: assignment.notes || null,
        sub_name:
          assignment.sub?.display_name ||
          `${assignment.sub?.first_name || ''} ${assignment.sub?.last_name || ''}`.trim() ||
          'Sub',
        teacher_name:
          assignment.teacher?.display_name ||
          `${assignment.teacher?.first_name || ''} ${assignment.teacher?.last_name || ''}`.trim() ||
          'Teacher',
      }))
      .sort((a, b) =>
        a.date.localeCompare(b.date) || a.time_slot_order - b.time_slot_order
      )

    return NextResponse.json({
      range: { start_date: startDate, end_date: endDate },
      summary: {
        absences: coverageRequests.length,
        uncovered_shifts: uncoveredCount,
        partially_covered_shifts: partiallyCoveredCount,
        scheduled_subs: scheduledSubs.length,
      },
      coverage_requests: coverageRequests,
      staffing_targets: staffingTargets,
      scheduled_subs: scheduledSubs,
    })
  } catch (error) {
    return createErrorResponse(error, 'Failed to build dashboard overview', 500)
  }
}
