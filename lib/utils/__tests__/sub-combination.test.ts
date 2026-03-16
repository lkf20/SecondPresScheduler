import { findTopCombinations } from '../sub-combination'

const createSub = (overrides: {
  id: string
  name: string
  coverage_percent: number
  can_cover: Array<{ date: string; time_slot_code: string }>
}) => ({
  id: overrides.id,
  name: overrides.name,
  phone: null,
  email: null,
  coverage_percent: overrides.coverage_percent,
  can_cover: overrides.can_cover,
  response_status: null,
})

describe('findTopCombinations', () => {
  const shift1 = { date: '2025-03-17', time_slot_code: 'AM' }
  const shift2 = { date: '2025-03-18', time_slot_code: 'AM' }
  const allShifts = [shift1, shift2]
  const shiftKey = (s: { date: string; time_slot_code: string }) => `${s.date}|${s.time_slot_code}`

  it('returns at least all subs with 100% availability when limit is 5', () => {
    // Create 8 subs, each with 100% coverage (can cover both shifts)
    const subs = Array.from({ length: 8 }, (_, i) =>
      createSub({
        id: `sub-${i}`,
        name: `Sub ${i}`,
        coverage_percent: 100,
        can_cover: allShifts.map(s => ({ ...s, day_name: 'Mon', class_name: null })),
      })
    )

    const result = findTopCombinations(subs, 5)

    // Should return 8 combinations (one per 100% sub), not capped at 5
    expect(result.length).toBe(8)
    const subIds = result.map(c =>
      c.subs
        .map(s => s.subId)
        .sort()
        .join('|')
    )
    expect(new Set(subIds).size).toBe(8)
  })

  it('each 100% sub appears as a single-sub combination', () => {
    const subs = [
      createSub({
        id: 'alice',
        name: 'Alice',
        coverage_percent: 100,
        can_cover: allShifts.map(s => ({ ...s, day_name: 'Mon', class_name: null })),
      }),
      createSub({
        id: 'bob',
        name: 'Bob',
        coverage_percent: 100,
        can_cover: allShifts.map(s => ({ ...s, day_name: 'Mon', class_name: null })),
      }),
    ]

    const result = findTopCombinations(subs, 5)

    expect(result.length).toBe(2)
    expect(result[0].subs.length).toBe(1)
    expect(result[1].subs.length).toBe(1)
    expect(result.map(c => c.subs[0].subId).sort()).toEqual(['alice', 'bob'])
  })

  it('still respects limit when no 100% subs', () => {
    const subs = [
      createSub({
        id: 'partial',
        name: 'Partial',
        coverage_percent: 50,
        can_cover: [shift1].map(s => ({ ...s, day_name: 'Mon', class_name: null })),
      }),
      createSub({
        id: 'partial2',
        name: 'Partial 2',
        coverage_percent: 50,
        can_cover: [shift2].map(s => ({ ...s, day_name: 'Mon', class_name: null })),
      }),
    ]

    const result = findTopCombinations(subs, 5)

    // Multi-sub combo or partial combos - limit 5 applies
    expect(result.length).toBeLessThanOrEqual(5)
  })
})
