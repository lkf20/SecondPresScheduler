import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import { createErrorResponse } from '@/lib/utils/errors'
import { parseLocalDate, expandDateRangeWithTimeZone } from '@/lib/utils/date'
import { getStaffingEndDate } from '@/lib/dashboard/staffing-boundary'
import { MONTH_NAMES } from '@/lib/utils/date-format'
import { getStaffDisplayName, type DisplayNameFormat } from '@/lib/utils/staff-display-name'
import { filterCoverageRequestsToActiveTimeOffOnly } from '@/lib/dashboard/filter-draft-time-off'

export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'start_date and end_date query parameters are required' },
        { status: 400 }
      )
    }

    // 12-week lookahead for staffing targets (run length and suggestions), capped by boundary day
    const staffingEndDateForFetch = getStaffingEndDate(startDate)

    const supabase = await createClient()

    const defaultDisplayNameFormat: DisplayNameFormat = 'first_last_initial'
    let displayNameFormat: DisplayNameFormat = defaultDisplayNameFormat

    let timeZone = 'UTC'
    try {
      const { data: settingsData, error: settingsError } = await supabase
        .from('schedule_settings')
        .select('default_display_name_format, time_zone')
        .eq('school_id', schoolId)
        .maybeSingle()

      if (!settingsError) {
        if (settingsData?.default_display_name_format) {
          displayNameFormat = settingsData.default_display_name_format as DisplayNameFormat
        }
        if (settingsData?.time_zone) {
          timeZone = settingsData.time_zone as string
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.warn('Error fetching schedule settings:', errorMessage)
    }

    // Get coverage requests in date range
    const { data: coverageRequests, error: coverageRequestsError } = await supabase
      .from('coverage_requests')
      .select(
        `
        id,
        teacher_id,
        start_date,
        end_date,
        request_type,
        source_request_id,
        status,
        total_shifts,
        covered_shifts,
        created_at,
        teacher:staff!coverage_requests_teacher_id_fkey(
          id,
          first_name,
          last_name,
          display_name
        )
      `
      )
      .eq('school_id', schoolId)
      .lte('start_date', endDate)
      .gte('end_date', startDate)
      .in('status', ['open', 'filled'])
      .order('start_date', { ascending: false })

    if (coverageRequestsError) {
      console.error('Error fetching coverage requests:', coverageRequestsError)
      return createErrorResponse(coverageRequestsError, 'Failed to fetch coverage requests', 500)
    }

    // Deduplicate coverage requests FIRST - keep the most recent one for each source_request_id
    const uniqueCoverageRequests = new Map<string, (typeof coverageRequests)[0]>()
    ;(coverageRequests || []).forEach(request => {
      if (request.request_type === 'time_off' && request.source_request_id) {
        const existing = uniqueCoverageRequests.get(request.source_request_id)
        const requestDate = request.created_at ? new Date(request.created_at).getTime() : 0
        const existingDate = existing?.created_at ? new Date(existing.created_at).getTime() : 0

        // Keep the most recent one, or if dates are equal, keep the one with more shifts
        if (
          !existing ||
          requestDate > existingDate ||
          (requestDate === existingDate &&
            (request.total_shifts || 0) > (existing.total_shifts || 0))
        ) {
          uniqueCoverageRequests.set(request.source_request_id, request)
        }
      } else {
        // For non-time_off requests, use id as key
        uniqueCoverageRequests.set(request.id, request)
      }
    })
    const deduplicatedRequests = Array.from(uniqueCoverageRequests.values())

    // Log if we filtered out any duplicates
    if (deduplicatedRequests.length < (coverageRequests || []).length) {
      console.log(
        `Filtered ${(coverageRequests || []).length - deduplicatedRequests.length} duplicate coverage requests`
      )
    }

    // Get time_off_requests for coverage requests that have source_request_id (need status to exclude drafts)
    const sourceRequestIds = deduplicatedRequests
      .filter(cr => cr.request_type === 'time_off' && cr.source_request_id)
      .map(cr => cr.source_request_id)
      .filter((id): id is string => id !== null)

    const timeOffRequestsMap = new Map<string, { reason: string | null; notes: string | null }>()
    const activeTimeOffRequestIds = new Set<string>()

    if (sourceRequestIds.length > 0) {
      const { data: timeOffRequests, error: timeOffError } = await supabase
        .from('time_off_requests')
        .select('id, reason, notes, status')
        .in('id', sourceRequestIds)

      if (timeOffError) {
        console.error('Error fetching time_off_requests:', timeOffError)
        // Don't fail the whole request, just log the error
      } else {
        ;(timeOffRequests || []).forEach(tor => {
          timeOffRequestsMap.set(tor.id, {
            reason: tor.reason || null,
            notes: tor.notes || null,
          })
          if (tor.status === 'active') {
            activeTimeOffRequestIds.add(tor.id)
          }
        })
      }
    }

    // Exclude coverage requests whose source time_off_request is draft (dashboard shows only active time off)
    const deduplicatedRequestsFiltered = filterCoverageRequestsToActiveTimeOffOnly(
      deduplicatedRequests,
      activeTimeOffRequestIds
    )

    // Get coverage request shifts for these requests with classroom details
    const requestIds = deduplicatedRequestsFiltered.map(cr => cr.id)
    let coverageRequestShifts: any[] = []

    if (requestIds.length > 0) {
      const { data: shifts, error: shiftsError } = await supabase
        .from('coverage_request_shifts')
        .select(
          `
          *,
          classroom:classrooms(
            id,
            name,
            color
          ),
          day_of_week:days_of_week(
            id,
            name,
            day_number
          ),
          time_slot:time_slots(
            id,
            code,
            name
          )
        `
        )
        .in('coverage_request_id', requestIds)
        .eq('status', 'active')
        .gte('date', startDate)
        .lte('date', endDate)

      if (shiftsError) {
        console.error('Error fetching coverage request shifts:', shiftsError)
        return createErrorResponse(shiftsError, 'Failed to fetch coverage request shifts', 500)
      }

      coverageRequestShifts = shifts || []
    }

    // Get sub assignments in date range (scheduled subs)
    // We want all sub_assignments in the date range, not just those linked to coverage requests
    const { data: subAssignments, error: subAssignmentsError } = await supabase
      .from('sub_assignments')
      .select(
        `
        id,
        date,
        day_of_week_id,
        time_slot_id,
        classroom_id,
        notes,
        sub_id,
        teacher_id,
        coverage_request_shift_id,
        is_partial,
        assignment_type,
        sub:staff!sub_assignments_sub_id_fkey(
          id,
          first_name,
          last_name,
          display_name
        ),
        teacher:staff!sub_assignments_teacher_id_fkey(
          id,
          first_name,
          last_name,
          display_name
        ),
        classroom:classrooms(
          id,
          name,
          color
        ),
        day_of_week:days_of_week(
          id,
          name
        ),
        time_slot:time_slots(
          id,
          code
        ),
        coverage_request_shift:coverage_request_shifts(
          coverage_request_id
        )
      `
      )
      .eq('status', 'active')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })

    if (subAssignmentsError) {
      console.error('Error fetching sub assignments:', subAssignmentsError)
      return createErrorResponse(subAssignmentsError, 'Failed to fetch sub assignments', 500)
    }

    // Get schedule cells with class groups and enrollment data
    // This is the correct way to calculate staffing - using enrollment and ratios, not fixed staffing_rules
    const { data: scheduleCellsData, error: scheduleCellsError } = await supabase
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
        classroom:classrooms(
          id,
          name,
          color
        ),
        day_of_week:days_of_week(
          id,
          name,
          day_number,
          display_order
        ),
        time_slot:time_slots(
          id,
          code,
          display_order
        ),
        schedule_cell_class_groups(
          enrollment,
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

    if (scheduleCellsError) {
      console.error('Error fetching schedule cells:', scheduleCellsError)
      // If table doesn't exist, return empty array instead of failing
      if (
        scheduleCellsError.code === '42P01' ||
        scheduleCellsError.message?.includes('does not exist')
      ) {
        console.warn('schedule_cells table does not exist yet. Staffing targets will be empty.')
      } else {
        return createErrorResponse(scheduleCellsError, 'Failed to fetch schedule cells', 500)
      }
    }

    // Transform schedule cells to flatten class_groups array (include enrollment per class group)
    const scheduleCells = (scheduleCellsData || [])
      .map((cell: any) => {
        const classGroups = cell.schedule_cell_class_groups
          ? cell.schedule_cell_class_groups
              .map((j: any) =>
                j.class_group ? { ...j.class_group, enrollment: j.enrollment ?? null } : null
              )
              .filter((cg: any): cg is any => cg !== null)
          : []
        const hasPerClassEnrollment = classGroups.some(
          (cg: any) => cg.enrollment != null && cg.enrollment !== ''
        )
        const totalEnrollment = hasPerClassEnrollment
          ? classGroups.reduce((sum: number, cg: any) => sum + (Number(cg.enrollment) || 0), 0)
          : cell.enrollment_for_staffing
        return {
          ...cell,
          class_groups: classGroups,
          _totalEnrollment: totalEnrollment,
        }
      })
      .filter(
        (cell: any) =>
          cell.is_active &&
          cell.class_groups &&
          cell.class_groups.length > 0 &&
          cell._totalEnrollment != null
      )

    // Get teacher schedules to count scheduled staff (permanent, flex, floaters)
    // Include is_floater for 0.5 weighting
    const { data: teacherSchedules, error: teacherSchedulesError } = await supabase
      .from('teacher_schedules')
      .select(
        `
        day_of_week_id,
        time_slot_id,
        classroom_id,
        is_floater
      `
      )
      .eq('school_id', schoolId)

    if (teacherSchedulesError) {
      console.error('Error fetching teacher schedules:', teacherSchedulesError)
      return createErrorResponse(teacherSchedulesError, 'Failed to fetch teacher schedules', 500)
    }

    // Get staffing_event_shifts (temporary coverage) in date range - use 12-week window for staffing targets.
    // We scope by classroom_id when we have schedule cells to avoid fetching shifts for other classrooms.
    // Matching to cells uses date + time_slot_id + classroom_id (day-of-week is implicit from date).
    // Unlike slot-run, we do not filter by time_slot_id or day_of_week_id here; in-memory filter is correct.
    const classroomIdsFromCells = [
      ...new Set(
        (scheduleCells as { classroom_id?: string }[]).map(c => c.classroom_id).filter(Boolean)
      ),
    ] as string[]
    let staffingEventShiftsQuery = supabase
      .from('staffing_event_shifts')
      .select('date, time_slot_id, classroom_id')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .gte('date', startDate)
      .lte('date', staffingEndDateForFetch)
    if (classroomIdsFromCells.length > 0) {
      staffingEventShiftsQuery = staffingEventShiftsQuery.in('classroom_id', classroomIdsFromCells)
    }
    const { data: staffingEventShifts, error: staffingEventShiftsError } =
      await staffingEventShiftsQuery

    if (staffingEventShiftsError) {
      console.error('Error fetching staffing event shifts:', staffingEventShiftsError)
      return createErrorResponse(
        staffingEventShiftsError,
        'Failed to fetch staffing event shifts',
        500
      )
    }

    // Process coverage requests (already deduplicated and draft time-off excluded above)
    // Use Promise.all since we need to fetch missing classrooms asynchronously
    const processedCoverageRequests = await Promise.all(
      deduplicatedRequestsFiltered.map(async request => {
        // Debug: Log if we see duplicates
        if (request.request_type === 'time_off' && request.source_request_id) {
          const duplicates = deduplicatedRequestsFiltered.filter(
            r =>
              r.request_type === 'time_off' &&
              r.source_request_id === request.source_request_id &&
              r.id !== request.id
          )
          if (duplicates.length > 0) {
            console.warn(
              `Found duplicate coverage requests for source_request_id ${request.source_request_id}:`,
              {
                kept: request.id,
                duplicates: duplicates.map(d => d.id),
              }
            )
          }
        }
        const teacher = request.teacher as any
        const teacherName = teacher
          ? getStaffDisplayName(teacher, displayNameFormat) || 'Unknown Teacher'
          : 'Unknown Teacher'

        // Get reason and notes from time_off_request if it exists
        const timeOffRequest =
          request.source_request_id && request.request_type === 'time_off'
            ? timeOffRequestsMap.get(request.source_request_id)
            : null
        const reason = timeOffRequest?.reason || null
        const notes = timeOffRequest?.notes || null

        // Get shifts for this request
        const requestShifts = coverageRequestShifts.filter(
          s => s.coverage_request_id === request.id
        )

        // Get sub assignments for these shifts using coverage_request_shift_id
        const shiftIds = new Set(requestShifts.map((s: any) => s.id))
        const assignedSubs = (subAssignments || []).filter(
          (sa: any) => sa.coverage_request_shift_id && shiftIds.has(sa.coverage_request_shift_id)
        )

        const totalShifts = requestShifts.length

        const assignmentMap = new Map<string, { hasFull: boolean; hasPartial: boolean }>()
        const subNameByShiftId = new Map<string, string>()

        assignedSubs.forEach((assignment: any) => {
          const key =
            assignment.coverage_request_shift_id ||
            `${assignment.date}|${assignment.day_of_week_id}|${assignment.time_slot_id}`
          const existing = assignmentMap.get(key) || { hasFull: false, hasPartial: false }
          const isPartial =
            assignment.is_partial || assignment.assignment_type === 'Partial Sub Shift'
          if (isPartial) {
            existing.hasPartial = true
          } else {
            existing.hasFull = true
          }
          assignmentMap.set(key, existing)
          if (assignment.coverage_request_shift_id && assignment.sub) {
            const subName = getStaffDisplayName(assignment.sub as any, displayNameFormat) || 'Sub'
            subNameByShiftId.set(assignment.coverage_request_shift_id, subName)
          }
        })

        const assignedShifts = Array.from(assignmentMap.values()).filter(
          entry => entry.hasFull || entry.hasPartial
        ).length
        const partialShifts = Array.from(assignmentMap.values()).filter(
          entry => entry.hasPartial && !entry.hasFull
        ).length
        const uncoveredShifts = totalShifts - assignedShifts
        const remainingShifts = uncoveredShifts

        // Determine status
        let status: 'needs_coverage' | 'partially_covered' | 'covered'
        if (assignedShifts === 0) {
          status = 'needs_coverage'
        } else if (uncoveredShifts > 0) {
          status = 'partially_covered'
        } else {
          status = 'covered'
        }

        // Get unique classrooms from shifts
        // If classroom relationship is missing, fetch it directly
        const classroomsMap = new Map<string, { id: string; name: string; color: string | null }>()
        const missingClassroomIds = new Set<string>()

        requestShifts.forEach((shift: any) => {
          if (shift.classroom_id) {
            if (shift.classroom) {
              const classroom = shift.classroom as any
              if (!classroomsMap.has(shift.classroom_id)) {
                classroomsMap.set(shift.classroom_id, {
                  id: shift.classroom_id,
                  name: classroom.name || 'Unknown',
                  color: classroom.color || null,
                })
              }
            } else {
              // Classroom relationship missing, need to fetch it
              missingClassroomIds.add(shift.classroom_id)
            }
          }
        })

        // Fetch missing classrooms if any
        if (missingClassroomIds.size > 0) {
          const { data: missingClassrooms } = await supabase
            .from('classrooms')
            .select('id, name, color')
            .in('id', Array.from(missingClassroomIds))
            .eq('school_id', schoolId)

          ;(missingClassrooms || []).forEach((classroom: any) => {
            if (!classroomsMap.has(classroom.id)) {
              classroomsMap.set(classroom.id, {
                id: classroom.id,
                name: classroom.name || 'Unknown',
                color: classroom.color || null,
              })
            }
          })
        }

        const classrooms = Array.from(classroomsMap.values())

        // Format shift details for dropdown and for large shift chips (Dashboard uses same as Recommended Subs)
        const shiftDetails: Array<{
          label: string
          status: 'covered' | 'partial' | 'uncovered'
          date: string
          time_slot_code: string
          day_name?: string
          classroom_name?: string | null
          classroom_color?: string | null
          assigned_sub_name?: string | null
        }> = []

        requestShifts.forEach((shift: any) => {
          const assignment = assignmentMap.get(shift.id)

          let status: 'covered' | 'partial' | 'uncovered' = 'uncovered'
          if (assignment?.hasFull) {
            status = 'covered'
          } else if (assignment?.hasPartial) {
            status = 'partial'
          }

          const dayOfWeek = shift.day_of_week as any
          const timeSlot = shift.time_slot as any
          const dayName = dayOfWeek?.name
            ? dayOfWeek.name === 'Tuesday'
              ? 'Tues'
              : dayOfWeek.name.slice(0, 3)
            : '—'
          const timeCode = timeSlot?.code || '—'

          const date = parseLocalDate(shift.date)
          const month = MONTH_NAMES[date.getMonth()]
          const day = date.getDate()
          const label = `${dayName} ${timeCode} • ${month} ${day}`

          const classroom = shift.classroom_id ? classroomsMap.get(shift.classroom_id) : null

          const assignedSubName =
            status === 'covered' || status === 'partial'
              ? (subNameByShiftId.get(shift.id) ?? null)
              : null

          shiftDetails.push({
            label,
            status,
            date: shift.date,
            time_slot_code: timeCode,
            day_name: dayName,
            classroom_name: classroom?.name ?? null,
            classroom_color: classroom?.color ?? null,
            assigned_sub_name: assignedSubName,
          })
        })

        return {
          id: request.id,
          source_request_id: request.source_request_id || null,
          request_type: request.request_type,
          teacher_name: teacherName,
          start_date: request.start_date,
          end_date: request.end_date,
          reason,
          notes,
          classrooms,
          classroom_label:
            classrooms.length > 0 ? classrooms.map(c => c.name).join(', ') : 'Multiple',
          total_shifts: totalShifts,
          assigned_shifts: assignedShifts,
          uncovered_shifts: uncoveredShifts,
          partial_shifts: partialShifts,
          remaining_shifts: remainingShifts,
          status,
          shift_details: shiftDetails.length > 0 ? shiftDetails : undefined,
        }
      })
    )

    // Process staffing targets: use 12-week lookahead for run-length and suggestions (coverage range unchanged)
    const expandedDates = expandDateRangeWithTimeZone(startDate, staffingEndDateForFetch, timeZone)
    const dayNumberToDayOfWeekId = new Map<number, string>()
    scheduleCells.forEach((cell: any) => {
      const dow = cell.day_of_week as any
      if (dow?.day_number != null && dow?.id) {
        dayNumberToDayOfWeekId.set(dow.day_number, dow.id)
      }
    })

    // Precompute teacher contribution per (day_of_week_id, time_slot_id, classroom_id).
    // It is identical for every date with the same day-of-week, so compute once per slot.
    const teacherContribBySlot = new Map<string, number>()
    for (const cell of scheduleCells) {
      const slotKey = `${cell.day_of_week_id}|${cell.time_slot_id}|${cell.classroom_id}`
      if (teacherContribBySlot.has(slotKey)) continue
      const contrib = (teacherSchedules || []).reduce((sum, ts) => {
        if (
          ts.day_of_week_id === cell.day_of_week_id &&
          ts.time_slot_id === cell.time_slot_id &&
          ts.classroom_id === cell.classroom_id
        ) {
          return sum + (ts.is_floater ? 0.5 : 1)
        }
        return sum
      }, 0)
      teacherContribBySlot.set(slotKey, contrib)
    }

    const staffingTargetResults: any[] = []
    for (const dateEntry of expandedDates) {
      const dayOfWeekId = dayNumberToDayOfWeekId.get(dateEntry.day_number)
      if (!dayOfWeekId) continue

      for (const cell of scheduleCells) {
        const dayOfWeek = cell.day_of_week as any
        const timeSlot = cell.time_slot as any
        const classroom = cell.classroom as any
        const classGroups = cell.class_groups || []

        if (cell.day_of_week_id !== dayOfWeekId) continue

        const classGroupForRatio = classGroups.reduce((lowest: any, current: any) => {
          const currentMinAge = current.min_age ?? Infinity
          const lowestMinAge = lowest.min_age ?? Infinity
          return currentMinAge < lowestMinAge ? current : lowest
        })

        const totalEnrollment = cell._totalEnrollment ?? cell.enrollment_for_staffing
        const calculatedRequired =
          classGroupForRatio.required_ratio && totalEnrollment
            ? Math.ceil(totalEnrollment / classGroupForRatio.required_ratio)
            : null
        const calculatedPreferred =
          classGroupForRatio.preferred_ratio && totalEnrollment
            ? Math.ceil(totalEnrollment / classGroupForRatio.preferred_ratio)
            : null
        const requiredStaff =
          cell.required_staff_override != null ? cell.required_staff_override : calculatedRequired
        const preferredStaff =
          cell.preferred_staff_override != null
            ? cell.preferred_staff_override
            : calculatedPreferred

        const slotKey = `${cell.day_of_week_id}|${cell.time_slot_id}|${cell.classroom_id}`
        const teacherContrib = teacherContribBySlot.get(slotKey) ?? 0
        const tempCoverageCount = (staffingEventShifts || []).filter(
          (ses: any) =>
            ses.date === dateEntry.date &&
            ses.time_slot_id === cell.time_slot_id &&
            ses.classroom_id === cell.classroom_id
        ).length
        const totalScheduled = teacherContrib + tempCoverageCount

        let status: 'below_required' | 'below_preferred' | null = null
        if (requiredStaff !== null && totalScheduled < requiredStaff) {
          status = 'below_required'
        } else if (preferredStaff !== null && totalScheduled < preferredStaff) {
          status = 'below_preferred'
        }
        if (status === null) continue

        staffingTargetResults.push({
          id: `${cell.id}|${dateEntry.date}`,
          date: dateEntry.date,
          day_of_week_id: cell.day_of_week_id,
          day_name: dateEntry.day_name || dayOfWeek?.name || 'Unknown',
          day_number: dayOfWeek?.day_number ?? 0,
          day_order: dayOfWeek?.display_order ?? 0,
          time_slot_id: cell.time_slot_id,
          time_slot_code: timeSlot?.code || 'Unknown',
          time_slot_order: timeSlot?.display_order ?? 0,
          classroom_id: cell.classroom_id || '',
          classroom_name: classroom?.name || 'Unknown',
          classroom_color: classroom?.color || null,
          required_staff: requiredStaff,
          preferred_staff: preferredStaff,
          scheduled_staff: totalScheduled,
          status,
        })
      }
    }
    const processedStaffingTargets = staffingTargetResults

    // Process scheduled subs
    const processedScheduledSubs = (subAssignments || []).map((sa: any) => {
      const sub = sa.sub as any
      const teacher = sa.teacher as any
      const classroom = sa.classroom as any
      const dayOfWeek = sa.day_of_week as any
      const timeSlot = sa.time_slot as any

      const subName = sub
        ? getStaffDisplayName(sub, displayNameFormat) || 'Unknown Sub'
        : 'Unknown Sub'

      const teacherName = teacher
        ? getStaffDisplayName(teacher, displayNameFormat) || 'Unknown Teacher'
        : 'Unknown Teacher'

      return {
        id: sa.id,
        date: sa.date,
        day_name: dayOfWeek?.name || 'Unknown',
        time_slot_code: timeSlot?.code || 'Unknown',
        classroom_name: classroom?.name || 'Unknown',
        classroom_color: classroom?.color || null,
        notes: sa.notes,
        sub_name: subName,
        sub_id: sub?.id,
        teacher_name: teacherName,
        coverage_request_id: sa.coverage_request_shift?.coverage_request_id || null,
      }
    })

    // Calculate summary
    const summary = {
      absences: processedCoverageRequests.length,
      uncovered_shifts: processedCoverageRequests.reduce((sum, cr) => sum + cr.uncovered_shifts, 0),
      partially_covered_shifts: processedCoverageRequests.reduce(
        (sum, cr) => sum + cr.partial_shifts,
        0
      ),
      scheduled_subs: processedScheduledSubs.length,
    }

    return NextResponse.json({
      summary,
      coverage_requests: processedCoverageRequests,
      staffing_targets: processedStaffingTargets,
      scheduled_subs: processedScheduledSubs,
    })
  } catch (error) {
    console.error('Error in dashboard overview:', error)
    return createErrorResponse(error, 'Failed to fetch dashboard overview', 500)
  }
}
