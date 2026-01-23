import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getTimeOffRequests, createTimeOffRequest } from '@/lib/api/time-off'
import {
  createTimeOffShifts,
  getTeacherScheduledShifts,
  getTeacherTimeOffShifts,
} from '@/lib/api/time-off-shifts'
import { getUserSchoolId } from '@/lib/utils/auth'
import { parseLocalDate } from '@/lib/utils/date'

// Helper function to format date as "Mon Jan 20"
function formatExcludedDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const date = parseLocalDate(dateStr)
    if (isNaN(date.getTime())) return dateStr // Return original if invalid
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]
    const dayAbbr = dayNames[date.getDay()]
    const monthAbbr = monthNames[date.getMonth()]
    const day = date.getDate()
    return `${dayAbbr} ${monthAbbr} ${day}`
  } catch (error) {
    console.error('Error formatting date:', dateStr, error)
    return dateStr // Return original if formatting fails
  }
}

export async function GET(request: NextRequest) {
  try {
    // Require schoolId from session
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json(
        {
          error:
            'User profile not found or missing school_id. Please ensure your profile is set up.',
        },
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
        {
          error:
            'User profile not found or missing school_id. Please ensure your profile is set up.',
        },
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
      requestedShifts = scheduledShifts.map(shift => ({
        date: shift.date,
        time_slot_id: shift.time_slot_id,
      }))
    }

    // Filter out conflicting shifts (but still allow the request to be created)
    let shiftsToCreate: Array<{
      date: string
      day_of_week_id: string
      time_slot_id: string
      is_partial?: boolean
      start_time?: string | null
      end_time?: string | null
    }> = []
    let excludedShifts: Array<{ date: string }> = []
    let excludedShiftCount = 0
    let warning: string | null = null

    if (requestedShifts.length > 0 && status !== 'draft') {
      const existingShifts = await getTeacherTimeOffShifts(
        requestData.teacher_id,
        requestData.start_date,
        effectiveEndDate
      )
      const existingShiftKeys = new Set(
        existingShifts.map(shift => `${normalizeDate(shift.date)}::${shift.time_slot_id}`)
      )

      // Filter out conflicting shifts
      if (shifts && Array.isArray(shifts) && shifts.length > 0) {
        const excluded = shifts.filter(shift => {
          const shiftKey = `${normalizeDate(shift.date)}::${shift.time_slot_id}`
          return existingShiftKeys.has(shiftKey)
        })

        excludedShifts = excluded.map(shift => ({
          date: normalizeDate(shift.date),
        }))

        shiftsToCreate = shifts.filter(shift => {
          const shiftKey = `${normalizeDate(shift.date)}::${shift.time_slot_id}`
          return !existingShiftKeys.has(shiftKey)
        })
        excludedShiftCount = excludedShifts.length
      } else if (requestData.shift_selection_mode === 'all_scheduled') {
        // If "all_scheduled" mode, fetch all scheduled shifts and filter out conflicts
        const scheduledShifts = await getTeacherScheduledShifts(
          requestData.teacher_id,
          requestData.start_date,
          effectiveEndDate
        )

        const excluded = scheduledShifts.filter(shift => {
          const shiftKey = `${normalizeDate(shift.date)}::${shift.time_slot_id}`
          return existingShiftKeys.has(shiftKey)
        })

        excludedShifts = excluded.map(shift => ({
          date: shift.date,
        }))

        shiftsToCreate = scheduledShifts
          .map(shift => ({
            date: shift.date,
            day_of_week_id: shift.day_of_week_id,
            time_slot_id: shift.time_slot_id,
            is_partial: false,
            start_time: null,
            end_time: null,
          }))
          .filter(shift => {
            const shiftKey = `${normalizeDate(shift.date)}::${shift.time_slot_id}`
            return !existingShiftKeys.has(shiftKey)
          })
        excludedShiftCount = excludedShifts.length
      }

      if (excludedShiftCount > 0 && excludedShifts.length > 0) {
        try {
          // Remove duplicates by date (same date can appear multiple times with different time slots)
          const uniqueExcludedDates = Array.from(
            new Set(excludedShifts.map(s => s.date).filter(Boolean))
          )
            .map(date => {
              try {
                return formatExcludedDate(date)
              } catch (err) {
                console.error('Error formatting excluded date:', date, err)
                return null
              }
            })
            .filter((date): date is string => Boolean(date)) // Remove any null/empty values

          if (uniqueExcludedDates.length > 0) {
            const formattedDates = uniqueExcludedDates.join(', ')
            warning = `This teacher already has time off recorded for ${excludedShiftCount} of these shifts.<br>${excludedShiftCount} shift${excludedShiftCount !== 1 ? 's' : ''} will not be recorded: ${formattedDates}`
          } else {
            // Fallback if date formatting fails
            warning = `This teacher already has time off recorded for ${excludedShiftCount} of these shifts.<br>${excludedShiftCount} shift${excludedShiftCount !== 1 ? 's' : ''} will not be recorded.`
          }
        } catch (error) {
          console.error('Error processing excluded shifts:', error)
          // Fallback warning if processing fails
          warning = `This teacher already has time off recorded for ${excludedShiftCount} of these shifts.<br>${excludedShiftCount} shift${excludedShiftCount !== 1 ? 's' : ''} will not be recorded.`
        }
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
        shiftsToCreate = scheduledShifts.map(shift => ({
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
    return NextResponse.json(
      {
        ...createdRequest,
        warning,
        excludedShiftCount,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating time off request:', error)
    return NextResponse.json({ error: error.message || 'Unknown error occurred' }, { status: 500 })
  }
}
