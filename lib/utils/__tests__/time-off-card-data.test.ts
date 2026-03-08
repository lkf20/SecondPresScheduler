/**
 * Tests for time-off-card-data transform (request_status, etc.)
 */

import { transformTimeOffCardData } from '../time-off-card-data'

const minimalRequest = {
  id: 'req-1',
  teacher_id: 'teacher-1',
  start_date: '2026-02-10',
  end_date: '2026-02-10',
  reason: null as string | null,
  notes: null as string | null,
  teacher: { first_name: 'Jane', last_name: 'Doe', display_name: null as string | null },
}
const noShifts: Parameters<typeof transformTimeOffCardData>[1] = []
const noAssignments: Parameters<typeof transformTimeOffCardData>[2] = []
const noClassrooms: Parameters<typeof transformTimeOffCardData>[3] = []

describe('transformTimeOffCardData', () => {
  it('includes request_status from input when provided', () => {
    const result = transformTimeOffCardData(
      { ...minimalRequest, request_status: 'draft' },
      noShifts,
      noAssignments,
      noClassrooms
    )
    expect(result.request_status).toBe('draft')
  })

  it('defaults request_status to "active" when missing', () => {
    const result = transformTimeOffCardData(minimalRequest, noShifts, noAssignments, noClassrooms)
    expect(result.request_status).toBe('active')
  })

  it('passes through request_status "cancelled"', () => {
    const result = transformTimeOffCardData(
      { ...minimalRequest, request_status: 'cancelled' },
      noShifts,
      noAssignments,
      noClassrooms
    )
    expect(result.request_status).toBe('cancelled')
  })
})
