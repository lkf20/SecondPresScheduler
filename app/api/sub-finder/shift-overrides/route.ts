import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createErrorResponse } from '@/lib/utils/errors'

type ShiftOverridePayload = {
  coverage_request_id: string
  selected_shift_keys: string[]
  override_shift_keys: string[]
  available_shift_keys: string[]
  unavailable_shift_keys: string[]
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<ShiftOverridePayload>
    const coverageRequestId = body.coverage_request_id

    if (!coverageRequestId) {
      return createErrorResponse('Missing coverage_request_id', 400)
    }

    const selectedShiftKeys = new Set(Array.isArray(body.selected_shift_keys) ? body.selected_shift_keys : [])
    const overrideShiftKeys = new Set(Array.isArray(body.override_shift_keys) ? body.override_shift_keys : [])
    const availableShiftKeys = new Set(Array.isArray(body.available_shift_keys) ? body.available_shift_keys : [])
    const unavailableShiftKeys = new Set(Array.isArray(body.unavailable_shift_keys) ? body.unavailable_shift_keys : [])

    const supabase = await createClient()
    const { data: shifts, error } = await supabase
      .from('coverage_request_shifts')
      .select('id, date, time_slots:time_slot_id(code)')
      .eq('coverage_request_id', coverageRequestId)

    if (error) {
      return createErrorResponse(error, 'Failed to fetch coverage request shifts', 500)
    }

    const shiftIdMap = new Map<string, string>()
    ;(shifts || []).forEach((shift: any) => {
      const timeSlot = Array.isArray(shift.time_slots) ? shift.time_slots[0] : shift.time_slots
      const timeSlotCode = timeSlot?.code || ''
      if (!shift.date || !timeSlotCode) return
      shiftIdMap.set(`${shift.date}|${timeSlotCode}`, shift.id)
    })

    const shiftOverrides: Array<{
      coverage_request_shift_id: string
      selected: boolean
      override_availability: boolean
    }> = []
    const selectedShiftIds: string[] = []

    availableShiftKeys.forEach((key) => {
      const shiftId = shiftIdMap.get(key)
      if (!shiftId) return
      const selected = selectedShiftKeys.has(key)
      shiftOverrides.push({
        coverage_request_shift_id: shiftId,
        selected,
        override_availability: false,
      })
      if (selected) {
        selectedShiftIds.push(shiftId)
      }
    })

    unavailableShiftKeys.forEach((key) => {
      const shiftId = shiftIdMap.get(key)
      if (!shiftId) return
      const override = overrideShiftKeys.has(key)
      const selected = selectedShiftKeys.has(key) && override
      shiftOverrides.push({
        coverage_request_shift_id: shiftId,
        selected,
        override_availability: override,
      })
      if (selected) {
        selectedShiftIds.push(shiftId)
      }
    })

    return NextResponse.json({
      shift_overrides: shiftOverrides,
      selected_shift_ids: selectedShiftIds,
    })
  } catch (error) {
    return createErrorResponse(error, 'Failed to resolve shift overrides', 500, 'POST /api/sub-finder/shift-overrides')
  }
}
