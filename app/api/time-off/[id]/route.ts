import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getTimeOffRequestById, updateTimeOffRequest, deleteTimeOffRequest } from '@/lib/api/time-off'
import {
  getTimeOffShifts,
  createTimeOffShifts,
  deleteTimeOffShifts,
  getTeacherScheduledShifts,
  getTeacherTimeOffShifts,
} from '@/lib/api/time-off-shifts'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const requestData = await getTimeOffRequestById(id)
    const shifts = await getTimeOffShifts(id)
    return NextResponse.json({ ...requestData, shifts })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { shifts, ...requestData } = body
    const existingRequest = await getTimeOffRequestById(id)
    const status = requestData.status || existingRequest.status || 'active'
    const effectiveEndDate = requestData.end_date || requestData.start_date

    const normalizeDate = (dateStr: string) => {
      if (!dateStr) return ''
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
      const parsed = new Date(dateStr)
      return parsed.toISOString().split('T')[0]
    }

    let requestedShifts: Array<{ date: string; time_slot_id: string }> = []
    if (Array.isArray(shifts) && shifts.length > 0) {
      requestedShifts = shifts.map((shift: any) => ({
        date: shift.date,
        time_slot_id: shift.time_slot_id,
      }))
    } else if (requestData.shift_selection_mode === 'all_scheduled') {
      const scheduledShifts = await getTeacherScheduledShifts(
        requestData.teacher_id,
        requestData.start_date,
        effectiveEndDate
      )
      requestedShifts = scheduledShifts.map((shift) => ({
        date: shift.date,
        time_slot_id: shift.time_slot_id,
      }))
    }

    if (requestedShifts.length > 0 && status !== 'draft') {
      const existingShifts = await getTeacherTimeOffShifts(
        requestData.teacher_id,
        requestData.start_date,
        effectiveEndDate,
        id
      )
      const existingShiftKeys = new Set(
        existingShifts.map((shift) => `${normalizeDate(shift.date)}::${shift.time_slot_id}`)
      )
      const conflictCount = requestedShifts.filter((shift) =>
        existingShiftKeys.has(`${normalizeDate(shift.date)}::${shift.time_slot_id}`)
      ).length

      if (conflictCount > 0) {
        return NextResponse.json(
          {
            error: `Teacher already has time off recorded for ${conflictCount} selected shift${
              conflictCount !== 1 ? 's' : ''
            }.`,
          },
          { status: 409 }
        )
      }
    }
    
    // Update the time off request
    const updatedRequest = await updateTimeOffRequest(id, { ...requestData, status })
    
    // Handle shifts
    if (shifts !== undefined) {
      // Delete existing shifts
      await deleteTimeOffShifts(id)
      
      // Create new shifts if provided
      if (Array.isArray(shifts) && shifts.length > 0) {
        await createTimeOffShifts(id, shifts)
      } else if (requestData.shift_selection_mode === 'all_scheduled') {
        // If "all_scheduled" mode, fetch all scheduled shifts and create them
        const scheduledShifts = await getTeacherScheduledShifts(
          updatedRequest.teacher_id,
          updatedRequest.start_date,
          effectiveEndDate
        )
        
        const shiftsToCreate = scheduledShifts.map((shift) => ({
          date: shift.date,
          day_of_week_id: shift.day_of_week_id,
          time_slot_id: shift.time_slot_id,
          is_partial: false,
          start_time: null,
          end_time: null,
        }))
        
        if (shiftsToCreate.length > 0) {
          await createTimeOffShifts(id, shiftsToCreate)
        }
      }
    }
    
    revalidatePath('/dashboard')
    revalidatePath('/time-off')
    return NextResponse.json(updatedRequest)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await deleteTimeOffRequest(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
