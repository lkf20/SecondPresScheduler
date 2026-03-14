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

    const selectedShiftKeys = new Set(
      Array.isArray(body.selected_shift_keys) ? body.selected_shift_keys : []
    )
    const overrideShiftKeys = new Set(
      Array.isArray(body.override_shift_keys) ? body.override_shift_keys : []
    )
    const availableShiftKeys = new Set(
      Array.isArray(body.available_shift_keys) ? body.available_shift_keys : []
    )
    const unavailableShiftKeys = new Set(
      Array.isArray(body.unavailable_shift_keys) ? body.unavailable_shift_keys : []
    )

    const supabase = await createClient()
    const { data: shifts, error } = await supabase
      .from('coverage_request_shifts')
      .select('id, date, time_slot_id, time_slots:time_slot_id(code)')
      .eq('coverage_request_id', coverageRequestId)

    if (error) {
      return createErrorResponse(error, 'Failed to fetch coverage request shifts', 500)
    }

    // Key -> shift ids (array for floater: multiple shifts per date|slot)
    const shiftIdMap = new Map<string, string[]>()
    ;(shifts || []).forEach((shift: any) => {
      const timeSlot = Array.isArray(shift.time_slots) ? shift.time_slots[0] : shift.time_slots
      const timeSlotCode = timeSlot?.code || ''
      if (!shift.date || !timeSlotCode) return
      const key = `${shift.date}|${timeSlotCode}`
      if (!shiftIdMap.has(key)) shiftIdMap.set(key, [])
      shiftIdMap.get(key)!.push(shift.id)
    })

    // Group shift ids by (date, time_slot_id) to find floater slots (multiple rooms per slot)
    const slotKeyToShiftIds = new Map<string, string[]>()
    ;(shifts || []).forEach((shift: any) => {
      if (!shift.date || !shift.time_slot_id) return
      const key = `${shift.date}|${shift.time_slot_id}`
      if (!slotKeyToShiftIds.has(key)) slotKeyToShiftIds.set(key, [])
      slotKeyToShiftIds.get(key)!.push(shift.id)
    })

    const shiftOverrides: Array<{
      coverage_request_shift_id: string
      selected: boolean
      override_availability: boolean
    }> = []
    const selectedShiftIds: string[] = []

    availableShiftKeys.forEach(key => {
      const shiftIds = shiftIdMap.get(key)
      if (!shiftIds || shiftIds.length === 0) return
      const selected = selectedShiftKeys.has(key)
      shiftIds.forEach(shiftId => {
        shiftOverrides.push({
          coverage_request_shift_id: shiftId,
          selected,
          override_availability: false,
        })
        if (selected) {
          selectedShiftIds.push(shiftId)
        }
      })
    })

    unavailableShiftKeys.forEach(key => {
      const shiftIds = shiftIdMap.get(key)
      if (!shiftIds || shiftIds.length === 0) return
      const override = overrideShiftKeys.has(key)
      const selected = selectedShiftKeys.has(key) && override
      shiftIds.forEach(shiftId => {
        shiftOverrides.push({
          coverage_request_shift_id: shiftId,
          selected,
          override_availability: override,
        })
        if (selected) {
          selectedShiftIds.push(shiftId)
        }
      })
    })

    // Floater slots: (date, time_slot_id) with multiple shifts. All selected ids in such slots are floater.
    const selectedSet = new Set(selectedShiftIds)
    const isFloaterShiftIds: string[] = []
    slotKeyToShiftIds.forEach(ids => {
      if (ids.length > 1) {
        ids.filter(id => selectedSet.has(id)).forEach(id => isFloaterShiftIds.push(id))
      }
    })

    return NextResponse.json({
      shift_overrides: shiftOverrides,
      selected_shift_ids: selectedShiftIds,
      is_floater_shift_ids: isFloaterShiftIds,
    })
  } catch (error) {
    return createErrorResponse(
      error,
      'Failed to resolve shift overrides',
      500,
      'POST /api/sub-finder/shift-overrides'
    )
  }
}
