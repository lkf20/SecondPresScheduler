import { withFixedNow } from '@/tests/helpers/date'

describe('withFixedNow', () => {
  it('temporarily overrides Date.now and restores it after run', async () => {
    const before = Date.now()
    const target = '2026-01-15T10:30:00.000Z'

    const value = await withFixedNow(target, () => Date.now())
    expect(value).toBe(new Date(target).getTime())
    expect(Date.now()).not.toBe(value)
    expect(Date.now()).toBeGreaterThanOrEqual(before)
  })
})
