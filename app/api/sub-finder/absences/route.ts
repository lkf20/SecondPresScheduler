import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildCoverageBadges, getCoverageStatus } from '@/lib/server/coverage/absence-status'
import { sortCoverageShifts, buildCoverageSegments } from '@/lib/server/coverage/coverage-summary'
import { getTimeOffRequests, getActiveSubAssignmentsForTimeOffRequest } from '@/lib/api/time-off'
import { getTimeOffShifts } from '@/lib/api/time-off-shifts'
import { transformTimeOffCardData } from '@/lib/utils/time-off-card-data'
import { toDateStringISO } from '@/lib/utils/date'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getSchoolClosuresForDateRange } from '@/lib/api/school-calendar'
import { isSlotClosedOnDate } from '@/lib/utils/school-closures'

export async function GET(request: NextRequest) {
  try {
    const isDev = process.env.NODE_ENV !== 'production'
    // Require schoolId from session
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json(
        {
          error:
            'User profile not found or missing school_id. Please ensure your profile is set up.',
        },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const includePartiallyCovered = searchParams.get('include_partially_covered') === 'true'
    const includeFullyCovered = searchParams.get('include_fully_covered') === 'true'

    const supabase = await createClient()

    // Fetch time off requests (scoped to user's school)
    const timeOffRequests = await getTimeOffRequests({
      school_id: schoolId,
      statuses: ['active'],
    })

    // Fetch school closures for the full date range so we exclude closed-day shifts from counts and display
    const dateRangeStart =
      timeOffRequests.length > 0
        ? timeOffRequests.map(r => r.start_date).reduce((a, b) => (a && b && a < b ? a : b))
        : null
    const dateRangeEnd =
      timeOffRequests.length > 0
        ? timeOffRequests
            .map(r => r.end_date || r.start_date)
            .reduce((a, b) => (a && b && a > b ? a : b))
        : null
    const schoolClosures =
      dateRangeStart && dateRangeEnd
        ? await getSchoolClosuresForDateRange(schoolId, dateRangeStart, dateRangeEnd)
        : []
    const closureList = schoolClosures.map(c => ({ date: c.date, time_slot_id: c.time_slot_id }))

    // Build schedule lookup for classrooms
    const teacherIds = Array.from(new Set(timeOffRequests.map(r => r.teacher_id).filter(Boolean)))
    const scheduleLookup = new Map<
      string,
      {
        classrooms: Map<string, { id: string; name: string; color: string | null }>
        classes: Set<string>
      }
    >()

    if (teacherIds.length > 0) {
      const { data: teacherSchedules } = await supabase
        .from('teacher_schedules')
        .select('teacher_id, day_of_week_id, time_slot_id, classroom:classrooms(id, name, color)')
        .in('teacher_id', teacherIds)

      ;(teacherSchedules || []).forEach((schedule: any) => {
        const key = `${schedule.teacher_id}|${schedule.day_of_week_id}|${schedule.time_slot_id}`
        const entry = scheduleLookup.get(key) || {
          classrooms: new Map<string, { id: string; name: string; color: string | null }>(),
          classes: new Set<string>(),
        }
        if (schedule.classroom?.name) {
          const classroomId = schedule.classroom.id || schedule.classroom.name
          entry.classrooms.set(classroomId, {
            id: schedule.classroom.id || schedule.classroom.name,
            name: schedule.classroom.name,
            color: schedule.classroom.color || null,
          })
        }
        // Note: class groups are no longer directly on teacher_schedules
        scheduleLookup.set(key, entry)
      })
    }

    // Transform each request
    const transformedRequests = await Promise.all(
      timeOffRequests.map(async request => {
        const coverageRequestId = (request as { coverage_request_id?: string | null })
          .coverage_request_id
        // Get shifts (exclude shifts on school closed days, e.g. snow day added after request was created)
        let shifts: Awaited<ReturnType<typeof getTimeOffShifts>>
        try {
          const allShifts = await getTimeOffShifts(request.id)
          shifts =
            closureList.length > 0
              ? allShifts.filter(
                  s => !isSlotClosedOnDate(toDateStringISO(s.date), s.time_slot_id, closureList)
                )
              : allShifts
        } catch (error) {
          console.error(`Error fetching shifts for time off request ${request.id}:`, error)
          shifts = []
        }
        const timeOffShiftKeys = new Set(
          shifts.map(shift => `${toDateStringISO(shift.date)}|${shift.time_slot_id}`)
        )
        const loggedMissingShiftKeys = new Set<string>()

        // Get assignments
        let assignments: any[] = []
        if (shifts.length > 0) {
          const requestStartDate = request.start_date
          const requestEndDate = request.end_date || request.start_date
          const assignmentMap = new Map<string, any>()
          const loggedMissingCoverageLinkKeys = new Set<string>()

          const coverageRequestId = (request as { coverage_request_id?: string | null })
            .coverage_request_id
          if (coverageRequestId) {
            try {
              const activeAssignments = await getActiveSubAssignmentsForTimeOffRequest(request.id)
              ;(activeAssignments || []).forEach((assignment: any) => {
                const coverageShift = assignment.coverage_request_shift
                const shiftDate = coverageShift?.date || assignment.date
                const shiftTimeSlotId = coverageShift?.time_slot_id || assignment.time_slot_id
                const shiftKey = `${toDateStringISO(shiftDate)}|${shiftTimeSlotId}`
                if (
                  shiftDate &&
                  shiftTimeSlotId &&
                  timeOffShiftKeys.size > 0 &&
                  !timeOffShiftKeys.has(shiftKey) &&
                  !loggedMissingShiftKeys.has(shiftKey)
                ) {
                  loggedMissingShiftKeys.add(shiftKey)
                  console.warn('[Sub Finder Absences] Coverage assignment missing time_off_shift', {
                    request_id: request.id,
                    coverage_request_id: coverageRequestId,
                    assignment_id: assignment.id,
                    shift_date: shiftDate,
                    time_slot_id: shiftTimeSlotId,
                  })
                }
                if (timeOffShiftKeys.has(shiftKey)) {
                  assignmentMap.set(shiftKey, {
                    id: assignment.id,
                    date: shiftDate,
                    time_slot_id: shiftTimeSlotId,
                    is_partial: assignment.is_partial,
                    assignment_type: assignment.assignment_type || null,
                    sub: assignment.sub,
                    source: 'coverage_request',
                  })
                }
              })
            } catch (error) {
              console.error('[Sub Finder Absences] Failed to load coverage request assignments:', {
                request_id: request.id,
                coverage_request_id: coverageRequestId,
                error,
              })
            }
          }

          const { data: subAssignments } = await supabase
            .from('sub_assignments')
            .select(
              'id, coverage_request_shift_id, date, time_slot_id, is_partial, assignment_type, sub:staff!sub_assignments_sub_id_fkey(id, first_name, last_name, display_name)'
            )
            .eq('teacher_id', request.teacher_id)
            .eq('status', 'active') // Only active assignments
            .gte('date', requestStartDate)
            .lte('date', requestEndDate)

          ;(subAssignments || []).forEach(assignment => {
            const shiftDate = assignment.date
            const shiftTimeSlotId = assignment.time_slot_id
            const shiftKey = `${toDateStringISO(shiftDate)}|${shiftTimeSlotId}`
            if (!assignment.coverage_request_shift_id && timeOffShiftKeys.has(shiftKey)) {
              if (!loggedMissingCoverageLinkKeys.has(shiftKey)) {
                loggedMissingCoverageLinkKeys.add(shiftKey)
                console.warn('[Sub Finder Absences] Assignment missing coverage_request_shift_id', {
                  request_id: request.id,
                  assignment_id: assignment.id,
                  shift_date: shiftDate,
                  time_slot_id: shiftTimeSlotId,
                })
              }
            }
            if (!assignmentMap.has(shiftKey) && timeOffShiftKeys.has(shiftKey)) {
              if (isDev) {
                console.warn(
                  '[Sub Finder Absences Debug] Using teacher/date fallback assignment for coverage',
                  {
                    request_id: request.id,
                    coverage_request_id: coverageRequestId,
                    assignment_id: assignment.id,
                    shift_key: shiftKey,
                    has_coverage_request_shift_id: Boolean(assignment.coverage_request_shift_id),
                  }
                )
              }
              assignmentMap.set(shiftKey, {
                id: assignment.id,
                date: shiftDate,
                time_slot_id: shiftTimeSlotId,
                is_partial: assignment.is_partial,
                assignment_type: assignment.assignment_type || null,
                sub: assignment.sub,
                source: 'teacher_date',
              })
            }
          })
          assignments = Array.from(assignmentMap.values())
        }

        if (assignments.length > 0 && timeOffShiftKeys.size > 0) {
          const assignmentKeys = new Set(
            assignments
              .map(assignment => `${toDateStringISO(assignment.date)}|${assignment.time_slot_id}`)
              .filter(key => Boolean(key))
          )
          const overlapKeys = Array.from(assignmentKeys).filter(key => timeOffShiftKeys.has(key))
          if (overlapKeys.length === 0) {
            console.warn('[Sub Finder Absences] Assignments do not match time_off_shifts', {
              request_id: request.id,
              coverage_request_id: coverageRequestId,
              time_off_shift_keys: Array.from(timeOffShiftKeys).slice(0, 10),
              assignment_keys: Array.from(assignmentKeys).slice(0, 10),
            })
          }
        }

        // Build classroom list
        const classroomMap = new Map<string, { id: string; name: string; color: string | null }>()
        shifts.forEach(shift => {
          const scheduleKey = `${request.teacher_id}|${shift.day_of_week_id}|${shift.time_slot_id}`
          const scheduleEntry = scheduleLookup.get(scheduleKey)
          if (scheduleEntry?.classrooms?.size) {
            scheduleEntry.classrooms.forEach(classroom => {
              classroomMap.set(classroom.id || classroom.name, classroom)
            })
          }
        })
        const classrooms = Array.from(classroomMap.values())

        // Get teacher data
        const teacher = (request as any).teacher || null

        const formatDay = (name?: string | null) => {
          if (!name) return '—'
          if (name === 'Tuesday') return 'Tues'
          return name.slice(0, 3)
        }

        const transformed = transformTimeOffCardData(
          {
            id: request.id,
            teacher_id: request.teacher_id,
            start_date: request.start_date,
            end_date: request.end_date,
            reason: request.reason,
            notes: request.notes,
            teacher: teacher
              ? {
                  first_name: teacher.first_name || null,
                  last_name: teacher.last_name || null,
                  display_name: teacher.display_name || null,
                }
              : null,
          },
          shifts.map(shift => ({
            id: shift.id,
            date: shift.date,
            day_of_week_id: shift.day_of_week_id,
            time_slot_id: shift.time_slot_id,
            day_of_week: shift.day_of_week,
            time_slot: shift.time_slot,
          })),
          assignments.map(assignment => ({
            id: assignment.id,
            date: assignment.date,
            time_slot_id: assignment.time_slot_id,
            is_partial: assignment.is_partial,
            assignment_type: assignment.assignment_type || null,
            sub: assignment.sub as any,
          })),
          classrooms,
          {
            includeDetailedShifts: true,
            formatDay,
            getClassroomForShift: (teacherId, dayOfWeekId, timeSlotId) => {
              const scheduleKey = `${teacherId}|${dayOfWeekId}|${timeSlotId}`
              const scheduleEntry = scheduleLookup.get(scheduleKey)
              if (scheduleEntry?.classrooms?.size) {
                const classroom = Array.from(scheduleEntry.classrooms.values())[0]
                return {
                  id: classroom.id || classroom.name,
                  name: classroom.name,
                  color: classroom.color,
                }
              }
              return null
            },
            getClassNameForShift: (teacherId, dayOfWeekId, timeSlotId) => {
              const scheduleKey = `${teacherId}|${dayOfWeekId}|${timeSlotId}`
              const scheduleEntry = scheduleLookup.get(scheduleKey)
              if (scheduleEntry?.classes?.size) {
                return Array.from(scheduleEntry.classes).join(', ')
              }
              return null
            },
          }
        )
        const assignmentKeys = new Set(
          assignments
            .map(assignment => `${toDateStringISO(assignment.date)}|${assignment.time_slot_id}`)
            .filter(key => Boolean(key))
        )
        const hasAssignmentOverlap = Array.from(assignmentKeys).some(key =>
          timeOffShiftKeys.has(key)
        )
        if (hasAssignmentOverlap && transformed.covered === 0 && transformed.partial === 0) {
          console.warn('[Sub Finder Absences] Assignment overlap but no coverage counted', {
            request_id: request.id,
            coverage_request_id: coverageRequestId,
            time_off_shift_keys: Array.from(timeOffShiftKeys).slice(0, 10),
            assignment_keys: Array.from(assignmentKeys).slice(0, 10),
            assignments_count: assignments.length,
          })
        }

        return transformed
      })
    )

    // Map transformed data to Sub Finder format
    const absencesWithCoverage = transformedRequests.map((transformed: any) => {
      // Map shift details to Sub Finder format
      const shiftDetails = (transformed.shift_details || []).map((detail: any) => ({
        id: detail.id || `${detail.date}-${detail.time_slot_code}`,
        date: detail.date || '',
        day_name: detail.day_name || '',
        time_slot_code: detail.time_slot_code || '',
        class_name: detail.class_name || null,
        classroom_name: detail.classroom_name || null,
        classroom_color: detail.classroom_color || null,
        status:
          detail.status === 'covered'
            ? 'fully_covered'
            : detail.status === 'partial'
              ? 'partially_covered'
              : 'uncovered',
        sub_name: detail.sub_name || null,
        sub_id: detail.sub_id || null,
        assignment_id: detail.assignment_id || null,
        is_partial: detail.is_partial || false,
      }))

      const coverage_status = getCoverageStatus({
        uncovered: transformed.uncovered,
        partiallyCovered: transformed.partial,
      })
      const coverage_badges = buildCoverageBadges({
        uncovered: transformed.uncovered,
        partiallyCovered: transformed.partial,
        fullyCovered: transformed.covered,
      })

      const sortedShiftDetails = sortCoverageShifts(shiftDetails)
      const coverageSegments = buildCoverageSegments(sortedShiftDetails)

      return {
        id: transformed.id,
        teacher_id: transformed.teacher_id,
        teacher_name: transformed.teacher_name,
        start_date: transformed.start_date,
        end_date: transformed.end_date,
        reason: transformed.reason,
        notes: transformed.notes,
        classrooms: transformed.classrooms,
        coverage_status,
        coverage_badges,
        shifts: {
          total: transformed.total,
          uncovered: transformed.uncovered,
          partially_covered: transformed.partial,
          fully_covered: transformed.covered,
          shift_details: shiftDetails,
          shift_details_sorted: sortedShiftDetails,
          coverage_segments: coverageSegments,
        },
      }
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayString = today.toISOString().slice(0, 10)
    const ninetyDaysAgo = new Date(today)
    ninetyDaysAgo.setDate(today.getDate() - 90)
    const ninetyDaysAgoString = ninetyDaysAgo.toISOString().slice(0, 10)

    const isUpcoming = (absence: any) => {
      const endDate = absence.end_date || absence.start_date
      return endDate >= todayString
    }
    const isPastWithinWindow = (absence: any) => {
      const endDate = absence.end_date || absence.start_date
      return endDate < todayString && endDate >= ninetyDaysAgoString
    }

    const shouldIncludeUpcoming = (absence: any) => {
      if (absence.shifts.total === 0) return true
      if (!includePartiallyCovered) {
        return (
          absence.shifts.uncovered > 0 || (includeFullyCovered && absence.shifts.fully_covered > 0)
        )
      }
      return (
        absence.shifts.uncovered > 0 ||
        absence.shifts.partially_covered > 0 ||
        (includeFullyCovered && absence.shifts.fully_covered > 0)
      )
    }

    const upcoming: any[] = []
    const past: any[] = []
    for (const absence of absencesWithCoverage) {
      if (isUpcoming(absence)) {
        if (shouldIncludeUpcoming(absence)) {
          upcoming.push({ ...absence, is_past: false })
        }
      } else if (isPastWithinWindow(absence)) {
        past.push({ ...absence, is_past: true })
      }
    }

    const sortUpcoming = (a: any, b: any) => {
      const startA = a.start_date
      const startB = b.start_date
      if (startA !== startB) return startA.localeCompare(startB)
      return (a.end_date || a.start_date).localeCompare(b.end_date || b.start_date)
    }
    const sortPast = (a: any, b: any) => {
      const endA = a.end_date || a.start_date
      const endB = b.end_date || b.start_date
      return endB.localeCompare(endA)
    }
    upcoming.sort(sortUpcoming)
    past.sort(sortPast)

    const filteredAbsences = [...upcoming, ...past]
    return NextResponse.json(filteredAbsences)
  } catch (error: any) {
    console.error('Error fetching absences:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
