/** @jest-environment node */

import { POST } from '@/app/api/sub-finder/find-subs-manual/route'
import { createJsonRequest } from '@/tests/helpers/api'
import { getSubs } from '@/lib/api/subs'
import { getSubAvailability, getSubAvailabilityExceptions } from '@/lib/api/sub-availability'
import { getTeacherScheduledShifts, getTimeOffShifts } from '@/lib/api/time-off-shifts'
import { getTimeOffRequests } from '@/lib/api/time-off'

const mockIn = jest.fn()
const mockLte = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: mockFrom,
  })),
}))

jest.mock('@/lib/api/subs', () => ({
  getSubs: jest.fn(async () => []),
}))

jest.mock('@/lib/api/sub-availability', () => ({
  getSubAvailability: jest.fn(async () => []),
  getSubAvailabilityExceptions: jest.fn(async () => []),
}))

jest.mock('@/lib/api/time-off-shifts', () => ({
  getTeacherScheduledShifts: jest.fn(async () => []),
  getTimeOffShifts: jest.fn(async () => []),
}))

jest.mock('@/lib/api/time-off', () => ({
  getTimeOffRequests: jest.fn(async () => []),
}))

jest.mock('@/lib/utils/sub-combination', () => ({
  findTopCombinations: jest.fn(() => []),
}))

jest.mock('@/lib/server/coverage/shift-chips', () => ({
  buildShiftChips: jest.fn(() => []),
}))

describe('POST /api/sub-finder/find-subs-manual integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockIn.mockResolvedValue({ data: [], error: null })
    mockLte.mockResolvedValue({ data: [], error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'days_of_week' || table === 'time_slots') {
        return {
          select: () => ({
            in: mockIn,
          }),
        }
      }

      if (table === 'teacher_schedules') {
        return {
          select: () => ({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }
      }

      if (table === 'sub_assignments') {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lte: mockLte,
              }),
            }),
          }),
        }
      }

      return {
        select: () => ({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }
    })
  })

  it('returns 400 when required fields are missing', async () => {
    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/find-subs-manual',
      'POST',
      {}
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/teacher_id, start_date, end_date, and shifts are required/i)
  })

  it('returns empty payload when shifts array is empty', async () => {
    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/find-subs-manual',
      'POST',
      {
        teacher_id: 'teacher-1',
        start_date: '2026-02-10',
        end_date: '2026-02-10',
        shifts: [],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.subs).toEqual([])
    expect(json.totals).toEqual({ total: 0, uncovered: 0, partially_covered: 0, fully_covered: 0 })
  })

  it('returns manual shift details for a valid request', async () => {
    mockIn
      .mockResolvedValueOnce({
        data: [{ id: 'day-1', name: 'Monday' }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ id: 'slot-1', code: 'EM' }],
        error: null,
      })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'days_of_week' || table === 'time_slots') {
        return {
          select: () => ({
            in: mockIn,
          }),
        }
      }
      if (table === 'teacher_schedules') {
        return {
          select: () => ({
            eq: jest.fn().mockResolvedValue({
              data: [
                {
                  day_of_week_id: 'day-1',
                  time_slot_id: 'slot-1',
                  classroom: { name: 'Infant Room' },
                },
              ],
              error: null,
            }),
          }),
        }
      }
      if (table === 'sub_assignments') {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lte: mockLte,
              }),
            }),
          }),
        }
      }
      return {
        select: () => ({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }
    })

    mockLte.mockResolvedValueOnce({ data: [], error: null })

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/find-subs-manual',
      'POST',
      {
        teacher_id: 'teacher-1',
        start_date: '2026-02-10',
        end_date: '2026-02-10',
        shifts: [
          {
            date: '2026-02-10',
            day_of_week_id: 'day-1',
            time_slot_id: 'slot-1',
          },
        ],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.shift_details).toHaveLength(1)
    expect(json.shift_details[0]).toMatchObject({
      day_name: 'Monday',
      time_slot_code: 'EM',
      classroom_name: 'Infant Room',
      status: 'uncovered',
    })
  })

  it('evaluates a sub candidate and returns availability breakdown', async () => {
    mockIn
      .mockResolvedValueOnce({
        data: [{ id: 'day-1', name: 'Monday' }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ id: 'slot-1', code: 'EM' }],
        error: null,
      })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'days_of_week' || table === 'time_slots') {
        return {
          select: () => ({
            in: mockIn,
          }),
        }
      }
      if (table === 'teacher_schedules') {
        return {
          select: () => ({
            eq: jest.fn().mockResolvedValue({
              data: [
                {
                  day_of_week_id: 'day-1',
                  time_slot_id: 'slot-1',
                  classroom: { name: 'Infant Room' },
                },
              ],
              error: null,
            }),
          }),
        }
      }
      if (table === 'sub_assignments') {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lte: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }
      }
      return {
        select: () => ({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }
    })
    ;(getSubs as jest.Mock).mockResolvedValueOnce([
      {
        id: 'sub-1',
        first_name: 'Sally',
        last_name: 'A',
        display_name: 'Sally A.',
        phone: '555-111-2222',
        email: 'sally@example.com',
        active: true,
        can_change_diapers: true,
        can_lift_children: true,
      },
    ])
    ;(getSubAvailability as jest.Mock).mockResolvedValueOnce([
      { day_of_week_id: 'day-1', time_slot_id: 'slot-1', available: true },
    ])
    ;(getSubAvailabilityExceptions as jest.Mock).mockResolvedValueOnce([])
    ;(getTeacherScheduledShifts as jest.Mock).mockResolvedValueOnce([])

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/find-subs-manual',
      'POST',
      {
        teacher_id: 'teacher-1',
        start_date: '2026-02-10',
        end_date: '2026-02-10',
        shifts: [
          {
            date: '2026-02-10',
            day_of_week_id: 'day-1',
            time_slot_id: 'slot-1',
          },
        ],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.subs).toHaveLength(1)
    expect(json.subs[0]).toMatchObject({
      id: 'sub-1',
      name: 'Sally A.',
      coverage_percent: 100,
      shifts_covered: 1,
      total_shifts: 1,
    })
  })

  it('marks sub as unavailable when there is a schedule conflict', async () => {
    mockIn
      .mockResolvedValueOnce({
        data: [{ id: 'day-1', name: 'Monday' }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ id: 'slot-1', code: 'EM' }],
        error: null,
      })
    ;(getSubs as jest.Mock).mockResolvedValueOnce([
      {
        id: 'sub-1',
        first_name: 'Sally',
        last_name: 'A',
        display_name: 'Sally A.',
        active: true,
      },
    ])
    ;(getSubAvailability as jest.Mock).mockResolvedValueOnce([
      { day_of_week_id: 'day-1', time_slot_id: 'slot-1', available: true },
    ])
    ;(getSubAvailabilityExceptions as jest.Mock).mockResolvedValueOnce([])
    ;(getTeacherScheduledShifts as jest.Mock).mockResolvedValueOnce([
      {
        date: '2026-02-10',
        time_slot_id: 'slot-1',
      },
    ])
    ;(getTimeOffRequests as jest.Mock).mockResolvedValueOnce([])

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/find-subs-manual',
      'POST',
      {
        teacher_id: 'teacher-1',
        start_date: '2026-02-10',
        end_date: '2026-02-10',
        shifts: [
          {
            date: '2026-02-10',
            day_of_week_id: 'day-1',
            time_slot_id: 'slot-1',
          },
        ],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.subs).toHaveLength(1)
    expect(json.subs[0].coverage_percent).toBe(0)
    expect(json.subs[0].cannot_cover[0].reason).toBe('Scheduled to teach')
  })

  it('marks sub as unavailable when there is a time-off conflict', async () => {
    mockIn
      .mockResolvedValueOnce({
        data: [{ id: 'day-1', name: 'Monday' }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ id: 'slot-1', code: 'EM' }],
        error: null,
      })
    ;(getSubs as jest.Mock).mockResolvedValueOnce([
      {
        id: 'sub-1',
        first_name: 'Sally',
        last_name: 'A',
        display_name: 'Sally A.',
        active: true,
      },
    ])
    ;(getSubAvailability as jest.Mock).mockResolvedValueOnce([
      { day_of_week_id: 'day-1', time_slot_id: 'slot-1', available: true },
    ])
    ;(getSubAvailabilityExceptions as jest.Mock).mockResolvedValueOnce([])
    ;(getTeacherScheduledShifts as jest.Mock).mockResolvedValueOnce([])
    ;(getTimeOffRequests as jest.Mock).mockResolvedValueOnce([{ id: 'req-1', teacher_id: 'sub-1' }])
    ;(getTimeOffShifts as jest.Mock).mockResolvedValueOnce([
      {
        date: '2026-02-10',
        time_slot_id: 'slot-1',
      },
    ])

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/find-subs-manual',
      'POST',
      {
        teacher_id: 'teacher-1',
        start_date: '2026-02-10',
        end_date: '2026-02-10',
        shifts: [
          {
            date: '2026-02-10',
            day_of_week_id: 'day-1',
            time_slot_id: 'slot-1',
          },
        ],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.subs).toHaveLength(1)
    expect(json.subs[0].coverage_percent).toBe(0)
    expect(json.subs[0].cannot_cover[0].reason).toBe('Has time off')
  })

  it('returns 500 when request parsing fails', async () => {
    const request = {
      method: 'POST',
      nextUrl: new URL('http://localhost:3000/api/sub-finder/find-subs-manual'),
      headers: new Headers(),
      json: async () => {
        throw new Error('bad json')
      },
    }

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toMatch(/bad json/i)
  })
})
