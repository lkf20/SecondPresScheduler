import { NextRequest, NextResponse } from 'next/server'
import { getTimeOffRequestById, updateTimeOffRequest, deleteTimeOffRequest } from '@/lib/api/time-off'
import { getTimeOffShifts, createTimeOffShifts, deleteTimeOffShifts, getTeacherScheduledShifts } from '@/lib/api/time-off-shifts'

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
    
    // Update the time off request
    const updatedRequest = await updateTimeOffRequest(id, requestData)
    
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
          updatedRequest.end_date
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

