/** @jest-environment node */

import { POST } from '@/app/api/sub-finder/shift-overrides/route'
import { createJsonRequest } from '@/tests/helpers/api'

const mockEq = jest.fn()
const mockSelect = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: mockFrom,
  })),
}))

describe('POST /api/sub-finder/shift-overrides integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEq.mockResolvedValue({
      data: [
        {
          id: 'shift-available',
          date: '2026-02-10',
          time_slots: { code: 'EM' },
        },
        {
          id: 'shift-unavailable',
          date: '2026-02-11',
          time_slots: { code: 'AM' },
        },
      ],
      error: null,
    })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })
  })

  it('returns 400 when coverage_request_id is missing', async () => {
    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/shift-overrides',
      'POST',
      {
        selected_shift_keys: [],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/missing coverage_request_id/i)
  })

  it('returns mapped selected_shift_ids for available and overridden unavailable shifts', async () => {
    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/shift-overrides',
      'POST',
      {
        coverage_request_id: 'coverage-1',
        selected_shift_keys: ['2026-02-10|EM', '2026-02-11|AM'],
        override_shift_keys: ['2026-02-11|AM'],
        available_shift_keys: ['2026-02-10|EM'],
        unavailable_shift_keys: ['2026-02-11|AM'],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.selected_shift_ids).toEqual(['shift-available', 'shift-unavailable'])
    expect(json.shift_overrides).toHaveLength(2)
  })

  it('returns is_floater_shift_ids when multiple shifts share same date and slot (floater)', async () => {
    mockEq.mockResolvedValueOnce({
      data: [
        { id: 'shift-a', date: '2026-02-10', time_slot_id: 'slot-1', time_slots: { code: 'EM' } },
        { id: 'shift-b', date: '2026-02-10', time_slot_id: 'slot-1', time_slots: { code: 'EM' } },
      ],
      error: null,
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/shift-overrides',
      'POST',
      {
        coverage_request_id: 'coverage-1',
        selected_shift_keys: ['2026-02-10|EM'],
        override_shift_keys: [],
        available_shift_keys: ['2026-02-10|EM'],
        unavailable_shift_keys: [],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.selected_shift_ids).toEqual(expect.arrayContaining(['shift-a', 'shift-b']))
    expect(json.is_floater_shift_ids).toEqual(expect.arrayContaining(['shift-a', 'shift-b']))
    expect(json.is_floater_shift_ids).toHaveLength(2)
  })

  it('returns 500 when shift lookup fails', async () => {
    mockEq.mockResolvedValueOnce({
      data: null,
      error: { message: 'query failed' },
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/shift-overrides',
      'POST',
      {
        coverage_request_id: 'coverage-1',
        selected_shift_keys: [],
        override_shift_keys: [],
        available_shift_keys: [],
        unavailable_shift_keys: [],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toMatch(/query failed/i)
  })

  it('dedupes selected_shift_ids when a shift key appears in both available and unavailable lists', async () => {
    mockEq.mockResolvedValueOnce({
      data: [
        {
          id: 'shift-overlap',
          date: '2026-02-12',
          time_slot_id: 'slot-2',
          time_slots: { code: 'LB1' },
        },
      ],
      error: null,
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/shift-overrides',
      'POST',
      {
        coverage_request_id: 'coverage-1',
        selected_shift_keys: ['2026-02-12|LB1'],
        override_shift_keys: ['2026-02-12|LB1'],
        available_shift_keys: ['2026-02-12|LB1'],
        unavailable_shift_keys: ['2026-02-12|LB1'],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.selected_shift_ids).toEqual(['shift-overlap'])
    expect(json.shift_overrides).toHaveLength(1)
  })
})
