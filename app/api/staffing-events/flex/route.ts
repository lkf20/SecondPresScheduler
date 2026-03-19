import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import { expandDateRangeWithTimeZone, parseLocalDate } from '@/lib/utils/date'
import { getScheduleSettings } from '@/lib/api/schedule-settings'
import { getSchoolClosuresForDateRange } from '@/lib/api/school-calendar'
import { getAuditActorContext, logAuditEvent } from '@/lib/audit/logAuditEvent'
import { getStaffDisplayName } from '@/lib/utils/staff-display-name'
import { isSlotClosedOnDate } from '@/lib/utils/school-closures'

type FlexAssignmentPayload = {
  staff_id: string
  start_date: string
  end_date: string
  classroom_ids: string[]
  time_slot_ids: string[]
  day_of_week_ids?: string[]
  notes?: string | null
  event_category?: 'standard' | 'break' | 'reassignment'
  covered_staff_id?: string | null
  start_time?: string | null
  end_time?: string | null
  source_classroom_id?: string | null
  coverage_request_shift_id?: string | null
  shifts?: Array<{
    date: string
    time_slot_id: string
    classroom_id: string
    source_classroom_id?: string | null
    coverage_request_shift_id?: string | null
  }>
}

const isEventCategoryConstraintError = (
  error: { code?: string; message?: string; details?: string | null } | null | undefined
) => {
  if (!error) return false
  if (error.code !== '23514') return false
  const haystack = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase()
  return haystack.includes('event_category') || haystack.includes('staffing_events_event_category')
}

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function POST(request: NextRequest) {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json({ error: 'Missing school context.' }, { status: 403 })
    }

    const body = (await request.json()) as FlexAssignmentPayload
    const {
      staff_id,
      start_date,
      end_date,
      classroom_ids,
      time_slot_ids,
      day_of_week_ids,
      notes,
      event_category,
      covered_staff_id,
      start_time,
      end_time,
      source_classroom_id,
      coverage_request_shift_id,
      shifts,
    } = body

    const normalizedEventCategory = event_category ?? 'standard'
    const isReassignment = normalizedEventCategory === 'reassignment'

    if (!staff_id || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'staff_id, start_date, end_date are required.' },
        { status: 400 }
      )
    }
    if (!Array.isArray(classroom_ids) || classroom_ids.length === 0) {
      return NextResponse.json({ error: 'classroom_ids is required.' }, { status: 400 })
    }
    if (!Array.isArray(time_slot_ids) || time_slot_ids.length === 0) {
      return NextResponse.json({ error: 'time_slot_ids is required.' }, { status: 400 })
    }

    const startDate = parseLocalDate(start_date)
    const endDate = parseLocalDate(end_date)
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid start_date or end_date.' }, { status: 400 })
    }
    if (startDate > endDate) {
      return NextResponse.json({ error: 'start_date must be before end_date.' }, { status: 400 })
    }

    if (classroom_ids.length === 0 || time_slot_ids.length === 0) {
      return NextResponse.json(
        { error: 'At least one classroom and time slot is required.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const scheduleSettings = await getScheduleSettings(schoolId)
    const timeZone = scheduleSettings?.time_zone || 'UTC'

    const { data: daysOfWeekRows, error: daysError } = await supabase
      .from('days_of_week')
      .select('id, day_number')

    if (daysError) {
      return NextResponse.json({ error: daysError.message }, { status: 500 })
    }

    const dayNumberToId = new Map<number, string>()
    ;(daysOfWeekRows || []).forEach(row => {
      if (typeof row.day_number === 'number') {
        dayNumberToId.set(row.day_number, row.id)
      }
    })

    const selectedDayIds = Array.isArray(day_of_week_ids) ? new Set(day_of_week_ids) : null

    // Fetch school closures so we skip assigning flex staff on closed days
    const schoolClosures = await getSchoolClosuresForDateRange(schoolId, start_date, end_date)
    const closureList = schoolClosures.map(c => ({ date: c.date, time_slot_id: c.time_slot_id }))

    const { data: eventRow, error: eventError } = await supabase
      .from('staffing_events')
      .insert({
        school_id: schoolId,
        event_type: 'temporary_coverage',
        event_category: normalizedEventCategory,
        covered_staff_id: covered_staff_id ?? null,
        start_time: start_time ?? null,
        end_time: end_time ?? null,
        staff_id,
        start_date,
        end_date,
        notes: notes ?? null,
        status: 'active',
      })
      .select('id')
      .single()

    if (eventError || !eventRow) {
      if (isEventCategoryConstraintError(eventError as any)) {
        return NextResponse.json(
          {
            error:
              'This environment does not yet support reassignment event categories. Please run the latest migrations (including 119_fix_reassignment_event_category_and_linkage.sql) before retrying.',
          },
          { status: 503 }
        )
      }
      return NextResponse.json(
        { error: eventError?.message || 'Failed to create event.' },
        { status: 500 }
      )
    }

    const normalizeShiftMeta = (shift: {
      source_classroom_id?: string | null
      coverage_request_shift_id?: string | null
    }) => ({
      source_classroom_id: shift.source_classroom_id ?? source_classroom_id ?? null,
      coverage_request_shift_id:
        shift.coverage_request_shift_id ?? coverage_request_shift_id ?? null,
    })

    const shiftRows: Array<{
      school_id: string
      staffing_event_id: string
      staff_id: string
      date: string
      day_of_week_id: string | null
      time_slot_id: string
      classroom_id: string
      source_classroom_id: string | null
      coverage_request_shift_id: string | null
      status: 'active'
    }> = []

    if (Array.isArray(shifts) && shifts.length > 0) {
      for (const shift of shifts) {
        const shiftDate = parseLocalDate(shift.date)
        if (Number.isNaN(shiftDate.getTime())) continue
        const dateStr = formatLocalDate(shiftDate)
        if (isSlotClosedOnDate(dateStr, shift.time_slot_id, closureList)) continue
        const dayNumber = shiftDate.getDay()
        const normalizedDayNumber = dayNumber === 0 ? 7 : dayNumber
        const dayOfWeekId = dayNumberToId.get(normalizedDayNumber) ?? null
        const shiftMeta = normalizeShiftMeta(shift)
        shiftRows.push({
          school_id: schoolId,
          staffing_event_id: eventRow.id,
          staff_id,
          date: shift.date,
          day_of_week_id: dayOfWeekId,
          time_slot_id: shift.time_slot_id,
          classroom_id: shift.classroom_id,
          source_classroom_id: shiftMeta.source_classroom_id,
          coverage_request_shift_id: shiftMeta.coverage_request_shift_id,
          status: 'active',
        })
      }
    } else {
      const dates = expandDateRangeWithTimeZone(start_date, end_date, timeZone)
      for (const entry of dates) {
        const dayOfWeekId = dayNumberToId.get(entry.day_number) ?? null
        if (!selectedDayIds || (dayOfWeekId && selectedDayIds.has(dayOfWeekId))) {
          for (const timeSlotId of time_slot_ids) {
            if (isSlotClosedOnDate(entry.date, timeSlotId, closureList)) continue
            for (const classroomId of classroom_ids) {
              const shiftMeta = normalizeShiftMeta({})
              shiftRows.push({
                school_id: schoolId,
                staffing_event_id: eventRow.id,
                staff_id,
                date: entry.date,
                day_of_week_id: dayOfWeekId,
                time_slot_id: timeSlotId,
                classroom_id: classroomId,
                source_classroom_id: shiftMeta.source_classroom_id,
                coverage_request_shift_id: shiftMeta.coverage_request_shift_id,
                status: 'active',
              })
            }
          }
        }
      }
    }

    if (shiftRows.length === 0) {
      return NextResponse.json(
        { error: 'No shifts matched the selected filters.' },
        { status: 400 }
      )
    }

    if (coverage_request_shift_id && shiftRows.length > 1) {
      return NextResponse.json(
        {
          error:
            'Top-level coverage_request_shift_id can only be used when assigning exactly one shift.',
        },
        { status: 400 }
      )
    }

    if (isReassignment) {
      for (const shift of shiftRows) {
        if (!shift.source_classroom_id) {
          return NextResponse.json(
            {
              error:
                'source_classroom_id is required for reassignment shifts. Choose the baseline room being reassigned.',
            },
            { status: 400 }
          )
        }
        if (shift.source_classroom_id === shift.classroom_id) {
          return NextResponse.json(
            { error: 'source_classroom_id must be different from target classroom_id.' },
            { status: 400 }
          )
        }
      }
    }

    const coverageShiftIds = Array.from(
      new Set(shiftRows.map(shift => shift.coverage_request_shift_id).filter(Boolean) as string[])
    )

    const coverageShiftById = new Map<
      string,
      {
        id: string
        date: string
        time_slot_id: string
        classroom_id: string
        teacher_id: string
      }
    >()

    if (coverageShiftIds.length > 0) {
      const linkedShiftCountByCoverageId = new Map<string, number>()
      for (const shift of shiftRows) {
        if (!shift.coverage_request_shift_id) continue
        linkedShiftCountByCoverageId.set(
          shift.coverage_request_shift_id,
          (linkedShiftCountByCoverageId.get(shift.coverage_request_shift_id) ?? 0) + 1
        )
      }
      for (const [id, count] of linkedShiftCountByCoverageId.entries()) {
        if (count > 1) {
          return NextResponse.json(
            { error: `coverage_request_shift_id ${id} is linked more than once in this request.` },
            { status: 400 }
          )
        }
      }

      const { data: coverageRows, error: coverageError } = await supabase
        .from('coverage_request_shifts')
        .select(
          `
          id,
          school_id,
          status,
          date,
          time_slot_id,
          classroom_id,
          coverage_requests!inner (
            teacher_id,
            school_id,
            status
          )
        `
        )
        .in('id', coverageShiftIds)

      if (coverageError) {
        return NextResponse.json({ error: coverageError.message }, { status: 500 })
      }

      const rows = (coverageRows ?? []) as Array<{
        id: string
        school_id: string
        status: string
        date: string
        time_slot_id: string
        classroom_id: string
        coverage_requests:
          | {
              teacher_id: string
              school_id: string
              status: string
            }
          | Array<{
              teacher_id: string
              school_id: string
              status: string
            }>
      }>

      for (const row of rows) {
        const requestRow = Array.isArray(row.coverage_requests)
          ? (row.coverage_requests[0] ?? null)
          : row.coverage_requests
        if (!requestRow) continue
        if (row.school_id !== schoolId || requestRow.school_id !== schoolId) {
          return NextResponse.json(
            { error: 'Coverage shift is outside school scope.' },
            { status: 403 }
          )
        }
        if (row.status !== 'active' || requestRow.status === 'cancelled') {
          return NextResponse.json(
            { error: 'Coverage shift is not active and cannot be linked.' },
            { status: 409 }
          )
        }
        coverageShiftById.set(row.id, {
          id: row.id,
          date: row.date,
          time_slot_id: row.time_slot_id,
          classroom_id: row.classroom_id,
          teacher_id: requestRow.teacher_id,
        })
      }

      for (const id of coverageShiftIds) {
        if (!coverageShiftById.has(id)) {
          return NextResponse.json({ error: 'Coverage shift not found.' }, { status: 404 })
        }
      }

      for (const shift of shiftRows) {
        if (!shift.coverage_request_shift_id) continue
        const coverageShift = coverageShiftById.get(shift.coverage_request_shift_id)
        if (!coverageShift) continue
        if (
          coverageShift.date !== shift.date ||
          coverageShift.time_slot_id !== shift.time_slot_id ||
          coverageShift.classroom_id !== shift.classroom_id
        ) {
          return NextResponse.json(
            {
              error:
                'coverage_request_shift_id must match shift date, time slot, and target classroom.',
            },
            { status: 400 }
          )
        }
      }
    }

    const { data: insertedShifts, error: shiftsError } = await supabase
      .from('staffing_event_shifts')
      .insert(shiftRows)
      .select(
        'id, date, day_of_week_id, time_slot_id, classroom_id, source_classroom_id, coverage_request_shift_id'
      )

    if (shiftsError) {
      if (shiftsError.code === '42703') {
        return NextResponse.json(
          {
            error:
              'This feature requires the latest staffing-event migration. Please run migrations before creating reassignment shifts.',
          },
          { status: 503 }
        )
      }
      if (shiftsError.code === '23505') {
        return NextResponse.json(
          {
            error:
              'Flex assignment conflicts with an existing active assignment for this staff member.',
          },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: shiftsError.message }, { status: 500 })
    }

    let linkedSubAssignmentCount = 0
    const reassignmentCoverageRows = (insertedShifts ?? [])
      .filter(shift => Boolean(shift.coverage_request_shift_id))
      .map(shift => {
        const coverage = coverageShiftById.get(shift.coverage_request_shift_id as string)
        if (!coverage) return null
        return {
          sub_id: staff_id,
          teacher_id: coverage.teacher_id,
          date: shift.date,
          day_of_week_id: shift.day_of_week_id,
          time_slot_id: shift.time_slot_id,
          assignment_type: 'Substitute Shift',
          classroom_id: shift.classroom_id,
          coverage_request_shift_id: coverage.id,
          is_partial: false,
          is_floater: false,
          partial_start_time: null,
          partial_end_time: null,
          notes: 'Linked to day-only reassignment',
          status: 'active',
          assignment_kind: 'absence_coverage' as const,
          non_sub_override: true,
          school_id: schoolId,
          staffing_event_shift_id: shift.id,
        }
      })
      .filter(Boolean)

    if (reassignmentCoverageRows.length > 0) {
      const { data: linkedRows, error: linkedError } = await (supabase
        .from('sub_assignments')
        .insert(reassignmentCoverageRows as any)
        .select('id') as any)

      if (linkedError) {
        await supabase
          .from('staffing_event_shifts')
          .update({ status: 'cancelled' })
          .eq('school_id', schoolId)
          .eq('staffing_event_id', eventRow.id)
          .eq('status', 'active')
        await supabase
          .from('staffing_events')
          .update({ status: 'cancelled' })
          .eq('school_id', schoolId)
          .eq('id', eventRow.id)
        return NextResponse.json(
          {
            error: `Failed to link reassignment coverage: ${linkedError.message}`,
          },
          { status: 500 }
        )
      }
      linkedSubAssignmentCount = (linkedRows ?? []).length
    }

    const { data: staffRow } = await supabase
      .from('staff')
      .select('first_name, last_name, display_name')
      .eq('id', staff_id)
      .eq('school_id', schoolId)
      .maybeSingle()
    const teacherName = staffRow ? getStaffDisplayName(staffRow) : null

    const uniqueClassroomIds = Array.from(new Set(classroom_ids))
    const { data: classroomRows } = await supabase
      .from('classrooms')
      .select('id, name')
      .eq('school_id', schoolId)
      .in('id', uniqueClassroomIds)
    const classroomNames = (classroomRows || []).map(r => r.name).filter(Boolean)
    const classroomName = classroomNames.length > 0 ? classroomNames.join(', ') : null

    const { actorUserId, actorDisplayName } = await getAuditActorContext()
    await logAuditEvent({
      schoolId,
      actorUserId,
      actorDisplayName,
      action: 'assign',
      category: 'temporary_coverage',
      entityType: 'staffing_event',
      entityId: eventRow.id,
      details: {
        staff_id,
        teacher_name: teacherName,
        classroom_ids: uniqueClassroomIds,
        classroom_name: classroomName,
        source_classroom_id: source_classroom_id ?? null,
        start_date,
        end_date,
        event_category: normalizedEventCategory,
        shift_count: shiftRows.length,
        linked_sub_assignment_count: linkedSubAssignmentCount,
      },
    })

    return NextResponse.json({
      id: eventRow.id,
      shift_count: shiftRows.length,
      linked_sub_assignment_count: linkedSubAssignmentCount,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
