/** @jest-environment node */
import { validateCalendarPatchBody, isAddClosureRange } from '../calendar-patch-validation'

describe('validateCalendarPatchBody', () => {
  it('returns valid normalized payload for add_closures (single day)', () => {
    const result = validateCalendarPatchBody({
      add_closures: [{ date: '2024-12-25', time_slot_id: null, reason: 'Holiday', notes: null }],
    })
    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.normalized.addClosures).toHaveLength(1)
    expect(result.normalized.addClosures[0]).toMatchObject({
      date: '2024-12-25',
      time_slot_id: null,
      reason: 'Holiday',
      notes: null,
    })
    expect(isAddClosureRange(result.normalized.addClosures[0])).toBe(false)
  })

  it('returns valid normalized payload for add_closure (range)', () => {
    const result = validateCalendarPatchBody({
      add_closure: {
        start_date: '2024-12-24',
        end_date: '2024-12-26',
        reason: 'Break',
        notes: null,
      },
    })
    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.normalized.addClosures).toHaveLength(1)
    expect(isAddClosureRange(result.normalized.addClosures[0])).toBe(true)
    expect(result.normalized.addClosures[0]).toMatchObject({
      start_date: '2024-12-24',
      end_date: '2024-12-26',
      reason: 'Break',
    })
  })

  it('returns 400 when add_closure has no date or range', () => {
    const result = validateCalendarPatchBody({
      add_closure: { time_slot_id: null, reason: 'Test' },
    })
    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.response.status).toBe(400)
  })

  it('returns 400 when start_date > end_date', () => {
    const result = validateCalendarPatchBody({
      add_closures: [
        {
          start_date: '2024-12-26',
          end_date: '2024-12-24',
          reason: 'Test',
        },
      ],
    })
    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.response.status).toBe(400)
  })

  it('returns 400 when range exceeds 365 days', () => {
    const result = validateCalendarPatchBody({
      add_closures: [
        {
          start_date: '2024-01-01',
          end_date: '2025-12-31',
          reason: 'Test',
        },
      ],
    })
    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.response.status).toBe(400)
  })

  it('normalizes update_closure and update_closures into updateClosures array', () => {
    const result = validateCalendarPatchBody({
      update_closure: { id: 'c-1', reason: 'R1', notes: null },
      update_closures: [{ id: 'c-2', reason: 'R2' }],
    })
    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.normalized.updateClosures).toHaveLength(2)
    expect(result.normalized.updateClosures[0]).toEqual({
      id: 'c-1',
      reason: 'R1',
      notes: null,
    })
    expect(result.normalized.updateClosures[1]).toMatchObject({ id: 'c-2', reason: 'R2' })
  })
})
