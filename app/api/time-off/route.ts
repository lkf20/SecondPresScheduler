import { NextRequest, NextResponse } from 'next/server'
import { getTimeOffRequests, createTimeOffRequest } from '@/lib/api/time-off'
import { createTimeOffShifts, getTeacherScheduledShifts } from '@/lib/api/time-off-shifts'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filters: any = {}
    if (searchParams.get('teacher_id')) filters.teacher_id = searchParams.get('teacher_id')
    if (searchParams.get('start_date')) filters.start_date = searchParams.get('start_date')
    if (searchParams.get('end_date')) filters.end_date = searchParams.get('end_date')
    
    const requests = await getTimeOffRequests(filters)
    return NextResponse.json(requests)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { shifts, ...requestData } = body
    
    // Create the time off request
    const createdRequest = await createTimeOffRequest(requestData)
    
    // If shifts are provided, create them
    if (shifts && Array.isArray(shifts) && shifts.length > 0) {
      await createTimeOffShifts(createdRequest.id, shifts)
    } else if (requestData.shift_selection_mode === 'all_scheduled') {
      // If "all_scheduled" mode, fetch all scheduled shifts and create them
      const scheduledShifts = await getTeacherScheduledShifts(
        requestData.teacher_id,
        requestData.start_date,
        requestData.end_date
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
        await createTimeOffShifts(createdRequest.id, shiftsToCreate)
      }
    }
    
    return NextResponse.json(createdRequest, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}



