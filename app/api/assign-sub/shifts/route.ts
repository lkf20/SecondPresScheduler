import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createErrorResponse, getErrorMessage } from '@/lib/utils/errors'
import { getTeacherShiftsForAssignSub, type AssignSubShiftRow } from '@/lib/api/coverage-requests'
import { getSchoolClosuresForDateRange } from '@/lib/api/school-calendar'
import { isSlotClosedOnDate } from '@/lib/utils/school-closures'
import { toDateStringISO } from '@/lib/utils/date'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getStaffDisplayName } from '@/lib/utils/staff-display-name'

/**
 * POST /api/assign-sub/shifts
 * Get teacher's scheduled shifts for a date range with time-off info.
 * Marks shifts on school-closed days/slots with school_closure: true (show for context, not assignable).
 * For shifts with time off: includes coverage_request_shift_id (for assign/unassign) and, when assigned,
 * assignment_id, assigned_sub_id, assigned_sub_name (for Change sub in Assign Sub panel).
 * Does NOT create a coverage request (aligns with Sub Finder pattern).
 */
export async function POST(request: NextRequest) {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return createErrorResponse(
        new Error('User profile not found or missing school_id'),
        'User profile not found or missing school_id',
        403
      )
    }

    const body = await request.json()
    const { teacher_id, start_date, end_date } = body

    if (!teacher_id || !start_date) {
      return createErrorResponse(
        new Error('Missing required fields: teacher_id, start_date'),
        'Missing required fields: teacher_id, start_date',
        400
      )
    }

    const effectiveEndDate = end_date || start_date
    const startDateNorm = toDateStringISO(start_date)
    const endDateNorm = toDateStringISO(effectiveEndDate)
    if (!startDateNorm) {
      return createErrorResponse(new Error('Invalid start_date'), 'Invalid start_date', 400)
    }

    let rawShifts = await getTeacherShiftsForAssignSub(
      teacher_id,
      startDateNorm,
      endDateNorm || startDateNorm
    )
    const schoolClosures = await getSchoolClosuresForDateRange(
      schoolId,
      startDateNorm,
      endDateNorm || startDateNorm
    )
    const closureList = schoolClosures.map(c => ({ date: c.date, time_slot_id: c.time_slot_id }))

    const supabase = await createClient()

    const timeOffRequestIds = [
      ...new Set(
        rawShifts.map(s => s.time_off_request_id).filter((id): id is string => Boolean(id))
      ),
    ]
    const shiftMapByRequest = new Map<string, Map<string, string>>()
    if (timeOffRequestIds.length > 0) {
      const { data: torRows } = await supabase
        .from('time_off_requests')
        .select('id, coverage_request_id')
        .in('id', timeOffRequestIds)

      const coverageRequestIds = (torRows || [])
        .map((r: { id: string; coverage_request_id: string | null }) => r.coverage_request_id)
        .filter(Boolean) as string[]

      if (coverageRequestIds.length > 0) {
        const { data: crShifts } = await supabase
          .from('coverage_request_shifts')
          .select('id, coverage_request_id, date, time_slot_id, classroom_id, time_slots(code)')
          .in('coverage_request_id', coverageRequestIds)
          .eq('status', 'active')

        const crIdToTorId = new Map(
          (torRows || [])
            .filter((r: { coverage_request_id: string | null }) => r.coverage_request_id != null)
            .map((r: { id: string; coverage_request_id: string | null }) => [
              r.coverage_request_id as string,
              r.id,
            ])
        )

        for (const row of crShifts || []) {
          const crId = (row as { coverage_request_id?: string }).coverage_request_id
          const torId = crId ? crIdToTorId.get(crId) : undefined
          if (!torId) continue
          const code = (row.time_slots as { code?: string } | null)?.code ?? ''
          const dateStr = toDateStringISO(row.date)
          const keyFull = `${dateStr}|${code}|${row.classroom_id ?? ''}`
          const keySimple = `${dateStr}|${code}`
          if (!shiftMapByRequest.has(torId)) {
            shiftMapByRequest.set(torId, new Map())
          }
          const map = shiftMapByRequest.get(torId)!
          map.set(keyFull, row.id)
          if (!map.has(keySimple)) map.set(keySimple, row.id)
        }
      }
    }

    const { data: assignments } = await supabase
      .from('sub_assignments')
      .select(
        'id, sub_id, date, day_of_week_id, time_slot_id, classroom_id, coverage_request_shift_id, staff!sub_assignments_sub_id_fkey(first_name, last_name, display_name), time_slots(code)'
      )
      .eq('teacher_id', teacher_id)
      .eq('status', 'active')
      .gte('date', startDateNorm)
      .lte('date', endDateNorm || startDateNorm)

    const assignmentCrShiftByShiftId = new Map<string, string>()
    if (rawShifts.length === 0 && (assignments?.length ?? 0) > 0) {
      rawShifts = assignments!.map((a: Record<string, unknown>) => {
        const dateStr = toDateStringISO(a.date as string)
        const code = (a.time_slots as { code?: string } | null)?.code ?? ''
        const id = `${dateStr}|${a.day_of_week_id ?? ''}|${a.time_slot_id}|${a.classroom_id ?? ''}`
        const crShiftId = a.coverage_request_shift_id as string | undefined
        if (crShiftId) assignmentCrShiftByShiftId.set(id, crShiftId)
        return {
          id,
          date: dateStr,
          day_of_week_id: String(a.day_of_week_id ?? ''),
          time_slot_id: String(a.time_slot_id ?? ''),
          time_slot_code: code,
          classroom_id: (a.classroom_id as string) ?? null,
          has_time_off: Boolean(crShiftId),
          time_off_request_id: null,
        } satisfies AssignSubShiftRow
      })
    }

    const assignmentByKey = new Map<string, { id: string; sub_id: string; sub_name: string }>()
    for (const a of assignments || []) {
      const key = `${toDateStringISO(a.date)}|${a.time_slot_id}`
      const sub = (
        a as { staff?: { first_name?: string; last_name?: string; display_name?: string } | null }
      ).staff
      const sub_name = sub
        ? getStaffDisplayName({
            first_name: sub.first_name ?? '',
            last_name: sub.last_name ?? '',
            display_name: sub.display_name ?? null,
          })
        : 'Unknown'
      assignmentByKey.set(key, { id: a.id, sub_id: a.sub_id, sub_name })
    }

    const shifts = rawShifts.map(shift => {
      const base = {
        ...shift,
        school_closure: isSlotClosedOnDate(shift.date, shift.time_slot_id, closureList),
      }
      const dateStr = toDateStringISO(shift.date)
      const keyFull = `${dateStr}|${shift.time_slot_code ?? ''}|${shift.classroom_id ?? ''}`
      const keySimple = `${dateStr}|${shift.time_slot_code ?? ''}`
      let coverage_request_shift_id: string | null = null
      const fromAssignment = assignmentCrShiftByShiftId.get(shift.id)
      if (fromAssignment) {
        coverage_request_shift_id = fromAssignment
      } else if (shift.time_off_request_id) {
        const map = shiftMapByRequest.get(shift.time_off_request_id)
        coverage_request_shift_id = (map?.get(keyFull) ?? map?.get(keySimple) ?? null) || null
      }
      const assignKey = `${dateStr}|${shift.time_slot_id}`
      const assignment = assignmentByKey.get(assignKey)
      return {
        ...base,
        coverage_request_shift_id: coverage_request_shift_id ?? undefined,
        assignment_id: assignment?.id,
        assigned_sub_id: assignment?.sub_id,
        assigned_sub_name: assignment?.sub_name,
      }
    })

    return NextResponse.json({ shifts })
  } catch (error) {
    console.error('Error fetching assign-sub shifts:', error)
    return createErrorResponse(error, getErrorMessage(error), 500)
  }
}
