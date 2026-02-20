import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import { expandDateRangeWithTimeZone, parseLocalDate } from '@/lib/utils/date'
import { getScheduleSettings } from '@/lib/api/schedule-settings'
import { getTeacherScheduledShifts, getTimeOffShifts } from '@/lib/api/time-off-shifts'
import { getTimeOffRequests } from '@/lib/api/time-off'
import { getStaffDisplayName } from '@/lib/utils/staff-display-name'

type AvailabilityRequest = {
  start_date: string
  end_date: string
  time_slot_ids: string[]
  classroom_ids?: string[]
}

export async function POST(request: NextRequest) {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json({ error: 'Missing school context.' }, { status: 403 })
    }

    const body = (await request.json()) as AvailabilityRequest
    const { start_date, end_date, time_slot_ids } = body

    if (!start_date || !end_date || !Array.isArray(time_slot_ids) || time_slot_ids.length === 0) {
      return NextResponse.json(
        { error: 'start_date, end_date, and time_slot_ids are required.' },
        { status: 400 }
      )
    }

    const startDate = parseLocalDate(start_date)
    const endDate = parseLocalDate(end_date)
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid start_date or end_date.' }, { status: 400 })
    }
    if (startDate > endDate) {
      return NextResponse.json({ error: 'start_date must be before end_date.' }, { status: 400 })
    }

    const supabase = await createClient()
    const scheduleSettings = await getScheduleSettings(schoolId)
    const timeZone = scheduleSettings?.time_zone || 'UTC'

    const { data: dayRows, error: dayError } = await supabase
      .from('days_of_week')
      .select('id, name, day_number')

    if (dayError) {
      return NextResponse.json({ error: dayError.message }, { status: 500 })
    }

    const dayNameToId = new Map<string, string>()
    const dayIdToName = new Map<string, string>()
    const dayIdToNumber = new Map<string, number>()
    ;(dayRows || []).forEach(row => {
      if (row?.name) {
        dayNameToId.set(String(row.name).toLowerCase(), row.id)
        dayIdToName.set(row.id, row.name)
      }
      if (typeof row?.day_number === 'number') {
        dayIdToNumber.set(row.id, row.day_number)
      }
    })

    const selectedDayIdsRaw = scheduleSettings?.selected_day_ids
    const selectedDayIds = Array.isArray(selectedDayIdsRaw)
      ? selectedDayIdsRaw.map(id => String(id))
      : []
    const dayOptions = (dayRows || [])
      .filter(row => (selectedDayIds.length > 0 ? selectedDayIds.includes(row.id) : true))
      .sort((a, b) => (a.day_number ?? 0) - (b.day_number ?? 0))
      .map(row => ({
        id: row.id,
        name: row.name,
        short_name: row.name?.slice(0, 3) || row.name,
        day_number: row.day_number ?? 0,
      }))

    const { data: staffRows, error: staffError } = await supabase
      .from('staff')
      .select(
        `
        id,
        first_name,
        last_name,
        display_name,
        staff_role_type_assignments(
          staff_role_types(code)
        )
      `
      )
      .eq('school_id', schoolId)

    if (staffError) {
      return NextResponse.json({ error: staffError.message }, { status: 500 })
    }

    const flexStaff =
      (staffRows || []).filter((member: any) =>
        (member.staff_role_type_assignments || []).some((assignment: any) => {
          const roleType = assignment?.staff_role_types
          const roleCode = Array.isArray(roleType) ? roleType[0]?.code : roleType?.code
          return roleCode === 'FLEXIBLE'
        })
      ) ?? []

    console.log('[FlexAvailability] staff counts', {
      schoolId,
      total_staff_rows: (staffRows || []).length,
      flex_staff_rows: flexStaff.length,
    })

    const flexIds = flexStaff.map((staff: any) => staff.id)
    if (flexIds.length === 0) {
      return NextResponse.json({ staff: [], shifts: [] })
    }

    const dates = expandDateRangeWithTimeZone(start_date, end_date, timeZone)
    const shiftKeys = dates.flatMap(entry =>
      time_slot_ids.map(timeSlotId => {
        const dayName = new Date(`${entry.date}T00:00:00`).toLocaleDateString('en-US', {
          weekday: 'long',
        })
        const dayId = dayNameToId.get(dayName.toLowerCase()) || null
        return {
          date: entry.date,
          day_of_week_id: dayId,
          time_slot_id: timeSlotId,
        }
      })
    )

    const { data: timeSlots } = await supabase
      .from('time_slots')
      .select('id, code')
      .in('id', time_slot_ids)

    const timeSlotCodeMap = new Map<string, string>()
    ;(timeSlots || []).forEach(slot => {
      if (slot?.id) timeSlotCodeMap.set(slot.id, slot.code || '')
    })

    const availabilityByStaff = new Map<string, Map<string, boolean>>()
    const exceptionsByStaff = new Map<
      string,
      Array<{ date: string; time_slot_id: string; available: boolean }>
    >()

    const { data: availabilityRows } = await supabase
      .from('sub_availability')
      .select('sub_id, day_of_week_id, time_slot_id, available')
      .in('sub_id', flexIds)

    ;(availabilityRows || []).forEach(row => {
      if (!row?.sub_id || !row.available) return
      const key = `${row.day_of_week_id}|${row.time_slot_id}`
      if (!availabilityByStaff.has(row.sub_id)) {
        availabilityByStaff.set(row.sub_id, new Map())
      }
      availabilityByStaff.get(row.sub_id)!.set(key, true)
    })

    const { data: exceptionRows } = await supabase
      .from('sub_availability_exceptions')
      .select('sub_id, date, time_slot_id, available')
      .in('sub_id', flexIds)
      .gte('date', start_date)
      .lte('date', end_date)

    ;(exceptionRows || []).forEach(row => {
      if (!row?.sub_id) return
      if (!exceptionsByStaff.has(row.sub_id)) {
        exceptionsByStaff.set(row.sub_id, [])
      }
      exceptionsByStaff.get(row.sub_id)!.push({
        date: row.date,
        time_slot_id: row.time_slot_id,
        available: row.available,
      })
    })

    const { data: flexConflicts } = await supabase
      .from('staffing_event_shifts')
      .select('staff_id, date, time_slot_id')
      .in('staff_id', flexIds)
      .eq('status', 'active')
      .gte('date', start_date)
      .lte('date', end_date)
      .in('time_slot_id', time_slot_ids)

    const flexConflictMap = new Map<string, Set<string>>()
    ;(flexConflicts || []).forEach(row => {
      if (!row?.staff_id) return
      const key = `${row.date}|${row.time_slot_id}`
      if (!flexConflictMap.has(row.staff_id)) {
        flexConflictMap.set(row.staff_id, new Set())
      }
      flexConflictMap.get(row.staff_id)!.add(key)
    })

    const staffAvailability = await Promise.all(
      flexStaff.map(async (staff: any) => {
        const availabilityMap = new Map<string, boolean>(availabilityByStaff.get(staff.id) ?? [])
        const exceptions = exceptionsByStaff.get(staff.id) || []
        exceptions.forEach(exception => {
          const key = `${exception.date}|${exception.time_slot_id}`
          availabilityMap.set(key, exception.available)
        })

        const scheduleConflicts = new Set<string>()
        try {
          const scheduled = await getTeacherScheduledShifts(
            staff.id,
            start_date,
            end_date,
            timeZone
          )
          scheduled.forEach(shift => {
            scheduleConflicts.add(`${shift.date}|${shift.time_slot_id}`)
          })
        } catch {
          // ignore schedule conflicts if fetch fails
        }

        const timeOffConflicts = new Set<string>()
        try {
          const timeOffRequests = await getTimeOffRequests({
            teacher_id: staff.id,
            start_date,
            end_date,
          })
          for (const req of timeOffRequests) {
            try {
              const reqShifts = await getTimeOffShifts(req.id)
              reqShifts.forEach((shift: any) => {
                timeOffConflicts.add(`${shift.date}|${shift.time_slot_id}`)
              })
            } catch {
              // ignore
            }
          }
        } catch {
          // ignore
        }

        const flexConflictsForStaff = flexConflictMap.get(staff.id) || new Set<string>()
        const availableShiftKeys: string[] = []

        const hasAvailabilityData =
          availabilityMap.size > 0 || (exceptionsByStaff.get(staff.id) || []).length > 0

        shiftKeys.forEach(shift => {
          const key = `${shift.date}|${shift.time_slot_id}`
          const dayKey = `${shift.day_of_week_id}|${shift.time_slot_id}`
          let isAvailable = hasAvailabilityData
            ? availabilityMap.has(key)
              ? availabilityMap.get(key)!
              : availabilityMap.get(dayKey) === true
            : true

          if (
            scheduleConflicts.has(key) ||
            timeOffConflicts.has(key) ||
            flexConflictsForStaff.has(key)
          ) {
            isAvailable = false
          }

          if (isAvailable) {
            availableShiftKeys.push(key)
          }
        })

        return {
          id: staff.id,
          name: getStaffDisplayName(
            {
              first_name: staff.first_name ?? '',
              last_name: staff.last_name ?? '',
              display_name: staff.display_name ?? null,
            },
            scheduleSettings?.default_display_name_format || 'first_last_initial'
          ),
          availableShiftKeys,
        }
      })
    )

    const { data: scheduleCellsData } = await supabase
      .from('schedule_cells')
      .select(
        `
        id,
        classroom_id,
        day_of_week_id,
        time_slot_id,
        enrollment_for_staffing,
        is_active,
        classroom:classrooms(
          id,
          name,
          color
        ),
        schedule_cell_class_groups(
          class_group:class_groups(
            id,
            name,
            min_age,
            max_age,
            required_ratio,
            preferred_ratio
          )
        )
      `
      )
      .eq('school_id', schoolId)
      .eq('is_active', true)

    const scheduleCells = (scheduleCellsData || []).map((cell: any) => {
      const classGroups = cell.schedule_cell_class_groups
        ? cell.schedule_cell_class_groups
            .map((j: any) => j.class_group)
            .filter((cg: any): cg is any => cg !== null)
        : []
      return {
        ...cell,
        class_groups: classGroups,
      }
    })

    const cellByKey = new Map<
      string,
      {
        required_staff: number | null
        preferred_staff: number | null
        classroom_name: string
      }
    >()

    scheduleCells.forEach((cell: any) => {
      const classGroups = cell.class_groups || []
      if (!cell.enrollment_for_staffing || classGroups.length === 0) return
      const classGroupForRatio = classGroups.reduce((lowest: any, current: any) => {
        const currentMinAge = current.min_age ?? Infinity
        const lowestMinAge = lowest.min_age ?? Infinity
        return currentMinAge < lowestMinAge ? current : lowest
      })
      const required_staff =
        classGroupForRatio.required_ratio && cell.enrollment_for_staffing
          ? Math.ceil(cell.enrollment_for_staffing / classGroupForRatio.required_ratio)
          : null
      const preferred_staff =
        classGroupForRatio.preferred_ratio && cell.enrollment_for_staffing
          ? Math.ceil(cell.enrollment_for_staffing / classGroupForRatio.preferred_ratio)
          : null
      const key = `${cell.day_of_week_id}|${cell.time_slot_id}|${cell.classroom_id}`
      cellByKey.set(key, {
        required_staff,
        preferred_staff,
        classroom_name: cell.classroom?.name || 'Unknown',
      })
    })

    const { data: teacherSchedules } = await supabase
      .from('teacher_schedules')
      .select('day_of_week_id, time_slot_id, classroom_id')
      .eq('school_id', schoolId)

    const teacherCountByKey = new Map<string, number>()
    ;(teacherSchedules || []).forEach((ts: any) => {
      const key = `${ts.day_of_week_id}|${ts.time_slot_id}|${ts.classroom_id}`
      teacherCountByKey.set(key, (teacherCountByKey.get(key) || 0) + 1)
    })

    const { data: subAssignments } = await supabase
      .from('sub_assignments')
      .select('date, time_slot_id, classroom_id, status')
      .eq('status', 'active')
      .gte('date', start_date)
      .lte('date', end_date)

    const subCountByKey = new Map<string, number>()
    ;(subAssignments || []).forEach((sa: any) => {
      const key = `${sa.date}|${sa.time_slot_id}|${sa.classroom_id}`
      subCountByKey.set(key, (subCountByKey.get(key) || 0) + 1)
    })

    const { data: flexAssignments } = await supabase
      .from('staffing_event_shifts')
      .select('date, time_slot_id, classroom_id, status')
      .eq('status', 'active')
      .gte('date', start_date)
      .lte('date', end_date)

    const flexCountByKey = new Map<string, number>()
    ;(flexAssignments || []).forEach((fa: any) => {
      const key = `${fa.date}|${fa.time_slot_id}|${fa.classroom_id}`
      flexCountByKey.set(key, (flexCountByKey.get(key) || 0) + 1)
    })

    const shifts = shiftKeys.map(shift => ({
      date: shift.date,
      time_slot_id: shift.time_slot_id,
      time_slot_code: timeSlotCodeMap.get(shift.time_slot_id) || '',
    }))

    const shiftMetrics = shiftKeys.flatMap(shift =>
      (body.classroom_ids?.length ? body.classroom_ids : []).map(classroomId => {
        const dateKey = `${shift.date}|${shift.time_slot_id}|${classroomId}`
        const dayName = new Date(`${shift.date}T00:00:00`).toLocaleDateString('en-US', {
          weekday: 'long',
        })
        const dayOfWeekId = dayNameToId.get(dayName.toLowerCase()) || null
        const cellKey = dayOfWeekId ? `${dayOfWeekId}|${shift.time_slot_id}|${classroomId}` : ''
        const staffing = cellByKey.get(cellKey)
        const scheduledStaff =
          (teacherCountByKey.get(cellKey) || 0) +
          (subCountByKey.get(dateKey) || 0) +
          (flexCountByKey.get(dateKey) || 0)
        let status: 'below_required' | 'below_preferred' | 'ok' = 'ok'
        if (
          staffing?.required_staff !== null &&
          staffing?.required_staff !== undefined &&
          scheduledStaff < staffing.required_staff
        ) {
          status = 'below_required'
        } else if (
          staffing?.preferred_staff !== null &&
          staffing?.preferred_staff !== undefined &&
          scheduledStaff < staffing.preferred_staff
        ) {
          status = 'below_preferred'
        }
        return {
          date: shift.date,
          time_slot_id: shift.time_slot_id,
          time_slot_code: timeSlotCodeMap.get(shift.time_slot_id) || '',
          classroom_id: classroomId,
          classroom_name: staffing?.classroom_name || '',
          required_staff: staffing?.required_staff ?? null,
          preferred_staff: staffing?.preferred_staff ?? null,
          scheduled_staff: scheduledStaff,
          status,
        }
      })
    )

    return NextResponse.json({
      staff: staffAvailability,
      shifts,
      day_options: dayOptions,
      shift_metrics: shiftMetrics,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load flex availability.' },
      { status: 500 }
    )
  }
}
