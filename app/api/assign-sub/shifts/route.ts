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

    const selectWithOverride =
      'id, sub_id, date, day_of_week_id, time_slot_id, classroom_id, coverage_request_shift_id, non_sub_override, is_partial, partial_start_time, partial_end_time, created_at, staff!sub_assignments_sub_id_fkey(first_name, last_name, display_name), time_slots(code)'
    const selectWithoutOverride =
      'id, sub_id, date, day_of_week_id, time_slot_id, classroom_id, coverage_request_shift_id, is_partial, partial_start_time, partial_end_time, created_at, staff!sub_assignments_sub_id_fkey(first_name, last_name, display_name), time_slots(code)'

    let { data: assignments, error: assignmentsError } = await supabase
      .from('sub_assignments')
      .select(selectWithOverride)
      .eq('teacher_id', teacher_id)
      .eq('status', 'active')
      .gte('date', startDateNorm)
      .lte('date', endDateNorm || startDateNorm)

    if (
      assignmentsError &&
      (assignmentsError.code === '42703' || /non_sub_override/i.test(assignmentsError.message))
    ) {
      const fallback = await supabase
        .from('sub_assignments')
        .select(selectWithoutOverride)
        .eq('teacher_id', teacher_id)
        .eq('status', 'active')
        .gte('date', startDateNorm)
        .lte('date', endDateNorm || startDateNorm)
      assignments = fallback.data as any
      assignmentsError = fallback.error as any
    }

    if (assignmentsError) {
      throw assignmentsError
    }

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

    // Multi-value maps for assignment lookup:
    // 1) coverage_request_shift_id (preferred, exact identity for time-off-backed shifts)
    // 2) date|time_slot_id|classroom_id fallback for non-time-off / legacy rows
    const assignmentByCoverageShiftId = new Map<
      string,
      Array<{
        id: string
        sub_id: string
        sub_name: string
        non_sub_override: boolean
        is_partial: boolean
        partial_start_time: string | null
        partial_end_time: string | null
        created_at: string
      }>
    >()
    const assignmentBySlotClassKey = new Map<
      string,
      Array<{
        id: string
        sub_id: string
        sub_name: string
        non_sub_override: boolean
        is_partial: boolean
        partial_start_time: string | null
        partial_end_time: string | null
        created_at: string
      }>
    >()
    for (const a of assignments || []) {
      const dateISO = toDateStringISO(a.date)
      const slotClassKey = `${dateISO}|${a.time_slot_id}|${a.classroom_id ?? ''}`
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
      const entry = {
        id: a.id,
        sub_id: a.sub_id,
        sub_name,
        non_sub_override: (a as any).non_sub_override === true,
        is_partial: (a as any).is_partial === true,
        partial_start_time: (a as any).partial_start_time ?? null,
        partial_end_time: (a as any).partial_end_time ?? null,
        created_at: (a as any).created_at ?? '',
      }
      const coverageShiftId = (a as any).coverage_request_shift_id as string | null | undefined
      if (coverageShiftId) {
        const existingByCrShift = assignmentByCoverageShiftId.get(coverageShiftId)
        if (existingByCrShift) {
          existingByCrShift.push(entry)
        } else {
          assignmentByCoverageShiftId.set(coverageShiftId, [entry])
        }
      }

      const existingBySlotClass = assignmentBySlotClassKey.get(slotClassKey)
      if (existingBySlotClass) {
        existingBySlotClass.push(entry)
      } else {
        assignmentBySlotClassKey.set(slotClassKey, [entry])
      }
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
        const fromFull = map?.get(keyFull)
        const fromSimple = map?.get(keySimple)
        if (!fromFull && fromSimple && keyFull !== keySimple) {
          console.warn(
            '[assign-sub/shifts] Used keySimple fallback for coverage_request_shift lookup',
            {
              teacher_id,
              date: dateStr,
              keyFull,
              keySimple,
              time_off_request_id: shift.time_off_request_id,
            }
          )
        }
        coverage_request_shift_id = (fromFull ?? fromSimple ?? null) || null
      }
      const slotClassKey = `${dateStr}|${shift.time_slot_id}|${shift.classroom_id ?? ''}`
      const assignmentList =
        (coverage_request_shift_id
          ? assignmentByCoverageShiftId.get(coverage_request_shift_id)
          : undefined) ??
        assignmentBySlotClassKey.get(slotClassKey) ??
        []

      // Deterministic primary assignment: prefer active full (is_partial=false) first,
      // then most recently created partial (ORDER BY is_partial ASC, created_at DESC, id DESC).
      // This ensures legacy single-value fields remain stable and predictable for consumers
      // that have not yet migrated to the assigned_subs array.
      const sortedAssignments = [...assignmentList].sort((a, b) => {
        if (a.is_partial !== b.is_partial) return a.is_partial ? 1 : -1
        if (a.created_at !== b.created_at) return a.created_at > b.created_at ? -1 : 1
        return a.id > b.id ? -1 : 1
      })
      const primary = sortedAssignments[0]

      return {
        ...base,
        coverage_request_shift_id: coverage_request_shift_id ?? undefined,
        // Legacy single-value fields (backward compatible; populated from primary assignment)
        assignment_id: primary?.id,
        assigned_sub_id: primary?.sub_id,
        assigned_sub_name: primary?.sub_name,
        assigned_non_sub_override: primary?.non_sub_override ?? false,
        // New multi-value field for partial assignment support
        assigned_subs:
          sortedAssignments.length > 0
            ? sortedAssignments.map(a => ({
                assignment_id: a.id,
                sub_id: a.sub_id,
                sub_name: a.sub_name,
                is_partial: a.is_partial,
                partial_start_time: a.partial_start_time,
                partial_end_time: a.partial_end_time,
                non_sub_override: a.non_sub_override,
              }))
            : undefined,
      }
    })

    return NextResponse.json({ shifts })
  } catch (error) {
    console.error('Error fetching assign-sub shifts:', error)
    return createErrorResponse(error, getErrorMessage(error), 500)
  }
}
