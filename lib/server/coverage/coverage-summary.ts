import { sortShiftDetailsByDisplayOrder } from '@/lib/utils/shift-display-order'

export type CoverageShiftDetail = {
  id: string
  date: string
  day_name: string
  time_slot_code: string
  status: 'uncovered' | 'partially_covered' | 'fully_covered'
  sub_name?: string | null
  is_partial?: boolean
  /** For display order (date → day → time_slot per AGENTS.md) */
  day_display_order?: number | null
  time_slot_display_order?: number | null
}

export const sortCoverageShifts = (shiftDetails: CoverageShiftDetail[]) =>
  sortShiftDetailsByDisplayOrder(shiftDetails)

export const buildCoverageSegments = (shiftDetails: CoverageShiftDetail[]) =>
  shiftDetails.map(shift => ({
    id: shift.id,
    status: shift.status,
  }))
