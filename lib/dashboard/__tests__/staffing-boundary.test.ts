import {
  getDefaultLastDayOfSchool,
  getStaffingEndDate,
  getStaffingWeeksLabel,
  getStaffingWeeksLabelFromCount,
  getStaffingWeeksNumber,
} from '../staffing-boundary'

describe('staffing-boundary', () => {
  describe('getDefaultLastDayOfSchool', () => {
    it('returns last Friday of May for the given year', () => {
      expect(getDefaultLastDayOfSchool(2026)).toBe('2026-05-29')
      expect(getDefaultLastDayOfSchool(2025)).toBe('2025-05-30')
      expect(getDefaultLastDayOfSchool(2024)).toBe('2024-05-31')
    })
  })

  describe('getStaffingEndDate', () => {
    const boundary2026 = getDefaultLastDayOfSchool(2026) // 2026-05-29

    it('returns start + 12 weeks when that is before boundary (uses last Friday of May when no lastDayOfSchool)', () => {
      expect(getStaffingEndDate('2026-01-01')).toBe('2026-03-26') // 84 days later
      expect(getStaffingEndDate('2026-02-01')).toBe('2026-04-26')
    })

    it('returns boundary when start + 12 weeks would be after boundary', () => {
      // 12 weeks from 2026-03-07 is 2026-05-30 > 2026-05-29, so cap at boundary
      expect(getStaffingEndDate('2026-03-07')).toBe(boundary2026)
      expect(getStaffingEndDate('2026-03-09')).toBe(boundary2026)
      expect(getStaffingEndDate('2026-05-01')).toBe(boundary2026)
    })

    it('uses custom lastDayOfSchool when provided', () => {
      expect(getStaffingEndDate('2026-03-01', '2026-05-14')).toBe('2026-05-14')
      expect(getStaffingEndDate('2026-01-01', '2026-05-14')).toBe('2026-03-26') // 12 weeks before May 14
    })
  })

  describe('getStaffingWeeksLabel', () => {
    it('returns "12 or more weeks" when range is not capped and spans 12+ weeks', () => {
      expect(getStaffingWeeksLabel('2026-01-01', '2026-03-26')).toBe('12 or more weeks')
      expect(getStaffingWeeksLabel('2026-02-01', '2026-04-20')).toBe('12 or more weeks')
    })

    it('returns "X weeks" when end is at or after boundary (default last Friday of May)', () => {
      const boundary = getDefaultLastDayOfSchool(2026) // 2026-05-29
      // Mar 9 to May 29 = 81 days → 12 weeks; Mar 1 to May 29 = 89 days → 13 weeks
      expect(getStaffingWeeksLabel('2026-03-09', boundary)).toBe('12 weeks')
      expect(getStaffingWeeksLabel('2026-03-01', boundary)).toBe('13 weeks')
      expect(getStaffingWeeksLabel(boundary, boundary)).toBe('1 week')
    })

    it('uses custom lastDayOfSchool when provided', () => {
      expect(getStaffingWeeksLabel('2026-03-09', '2026-05-14', '2026-05-14')).toBe('10 weeks')
    })

    it('returns "X weeks" when run is shorter than 12 weeks and before boundary', () => {
      expect(getStaffingWeeksLabel('2026-03-09', '2026-03-30')).toBe('3 weeks')
      expect(getStaffingWeeksLabel('2026-03-09', '2026-03-16')).toBe('1 week')
    })
  })

  describe('getStaffingWeeksLabelFromCount', () => {
    it('returns "0 weeks" for 0', () => {
      expect(getStaffingWeeksLabelFromCount(0)).toBe('0 weeks')
    })
    it('returns "1 week" for 1', () => {
      expect(getStaffingWeeksLabelFromCount(1)).toBe('1 week')
    })
    it('returns "X weeks" for 2–11', () => {
      expect(getStaffingWeeksLabelFromCount(2)).toBe('2 weeks')
      expect(getStaffingWeeksLabelFromCount(5)).toBe('5 weeks')
      expect(getStaffingWeeksLabelFromCount(11)).toBe('11 weeks')
    })
    it('returns "12 or more weeks" for 12+', () => {
      expect(getStaffingWeeksLabelFromCount(12)).toBe('12 or more weeks')
      expect(getStaffingWeeksLabelFromCount(20)).toBe('12 or more weeks')
    })
  })

  describe('getStaffingWeeksNumber', () => {
    it('returns weeks from start to end when end is before boundary', () => {
      expect(getStaffingWeeksNumber('2026-03-09', '2026-04-06')).toBe(4)
      expect(getStaffingWeeksNumber('2026-03-09', '2026-05-11')).toBe(9)
    })

    it('returns weeks from start to boundary when end is at or after boundary', () => {
      const boundary = getDefaultLastDayOfSchool(2026) // 2026-05-29; Mar 9 to May 29 = 81 days → 12 weeks
      expect(getStaffingWeeksNumber('2026-03-09', boundary)).toBe(12)
      expect(getStaffingWeeksNumber('2026-03-09', '2026-06-01')).toBe(12)
    })

    it('uses custom lastDayOfSchool when provided', () => {
      expect(getStaffingWeeksNumber('2026-03-09', '2026-05-14', '2026-05-14')).toBe(10)
    })
  })
})
