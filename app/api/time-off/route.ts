import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getTimeOffRequests, createTimeOffRequest } from '@/lib/api/time-off'
import {
  createTimeOffShifts,
  getTeacherScheduledShifts,
  getTeacherTimeOffShifts,
} from '@/lib/api/time-off-shifts'

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

    if (requestedShifts.length > 0) {
      const existingShifts = await getTeacherTimeOffShifts(
        requestData.teacher_id,
        requestData.start_date,
        effectiveEndDate
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
        await createTimeOffShifts(createdRequest.id, shiftsToCreate)
      }
    }
    
    revalidatePath('/dashboard')
    revalidatePath('/time-off')
    return NextResponse.json(createdRequest, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
