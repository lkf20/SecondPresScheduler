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

    // Get staffing rules
    const { data: staffingRules, error: staffingRulesError } = await supabase
      .from('staffing_rules')
      .select(`
        id,
        class_id,
        day_of_week_id,
        time_slot_id,
        required_teachers,
        preferred_teachers,
        day_of_week:days_of_week(
          id,
          name,
          day_number,
          day_order
        ),
        time_slot:time_slots(
          id,
          code,
          time_slot_order
        ),
        class:class_groups(
          id,
          name
        )
      `)
      .eq('school_id', schoolId)

    if (staffingRulesError) {
      console.error('Error fetching staffing rules:', staffingRulesError)
      return createErrorResponse(staffingRulesError, 'Failed to fetch staffing rules', 500)
    }

    // Get class-classroom mappings for the staffing rules
    const staffingRuleIds = (staffingRules || []).map(r => ({
      class_id: r.class_id,
      day_of_week_id: r.day_of_week_id,
      time_slot_id: r.time_slot_id,
    }))

    let classClassroomMappings: any[] = []
    if (staffingRuleIds.length > 0) {
      // Build a query to get all relevant mappings
      const classIds = [...new Set(staffingRuleIds.map(r => r.class_id))]
      const dayIds = [...new Set(staffingRuleIds.map(r => r.day_of_week_id))]
      const timeSlotIds = [...new Set(staffingRuleIds.map(r => r.time_slot_id))]

      const { data: mappings, error: mappingsError } = await supabase
        .from('class_classroom_mappings')
        .select(`
          class_id,
          day_of_week_id,
          time_slot_id,
          classroom:classrooms(
            id,
            name,
            color
          )
        `)
        .in('class_id', classIds)
        .in('day_of_week_id', dayIds)
        .in('time_slot_id', timeSlotIds)

      if (mappingsError) {
        console.error('Error fetching class-classroom mappings:', mappingsError)
        // Continue without mappings - we'll handle missing classrooms gracefully
      } else {
        classClassroomMappings = mappings || []
      }
    }

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

    // Process staffing targets
    const processedStaffingTargets = (staffingRules || []).map(rule => {
      const dayOfWeek = rule.day_of_week as any
      const timeSlot = rule.time_slot as any
      const classGroup = rule.class as any

      // Find the classroom mapping for this rule
      const mapping = classClassroomMappings.find(
        (m: any) =>
          m.class_id === rule.class_id &&
          m.day_of_week_id === rule.day_of_week_id &&
          m.time_slot_id === rule.time_slot_id
      )
      const classroom = mapping?.classroom as any

      // Count scheduled staff for this rule
      const scheduledStaff = (teacherSchedules || []).filter(ts =>
        ts.day_of_week_id === rule.day_of_week_id &&
        ts.time_slot_id === rule.time_slot_id &&
        ts.classroom_id === classroom?.id
      ).length

      // Also count sub assignments for this slot
      const subCount = (subAssignments || []).filter((sa: any) =>
        sa.day_of_week_id === rule.day_of_week_id &&
        sa.time_slot_id === rule.time_slot_id &&
        sa.classroom_id === classroom?.id
      ).length

      const totalScheduled = scheduledStaff + subCount

      // Determine status
      let status: 'below_required' | 'below_preferred'
      if (rule.required_teachers && totalScheduled < rule.required_teachers) {
        status = 'below_required'
      } else if (rule.preferred_teachers && totalScheduled < rule.preferred_teachers) {
        status = 'below_preferred'
      } else {
        status = 'below_preferred' // Default, but should not show if above preferred
      }

      return {
        id: rule.id,
        day_of_week_id: rule.day_of_week_id,
        day_name: dayOfWeek?.name || 'Unknown',
        day_number: dayOfWeek?.day_number || 0,
        day_order: dayOfWeek?.day_order || 0,
        time_slot_id: rule.time_slot_id,
        time_slot_code: timeSlot?.code || 'Unknown',
        time_slot_order: timeSlot?.time_slot_order || 0,
        classroom_id: classroom?.id || '',
        classroom_name: classroom?.name || classGroup?.name || 'Unknown',
        classroom_color: classroom?.color || null,
        required_staff: rule.required_teachers,
        preferred_staff: rule.preferred_teachers,
        scheduled_staff: totalScheduled,
        status,
      }
    }).filter(target => 
      target.status === 'below_required' || 
      (target.status === 'below_preferred' && target.preferred_staff && target.scheduled_staff < target.preferred_staff)
    )

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
