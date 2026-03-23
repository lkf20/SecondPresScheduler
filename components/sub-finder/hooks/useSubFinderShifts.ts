import { useMemo } from 'react'
import type { Absence } from '@/components/sub-finder/hooks/useSubFinderData'
import type { SubFinderShift, SubFinderShiftSummary } from '@/lib/sub-finder/types'
import {
  buildShiftSummary,
  computeShiftCounts,
  filterVisibleShifts,
} from '@/lib/sub-finder/shift-helpers'

export function useSubFinderShifts(
  absence: Absence | null,
  includePastShifts: boolean
): {
  shiftDetails: SubFinderShift[]
  visibleShiftDetails: SubFinderShift[]
  summary: SubFinderShiftSummary | null
  pastShiftCount: number
  upcomingShiftCount: number
} {
  const shiftDetails = useMemo<SubFinderShift[]>(() => {
    const sourceShifts =
      absence?.shifts?.shift_details_sorted?.length &&
      absence.shifts.shift_details_sorted.length > 0
        ? absence.shifts.shift_details_sorted
        : absence?.shifts?.shift_details
    if (!sourceShifts?.length) return []
    return sourceShifts.map(shift => ({
      id: shift.id,
      date: shift.date,
      day_name: shift.day_name,
      time_slot_code: shift.time_slot_code,
      classroom_id: shift.classroom_id ?? null,
      class_name: shift.class_name ?? null,
      classroom_name: shift.classroom_name ?? null,
      classroom_color: shift.classroom_color ?? null,
      status: shift.status,
      sub_name: shift.sub_name ?? null,
      assigned_sub_names: Array.isArray(shift.assigned_sub_names)
        ? shift.assigned_sub_names
        : undefined,
      assigned_subs: Array.isArray(shift.assigned_subs)
        ? shift.assigned_subs.map(assignment => ({
            assignment_id: assignment.assignment_id,
            sub_id: assignment.sub_id,
            sub_name: assignment.sub_name,
            is_partial: Boolean(assignment.is_partial),
            partial_start_time: assignment.partial_start_time ?? null,
            partial_end_time: assignment.partial_end_time ?? null,
            non_sub_override: Boolean(assignment.non_sub_override),
          }))
        : undefined,
      sub_id: shift.sub_id ?? null,
      assignment_id: shift.assignment_id ?? null,
      is_partial: shift.is_partial ?? false,
      assignment_status: shift.assignment_status ?? null,
      day_display_order: shift.day_display_order ?? null,
      time_slot_display_order: shift.time_slot_display_order ?? null,
    }))
  }, [absence])

  const visibleShiftDetails = useMemo(
    () => filterVisibleShifts(shiftDetails, includePastShifts),
    [shiftDetails, includePastShifts]
  )

  const { past, upcoming } = useMemo(() => computeShiftCounts(shiftDetails), [shiftDetails])

  const summary = useMemo(() => {
    if (!visibleShiftDetails.length) return null
    return buildShiftSummary(visibleShiftDetails)
  }, [visibleShiftDetails])

  return {
    shiftDetails,
    visibleShiftDetails,
    summary,
    pastShiftCount: past,
    upcomingShiftCount: upcoming,
  }
}
