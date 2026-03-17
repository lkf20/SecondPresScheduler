import {
  getAssignmentCoverageWeight,
  getPartialAssignmentWeight,
  deriveShiftCoverageStatus,
  getSlotCoverageTotalWeekly,
  getSlotCoverageTotalBaseline,
  PARTIAL_APPROX_LABEL,
  PARTIAL_APPROX_TOOLTIP,
} from '../coverage-weights'

describe('coverage-weights', () => {
  describe('PARTIAL_APPROX_LABEL / PARTIAL_APPROX_TOOLTIP', () => {
    it('PARTIAL_APPROX_LABEL is "(approx.)"', () => {
      expect(PARTIAL_APPROX_LABEL).toBe('(approx.)')
    })
    it('PARTIAL_APPROX_TOOLTIP contains "50%"', () => {
      expect(PARTIAL_APPROX_TOOLTIP).toContain('50%')
    })
  })

  describe('getAssignmentCoverageWeight', () => {
    it('returns 0.5 for floater', () => {
      expect(getAssignmentCoverageWeight({ teacher_id: '1', is_floater: true })).toBe(0.5)
    })
    it('returns 0.5 for partial sub assignment', () => {
      expect(
        getAssignmentCoverageWeight({ teacher_id: '1', is_floater: false, is_partial: true })
      ).toBe(0.5)
    })
    it('returns 1 for permanent', () => {
      expect(getAssignmentCoverageWeight({ teacher_id: '1', is_floater: false })).toBe(1)
    })
    it('returns 1 for sub (full assignment)', () => {
      expect(
        getAssignmentCoverageWeight({ teacher_id: '1', is_substitute: true, is_floater: false })
      ).toBe(1)
    })
    it('returns 1 for flex/temp', () => {
      expect(
        getAssignmentCoverageWeight({ teacher_id: '1', is_flexible: true, is_floater: false })
      ).toBe(1)
    })
    it('returns 0 when no teacher_id', () => {
      expect(getAssignmentCoverageWeight({ is_floater: false })).toBe(0)
    })
  })

  describe('getPartialAssignmentWeight', () => {
    it('returns 0.5 (Phase 1 fixed approximation)', () => {
      expect(getPartialAssignmentWeight()).toBe(0.5)
    })
  })

  describe('deriveShiftCoverageStatus', () => {
    it('returns uncovered when no assignments', () => {
      expect(deriveShiftCoverageStatus({ assignments: [] })).toBe('uncovered')
    })

    it('returns fully_covered for one full assignment', () => {
      expect(deriveShiftCoverageStatus({ assignments: [{ is_partial: false }] })).toBe(
        'fully_covered'
      )
    })

    it('returns partially_covered for one partial assignment', () => {
      expect(deriveShiftCoverageStatus({ assignments: [{ is_partial: true }] })).toBe(
        'partially_covered'
      )
    })

    it('returns fully_covered for two partial assignments (weight >= 1.0)', () => {
      expect(
        deriveShiftCoverageStatus({ assignments: [{ is_partial: true }, { is_partial: true }] })
      ).toBe('fully_covered')
    })

    it('returns fully_covered for three or more partial assignments', () => {
      expect(
        deriveShiftCoverageStatus({
          assignments: [{ is_partial: true }, { is_partial: true }, { is_partial: true }],
        })
      ).toBe('fully_covered')
    })

    it('returns fully_covered when any assignment is full (even if others are partial)', () => {
      // This state should not occur (business rules prevent full+partial mix),
      // but deriveShiftCoverageStatus is defensive.
      expect(
        deriveShiftCoverageStatus({ assignments: [{ is_partial: false }, { is_partial: true }] })
      ).toBe('fully_covered')
    })
  })

  describe('getSlotCoverageTotalWeekly', () => {
    it('sums assignment weights and subtracts absences', () => {
      const slot = {
        assignments: [
          { teacher_id: '1', is_floater: false },
          { teacher_id: '2', is_floater: true },
          { teacher_id: '3', is_substitute: true },
        ],
        absences: [{}, {}],
      }
      expect(getSlotCoverageTotalWeekly(slot)).toBe(1 + 0.5 + 1 - 2)
    })
    it('handles empty assignments and no absences', () => {
      expect(getSlotCoverageTotalWeekly({ assignments: [], absences: [] })).toBe(0)
    })
  })

  describe('getSlotCoverageTotalBaseline', () => {
    it('counts permanent, flex, and floater; excludes only substitutes', () => {
      const slot = {
        assignments: [
          { teacher_id: '1', is_floater: false },
          { teacher_id: '2', is_floater: true },
          { teacher_id: '3', is_substitute: true },
          { teacher_id: '4', is_flexible: true },
        ],
      }
      expect(getSlotCoverageTotalBaseline(slot)).toBe(1 + 0.5 + 1)
    })
    it('ignores absences (baseline has no time-based events)', () => {
      const slot = {
        assignments: [{ teacher_id: '1', is_floater: false }],
        absences: [{}, {}],
      }
      expect(getSlotCoverageTotalBaseline(slot)).toBe(1)
    })
  })
})
