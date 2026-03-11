import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import { createErrorResponse } from '@/lib/utils/errors'
import { expandDateRangeWithTimeZone } from '@/lib/utils/date'
import {
  getStaffingEndDate,
  getStaffingWeeksLabelFromCount,
  STAFFING_BOUNDARY_DAY,
} from '@/lib/dashboard/staffing-boundary'
import { getSchoolClosuresForDateRange } from '@/lib/api/school-calendar'
import { isSlotClosedOnDate } from '@/lib/utils/school-closures'

/**
 * GET /api/dashboard/slot-run?classroom_id=&day_of_week_id=&time_slot_id=&start_date=
 * Returns run-length info for a single slot (below target for next 12 weeks or until boundary).
 * Used when opening Add Temporary Coverage from the weekly schedule.
 */
export async function GET(request: NextRequest) {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json(
        { error: 'User profile not found or missing school_id.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const classroomId = searchParams.get('classroom_id')
    const dayOfWeekId = searchParams.get('day_of_week_id')
    const timeSlotId = searchParams.get('time_slot_id')
    let startDate = searchParams.get('start_date')

    if (!classroomId || !dayOfWeekId || !timeSlotId) {
      return NextResponse.json(
        { error: 'classroom_id, day_of_week_id, and time_slot_id are required' },
        { status: 400 }
      )
    }

    if (!startDate) {
      const now = new Date()
      startDate =
        now.getFullYear() +
        '-' +
        String(now.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(now.getDate()).padStart(2, '0')
    }

    const staffingEndDate = getStaffingEndDate(startDate)

    const supabase = await createClient()

    let timeZone = 'UTC'
    try {
      const { data: settingsData } = await supabase
        .from('schedule_settings')
        .select('time_zone')
        .eq('school_id', schoolId)
        .maybeSingle()
      if (settingsData?.time_zone) {
        timeZone = settingsData.time_zone as string
      }
    } catch {
      // ignore
    }

    const { data: scheduleCellsData, error: cellsError } = await supabase
      .from('schedule_cells')
      .select(
        `
        id,
        classroom_id,
        day_of_week_id,
        time_slot_id,
        enrollment_for_staffing,
        required_staff_override,
        preferred_staff_override,
        is_active,
        day_of_week:days_of_week(
          id,
          name,
          day_number
        ),
        schedule_cell_class_groups(
          enrollment,
          class_group:class_groups(
            id,
            min_age,
            required_ratio,
            preferred_ratio
          )
        )
      `
      )
      .eq('school_id', schoolId)
      .eq('classroom_id', classroomId)
      .eq('day_of_week_id', dayOfWeekId)
      .eq('time_slot_id', timeSlotId)
      .eq('is_active', true)
      .limit(1)

    if (cellsError) {
      console.error('slot-run: schedule_cells error', cellsError)
      return createErrorResponse(cellsError, 'Failed to fetch schedule cell', 500)
    }

    const rawCell = Array.isArray(scheduleCellsData) ? scheduleCellsData[0] : null
    if (!rawCell) {
      return NextResponse.json({
        belowTarget: false,
      })
    }

    const classGroups = (rawCell.schedule_cell_class_groups || [])
      .map((j: any) =>
        j.class_group ? { ...j.class_group, enrollment: j.enrollment ?? null } : null
      )
      .filter((cg: any) => cg != null)
    const hasPerClassEnrollment = classGroups.some(
      (cg: any) => cg.enrollment != null && cg.enrollment !== ''
    )
    const totalEnrollment = hasPerClassEnrollment
      ? classGroups.reduce((sum: number, cg: any) => sum + (Number(cg.enrollment) || 0), 0)
      : rawCell.enrollment_for_staffing
    if (classGroups.length === 0 || totalEnrollment == null) {
      return NextResponse.json({
        belowTarget: false,
      })
    }

    const dayOfWeek = rawCell.day_of_week as any
    const dayNumber = dayOfWeek?.day_number ?? 1

    const classGroupForRatio = classGroups.reduce((lowest: any, current: any) => {
      const currentMinAge = current.min_age ?? Infinity
      const lowestMinAge = lowest.min_age ?? Infinity
      return currentMinAge < lowestMinAge ? current : lowest
    })

    const calculatedRequired =
      classGroupForRatio.required_ratio && totalEnrollment
        ? Math.ceil(totalEnrollment / classGroupForRatio.required_ratio)
        : null
    const calculatedPreferred =
      classGroupForRatio.preferred_ratio && totalEnrollment
        ? Math.ceil(totalEnrollment / classGroupForRatio.preferred_ratio)
        : null
    const requiredStaff =
      rawCell.required_staff_override != null ? rawCell.required_staff_override : calculatedRequired
    const preferredStaff =
      rawCell.preferred_staff_override != null
        ? rawCell.preferred_staff_override
        : calculatedPreferred

    const { data: teacherSchedules, error: tsError } = await supabase
      .from('teacher_schedules')
      .select('day_of_week_id, time_slot_id, classroom_id, is_floater')
      .eq('school_id', schoolId)
      .eq('day_of_week_id', dayOfWeekId)
      .eq('time_slot_id', timeSlotId)
      .eq('classroom_id', classroomId)

    if (tsError) {
      console.error('slot-run: teacher_schedules error', tsError)
      return createErrorResponse(tsError, 'Failed to fetch teacher schedules', 500)
    }

    // Dashboard below-staffing: permanent 1, flex 1, floater 0.5, temp +1; subs and absences excluded. See AGENTS.md "Coverage counting".
    const teacherContrib = (teacherSchedules || []).reduce(
      (sum: number, ts: any) => sum + (ts.is_floater ? 0.5 : 1),
      0
    )

    const { data: staffingEventShifts, error: sesError } = await supabase
      .from('staffing_event_shifts')
      .select('date, time_slot_id, classroom_id')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .eq('classroom_id', classroomId)
      .eq('time_slot_id', timeSlotId)
      .gte('date', startDate)
      .lte('date', staffingEndDate)

    if (sesError) {
      console.error('slot-run: staffing_event_shifts error', sesError)
      return createErrorResponse(sesError, 'Failed to fetch staffing event shifts', 500)
    }

    const tempByDate = new Map<string, number>()
    ;(staffingEventShifts || []).forEach((ses: any) => {
      const key = ses.date
      tempByDate.set(key, (tempByDate.get(key) || 0) + 1)
    })

    const expandedDates = expandDateRangeWithTimeZone(startDate, staffingEndDate, timeZone)
    const schoolClosures = await getSchoolClosuresForDateRange(schoolId, startDate, staffingEndDate)
    const closureList = schoolClosures.map(c => ({ date: c.date, time_slot_id: c.time_slot_id }))

    const belowDates: Array<{ date: string; status: 'below_required' | 'below_preferred' }> = []

    for (const dateEntry of expandedDates) {
      if (dateEntry.day_number !== dayNumber) continue
      if (isSlotClosedOnDate(dateEntry.date, timeSlotId, closureList)) continue

      const tempCount = tempByDate.get(dateEntry.date) || 0
      const totalScheduled = teacherContrib + tempCount

      let status: 'below_required' | 'below_preferred' | null = null
      if (requiredStaff !== null && totalScheduled < requiredStaff) {
        status = 'below_required'
      } else if (preferredStaff !== null && totalScheduled < preferredStaff) {
        status = 'below_preferred'
      }
      if (status) {
        belowDates.push({ date: dateEntry.date, status })
      }
    }

    if (belowDates.length === 0) {
      return NextResponse.json({
        belowTarget: false,
      })
    }

    const dateStart = belowDates[0].date
    const dateEnd = belowDates[belowDates.length - 1].date
    // Use count of dates that need coverage so we don't overcount when there are gaps
    // (dates that meet target due to temp coverage are excluded from belowDates).
    const weeksLabel = getStaffingWeeksLabelFromCount(belowDates.length)
    // Use worst status in range so Add Temporary Coverage form pre-fills correctly
    // (e.g. if any date is below_required, default to required target).
    const hasBelowRequired = belowDates.some(d => d.status === 'below_required')
    const targetType = hasBelowRequired ? 'required' : 'preferred'
    const datesNeedingCoverage = belowDates.map(d => d.date)

    return NextResponse.json({
      belowTarget: true,
      dateStart,
      dateEnd,
      weeksLabel,
      targetType,
      datesNeedingCoverage,
      cappedByBoundary: dateEnd >= STAFFING_BOUNDARY_DAY,
    })
  } catch (error) {
    console.error('Error in slot-run:', error)
    return createErrorResponse(error, 'Failed to get slot run', 500)
  }
}
