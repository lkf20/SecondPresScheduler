import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import { createErrorResponse } from '@/lib/utils/errors'

export async function GET(request: NextRequest) {
  try {
    const schoolId = await getUserSchoolId()
    
    if (!schoolId) {
      return NextResponse.json(
        { error: 'User profile not found or missing school_id. Please ensure your profile is set up.' },
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

    const supabase = await createClient()

    // Get coverage requests in date range
    const { data: coverageRequests, error: coverageRequestsError } = await supabase
      .from('coverage_requests')
      .select(`
        id,
        teacher_id,
        start_date,
        end_date,
        request_type,
        source_request_id,
        status,
        total_shifts,
        covered_shifts,
        teacher:staff!coverage_requests_teacher_id_fkey(
          id,
          first_name,
          last_name,
          display_name
        )
      `)
      .eq('school_id', schoolId)
      .lte('start_date', endDate)
      .gte('end_date', startDate)
      .in('status', ['open', 'filled'])
      .order('start_date', { ascending: false })

    if (coverageRequestsError) {
      console.error('Error fetching coverage requests:', coverageRequestsError)
      return createErrorResponse(coverageRequestsError, 'Failed to fetch coverage requests', 500)
    }

    // Get time_off_requests for coverage requests that have source_request_id
    const sourceRequestIds = (coverageRequests || [])
      .filter(cr => cr.request_type === 'time_off' && cr.source_request_id)
      .map(cr => cr.source_request_id)
      .filter((id): id is string => id !== null)

    let timeOffRequestsMap = new Map<string, { reason: string | null; notes: string | null }>()
    
    if (sourceRequestIds.length > 0) {
      const { data: timeOffRequests, error: timeOffError } = await supabase
        .from('time_off_requests')
        .select('id, reason, notes')
        .in('id', sourceRequestIds)

      if (timeOffError) {
        console.error('Error fetching time_off_requests:', timeOffError)
        // Don't fail the whole request, just log the error
      } else {
        (timeOffRequests || []).forEach(tor => {
          timeOffRequestsMap.set(tor.id, {
            reason: tor.reason || null,
            notes: tor.notes || null,
          })
        })
      }
    }

    // Get coverage request shifts for these requests with classroom details
    const requestIds = (coverageRequests || []).map(cr => cr.id)
    let coverageRequestShifts: any[] = []
    
    if (requestIds.length > 0) {
      const { data: shifts, error: shiftsError } = await supabase
        .from('coverage_request_shifts')
        .select(`
          *,
          classroom:classrooms(
            id,
            name,
            color
          )
        `)
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
      .select(`
        id,
        date,
        day_of_week_id,
        time_slot_id,
        classroom_id,
        notes,
        sub_id,
        teacher_id,
        coverage_request_shift_id,
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
        )
      `)
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
      .select(`
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
          class_group:class_groups(
            id,
            name,
            min_age,
            max_age,
            required_ratio,
            preferred_ratio
          )
        )
      `)
      .eq('school_id', schoolId)
      .eq('is_active', true)

    if (scheduleCellsError) {
      console.error('Error fetching schedule cells:', scheduleCellsError)
      // If table doesn't exist, return empty array instead of failing
      if (scheduleCellsError.code === '42P01' || scheduleCellsError.message?.includes('does not exist')) {
        console.warn('schedule_cells table does not exist yet. Staffing targets will be empty.')
      } else {
        return createErrorResponse(scheduleCellsError, 'Failed to fetch schedule cells', 500)
      }
    }

    // Transform schedule cells to flatten class_groups array
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
    }).filter((cell: any) => 
      cell.is_active && 
      cell.class_groups && 
      cell.class_groups.length > 0 && 
      cell.enrollment_for_staffing !== null &&
      cell.enrollment_for_staffing !== undefined
    )

    // Get teacher schedules to count scheduled staff
    const { data: teacherSchedules, error: teacherSchedulesError } = await supabase
      .from('teacher_schedules')
      .select(`
        day_of_week_id,
        time_slot_id,
        classroom_id
      `)
      .eq('school_id', schoolId)

    if (teacherSchedulesError) {
      console.error('Error fetching teacher schedules:', teacherSchedulesError)
      return createErrorResponse(teacherSchedulesError, 'Failed to fetch teacher schedules', 500)
    }

    // Process coverage requests
    const processedCoverageRequests = (coverageRequests || []).map(request => {
      const teacher = request.teacher as any
      const teacherName = teacher?.display_name || 
        (teacher?.first_name && teacher?.last_name 
          ? `${teacher.first_name} ${teacher.last_name}` 
          : 'Unknown Teacher')

      // Get reason and notes from time_off_request if it exists
      const timeOffRequest = request.source_request_id && request.request_type === 'time_off'
        ? timeOffRequestsMap.get(request.source_request_id)
        : null
      const reason = timeOffRequest?.reason || null
      const notes = timeOffRequest?.notes || null

      // Get shifts for this request
      const requestShifts = coverageRequestShifts.filter(s => s.coverage_request_id === request.id)
      
      // Get sub assignments for these shifts using coverage_request_shift_id
      const shiftIds = new Set(requestShifts.map((s: any) => s.id))
      const assignedSubs = (subAssignments || []).filter((sa: any) => 
        sa.coverage_request_shift_id && shiftIds.has(sa.coverage_request_shift_id)
      )

      const totalShifts = requestShifts.length
      const assignedShifts = new Set(assignedSubs.map((sa: any) => 
        `${sa.date}|${sa.day_of_week_id}|${sa.time_slot_id}`
      )).size
      const uncoveredShifts = totalShifts - assignedShifts
      
      // Check for partial coverage (subs assigned but not all shifts covered)
      const partialShifts = totalShifts > 0 && assignedShifts > 0 && assignedShifts < totalShifts ? 1 : 0
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
      const classroomsMap = new Map<string, { id: string; name: string; color: string | null }>()
      requestShifts.forEach((shift: any) => {
        if (shift.classroom_id && shift.classroom) {
          const classroom = shift.classroom as any
          if (!classroomsMap.has(shift.classroom_id)) {
            classroomsMap.set(shift.classroom_id, {
              id: shift.classroom_id,
              name: classroom.name || 'Unknown',
              color: classroom.color || null,
            })
          }
        }
      })
      const classrooms = Array.from(classroomsMap.values())

      return {
        id: request.id,
        teacher_name: teacherName,
        start_date: request.start_date,
        end_date: request.end_date,
        reason,
        notes,
        classrooms,
        classroom_label: classrooms.length > 0 
          ? classrooms.map(c => c.name).join(', ')
          : 'Multiple',
        total_shifts: totalShifts,
        assigned_shifts: assignedShifts,
        uncovered_shifts: uncoveredShifts,
        partial_shifts: partialShifts,
        remaining_shifts: remainingShifts,
        status,
      }
    })

    // Process staffing targets using schedule_cells (same logic as weekly schedule)
    const processedStaffingTargets = scheduleCells.map((cell: any) => {
      const dayOfWeek = cell.day_of_week as any
      const timeSlot = cell.time_slot as any
      const classroom = cell.classroom as any
      const classGroups = cell.class_groups || []

      // Find class group with lowest min_age for ratio calculation (same as weekly schedule)
      const classGroupForRatio = classGroups.reduce((lowest: any, current: any) => {
        const currentMinAge = current.min_age ?? Infinity
        const lowestMinAge = lowest.min_age ?? Infinity
        return currentMinAge < lowestMinAge ? current : lowest
      })

      // Calculate required and preferred teachers based on enrollment and ratios
      // Formula: Math.ceil(enrollment / ratio) - same as weekly schedule
      const requiredStaff = classGroupForRatio.required_ratio && cell.enrollment_for_staffing
        ? Math.ceil(cell.enrollment_for_staffing / classGroupForRatio.required_ratio)
        : null
      const preferredStaff = classGroupForRatio.preferred_ratio && cell.enrollment_for_staffing
        ? Math.ceil(cell.enrollment_for_staffing / classGroupForRatio.preferred_ratio)
        : null

      // Count scheduled staff for this slot (regular teachers)
      const scheduledStaff = (teacherSchedules || []).filter(ts =>
        ts.day_of_week_id === cell.day_of_week_id &&
        ts.time_slot_id === cell.time_slot_id &&
        ts.classroom_id === cell.classroom_id
      ).length

      // Also count sub assignments for this slot
      const subCount = (subAssignments || []).filter((sa: any) =>
        sa.day_of_week_id === cell.day_of_week_id &&
        sa.time_slot_id === cell.time_slot_id &&
        sa.classroom_id === cell.classroom_id
      ).length

      const totalScheduled = scheduledStaff + subCount

      // Determine status - only include if actually below required or below preferred
      let status: 'below_required' | 'below_preferred' | null = null
      if (requiredStaff !== null && totalScheduled < requiredStaff) {
        status = 'below_required'
      } else if (preferredStaff !== null && totalScheduled < preferredStaff) {
        status = 'below_preferred'
      }

      // Only return if there's a staffing issue
      if (status === null) {
        return null
      }

      return {
        id: cell.id,
        day_of_week_id: cell.day_of_week_id,
        day_name: dayOfWeek?.name || 'Unknown',
        day_number: dayOfWeek?.day_number || 0,
        day_order: dayOfWeek?.display_order || 0,
        time_slot_id: cell.time_slot_id,
        time_slot_code: timeSlot?.code || 'Unknown',
        time_slot_order: timeSlot?.display_order || 0,
        classroom_id: cell.classroom_id || '',
        classroom_name: classroom?.name || 'Unknown',
        classroom_color: classroom?.color || null,
        required_staff: requiredStaff,
        preferred_staff: preferredStaff,
        scheduled_staff: totalScheduled,
        status,
      }
    }).filter((target: any): target is NonNullable<typeof target> => target !== null)

    // Process scheduled subs
    const processedScheduledSubs = (subAssignments || []).map((sa: any) => {
      const sub = sa.sub as any
      const teacher = sa.teacher as any
      const classroom = sa.classroom as any
      const dayOfWeek = sa.day_of_week as any
      const timeSlot = sa.time_slot as any

      const subName = sub?.display_name || 
        (sub?.first_name && sub?.last_name 
          ? `${sub.first_name} ${sub.last_name}` 
          : 'Unknown Sub')
      
      const teacherName = teacher?.display_name || 
        (teacher?.first_name && teacher?.last_name 
          ? `${teacher.first_name} ${teacher.last_name}` 
          : 'Unknown Teacher')

      return {
        id: sa.id,
        date: sa.date,
        day_name: dayOfWeek?.name || 'Unknown',
        time_slot_code: timeSlot?.code || 'Unknown',
        classroom_name: classroom?.name || 'Unknown',
        classroom_color: classroom?.color || null,
        notes: sa.notes,
        sub_name: subName,
        teacher_name: teacherName,
      }
    })

    // Calculate summary
    const summary = {
      absences: processedCoverageRequests.length,
      uncovered_shifts: processedCoverageRequests.reduce((sum, cr) => sum + cr.uncovered_shifts, 0),
      partially_covered_shifts: processedCoverageRequests.reduce((sum, cr) => sum + cr.partial_shifts, 0),
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
