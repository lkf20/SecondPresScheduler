import { parseLocalDate } from '@/lib/utils/date'

export type CoverageShiftDetail = {
  id: string
  date: string
  day_name: string
  time_slot_code: string
  status: 'uncovered' | 'partially_covered' | 'fully_covered'
  sub_name?: string | null
  is_partial?: boolean
}

export const sortCoverageShifts = (shiftDetails: CoverageShiftDetail[]) =>
  [...shiftDetails].sort((a, b) => {
    const dateA = parseLocalDate(a.date).getTime()
    const dateB = parseLocalDate(b.date).getTime()
    if (dateA !== dateB) return dateA - dateB
    return a.time_slot_code.localeCompare(b.time_slot_code)
  })

export const buildCoverageSegments = (shiftDetails: CoverageShiftDetail[]) =>
  shiftDetails.map(shift => ({
    id: shift.id,
    status: shift.status,
  }))
