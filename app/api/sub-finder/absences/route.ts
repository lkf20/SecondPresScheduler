import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildCoverageBadges, getCoverageStatus } from '@/lib/server/coverage/absence-status'
import { sortCoverageShifts, buildCoverageSegments } from '@/lib/server/coverage/coverage-summary'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const includePartiallyCovered = searchParams.get('include_partially_covered') === 'true'
    
    // Use unified API endpoint
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const timeOffRequestsUrl = `${baseUrl}/api/time-off-requests?status=active&include_detailed_shifts=true&include_classrooms=true&include_assignments=true`
    
    const timeOffRequestsResponse = await fetch(timeOffRequestsUrl, {
      headers: {
        'Cookie': request.headers.get('cookie') || '',
      },
    })
    
    if (!timeOffRequestsResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch time off requests' },
        { status: timeOffRequestsResponse.status }
      )
    }
    
    const timeOffRequestsResult = await timeOffRequestsResponse.json()
    const transformedRequests = timeOffRequestsResult.data || []

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
        status: detail.status === 'covered' ? 'fully_covered' : detail.status === 'partial' ? 'partially_covered' : 'uncovered',
        sub_name: detail.sub_name || null,
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
