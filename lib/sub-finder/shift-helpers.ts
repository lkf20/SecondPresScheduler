import { parseLocalDate } from '@/lib/utils/date'
import { sortShiftDetailsByDisplayOrder } from '@/lib/utils/shift-display-order'
import type { SubFinderShift, SubFinderShiftSummary } from '@/lib/sub-finder/types'

export function getShiftKey(
  shift: Pick<SubFinderShift, 'date' | 'time_slot_code'> & {
    classroom_id?: string | null
    classroom_name?: string | null
  }
): string {
  if (shift.classroom_id) return `${shift.date}|${shift.time_slot_code}|${shift.classroom_id}`
  if (shift.classroom_name) return `${shift.date}|${shift.time_slot_code}|${shift.classroom_name}`
  return `${shift.date}|${shift.time_slot_code}`
}

/** Sorts by date → day_display_order → time_slot_display_order (AGENTS.md). */
export function sortShiftDetails(shifts: SubFinderShift[]): SubFinderShift[] {
  return sortShiftDetailsByDisplayOrder(shifts)
}

export function filterVisibleShifts<T extends { date: string }>(
  shifts: T[],
  includePastShifts: boolean
): T[] {
  if (includePastShifts) return shifts
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return shifts.filter(shift => {
    const shiftDate = parseLocalDate(shift.date)
    shiftDate.setHours(0, 0, 0, 0)
    return shiftDate >= today
  })
}

export function computeShiftCounts(shifts: SubFinderShift[]) {
  let past = 0
  let upcoming = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  shifts.forEach(shift => {
    const shiftDate = parseLocalDate(shift.date)
    shiftDate.setHours(0, 0, 0, 0)
    if (shiftDate < today) {
      past++
    } else {
      upcoming++
    }
  })
  return { past, upcoming }
}

export function buildShiftSummary(shifts: SubFinderShift[]): SubFinderShiftSummary {
  const totals = shifts.reduce(
    (acc, shift) => {
      acc.total++
      if (shift.status === 'uncovered') {
        acc.uncovered++
      } else if (shift.status === 'partially_covered') {
        acc.partially_covered++
      } else {
        acc.fully_covered++
      }
      return acc
    },
    { total: 0, uncovered: 0, partially_covered: 0, fully_covered: 0 }
  )

  const sorted = sortShiftDetails(shifts)

  return {
    total: totals.total,
    uncovered: totals.uncovered,
    partially_covered: totals.partially_covered,
    fully_covered: totals.fully_covered,
    shift_details: shifts,
    shift_details_sorted: sorted,
    coverage_segments: sorted.map(shift => ({
      id: shift.id,
      status: shift.status,
    })),
  }
}
