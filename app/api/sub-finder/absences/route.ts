import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTimeOffRequests } from '@/lib/api/time-off'
import { getTimeOffShifts } from '@/lib/api/time-off-shifts'

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
      { classrooms: Set<string>; classes: Set<string> }
    >()

    if (teacherIds.length > 0) {
      const { data: teacherSchedules, error: scheduleError } = await supabase
        .from('teacher_schedules')
        .select('teacher_id, day_of_week_id, time_slot_id, classroom:classrooms(name), class:class_groups(name)')
        .in('teacher_id', teacherIds)

      if (scheduleError) {
        console.error('Error fetching teacher schedules:', scheduleError)
      } else {
        ;(teacherSchedules || []).forEach((schedule: any) => {
          const key = `${schedule.teacher_id}|${schedule.day_of_week_id}|${schedule.time_slot_id}`
          const entry = scheduleLookup.get(key) || { classrooms: new Set<string>(), classes: new Set<string>() }
          if (schedule.classroom?.name) entry.classrooms.add(schedule.classroom.name)
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
        const shiftDetails = shifts.map((shift) => {
          const key = `${shift.date}|${shift.time_slot_id}`
          const status = coverageMap.get(key) || 'uncovered'
          const assignment = assignmentMap.get(key)
          const scheduleKey = `${request.teacher_id}|${shift.day_of_week_id}|${shift.time_slot_id}`
          const scheduleEntry = scheduleLookup.get(scheduleKey)
          const classroom_name = scheduleEntry?.classrooms?.size
            ? Array.from(scheduleEntry.classrooms).join(', ')
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
        const uncovered = shiftDetails.filter(s => s.status === 'uncovered').length
        const partially_covered = shiftDetails.filter(s => s.status === 'partially_covered').length
        const fully_covered = shiftDetails.filter(s => s.status === 'fully_covered').length
        const total = shiftDetails.length
        
        // Get teacher name
        const teacher = (request as any).teacher
        const teacher_name = teacher?.display_name || 
                            (teacher?.first_name && teacher?.last_name 
                              ? `${teacher.first_name} ${teacher.last_name}` 
                              : teacher?.first_name || 'Unknown Teacher')
        
        return {
          id: request.id,
          teacher_id: request.teacher_id,
          teacher_name,
          start_date: request.start_date,
          end_date: request.end_date,
          reason: request.reason,
          shifts: {
            total,
            uncovered,
            partially_covered,
            fully_covered,
            shift_details: shiftDetails,
          },
        }
      })
    )
    
    // Filter absences based on includePartiallyCovered flag
    // If false, only show absences with uncovered shifts (exclude fully covered)
    // If true, show absences with uncovered OR partially covered shifts (exclude fully covered)
    // Always show absences with no shifts (newly created)
    let filteredAbsences = absencesWithCoverage.filter(
      (absence) => {
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
    
    // Sort by start date (most recent first)
    filteredAbsences.sort((a, b) => {
      const dateA = new Date(a.start_date).getTime()
      const dateB = new Date(b.start_date).getTime()
      return dateB - dateA
    })
    
    return NextResponse.json(filteredAbsences)
  } catch (error: any) {
    console.error('Error fetching absences:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
