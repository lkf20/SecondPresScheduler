import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTimeOffRequests } from '@/lib/api/time-off'
import { getTimeOffShifts } from '@/lib/api/time-off-shifts'
import { transformTimeOffCardData, type TimeOffCardData } from '@/lib/utils/time-off-card-data'
import { createErrorResponse } from '@/lib/utils/errors'

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
    const searchParams = request.nextUrl.searchParams
    
    // Parse filters
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const statusParam = searchParams.get('status')
    const statuses = statusParam ? statusParam.split(',').map(s => s.trim()) : ['active']
    const teacherId = searchParams.get('teacher_id')
    const classroomId = searchParams.get('classroom_id')
    const coverageStatusParam = searchParams.get('coverage_status')
    const coverageStatuses = coverageStatusParam ? coverageStatusParam.split(',').map(s => s.trim()) : null
    
    // Parse options
    const includeDetailedShifts = searchParams.get('include_detailed_shifts') === 'true'
    const includeClassrooms = searchParams.get('include_classrooms') !== 'false'
    const includeAssignments = searchParams.get('include_assignments') !== 'false'
    
    const supabase = await createClient()
    
    // Fetch time off requests
    const timeOffRequests = await getTimeOffRequests({ statuses: statuses as any[] })
    
    // Log for debugging - check for Anupa B.
    console.log('[Time Off Requests] Total requests fetched:', timeOffRequests.length)
    const anupaRequest = timeOffRequests.find((req: any) => {
      const teacher = req.teacher
      const name = teacher?.display_name || `${teacher?.first_name} ${teacher?.last_name}`.trim() || ''
      return name.toLowerCase().includes('anupa') || name.toLowerCase().includes('b.')
    })
    if (anupaRequest) {
      console.log('[Time Off Requests] Found Anupa B. request:', {
        id: anupaRequest.id,
        teacher_id: anupaRequest.teacher_id,
        start_date: anupaRequest.start_date,
        end_date: anupaRequest.end_date,
        status: anupaRequest.status,
        teacher_name: anupaRequest.teacher?.display_name || `${anupaRequest.teacher?.first_name} ${anupaRequest.teacher?.last_name}`.trim(),
      })
    } else {
      console.log('[Time Off Requests] Anupa B. request NOT found in database query')
      console.log('[Time Off Requests] Status filter:', statuses)
      console.log('[Time Off Requests] Sample teacher names:', timeOffRequests.slice(0, 5).map((r: any) => 
        r.teacher?.display_name || `${r.teacher?.first_name} ${r.teacher?.last_name}`.trim()
      ))
    }
    
    // Apply date range filter
    const getOverlap = (reqStart: string, reqEnd: string, rangeStart: string | null, rangeEnd: string | null) => {
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
      filteredRequests = filteredRequests.filter((request) =>
        getOverlap(request.start_date, request.end_date || request.start_date, startDate, endDate)
      )
    }
    
    // Apply teacher filter
    if (teacherId) {
      filteredRequests = filteredRequests.filter((request) => request.teacher_id === teacherId)
    }
    
    // Fetch shifts for all requests
    const requestIds = filteredRequests.map((r) => r.id)
    const teacherIds = Array.from(new Set(filteredRequests.map((r) => r.teacher_id).filter(Boolean)))
    
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
        .select('teacher_id, day_of_week_id, time_slot_id, classroom:classrooms(id, name, color), class:class_groups(name)')
        .in('teacher_id', teacherIds)
      
      ;(teacherSchedules || []).forEach((schedule: any) => {
        const key = `${schedule.teacher_id}|${schedule.day_of_week_id}|${schedule.time_slot_id}`
        const entry =
          scheduleLookup.get(key) || {
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
      filteredRequests.map(async (request) => {
        // Get shifts
        let shifts
        try {
          shifts = await getTimeOffShifts(request.id)
        } catch (error) {
          console.error(`Error fetching shifts for time off request ${request.id}:`, error)
          shifts = []
        }
        
        // Get assignments if needed
        let assignments: any[] = []
        if (includeAssignments && shifts.length > 0) {
          const requestStartDate = request.start_date
          const requestEndDate = request.end_date || request.start_date
          
          const { data: subAssignments } = await supabase
            .from('sub_assignments')
            .select('date, time_slot_id, is_partial, assignment_type, sub:staff!sub_assignments_sub_id_fkey(first_name, last_name, display_name)')
            .eq('teacher_id', request.teacher_id)
            .gte('date', requestStartDate)
            .lte('date', requestEndDate)
          
          assignments = subAssignments || []
        }
        
        // Build classroom list
        const classroomMap = new Map<string, { id: string; name: string; color: string | null }>()
        if (includeClassrooms) {
          shifts.forEach((shift) => {
            const scheduleKey = `${request.teacher_id}|${shift.day_of_week_id}|${shift.time_slot_id}`
            const scheduleEntry = scheduleLookup.get(scheduleKey)
            if (scheduleEntry?.classrooms?.size) {
              scheduleEntry.classrooms.forEach((classroom) => {
                classroomMap.set(classroom.id || classroom.name, classroom)
              })
            }
          })
        }
        const classrooms = Array.from(classroomMap.values())
        
        // Apply classroom filter if specified
        if (classroomId && classrooms.length > 0) {
          const hasClassroom = classrooms.some((c) => c.id === classroomId)
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
            teacher: teacher ? {
              first_name: teacher.first_name || null,
              last_name: teacher.last_name || null,
              display_name: teacher.display_name || null,
            } : null,
          },
          shifts.map((shift) => ({
            id: shift.id,
            date: shift.date,
            day_of_week_id: shift.day_of_week_id,
            time_slot_id: shift.time_slot_id,
            day_of_week: shift.day_of_week,
            time_slot: shift.time_slot,
          })),
          assignments.map((assignment) => ({
            date: assignment.date,
            time_slot_id: assignment.time_slot_id,
            is_partial: assignment.is_partial,
            assignment_type: assignment.assignment_type || null,
            sub: assignment.sub as any,
          })),
          classrooms,
          {
            includeDetailedShifts,
            formatDay,
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
      filteredResults = filteredResults.filter((result) =>
        coverageStatuses.includes(result.status)
      )
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
