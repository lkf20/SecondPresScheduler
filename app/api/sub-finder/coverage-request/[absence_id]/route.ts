import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTimeOffRequestById } from '@/lib/api/time-off'
import { getTimeOffShifts } from '@/lib/api/time-off-shifts'
import { createErrorResponse, getErrorMessage } from '@/lib/utils/errors'

/**
 * GET /api/sub-finder/coverage-request/[absence_id]
 * Get coverage_request_id and shift mappings for a time_off_request
 */
export async function GET(
  request: Request,
  { params }: { params?: { absence_id?: string } }
) {
  try {
    const absence_id =
      params?.absence_id || request.url.split('/').pop()?.split('?')[0]

    if (!absence_id) {
      return createErrorResponse('Missing absence_id', 'Missing absence_id', 400)
    }

    const supabase = await createClient()

    // Get time off request
    const timeOffRequest = await getTimeOffRequestById(absence_id)
    if (!timeOffRequest) {
      return createErrorResponse('Time off request not found', 404)
    }

    let coverageRequestId = (timeOffRequest as any).coverage_request_id
    if (!coverageRequestId) {
      const shifts = await getTimeOffShifts(absence_id)
      const totalShifts = shifts.length
      const startDate = (timeOffRequest as any).start_date
      const endDate = (timeOffRequest as any).end_date || startDate

      const { data: assignments, error: assignmentsError } = await supabase
        .from('sub_assignments')
        .select('date, time_slot_id')
        .eq('teacher_id', (timeOffRequest as any).teacher_id)
        .gte('date', startDate)
        .lte('date', endDate)

      if (assignmentsError) {
        console.error('Error fetching sub assignments:', assignmentsError)
      }

      const assignmentKeys = new Set(
        (assignments || []).map((assignment) => `${assignment.date}|${assignment.time_slot_id}`)
      )
      const coveredShifts = shifts.reduce((count, shift) => {
        const key = `${shift.date}|${shift.time_slot_id}`
        return assignmentKeys.has(key) ? count + 1 : count
      }, 0)

      const { data: newCoverageRequest, error: coverageError } = await supabase
        .from('coverage_requests')
        .insert({
          request_type: 'time_off',
          source_request_id: (timeOffRequest as any).id,
          teacher_id: (timeOffRequest as any).teacher_id,
          start_date: startDate,
          end_date: endDate,
          status: totalShifts > 0 && coveredShifts >= totalShifts ? 'filled' : 'open',
          total_shifts: totalShifts,
          covered_shifts: coveredShifts,
        })
        .select('id')
        .single()

      if (coverageError || !newCoverageRequest) {
        return createErrorResponse('Failed to create coverage request', 500)
      }

      coverageRequestId = newCoverageRequest.id

      const { error: updateError } = await supabase
        .from('time_off_requests')
        .update({ coverage_request_id: coverageRequestId })
        .eq('id', (timeOffRequest as any).id)

      if (updateError) {
        console.error('Error linking coverage request to time off request:', updateError)
      }

      if (shifts.length > 0) {
        const { data: scheduleRows, error: scheduleError } = await supabase
          .from('teacher_schedules')
          .select('day_of_week_id, time_slot_id, classroom_id, class_group_id')
          .eq('teacher_id', (timeOffRequest as any).teacher_id)

        if (scheduleError) {
          console.error('Error fetching teacher schedules:', scheduleError)
        }

        const scheduleMap = new Map<string, { classroom_id: string | null; class_group_id: string | null }>()
        ;(scheduleRows || []).forEach((row: any) => {
          const key = `${row.day_of_week_id}|${row.time_slot_id}`
          if (!scheduleMap.has(key)) {
            scheduleMap.set(key, { classroom_id: row.classroom_id || null, class_group_id: row.class_group_id || null })
          }
        })

        let fallbackClassroomId: string | null = null
        const { data: unknownClassroom } = await supabase
          .from('classrooms')
          .select('id')
          .eq('name', 'Unknown (needs review)')
          .maybeSingle()
        fallbackClassroomId = unknownClassroom?.id || null

        if (!fallbackClassroomId) {
          const { data: anyClassroom } = await supabase
            .from('classrooms')
            .select('id')
            .order('name', { ascending: true })
            .limit(1)
            .maybeSingle()
          fallbackClassroomId = anyClassroom?.id || null
        }

        if (!fallbackClassroomId) {
          return createErrorResponse('No classroom available for coverage shifts', 500)
        }

        const coverageShiftRows = shifts.map((shift: any) => {
          const key = `${shift.day_of_week_id}|${shift.time_slot_id}`
          const scheduleEntry = scheduleMap.get(key)
          return {
            coverage_request_id: coverageRequestId,
            date: shift.date,
            day_of_week_id: shift.day_of_week_id,
            time_slot_id: shift.time_slot_id,
            classroom_id: scheduleEntry?.classroom_id || fallbackClassroomId,
            class_group_id: scheduleEntry?.class_group_id || null,
            is_partial: shift.is_partial ?? false,
            start_time: shift.start_time || null,
            end_time: shift.end_time || null,
          }
        })

        const { error: shiftInsertError } = await supabase
          .from('coverage_request_shifts')
          .insert(coverageShiftRows)

        if (shiftInsertError) {
          console.error('Error creating coverage request shifts:', shiftInsertError)
        }
      }
    }

    // Get coverage_request_shifts
    const { data: coverageRequestShifts, error: shiftsError } = await supabase
      .from('coverage_request_shifts')
      .select('id, date, time_slot_id, classroom_id, time_slot:time_slots(code)')
      .eq('coverage_request_id', coverageRequestId)

    if (shiftsError) {
      console.error('Error fetching coverage_request_shifts:', shiftsError)
    }

    // Create a map: date|time_slot_code|classroom_id -> coverage_request_shift_id
    // Also create a simpler map: date|time_slot_code -> coverage_request_shift_id (for backward compatibility)
    const shiftMap = new Map<string, string>()
    const shiftMapSimple = new Map<string, string>()
    if (coverageRequestShifts) {
      coverageRequestShifts.forEach((shift: any) => {
        const key = `${shift.date}|${shift.time_slot?.code || ''}|${shift.classroom_id || ''}`
        const simpleKey = `${shift.date}|${shift.time_slot?.code || ''}`
        shiftMap.set(key, shift.id)
        // Use the first shift ID found for the simple key (for backward compatibility)
        if (!shiftMapSimple.has(simpleKey)) {
          shiftMapSimple.set(simpleKey, shift.id)
        }
      })
    }
    
    // Return both maps - the detailed one takes precedence
    const combinedMap = Object.fromEntries(shiftMap)
    // Add simple keys for backward compatibility
    Object.entries(Object.fromEntries(shiftMapSimple)).forEach(([key, value]) => {
      if (!combinedMap[key]) {
        combinedMap[key] = value
      }
    })

    return NextResponse.json({
      coverage_request_id: coverageRequestId,
      shift_map: combinedMap,
    })
  } catch (error) {
    console.error('Error fetching coverage request:', error)
    return createErrorResponse(getErrorMessage(error), 500)
  }
}
