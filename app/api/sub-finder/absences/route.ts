import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTimeOffRequests } from '@/lib/api/time-off'
import { getTimeOffShifts } from '@/lib/api/time-off-shifts'
import { buildCoverageBadges, getCoverageStatus } from '@/lib/server/coverage/absence-status'
import { sortCoverageShifts, buildCoverageSegments } from '@/lib/server/coverage/coverage-summary'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const includePartiallyCovered = searchParams.get('include_partially_covered') === 'true'
    
    const supabase = await createClient()
    
    // Fetch all time off requests with teacher info
    const timeOffRequests = await getTimeOffRequests()

    const teacherIds = Array.from(
      new Set(
        timeOffRequests
          .map((request) => request.teacher_id)
          .filter((id): id is string => Boolean(id))
      )
    )

    const scheduleLookup = new Map<
      string,
      {
        classrooms: Map<string, { id: string; name: string; color: string | null }>
        classes: Set<string>
      }
    >()

    if (teacherIds.length > 0) {
      const { data: teacherSchedules, error: scheduleError } = await supabase
        .from('teacher_schedules')
        .select('teacher_id, day_of_week_id, time_slot_id, classroom:classrooms(id, name, color), class:class_groups(name)')
        .in('teacher_id', teacherIds)

      if (scheduleError) {
        console.error('Error fetching teacher schedules:', scheduleError)
      } else {
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
    }
    
    // For each request, get shifts and check coverage
    const absencesWithCoverage = await Promise.all(
      timeOffRequests.map(async (request) => {
        // Get all shifts for this time off request
        let shifts
        try {
          shifts = await getTimeOffShifts(request.id)
        } catch (error) {
          console.error(`Error fetching shifts for time off request ${request.id}:`, error)
          shifts = []
        }
        
        // Get all sub assignments for this teacher in the date range
        const startDate = request.start_date
        const endDate = request.end_date || request.start_date
        
        const { data: subAssignments, error: subError } = await supabase
          .from('sub_assignments')
          .select(`
            *,
            time_slot:time_slots(*),
            day_of_week:days_of_week(*),
            classroom:classrooms(*),
            sub:staff!sub_assignments_sub_id_fkey(first_name, last_name, display_name)
          `)
          .eq('teacher_id', request.teacher_id)
          .gte('date', startDate)
          .lte('date', endDate)
        
        if (subError) {
          console.error('Error fetching sub assignments:', subError)
        }
        
        // Create a map of shift coverage: date + time_slot_id -> coverage status
        const coverageMap = new Map<string, 'uncovered' | 'partially_covered' | 'fully_covered'>()
        
        // Create a map of assignments with sub info: date + time_slot_id -> {sub_name, is_partial}
        const assignmentMap = new Map<string, { sub_name: string; is_partial: boolean }>()
        
        // Initialize all shifts as uncovered
        shifts.forEach((shift) => {
          const key = `${shift.date}|${shift.time_slot_id}`
          coverageMap.set(key, 'uncovered')
        })
        
        // Check sub assignments to determine coverage and store sub info
        if (subAssignments) {
          subAssignments.forEach((assignment) => {
            const key = `${assignment.date}|${assignment.time_slot_id}`
            if (coverageMap.has(key)) {
              // Get sub name
              const sub = assignment.sub as any
              const sub_name = sub?.display_name || 
                              (sub?.first_name && sub?.last_name 
                                ? `${sub.first_name} ${sub.last_name}` 
                                : 'Unknown Sub')
              
              // Store assignment info
              assignmentMap.set(key, {
                sub_name,
                is_partial: assignment.is_partial || false,
              })
              
              // Check if this assignment covers the shift
              // If it's a partial sub, mark as partially covered
              // Otherwise, mark as fully covered
              if (assignment.is_partial) {
                coverageMap.set(key, 'partially_covered')
              } else {
                coverageMap.set(key, 'fully_covered')
              }
            }
          })
        }
        
        // Build shift details with coverage status and sub info
        const classroomMap = new Map<string, { id: string; name: string; color: string | null }>()

        const shiftDetails = shifts.map((shift) => {
          const key = `${shift.date}|${shift.time_slot_id}`
          const status = coverageMap.get(key) || 'uncovered'
          const assignment = assignmentMap.get(key)
          const scheduleKey = `${request.teacher_id}|${shift.day_of_week_id}|${shift.time_slot_id}`
          const scheduleEntry = scheduleLookup.get(scheduleKey)
          if (scheduleEntry?.classrooms?.size) {
            scheduleEntry.classrooms.forEach((classroom) => {
              classroomMap.set(classroom.id || classroom.name, classroom)
            })
          }
          const classroom_name = scheduleEntry?.classrooms?.size
            ? Array.from(scheduleEntry.classrooms.values()).map((classroom) => classroom.name).join(', ')
            : null
          const class_name = scheduleEntry?.classes?.size
            ? Array.from(scheduleEntry.classes).join(', ')
            : null
          
          return {
            id: shift.id,
            date: shift.date,
            day_name: shift.day_of_week?.name || '',
            time_slot_code: shift.time_slot?.code || '',
            class_name,
            classroom_name,
            status,
            sub_name: assignment?.sub_name || null, // Add sub name for assigned shifts
            is_partial: assignment?.is_partial || false, // Add partial flag
          }
        })
        
        // Count coverage status
        const uncovered = shiftDetails.filter((s) => s.status === 'uncovered').length
        const partially_covered = shiftDetails.filter((s) => s.status === 'partially_covered').length
        const fully_covered = shiftDetails.filter((s) => s.status === 'fully_covered').length
        const total = shiftDetails.length
        
        // Get teacher name
        const teacher = (request as any).teacher
        const teacher_name = teacher?.display_name || 
                            (teacher?.first_name && teacher?.last_name 
                              ? `${teacher.first_name} ${teacher.last_name}` 
                              : teacher?.first_name || 'Unknown Teacher')
        
        const classrooms = Array.from(classroomMap.values())
        const coverage_status = getCoverageStatus({
          uncovered,
          partiallyCovered: partially_covered,
        })
        const coverage_badges = buildCoverageBadges({
          uncovered,
          partiallyCovered: partially_covered,
          fullyCovered: fully_covered,
        })

        const sortedShiftDetails = sortCoverageShifts(shiftDetails)
        const coverageSegments = buildCoverageSegments(sortedShiftDetails)

        return {
          id: request.id,
          teacher_id: request.teacher_id,
          teacher_name,
          start_date: request.start_date,
          end_date: request.end_date,
          reason: request.reason,
          classrooms,
          coverage_status,
          coverage_badges,
          shifts: {
            total,
            uncovered,
            partially_covered,
            fully_covered,
            shift_details: shiftDetails,
            shift_details_sorted: sortedShiftDetails,
            coverage_segments: coverageSegments,
          },
        }
      })
    )
    
    const today = new Date()
    const todayString = today.toISOString().slice(0, 10)

    // Filter absences based on includePartiallyCovered flag
    // If false, only show absences with uncovered shifts (exclude fully covered)
    // If true, show absences with uncovered OR partially covered shifts (exclude fully covered)
    // Always show absences with no shifts (newly created)
    const filteredAbsences = absencesWithCoverage.filter(
      (absence) => {
        const startDate = absence.start_date
        const endDate = absence.end_date || absence.start_date
        if (startDate < todayString && endDate < todayString) {
          return false
        }
        // Always show if there are no shifts (newly created time off)
        if (absence.shifts.total === 0) return true
        
        // If includePartiallyCovered is false, only show uncovered
        if (!includePartiallyCovered) {
          return absence.shifts.uncovered > 0
        }
        
        // If includePartiallyCovered is true, show uncovered or partially covered
        return absence.shifts.uncovered > 0 || absence.shifts.partially_covered > 0
      }
    )
    
    const sortKey = (absence: any) => {
      const startDate = absence.start_date
      return startDate < todayString ? todayString : startDate
    }

    // Sort by closest to present (earliest upcoming/ongoing first)
    filteredAbsences.sort((a, b) => {
      const dateA = sortKey(a)
      const dateB = sortKey(b)
      if (dateA === dateB) {
        return a.start_date.localeCompare(b.start_date)
      }
      return dateA.localeCompare(dateB)
    })
    
    return NextResponse.json(filteredAbsences)
  } catch (error: any) {
    console.error('Error fetching absences:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
