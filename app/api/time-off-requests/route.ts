import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTimeOffRequests } from '@/lib/api/time-off'
import { getTimeOffShifts, type TimeOffShiftWithDetails } from '@/lib/api/time-off-shifts'
import { transformTimeOffCardData, type TimeOffCardData } from '@/lib/utils/time-off-card-data'
import { createErrorResponse } from '@/lib/utils/errors'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getSchoolClosuresForDateRange } from '@/lib/api/school-calendar'
import { isSlotClosedOnDate } from '@/lib/utils/school-closures'
import { toDateStringISO } from '@/lib/utils/date'
import type { DisplayNameFormat } from '@/lib/utils/staff-display-name'

export const dynamic = 'force-dynamic'

/**
 * Unified API endpoint for time off requests
 *
 * Query Parameters:
 * - start_date: Filter requests that overlap with this date (ISO format)
 * - end_date: Filter requests that overlap with this date (ISO format)
 * - status: Comma-separated list of statuses (active, draft, deleted)
 * - teacher_id: Filter by specific teacher
 * - classroom_id: Filter by classroom (checks if any shift is in this classroom)
 * - coverage_status: Filter by coverage status (needs_coverage, partially_covered, covered)
 * - include_detailed_shifts: Include detailed shift information (default: false)
 * - include_classrooms: Include classroom information (default: true)
 * - include_assignments: Include assignment/sub information (default: true)
 *
 * Returns: Array of TimeOffCardData objects
 */
export async function GET(request: NextRequest) {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return createErrorResponse(
        new Error('User profile not found or missing school_id.'),
        'Missing school context',
        403
      )
    }

    const searchParams = request.nextUrl.searchParams

    // Parse filters
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const statusParam = searchParams.get('status')
    const statuses = statusParam ? statusParam.split(',').map(s => s.trim()) : ['active']
    const teacherId = searchParams.get('teacher_id')
    const classroomId = searchParams.get('classroom_id')
    const coverageStatusParam = searchParams.get('coverage_status')
    const coverageStatuses = coverageStatusParam
      ? coverageStatusParam.split(',').map(s => s.trim())
      : null

    // Parse options
    const includeDetailedShifts = searchParams.get('include_detailed_shifts') === 'true'
    const includeClassrooms = searchParams.get('include_classrooms') !== 'false'
    const includeAssignments = searchParams.get('include_assignments') !== 'false'

    const supabase = await createClient()

    let displayNameFormat: DisplayNameFormat = 'first_last_initial'
    try {
      const { data: settingsData } = await supabase
        .from('schedule_settings')
        .select('default_display_name_format')
        .eq('school_id', schoolId)
        .maybeSingle()
      if (settingsData?.default_display_name_format) {
        displayNameFormat = settingsData.default_display_name_format as DisplayNameFormat
      }
    } catch {
      // use default
    }

    // Fetch time off requests (scoped to user's school)
    const timeOffRequests = await getTimeOffRequests({
      school_id: schoolId,
      statuses: statuses as any[],
    })

    // Apply date range filter
    const getOverlap = (
      reqStart: string,
      reqEnd: string,
      rangeStart: string | null,
      rangeEnd: string | null
    ) => {
      if (!rangeStart && !rangeEnd) return true
      const reqEndDate = reqEnd || reqStart
      const normalizedReqStart = reqStart.slice(0, 10)
      const normalizedReqEnd = reqEndDate.slice(0, 10)
      if (rangeStart && rangeEnd) {
        return normalizedReqStart <= rangeEnd && normalizedReqEnd >= rangeStart
      }
      if (rangeStart) {
        return normalizedReqEnd >= rangeStart
      }
      if (rangeEnd) {
        return normalizedReqStart <= rangeEnd
      }
      return true
    }

    let filteredRequests = timeOffRequests
    if (startDate || endDate) {
      filteredRequests = filteredRequests.filter(request =>
        getOverlap(request.start_date, request.end_date || request.start_date, startDate, endDate)
      )
    }

    // Apply teacher filter
    if (teacherId) {
      filteredRequests = filteredRequests.filter(request => request.teacher_id === teacherId)
    }

    // Fetch school closures for the request date range so we exclude closed-day shifts from totals and display
    const dateRangeStart =
      filteredRequests.length > 0
        ? filteredRequests.map(r => r.start_date).reduce((a, b) => (a && b && a < b ? a : b))
        : null
    const dateRangeEnd =
      filteredRequests.length > 0
        ? filteredRequests
            .map(r => r.end_date || r.start_date)
            .reduce((a, b) => (a && b && a > b ? a : b))
        : null
    const schoolClosures =
      dateRangeStart && dateRangeEnd
        ? await getSchoolClosuresForDateRange(schoolId, dateRangeStart, dateRangeEnd)
        : []
    const closureList = schoolClosures.map(c => ({ date: c.date, time_slot_id: c.time_slot_id }))

    // Fetch shifts for all requests
    const teacherIds = Array.from(new Set(filteredRequests.map(r => r.teacher_id).filter(Boolean)))

    // Build schedule lookup for classrooms (if needed)
    const scheduleLookup = new Map<
      string,
      {
        classrooms: Map<string, { id: string; name: string; color: string | null }>
        classes: Set<string>
      }
    >()

    if (includeClassrooms && teacherIds.length > 0) {
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
        if (schedule.class?.name) entry.classes.add(schedule.class.name)
        scheduleLookup.set(key, entry)
      })
    }

    // Transform each request
    const results = await Promise.all(
      filteredRequests.map(async request => {
        const buildCoverageKey = ({
          coverageRequestShiftId,
          date,
          timeSlotId,
          classroomId,
        }: {
          coverageRequestShiftId?: string | null
          date: string
          timeSlotId: string
          classroomId?: string | null
        }) =>
          coverageRequestShiftId
            ? `crs:${coverageRequestShiftId}`
            : classroomId
              ? `${toDateStringISO(date)}|${timeSlotId}|${classroomId}`
              : `${toDateStringISO(date)}|${timeSlotId}`

        // Get shifts (exclude shifts on school closed days, e.g. snow day added after request was created)
        let shifts: Array<
          TimeOffShiftWithDetails & {
            coverage_request_shift_id?: string | null
            classroom_id?: string | null
            classroom_name?: string | null
            classroom_color?: string | null
            _coverage_key?: string
          }
        > = []
        try {
          const allShifts = await getTimeOffShifts(request.id)
          const normalizedTimeOffShifts = (
            closureList.length
              ? allShifts.filter(
                  s => !isSlotClosedOnDate(toDateStringISO(s.date), s.time_slot_id, closureList)
                )
              : allShifts
          ).map(s => ({
            ...s,
            coverage_request_shift_id: null,
            classroom_id: null,
            classroom_name: null,
            classroom_color: null,
            _coverage_key: buildCoverageKey({
              date: toDateStringISO(s.date),
              timeSlotId: s.time_slot_id,
            }),
          }))

          const coverageRequestId = (request as { coverage_request_id?: string | null })
            .coverage_request_id
          shifts = normalizedTimeOffShifts
          const allowedSlotKeys = new Set(
            normalizedTimeOffShifts.map(s => `${toDateStringISO(s.date)}|${s.time_slot_id}`)
          )
          if (coverageRequestId) {
            try {
              const { data: coverageShifts } = await supabase
                .from('coverage_request_shifts')
                .select(
                  `
                  id,
                  date,
                  day_of_week_id,
                  time_slot_id,
                  classroom_id,
                  day_of_week:days_of_week(name, display_order),
                  time_slot:time_slots(code, display_order),
                  classroom:classrooms(name, color)
                `
                )
                .eq('coverage_request_id', coverageRequestId)
                .eq('status', 'active')

              const normalizedCoverageShifts = (coverageShifts || [])
                .filter(
                  (s: any) =>
                    !isSlotClosedOnDate(toDateStringISO(s.date), s.time_slot_id, closureList)
                )
                .filter((s: any) =>
                  allowedSlotKeys.has(`${toDateStringISO(s.date)}|${s.time_slot_id}`)
                )
                .map((s: any) => ({
                  id: s.id,
                  date: toDateStringISO(s.date),
                  day_of_week_id: s.day_of_week_id,
                  time_slot_id: s.time_slot_id,
                  day_of_week: s.day_of_week || null,
                  time_slot: s.time_slot || null,
                  coverage_request_shift_id: s.id,
                  classroom_id: s.classroom_id || null,
                  classroom_name: s.classroom?.name ?? null,
                  classroom_color: s.classroom?.color ?? null,
                  _coverage_key: buildCoverageKey({
                    coverageRequestShiftId: s.id,
                    date: toDateStringISO(s.date),
                    timeSlotId: s.time_slot_id,
                    classroomId: s.classroom_id || null,
                  }),
                }))
              if (normalizedCoverageShifts.length > 0) {
                shifts = normalizedCoverageShifts as any
              }
            } catch (error) {
              console.warn('[Time Off Requests] Failed to load coverage_request_shifts', {
                request_id: request.id,
                coverage_request_id: coverageRequestId,
                error,
              })
            }
          }
        } catch (error) {
          console.error(`Error fetching shifts for time off request ${request.id}:`, error)
          shifts = []
        }

        // Get assignments if needed: prefer coverage_request_shift_id–linked (per-request), fallback to teacher+date
        let assignments: any[] = []
        if (includeAssignments) {
          const requestStartDate = request.start_date
          const requestEndDate = request.end_date || request.start_date
          const shiftKeys = new Set(
            shifts.map(
              (s: any) =>
                s._coverage_key ||
                buildCoverageKey({
                  coverageRequestShiftId: s.coverage_request_shift_id || null,
                  date: toDateStringISO(s.date),
                  timeSlotId: s.time_slot_id,
                  classroomId: s.classroom_id || null,
                })
            )
          )
          const shiftKeyByCoverageShiftId = new Map<string, string>(
            shifts
              .filter((s: any) => Boolean(s.coverage_request_shift_id))
              .map((s: any) => [s.coverage_request_shift_id as string, s._coverage_key as string])
          )
          const shiftKeyBySlot = new Map<string, string[]>()
          const shiftKeyBySlotAndClassroom = new Map<string, string>()
          shifts.forEach((s: any) => {
            const slotKey = `${toDateStringISO(s.date)}|${s.time_slot_id}`
            const keys = shiftKeyBySlot.get(slotKey) || []
            const coverageKey =
              s._coverage_key ||
              buildCoverageKey({
                coverageRequestShiftId: s.coverage_request_shift_id || null,
                date: toDateStringISO(s.date),
                timeSlotId: s.time_slot_id,
                classroomId: s.classroom_id || null,
              })
            keys.push(coverageKey)
            shiftKeyBySlot.set(slotKey, keys)
            if (s.classroom_id) {
              shiftKeyBySlotAndClassroom.set(`${slotKey}|${s.classroom_id}`, coverageKey)
            }
          })
          const resolveShiftKey = (input: {
            coverage_request_shift_id?: string | null
            date: string
            time_slot_id: string
            classroom_id?: string | null
          }): string | null => {
            if (input.coverage_request_shift_id) {
              return shiftKeyByCoverageShiftId.get(input.coverage_request_shift_id) || null
            }
            const slotKey = `${toDateStringISO(input.date)}|${input.time_slot_id}`
            if (input.classroom_id) {
              const byClass = shiftKeyBySlotAndClassroom.get(`${slotKey}|${input.classroom_id}`)
              if (byClass) return byClass
            }
            const candidates = shiftKeyBySlot.get(slotKey) || []
            return candidates.length === 1 ? candidates[0] : null
          }
          const coverageByKey = new Map<
            string,
            {
              date: string
              time_slot_id: string
              classroom_id?: string | null
              coverage_request_shift_id?: string | null
              is_partial?: boolean
              assignment_type?: string
              sub?: any
            }
          >()

          const coverageRequestId = (request as { coverage_request_id?: string | null })
            .coverage_request_id
          if (coverageRequestId) {
            const { data: crShifts } = await supabase
              .from('coverage_request_shifts')
              .select('id, date, time_slot_id, classroom_id')
              .eq('coverage_request_id', coverageRequestId)
              .eq('status', 'active')
            const crShiftIds = (crShifts || []).map((s: any) => s.id)
            const crShiftKeyById = new Map(
              (crShifts || []).map((s: any) => [
                s.id,
                buildCoverageKey({
                  coverageRequestShiftId: s.id,
                  date: toDateStringISO(s.date),
                  timeSlotId: s.time_slot_id,
                  classroomId: s.classroom_id || null,
                }),
              ])
            )
            if (crShiftIds.length > 0) {
              const { data: linkedAssignments } = await supabase
                .from('sub_assignments')
                .select(
                  'id, coverage_request_shift_id, date, time_slot_id, is_partial, assignment_type, sub:staff!sub_assignments_sub_id_fkey(first_name, last_name, display_name)'
                )
                .eq('status', 'active')
                .in('coverage_request_shift_id', crShiftIds)
              ;(linkedAssignments || []).forEach((a: any) => {
                const key =
                  crShiftKeyById.get(a.coverage_request_shift_id) ??
                  resolveShiftKey({
                    coverage_request_shift_id: a.coverage_request_shift_id || null,
                    date: toDateStringISO(a.date),
                    time_slot_id: a.time_slot_id,
                  })
                if (key && shiftKeys.has(key))
                  coverageByKey.set(key, {
                    date: a.date,
                    time_slot_id: a.time_slot_id,
                    classroom_id: null,
                    coverage_request_shift_id: a.coverage_request_shift_id || null,
                    is_partial: a.is_partial,
                    assignment_type: a.assignment_type ?? null,
                    sub: a.sub,
                  })
              })
            }
          }

          const { data: subAssignments } = await supabase
            .from('sub_assignments')
            .select(
              'date, time_slot_id, is_partial, assignment_type, sub:staff!sub_assignments_sub_id_fkey(first_name, last_name, display_name)'
            )
            .eq('teacher_id', request.teacher_id)
            .gte('date', requestStartDate)
            .lte('date', requestEndDate)

          const rawFallback = subAssignments || []
          const fallbackFiltered =
            closureList.length > 0
              ? rawFallback.filter(
                  (a: any) =>
                    !isSlotClosedOnDate(toDateStringISO(a.date), a.time_slot_id, closureList)
                )
              : rawFallback
          const fallbackByKey = new Map(
            fallbackFiltered
              .map((a: any) => {
                const key = resolveShiftKey({
                  coverage_request_shift_id: a.coverage_request_shift_id || null,
                  date: toDateStringISO(a.date),
                  time_slot_id: a.time_slot_id,
                })
                return key ? [key, a] : null
              })
              .filter(Boolean) as Array<[string, any]>
          )

          for (const shift of shifts) {
            const key =
              (shift as any)._coverage_key ||
              buildCoverageKey({
                coverageRequestShiftId: (shift as any).coverage_request_shift_id || null,
                date: toDateStringISO(shift.date),
                timeSlotId: shift.time_slot_id,
                classroomId: (shift as any).classroom_id || null,
              })
            const assignment = coverageByKey.get(key) ?? fallbackByKey.get(key)
            if (assignment) assignments.push(assignment)
          }
        }

        // Build classroom list
        const classroomMap = new Map<string, { id: string; name: string; color: string | null }>()
        if (includeClassrooms) {
          shifts.forEach(shift => {
            if (shift.classroom_id && shift.classroom_name) {
              classroomMap.set(shift.classroom_id, {
                id: shift.classroom_id,
                name: shift.classroom_name,
                color: shift.classroom_color ?? null,
              })
            }
            const scheduleKey = `${request.teacher_id}|${shift.day_of_week_id}|${shift.time_slot_id}`
            const scheduleEntry = scheduleLookup.get(scheduleKey)
            if (scheduleEntry?.classrooms?.size) {
              scheduleEntry.classrooms.forEach(classroom => {
                classroomMap.set(classroom.id || classroom.name, classroom)
              })
            }
          })
        }
        const classrooms = Array.from(classroomMap.values())

        // Apply classroom filter if specified
        if (classroomId && classrooms.length > 0) {
          const hasClassroom = classrooms.some(c => c.id === classroomId)
          if (!hasClassroom) {
            return null // Filter out this request
          }
        }

        // Transform using shared utility
        const formatDay = (name?: string | null) => {
          if (!name) return '—'
          if (name === 'Tuesday') return 'Tues'
          return name.slice(0, 3)
        }

        // Get teacher data from request
        const teacher = (request as any).teacher || null

        const transformed = transformTimeOffCardData(
          {
            id: request.id,
            teacher_id: request.teacher_id,
            start_date: request.start_date,
            end_date: request.end_date,
            reason: request.reason,
            notes: request.notes,
            request_status: request.status,
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
            coverage_request_shift_id: shift.coverage_request_shift_id ?? null,
            date: shift.date,
            day_of_week_id: shift.day_of_week_id,
            time_slot_id: shift.time_slot_id,
            classroom_id: shift.classroom_id ?? null,
            day_of_week: shift.day_of_week,
            time_slot: shift.time_slot,
          })),
          assignments.map(assignment => ({
            id: assignment.id,
            coverage_request_shift_id: assignment.coverage_request_shift_id ?? null,
            date: assignment.date,
            time_slot_id: assignment.time_slot_id,
            classroom_id: assignment.classroom_id ?? null,
            is_partial: assignment.is_partial,
            assignment_type: assignment.assignment_type || null,
            sub: assignment.sub as any,
          })),
          classrooms,
          {
            includeDetailedShifts,
            formatDay,
            displayNameFormat,
            getClassroomForShift: includeDetailedShifts
              ? (teacherId, dayOfWeekId, timeSlotId) => {
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
                }
              : undefined,
            getClassNameForShift: includeDetailedShifts
              ? (teacherId, dayOfWeekId, timeSlotId) => {
                  const scheduleKey = `${teacherId}|${dayOfWeekId}|${timeSlotId}`
                  const scheduleEntry = scheduleLookup.get(scheduleKey)
                  if (scheduleEntry?.classes?.size) {
                    return Array.from(scheduleEntry.classes).join(', ')
                  }
                  return null
                }
              : undefined,
          }
        )

        return transformed
      })
    )

    // Filter out nulls (from classroom filter)
    let filteredResults = results.filter((r): r is TimeOffCardData => r !== null)

    // Apply coverage status filter
    if (coverageStatuses && coverageStatuses.length > 0) {
      filteredResults = filteredResults.filter(result => coverageStatuses.includes(result.status))
    }

    return NextResponse.json({
      data: filteredResults,
      meta: {
        total: filteredResults.length,
        filters: {
          start_date: startDate,
          end_date: endDate,
          status: statuses,
          teacher_id: teacherId,
          classroom_id: classroomId,
          coverage_status: coverageStatuses,
        },
      },
    })
  } catch (error: any) {
    console.error('Error fetching time off requests:', error)
    return createErrorResponse(error, 'Failed to fetch time off requests', 500)
  }
}
