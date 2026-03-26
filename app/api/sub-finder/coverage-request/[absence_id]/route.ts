import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTimeOffRequestById } from '@/lib/api/time-off'
import { getTimeOffShifts } from '@/lib/api/time-off-shifts'
import { createErrorResponse, getErrorMessage } from '@/lib/utils/errors'
import { toDateStringISO } from '@/lib/utils/date'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getSchoolClosuresForDateRange } from '@/lib/api/school-calendar'
import { isSlotClosedOnDate } from '@/lib/utils/school-closures'
import { isNeedsReviewClassroomName } from '@/lib/utils/needs-review-classroom'

/**
 * GET /api/sub-finder/coverage-request/[absence_id]
 * Get coverage_request_id and shift mappings for a time_off_request
 */
export async function GET(
  request: NextRequest,
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

    let coverageRequestId = (timeOffRequest as any).coverage_request_id
    const startDate = (timeOffRequest as any).start_date
    const endDate = (timeOffRequest as any).end_date || startDate
    const requestStartDate = toDateStringISO(startDate)
    const requestEndDate = toDateStringISO(endDate)
    const isWithinRequestRange = (date: string) => {
      const dateISO = toDateStringISO(date)
      if (!requestStartDate || !requestEndDate) return true
      return dateISO >= requestStartDate && dateISO <= requestEndDate
    }
    let omittedShiftCount = 0
    let omittedShifts: Array<{ date: string; day_of_week_id: string; time_slot_id: string }> = []

    if (!coverageRequestId) {
      const allShifts = await getTimeOffShifts(absence_id)
      const userSchoolId = await getUserSchoolId()
      const schoolClosures =
        userSchoolId && startDate && endDate
          ? await getSchoolClosuresForDateRange(userSchoolId, startDate, endDate)
          : []
      const closureList = schoolClosures.map(c => ({ date: c.date, time_slot_id: c.time_slot_id }))
      const shifts =
        closureList.length > 0
          ? allShifts.filter(
              (s: any) => !isSlotClosedOnDate(toDateStringISO(s.date), s.time_slot_id, closureList)
            )
          : allShifts
      // Get school_id for the teacher
      const teacherId = (timeOffRequest as any).teacher_id
      let schoolId: string

      // Try to get from profile first
      const { data: profile } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('user_id', teacherId)
        .single()

      if (profile?.school_id) {
        schoolId = profile.school_id
      } else {
        // Fall back to teacher_schedules
        const { data: schedule } = await supabase
          .from('teacher_schedules')
          .select('school_id')
          .eq('teacher_id', teacherId)
          .limit(1)
          .single()

        if (schedule?.school_id) {
          schoolId = schedule.school_id
        } else {
          return createErrorResponse('Unable to resolve school_id for this teacher', 400)
        }
      }

      // total_shifts and covered_shifts start at 0; the DB trigger on coverage_request_shifts
      // will set total_shifts when we insert coverage_request_shifts (so it matches actual
      // row count, including floater multi-classroom and omitted shifts).
      const { data: newCoverageRequest, error: coverageError } = await supabase
        .from('coverage_requests')
        .insert({
          request_type: 'time_off',
          source_request_id: (timeOffRequest as any).id,
          teacher_id: teacherId,
          start_date: startDate,
          end_date: endDate,
          status: 'open',
          total_shifts: 0,
          covered_shifts: 0,
          school_id: schoolId,
        })
        .select('id')
        .single()

      if (coverageError || !newCoverageRequest) {
        return createErrorResponse('Failed to create coverage request', 500)
      }

      coverageRequestId = newCoverageRequest.id

      const { error: updateError } = await supabase
        .from('time_off_requests')
        .update({ coverage_request_id: coverageRequestId })
        .eq('id', (timeOffRequest as any).id)

      if (updateError) {
        console.error('Error linking coverage request to time off request:', updateError)
      }

      if (shifts.length > 0) {
        const { data: scheduleRows, error: scheduleError } = await supabase
          .from('teacher_schedules')
          .select('day_of_week_id, time_slot_id, classroom_id, class_group_id')
          .eq('teacher_id', (timeOffRequest as any).teacher_id)
          .eq('school_id', schoolId)

        if (scheduleError) {
          console.error('Error fetching teacher schedules:', scheduleError)
        }

        // One entry per (day, slot, classroom) so floaters get multiple coverage_request_shifts
        const scheduleEntriesBySlot = new Map<
          string,
          Array<{ classroom_id: string | null; class_group_id: string | null }>
        >()
        ;(scheduleRows || []).forEach((row: any) => {
          const key = `${row.day_of_week_id}|${row.time_slot_id}`
          if (!scheduleEntriesBySlot.has(key)) {
            scheduleEntriesBySlot.set(key, [])
          }
          scheduleEntriesBySlot.get(key)!.push({
            classroom_id: row.classroom_id || null,
            class_group_id: row.class_group_id || null,
          })
        })

        // Get school_id from the coverage request
        const { data: coverageRequestData } = await supabase
          .from('coverage_requests')
          .select('school_id')
          .eq('id', coverageRequestId)
          .single()

        const requestSchoolId = coverageRequestData?.school_id || schoolId

        // Only create coverage_request_shifts for shifts where the teacher has a scheduled classroom.
        // Do not use "Unknown (needs review)" fallback.
        const coverageShiftRows: Array<{
          coverage_request_id: string
          date: string
          day_of_week_id: string
          time_slot_id: string
          classroom_id: string
          class_group_id: string | null
          is_partial: boolean
          start_time: string | null
          end_time: string | null
          school_id: string
          time_off_shift_id: string
        }> = []
        const omittedForRequest: Array<{
          date: string
          day_of_week_id: string
          time_slot_id: string
        }> = []

        for (const shift of shifts) {
          const key = `${shift.day_of_week_id}|${shift.time_slot_id}`
          const entries = scheduleEntriesBySlot.get(key) || []
          const withClassroom = entries.filter(e => e.classroom_id != null)
          if (withClassroom.length > 0) {
            for (const scheduleEntry of withClassroom) {
              coverageShiftRows.push({
                coverage_request_id: coverageRequestId,
                date: shift.date,
                day_of_week_id: shift.day_of_week_id as string,
                time_slot_id: shift.time_slot_id as string,
                classroom_id: scheduleEntry.classroom_id!,
                class_group_id: scheduleEntry.class_group_id || null,
                is_partial: shift.is_partial ?? false,
                start_time: shift.start_time || null,
                end_time: shift.end_time || null,
                school_id: requestSchoolId,
                time_off_shift_id: shift.id as string,
              })
            }
          } else {
            omittedForRequest.push({
              date: toDateStringISO(shift.date),
              day_of_week_id: shift.day_of_week_id as string,
              time_slot_id: shift.time_slot_id as string,
            })
          }
        }

        omittedShiftCount = omittedForRequest.length
        omittedShifts = omittedForRequest

        if (coverageShiftRows.length > 0) {
          const { error: shiftInsertError } = await supabase
            .from('coverage_request_shifts')
            .insert(coverageShiftRows)

          if (shiftInsertError) {
            console.error('Error creating coverage request shifts:', shiftInsertError)
          }
        }
      }
    } else {
      // Coverage request already exists: compute omitted shifts (time_off_shifts with no coverage_request_shift, e.g. missing classroom)
      const allShifts = (await getTimeOffShifts(absence_id)) || []
      const userSchoolIdForOmitted = await getUserSchoolId()
      const schoolClosuresForOmitted =
        userSchoolIdForOmitted && startDate && endDate
          ? await getSchoolClosuresForDateRange(userSchoolIdForOmitted, startDate, endDate)
          : []
      const closureListForOmitted = schoolClosuresForOmitted.map(c => ({
        date: c.date,
        time_slot_id: c.time_slot_id,
      }))
      const shiftsNonClosed =
        closureListForOmitted.length > 0
          ? allShifts.filter(
              (s: any) =>
                !isSlotClosedOnDate(toDateStringISO(s.date), s.time_slot_id, closureListForOmitted)
            )
          : allShifts

      const { data: crShiftsForOmitted } = await supabase
        .from('coverage_request_shifts')
        .select('date, time_slot_id')
        .eq('coverage_request_id', coverageRequestId)

      const crShiftKeys = new Set(
        (crShiftsForOmitted || [])
          .filter((r: { date: string }) => isWithinRequestRange(r.date))
          .map(
            (r: { date: string; time_slot_id: string }) =>
              `${toDateStringISO(r.date)}|${r.time_slot_id}`
          )
      )
      const omittedForExisting = shiftsNonClosed.filter(
        (s: any) => !crShiftKeys.has(`${toDateStringISO(s.date)}|${s.time_slot_id}`)
      )
      omittedShiftCount = omittedForExisting.length
      omittedShifts = omittedForExisting.map((s: any) => ({
        date: toDateStringISO(s.date),
        day_of_week_id: s.day_of_week_id as string,
        time_slot_id: s.time_slot_id as string,
      }))
    }

    // Get coverage_request_shifts (filter out shifts on school closed days for response)
    const { data: rawCoverageRequestShifts, error: shiftsError } = await supabase
      .from('coverage_request_shifts')
      .select(
        'id, date, day_of_week_id, time_slot_id, classroom_id, time_slot:time_slots(code), classroom:classrooms(name)'
      )
      .eq('coverage_request_id', coverageRequestId)

    if (shiftsError) {
      console.error('Error fetching coverage_request_shifts:', shiftsError)
    }

    const schoolIdForFilter = await getUserSchoolId()
    const closureListForResponse =
      schoolIdForFilter && startDate && endDate
        ? (await getSchoolClosuresForDateRange(schoolIdForFilter, startDate, endDate)).map(c => ({
            date: c.date,
            time_slot_id: c.time_slot_id,
          }))
        : []
    const coverageRequestShifts =
      closureListForResponse.length > 0 && rawCoverageRequestShifts
        ? rawCoverageRequestShifts.filter(
            (s: any) =>
              !isSlotClosedOnDate(
                toDateStringISO(s.date),
                s.time_slot_id,
                closureListForResponse
              ) && isWithinRequestRange(s.date)
          )
        : (rawCoverageRequestShifts || []).filter((s: any) => isWithinRequestRange(s.date))

    // Create mappings for robust shift-id resolution in clients:
    // - date|time_slot_id|classroom_id (preferred, id-based)
    // - date|time_slot_code|classroom_id (legacy fallback)
    // - date|time_slot_id (legacy/simple fallback)
    // - date|time_slot_code (legacy/simple fallback)
    const shiftMap = new Map<string, string>()
    const shiftMapSimple = new Map<string, string>()
    if (coverageRequestShifts) {
      coverageRequestShifts.forEach((shift: any) => {
        const dateISO = toDateStringISO(shift.date)
        const slotCode = shift.time_slot?.code || ''
        const slotId = shift.time_slot_id || ''
        const classroomId = shift.classroom_id || ''

        const keyBySlotId = `${dateISO}|${slotId}|${classroomId}`
        const keyBySlotCode = `${dateISO}|${slotCode}|${classroomId}`
        const simpleKeyBySlotId = `${dateISO}|${slotId}`
        const simpleKeyBySlotCode = `${dateISO}|${slotCode}`

        shiftMap.set(keyBySlotId, shift.id)
        shiftMap.set(keyBySlotCode, shift.id)

        // Use the first shift ID found for the simple key (for backward compatibility)
        if (!shiftMapSimple.has(simpleKeyBySlotId)) shiftMapSimple.set(simpleKeyBySlotId, shift.id)
        if (!shiftMapSimple.has(simpleKeyBySlotCode))
          shiftMapSimple.set(simpleKeyBySlotCode, shift.id)
      })
    }

    const needsReviewShiftCount = (coverageRequestShifts || []).filter((shift: any) =>
      isNeedsReviewClassroomName(shift.classroom?.name)
    ).length

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
      needs_classroom_review: needsReviewShiftCount > 0,
      needs_review_shift_count: needsReviewShiftCount,
      omitted_shift_count: omittedShiftCount,
      omitted_shifts: omittedShifts,
    })
  } catch (error) {
    console.error('Error fetching coverage request:', error)
    return createErrorResponse(getErrorMessage(error), 500)
  }
}
