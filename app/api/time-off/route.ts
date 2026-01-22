import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getTimeOffRequests, createTimeOffRequest } from '@/lib/api/time-off'
import {
  createTimeOffShifts,
  getTeacherScheduledShifts,
  getTeacherTimeOffShifts,
} from '@/lib/api/time-off-shifts'
import { getUserSchoolId } from '@/lib/utils/auth'

export async function GET(request: NextRequest) {
  try {
    // Require schoolId from session
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json(
        { error: 'User profile not found or missing school_id. Please ensure your profile is set up.' },
        { status: 403 }
      )
    }

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
    // Require schoolId from session
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json(
        { error: 'User profile not found or missing school_id. Please ensure your profile is set up.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { shifts, ...requestData } = body
    const status = requestData.status || 'active'
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

    // Filter out conflicting shifts (but still allow the request to be created)
    let shiftsToCreate: Array<{ date: string; day_of_week_id: string; time_slot_id: string; is_partial?: boolean; start_time?: string | null; end_time?: string | null }> = []
    let excludedShiftCount = 0
    let warning: string | null = null

    if (requestedShifts.length > 0 && status !== 'draft') {
      const existingShifts = await getTeacherTimeOffShifts(
        requestData.teacher_id,
        requestData.start_date,
        effectiveEndDate
      )
      const existingShiftKeys = new Set(
        existingShifts.map((shift) => `${normalizeDate(shift.date)}::${shift.time_slot_id}`)
      )
      
      // Filter out conflicting shifts
      if (shifts && Array.isArray(shifts) && shifts.length > 0) {
        shiftsToCreate = shifts.filter((shift) => {
          const shiftKey = `${normalizeDate(shift.date)}::${shift.time_slot_id}`
          return !existingShiftKeys.has(shiftKey)
        })
        excludedShiftCount = shifts.length - shiftsToCreate.length
      } else if (requestData.shift_selection_mode === 'all_scheduled') {
        // If "all_scheduled" mode, fetch all scheduled shifts and filter out conflicts
        const scheduledShifts = await getTeacherScheduledShifts(
          requestData.teacher_id,
          requestData.start_date,
          effectiveEndDate
        )
        
        shiftsToCreate = scheduledShifts
          .map((shift) => ({
            date: shift.date,
            day_of_week_id: shift.day_of_week_id,
            time_slot_id: shift.time_slot_id,
            is_partial: false,
            start_time: null,
            end_time: null,
          }))
          .filter((shift) => {
            const shiftKey = `${normalizeDate(shift.date)}::${shift.time_slot_id}`
            return !existingShiftKeys.has(shiftKey)
          })
        excludedShiftCount = scheduledShifts.length - shiftsToCreate.length
      }
      
      if (excludedShiftCount > 0) {
        warning = `This teacher already has time off recorded for ${excludedShiftCount} of these shifts.\nThis shift${excludedShiftCount !== 1 ? 's will' : ' will'} not be included in this time off request.`
      }
    } else {
      // No conflicts to check, use all requested shifts
      if (shifts && Array.isArray(shifts) && shifts.length > 0) {
        shiftsToCreate = shifts
      } else if (requestData.shift_selection_mode === 'all_scheduled') {
        const scheduledShifts = await getTeacherScheduledShifts(
          requestData.teacher_id,
          requestData.start_date,
          effectiveEndDate
        )
        shiftsToCreate = scheduledShifts.map((shift) => ({
          date: shift.date,
          day_of_week_id: shift.day_of_week_id,
          time_slot_id: shift.time_slot_id,
          is_partial: false,
          start_time: null,
          end_time: null,
        }))
      }
    }
    
    // Create the time off request
    const createdRequest = await createTimeOffRequest({ ...requestData, status })
    
    // Create shifts (only non-conflicting ones)
    if (shiftsToCreate.length > 0) {
      await createTimeOffShifts(createdRequest.id, shiftsToCreate)
    }
    
    // Revalidate all pages that might show this data
    revalidatePath('/dashboard')
    revalidatePath('/time-off')
    revalidatePath('/schedules/weekly')
    revalidatePath('/sub-finder')
    revalidatePath('/reports')
    
    // Return the created request with optional warning
    return NextResponse.json({
      ...createdRequest,
      warning,
      excludedShiftCount,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating time off request:', error)
    return NextResponse.json({ error: error.message || 'Unknown error occurred' }, { status: 500 })
  }
}
