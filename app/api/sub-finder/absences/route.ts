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
          .select('*, time_slot:time_slots(*), day_of_week:days_of_week(*), classroom:classrooms(*)')
          .eq('teacher_id', request.teacher_id)
          .gte('date', startDate)
          .lte('date', endDate)
        
        if (subError) {
          console.error('Error fetching sub assignments:', subError)
        }
        
        // Create a map of shift coverage: date + time_slot_id -> coverage status
        const coverageMap = new Map<string, 'uncovered' | 'partially_covered' | 'fully_covered'>()
        
        // Initialize all shifts as uncovered
        shifts.forEach((shift) => {
          const key = `${shift.date}|${shift.time_slot_id}`
          coverageMap.set(key, 'uncovered')
        })
        
        // Check sub assignments to determine coverage
        if (subAssignments) {
          subAssignments.forEach((assignment) => {
            const key = `${assignment.date}|${assignment.time_slot_id}`
            if (coverageMap.has(key)) {
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
        
        // Build shift details with coverage status
        const shiftDetails = shifts.map((shift) => {
          const key = `${shift.date}|${shift.time_slot_id}`
          const status = coverageMap.get(key) || 'uncovered'
          
          // Get class and classroom info if available from schedule cells
          // For now, we'll leave these as null and can enhance later
          return {
            id: shift.id,
            date: shift.date,
            day_name: shift.day_of_week?.name || '',
            time_slot_code: shift.time_slot?.code || '',
            class_name: null, // TODO: Get from schedule cells
            classroom_name: null, // TODO: Get from schedule cells
            status,
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

