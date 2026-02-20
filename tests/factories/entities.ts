import type { SubFinderShift } from '@/lib/sub-finder/types'

export const buildSubFinderShift = (overrides: Partial<SubFinderShift> = {}): SubFinderShift => ({
  id: 'shift-1',
  date: '2026-02-20',
  day_name: 'Friday',
  time_slot_code: 'AM',
  classroom_name: 'Infant Room',
  classroom_color: '#bfdbfe',
  class_name: 'Infants',
  status: 'uncovered',
  sub_name: null,
  is_partial: false,
  assignment_status: null,
  contact_status: null,
  ...overrides,
})
