/**
 * Tests for time-off-card-data transform (request_status, coverage counts, status, invariant)
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

function makeShift(
  id: string,
  date: string,
  timeSlotId: string,
  dayOfWeekId?: string
): Parameters<typeof transformTimeOffCardData>[1][number] {
  return {
    id,
    date,
    day_of_week_id: dayOfWeekId ?? 'dow-1',
    time_slot_id: timeSlotId,
    day_of_week: { name: 'Monday' },
    time_slot: { code: 'AM', name: 'Morning' },
  }
}

function makeAssignment(
  date: string,
  timeSlotId: string,
  options?: { is_partial?: boolean; assignment_type?: string; subName?: string }
): Parameters<typeof transformTimeOffCardData>[2][number] {
  const sub = options?.subName
    ? {
        first_name: options.subName.split(' ')[0],
        last_name: options.subName.split(' ')[1] ?? '',
        display_name: null as string | null,
      }
    : undefined
  return {
    date,
    time_slot_id: timeSlotId,
    is_partial: options?.is_partial ?? false,
    assignment_type: options?.assignment_type ?? null,
    sub: sub ?? null,
  }
}

describe('transformTimeOffCardData', () => {
  describe('request_status', () => {
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

  describe('coverage counts and status', () => {
    it('all shifts uncovered -> needs_coverage, uncovered = total', () => {
      const shifts = [
        makeShift('s1', '2026-02-10', 'slot-1'),
        makeShift('s2', '2026-02-10', 'slot-2'),
      ]
      const result = transformTimeOffCardData(minimalRequest, shifts, noAssignments, noClassrooms)
      expect(result.covered).toBe(0)
      expect(result.partial).toBe(0)
      expect(result.uncovered).toBe(2)
      expect(result.total).toBe(2)
      expect(result.status).toBe('needs_coverage')
    })

    it('all shifts covered -> covered, covered = total', () => {
      const shifts = [
        makeShift('s1', '2026-02-10', 'slot-1'),
        makeShift('s2', '2026-02-10', 'slot-2'),
      ]
      const assignments = [
        makeAssignment('2026-02-10', 'slot-1'),
        makeAssignment('2026-02-10', 'slot-2'),
      ]
      const result = transformTimeOffCardData(minimalRequest, shifts, assignments, noClassrooms)
      expect(result.covered).toBe(2)
      expect(result.partial).toBe(0)
      expect(result.uncovered).toBe(0)
      expect(result.total).toBe(2)
      expect(result.status).toBe('covered')
    })

    it('mixed covered, partial, uncovered -> partially_covered', () => {
      const shifts = [
        makeShift('s1', '2026-02-10', 'slot-1'),
        makeShift('s2', '2026-02-10', 'slot-2'),
        makeShift('s3', '2026-02-11', 'slot-1'),
      ]
      const assignments = [
        makeAssignment('2026-02-10', 'slot-1'),
        makeAssignment('2026-02-10', 'slot-2', { is_partial: true }),
      ]
      const result = transformTimeOffCardData(minimalRequest, shifts, assignments, noClassrooms)
      expect(result.covered).toBe(1)
      expect(result.partial).toBe(1)
      expect(result.uncovered).toBe(1)
      expect(result.total).toBe(3)
      expect(result.status).toBe('partially_covered')
    })

    it('partial-only assignment counts as partial, status needs_coverage (no full coverage)', () => {
      const shifts = [makeShift('s1', '2026-02-10', 'slot-1')]
      const assignments = [
        makeAssignment('2026-02-10', 'slot-1', {
          is_partial: true,
          assignment_type: 'Partial Sub Shift',
        }),
      ]
      const result = transformTimeOffCardData(minimalRequest, shifts, assignments, noClassrooms)
      expect(result.covered).toBe(0)
      expect(result.partial).toBe(1)
      expect(result.uncovered).toBe(0)
      expect(result.status).toBe('needs_coverage')
    })

    it('invariant: covered + partial + uncovered === total', () => {
      const shifts = [
        makeShift('s1', '2026-02-10', 'slot-1'),
        makeShift('s2', '2026-02-10', 'slot-2'),
        makeShift('s3', '2026-02-11', 'slot-1'),
      ]
      const assignments = [
        makeAssignment('2026-02-10', 'slot-1'),
        makeAssignment('2026-02-10', 'slot-2', { is_partial: true }),
      ]
      const result = transformTimeOffCardData(minimalRequest, shifts, assignments, noClassrooms)
      expect(result.covered + result.partial + result.uncovered).toBe(result.total)
    })
  })

  describe('date format matching', () => {
    it('matches assignment when date is ISO timestamp', () => {
      const shifts = [makeShift('s1', '2026-02-10', 'slot-1')]
      const assignments = [makeAssignment('2026-02-10T00:00:00.000Z', 'slot-1')]
      const result = transformTimeOffCardData(minimalRequest, shifts, assignments, noClassrooms)
      expect(result.covered).toBe(1)
      expect(result.uncovered).toBe(0)
    })

    it('matches assignment when shift date is ISO timestamp', () => {
      const shifts = [{ ...makeShift('s1', '2026-02-10T00:00:00.000Z', 'slot-1') }]
      const assignments = [makeAssignment('2026-02-10', 'slot-1')]
      const result = transformTimeOffCardData(minimalRequest, shifts, assignments, noClassrooms)
      expect(result.covered).toBe(1)
      expect(result.uncovered).toBe(0)
    })
  })

  describe('empty inputs', () => {
    it('zero shifts -> zero counts, status needs_coverage (not covered)', () => {
      const result = transformTimeOffCardData(minimalRequest, noShifts, noAssignments, noClassrooms)
      expect(result.covered).toBe(0)
      expect(result.partial).toBe(0)
      expect(result.uncovered).toBe(0)
      expect(result.total).toBe(0)
      expect(result.status).toBe('needs_coverage')
    })

    it('shifts with no matching assignments -> all uncovered', () => {
      const shifts = [
        makeShift('s1', '2026-02-10', 'slot-1'),
        makeShift('s2', '2026-02-11', 'slot-2'),
      ]
      const assignments = [
        makeAssignment('2026-02-10', 'slot-2'),
        makeAssignment('2026-02-12', 'slot-1'),
      ]
      const result = transformTimeOffCardData(minimalRequest, shifts, assignments, noClassrooms)
      expect(result.covered).toBe(0)
      expect(result.partial).toBe(0)
      expect(result.uncovered).toBe(2)
    })
  })

  describe('teacher name', () => {
    it('uses teacher first/last for name when displayNameFormat provided', () => {
      const result = transformTimeOffCardData(
        minimalRequest,
        noShifts,
        noAssignments,
        noClassrooms,
        { displayNameFormat: 'first_last_initial' }
      )
      expect(result.teacher_name).toBe('Jane D.')
    })

    it('falls back to first/last when display_name null', () => {
      const result = transformTimeOffCardData(
        minimalRequest,
        noShifts,
        noAssignments,
        noClassrooms,
        { displayNameFormat: 'first_last_initial' }
      )
      expect(result.teacher_name).toBe('Jane D.')
    })
  })
})
