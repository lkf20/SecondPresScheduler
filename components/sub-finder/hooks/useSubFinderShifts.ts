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
    if (!absence?.shifts?.shift_details?.length) return []
    return absence.shifts.shift_details.map(shift => ({
      id: shift.id,
      date: shift.date,
      day_name: shift.day_name,
      time_slot_code: shift.time_slot_code,
      class_name: shift.class_name ?? null,
      classroom_name: shift.classroom_name ?? null,
      classroom_color: shift.classroom_color ?? null,
      status: shift.status,
      sub_name: shift.sub_name ?? null,
      is_partial: shift.is_partial ?? false,
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
