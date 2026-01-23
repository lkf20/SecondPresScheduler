import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import {
  getTimeOffRequestById,
  updateTimeOffRequest,
  deleteTimeOffRequest,
  getActiveSubAssignmentsForTimeOffRequest,
  cancelTimeOffRequest,
} from '@/lib/api/time-off'
import {
  getTimeOffShifts,
  createTimeOffShifts,
  deleteTimeOffShifts,
  getTeacherScheduledShifts,
  getTeacherTimeOffShifts,
} from '@/lib/api/time-off-shifts'
import { parseLocalDate } from '@/lib/utils/date'
import { createClient } from '@/lib/supabase/server'

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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const requestData = await getTimeOffRequestById(id)
    const shifts = await getTimeOffShifts(id)
    return NextResponse.json({ ...requestData, shifts })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      requestedShifts = scheduledShifts.map(shift => ({
        date: shift.date,
        time_slot_id: shift.time_slot_id,
      }))
    }

    // Filter out conflicting shifts (but still allow the request to be updated)
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

    // Update the time off request
    const updatedRequest = await updateTimeOffRequest(id, { ...requestData, status })

    // Update the corresponding coverage_request's dates to match the time_off_request
    const supabase = await createClient()
    const { data: timeOffRequestWithCoverage } = await supabase
      .from('time_off_requests')
      .select('coverage_request_id, start_date, end_date')
      .eq('id', id)
      .single()

    if (timeOffRequestWithCoverage?.coverage_request_id) {
      // Always update dates to match the time_off_request
      const effectiveStartDate = timeOffRequestWithCoverage.start_date
      const effectiveEndDate =
        timeOffRequestWithCoverage.end_date || timeOffRequestWithCoverage.start_date

      const coverageUpdate: { start_date: string; end_date: string; updated_at: string } = {
        start_date: effectiveStartDate,
        end_date: effectiveEndDate,
        updated_at: new Date().toISOString(),
      }

      console.log(
        `[TimeOff Update] Updating coverage_request ${timeOffRequestWithCoverage.coverage_request_id} with dates:`,
        {
          start_date: effectiveStartDate,
          end_date: effectiveEndDate,
        }
      )

      const { error: coverageUpdateError, data: updatedCoverageRequest } = await supabase
        .from('coverage_requests')
        .update(coverageUpdate)
        .eq('id', timeOffRequestWithCoverage.coverage_request_id)
        .select('start_date, end_date')
        .single()

      if (coverageUpdateError) {
        console.error(
          '[TimeOff Update] Error updating coverage_request dates:',
          coverageUpdateError
        )
        // Don't fail the request, just log the error
      } else {
        console.log(
          '[TimeOff Update] Successfully updated coverage_request dates:',
          updatedCoverageRequest
        )
      }
    }

    // Handle shifts
    if (shifts !== undefined) {
      // Delete existing shifts
      await deleteTimeOffShifts(id)

      if (requestedShifts.length > 0 && status !== 'draft') {
        const existingShifts = await getTeacherTimeOffShifts(
          requestData.teacher_id,
          requestData.start_date,
          effectiveEndDate,
          id // Exclude current request
        )
        const existingShiftKeys = new Set(
          existingShifts.map(shift => `${normalizeDate(shift.date)}::${shift.time_slot_id}`)
        )

        // Filter out conflicting shifts
        if (Array.isArray(shifts) && shifts.length > 0) {
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
            updatedRequest.teacher_id,
            updatedRequest.start_date,
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
        if (Array.isArray(shifts) && shifts.length > 0) {
          shiftsToCreate = shifts
        } else if (requestData.shift_selection_mode === 'all_scheduled') {
          const scheduledShifts = await getTeacherScheduledShifts(
            updatedRequest.teacher_id,
            updatedRequest.start_date,
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

      // Create shifts (only non-conflicting ones)
      if (shiftsToCreate.length > 0) {
        await createTimeOffShifts(id, shiftsToCreate)
      }

      // After shifts are created/updated, recalculate coverage_request dates from actual shifts
      // This ensures the dates match the actual shift dates (MIN and MAX)
      if (timeOffRequestWithCoverage?.coverage_request_id) {
        const { data: coverageShifts } = await supabase
          .from('coverage_request_shifts')
          .select('date')
          .eq('coverage_request_id', timeOffRequestWithCoverage.coverage_request_id)

        if (coverageShifts && coverageShifts.length > 0) {
          const dates = coverageShifts
            .map(s => s.date)
            .filter(Boolean)
            .sort()
          if (dates.length > 0) {
            const minDate = dates[0]
            const maxDate = dates[dates.length - 1]

            await supabase
              .from('coverage_requests')
              .update({
                start_date: minDate,
                end_date: maxDate,
                updated_at: new Date().toISOString(),
              })
              .eq('id', timeOffRequestWithCoverage.coverage_request_id)
          }
        }
      }
    }

    // Revalidate all pages that might show this data
    revalidatePath('/dashboard')
    revalidatePath('/time-off')
    revalidatePath('/schedules/weekly')
    revalidatePath('/sub-finder')
    revalidatePath('/reports')

    return NextResponse.json({
      ...updatedRequest,
      warning,
      excludedShiftCount,
    })
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
    const body = await request.json().catch(() => ({}))
    const { keepAssignmentsAsExtraCoverage = false, assignmentIdsToKeep = undefined } = body

    // First, get active sub assignments to return summary
    const activeAssignments = await getActiveSubAssignmentsForTimeOffRequest(id)

    // If there are assignments, we need the director's choice
    if (activeAssignments.length > 0 && body.action === undefined) {
      // Return summary for the UI dialog
      const timeOffRequest = await getTimeOffRequestById(id)
      const teacher = timeOffRequest?.teacher

      // Format assignments for display
      const formattedAssignments = activeAssignments.map((assignment: any) => {
        const shift = assignment.coverage_request_shift
        const sub = assignment.sub
        const dayName = shift?.days_of_week?.name || ''
        const timeSlot = shift?.time_slots?.code || ''
        const classroom = shift?.classrooms?.name || ''
        const subName =
          sub?.display_name ||
          `${sub?.first_name || ''} ${sub?.last_name || ''}`.trim() ||
          'Unknown'

        // Format date: "Mon Feb 10" format
        const date = new Date(shift?.date || '')
        const dayNameShort = dayName.substring(0, 3) // "Mon" from "Monday"
        const monthShort = date.toLocaleDateString('en-US', { month: 'short' })
        const day = date.getDate()
        const dateStr = `${dayNameShort} ${monthShort} ${day}`

        return {
          id: assignment.id,
          display: `${dateStr} • ${timeSlot} • ${subName} • ${classroom}`,
          date: shift?.date,
          dayName,
          timeSlot,
          subName,
          classroom,
        }
      })

      return NextResponse.json({
        hasAssignments: true,
        assignmentCount: activeAssignments.length,
        assignments: formattedAssignments,
        teacherName:
          teacher?.display_name ||
          `${teacher?.first_name || ''} ${teacher?.last_name || ''}`.trim(),
      })
    }

    // Perform cancellation
    const result = await cancelTimeOffRequest(id, {
      keepAssignmentsAsExtraCoverage,
      assignmentIdsToKeep,
    })

    revalidatePath('/dashboard')
    revalidatePath('/time-off')
    revalidatePath('/schedules/weekly')
    revalidatePath('/sub-finder')
    revalidatePath('/reports')

    // Return the cancellation result
    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error: any) {
    console.error('Error cancelling time off request:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
