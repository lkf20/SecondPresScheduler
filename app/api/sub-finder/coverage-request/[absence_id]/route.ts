import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTimeOffRequestById } from '@/lib/api/time-off'
import { createErrorResponse, getErrorMessage } from '@/lib/utils/errors'

/**
 * GET /api/sub-finder/coverage-request/[absence_id]
 * Get coverage_request_id and shift mappings for a time_off_request
 */
export async function GET(
  { params }: { params: Promise<{ absence_id: string }> }
) {
  try {
    const { absence_id } = await params

    if (!absence_id) {
      return createErrorResponse('Missing absence_id', 400)
    }

    const supabase = await createClient()

    // Get time off request
    const timeOffRequest = await getTimeOffRequestById(absence_id)
    if (!timeOffRequest) {
      return createErrorResponse('Time off request not found', 404)
    }

    // Get coverage_request_id
    const coverageRequestId = (timeOffRequest as any).coverage_request_id
    if (!coverageRequestId) {
      return createErrorResponse('Coverage request not found for this absence', 404)
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
