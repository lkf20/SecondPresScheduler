export type SubFinderCoverageStatus = 'uncovered' | 'partially_covered' | 'fully_covered'
export type SubFinderAssignmentStatus = 'pending' | 'confirmed' | 'declined' | 'no_response'

export interface SubFinderShift {
  id: string
  date: string
  day_name: string
  time_slot_code: string
  classroom_name: string | null
  class_name: string | null
  status: SubFinderCoverageStatus
  sub_name?: string | null
  is_partial?: boolean
  assignment_status?: SubFinderAssignmentStatus | null
  contact_status?: SubFinderAssignmentStatus | null
}

export interface SubFinderShiftSummary {
  total: number
  uncovered: number
  partially_covered: number
  fully_covered: number
  shift_details: SubFinderShift[]
  shift_details_sorted?: SubFinderShift[]
  coverage_segments?: Array<{
    id: string
    status: SubFinderCoverageStatus
  }>
}
