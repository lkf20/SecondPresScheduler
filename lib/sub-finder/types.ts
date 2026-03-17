export type SubFinderCoverageStatus = 'uncovered' | 'partially_covered' | 'fully_covered'
export type SubFinderAssignmentStatus = 'pending' | 'confirmed' | 'declined' | 'no_response'

export interface SubFinderAssignedSub {
  assignment_id: string
  sub_id: string
  sub_name: string
  is_partial: boolean
  partial_start_time?: string | null
  partial_end_time?: string | null
  non_sub_override?: boolean
}

export interface SubFinderShift {
  id: string
  date: string
  day_name: string
  time_slot_code: string
  classroom_name: string | null
  classroom_color?: string | null
  class_name: string | null
  status: SubFinderCoverageStatus
  sub_name?: string | null
  sub_id?: string | null
  assignment_id?: string | null
  is_partial?: boolean
  assignment_status?: SubFinderAssignmentStatus | null
  contact_status?: SubFinderAssignmentStatus | null
  /** Multiple subs for partially covered shifts (each partial assignment has its own entry) */
  assigned_subs?: SubFinderAssignedSub[]
  /** For display order: date → day → time_slot (AGENTS.md) */
  day_display_order?: number | null
  time_slot_display_order?: number | null
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
