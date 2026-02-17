import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSubAvailability, getSubAvailabilityExceptions } from '@/lib/api/sub-availability'
import { getTeacherScheduledShifts } from '@/lib/api/time-off-shifts'
import { getTimeOffRequests } from '@/lib/api/time-off'
import { getTimeOffShifts } from '@/lib/api/time-off-shifts'
import { createErrorResponse } from '@/lib/utils/errors'

/**
 * POST /api/sub-finder/check-conflicts
 * Check conflicts for a sub and specific shifts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sub_id, coverage_request_id, shift_ids } = body

    if (!sub_id || !coverage_request_id || !shift_ids || !Array.isArray(shift_ids)) {
      return createErrorResponse(
        'Missing required fields: sub_id, coverage_request_id, shift_ids',
        400
      )
    }

    const supabase = await createClient()

    // Get coverage request to find date range
    const { data: coverageRequest, error: crError } = await supabase
      .from('coverage_requests')
      .select('teacher_id, start_date, end_date')
      .eq('id', coverage_request_id)
      .single()

    if (crError || !coverageRequest) {
      return createErrorResponse('Coverage request not found', 404)
    }

    // Get the shifts
    const { data: coverageRequestShifts, error: shiftsError } = await supabase
      .from('coverage_request_shifts')
      .select('id, date, day_of_week_id, time_slot_id, classroom_id')
      .eq('coverage_request_id', coverage_request_id)
      .in('id', shift_ids)

    if (shiftsError) {
      return createErrorResponse('Failed to fetch shifts', 500)
    }

    if (!coverageRequestShifts || coverageRequestShifts.length === 0) {
      return NextResponse.json([])
    }

    const startDate = coverageRequest.start_date
    const endDate = coverageRequest.end_date

    // Get sub's availability
    const availability = await getSubAvailability(sub_id)
    const availabilityExceptions = await getSubAvailabilityExceptions(sub_id, {
      start_date: startDate,
      end_date: endDate,
    })

    // Create availability map: day_of_week_id + time_slot_id -> available (for day-based)
    // and date + time_slot_id -> available (for date-based exceptions)
    const dayBasedAvailabilityMap = new Map<string, boolean>()
    const dateBasedAvailabilityMap = new Map<string, boolean>()

    // Day-based availability
    availability.forEach((avail: any) => {
      if (avail.available) {
        const key = `${avail.day_of_week_id}|${avail.time_slot_id}`
        dayBasedAvailabilityMap.set(key, true)
      }
    })

    // Date-based exceptions override day-based availability
    availabilityExceptions.forEach((exception: any) => {
      const key = `${exception.date}|${exception.time_slot_id}`
      dateBasedAvailabilityMap.set(key, exception.available)
    })

    // Get sub's regular teaching schedule
    const subScheduledShifts = await getTeacherScheduledShifts(sub_id, startDate, endDate)
    const scheduleConflicts = new Set<string>()
    subScheduledShifts.forEach(scheduledShift => {
      const key = `${scheduledShift.date}|${scheduledShift.time_slot_id}`
      scheduleConflicts.add(key)
    })

    // Get sub's time off requests
    const timeOffRequests = await getTimeOffRequests({
      teacher_id: sub_id,
      start_date: startDate,
      end_date: endDate,
    })

    const timeOffConflicts = new Set<string>()
    for (const req of timeOffRequests) {
      try {
        const reqShifts = await getTimeOffShifts(req.id)
        reqShifts.forEach((shift: any) => {
          const key = `${shift.date}|${shift.time_slot_id}`
          timeOffConflicts.add(key)
        })
      } catch (error) {
        console.error(`Error fetching shifts for time off request ${req.id}:`, error)
      }
    }

    // Get existing sub assignments
    const { data: existingAssignments } = await supabase
      .from('sub_assignments')
      .select(
        'date, time_slot_id, teacher_id, classroom_id, staff:teacher_id(first_name, last_name, display_name)'
      )
      .eq('sub_id', sub_id)
      .eq('status', 'active')
      .eq('assignment_type', 'Substitute Shift')
      .gte('date', startDate)
      .lte('date', endDate)

    const assignmentConflicts = new Map<
      string,
      { teacher_name: string; classroom_name: string | null }
    >()
    if (existingAssignments) {
      for (const assignment of existingAssignments) {
        const key = `${assignment.date}|${assignment.time_slot_id}`
        const teacher = assignment.staff as any
        const teacherName =
          teacher?.display_name ||
          `${teacher?.first_name || ''} ${teacher?.last_name || ''}`.trim() ||
          'Unknown'

        // Get classroom name from the assignment if available
        let classroomName = null
        if (assignment.classroom_id) {
          const { data: classroom } = await supabase
            .from('classrooms')
            .select('name')
            .eq('id', assignment.classroom_id)
            .single()
          classroomName = classroom?.name || null
        }

        assignmentConflicts.set(key, {
          teacher_name: teacherName,
          classroom_name: classroomName,
        })
      }
    }

    // Check each shift for conflicts
    const conflicts = coverageRequestShifts.map(shift => {
      const dayBasedKey = `${shift.day_of_week_id}|${shift.time_slot_id}`
      const dateBasedKey = `${shift.date}|${shift.time_slot_id}`
      const conflictKey = dateBasedKey

      // Check date-based exception first, then fall back to day-based availability
      const isAvailable = dateBasedAvailabilityMap.has(dateBasedKey)
        ? dateBasedAvailabilityMap.get(dateBasedKey)!
        : dayBasedAvailabilityMap.has(dayBasedKey)
          ? dayBasedAvailabilityMap.get(dayBasedKey)!
          : false

      const hasScheduleConflict = scheduleConflicts.has(conflictKey)
      const hasTimeOffConflict = timeOffConflicts.has(conflictKey)
      const assignmentConflict = assignmentConflicts.get(conflictKey)

      let status: 'available' | 'unavailable' | 'conflict_teaching' | 'conflict_sub' = 'available'
      let message = ''

      if (!isAvailable) {
        status = 'unavailable'
        message = 'Marked unavailable'
      } else if (hasScheduleConflict) {
        status = 'conflict_teaching'
        message = `Conflict: Assigned to ${shift.classroom_id ? 'classroom' : 'teach'}`
      } else if (assignmentConflict) {
        status = 'conflict_sub'
        const classroomPart = assignmentConflict.classroom_name
          ? ` in ${assignmentConflict.classroom_name}`
          : ''
        message = `Conflict: Assigned to sub for ${assignmentConflict.teacher_name}${classroomPart}`
      } else if (hasTimeOffConflict) {
        status = 'unavailable'
        message = 'Has time off'
      }

      return {
        shift_id: shift.id,
        status,
        message,
      }
    })

    return NextResponse.json(conflicts)
  } catch (error) {
    console.error('Error checking conflicts:', error)
    return createErrorResponse('Failed to check conflicts', 500)
  }
}
