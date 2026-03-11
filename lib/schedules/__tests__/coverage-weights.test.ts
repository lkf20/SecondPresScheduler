import {
  getAssignmentCoverageWeight,
  getSlotCoverageTotalWeekly,
  getSlotCoverageTotalBaseline,
} from '../coverage-weights'

describe('coverage-weights', () => {
  describe('getAssignmentCoverageWeight', () => {
    it('returns 0.5 for floater', () => {
      expect(getAssignmentCoverageWeight({ teacher_id: '1', is_floater: true })).toBe(0.5)
    })
    it('returns 1 for permanent', () => {
      expect(getAssignmentCoverageWeight({ teacher_id: '1', is_floater: false })).toBe(1)
    })
    it('returns 1 for sub', () => {
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
    it('counts only non-sub, non-flex assignments (permanent + floater)', () => {
      const slot = {
        assignments: [
          { teacher_id: '1', is_floater: false },
          { teacher_id: '2', is_floater: true },
          { teacher_id: '3', is_substitute: true },
          { teacher_id: '4', is_flexible: true },
        ],
      }
      expect(getSlotCoverageTotalBaseline(slot)).toBe(1 + 0.5)
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
