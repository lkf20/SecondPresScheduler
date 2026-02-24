/** @jest-environment node */

import { GET } from '@/app/api/sub-finder/coverage-request/[absence_id]/assigned-shifts/route'
import { getTimeOffRequestById } from '@/lib/api/time-off'
import { createClient } from '@/lib/supabase/server'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/api/time-off', () => ({
  getTimeOffRequestById: jest.fn(),
}))

describe('GET /api/sub-finder/coverage-request/[absence_id]/assigned-shifts integration', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns 400 when absence_id is missing', async () => {
    const request = {
      nextUrl: new URL('http://localhost:3000/api/sub-finder/coverage-request//assigned-shifts'),
    }
    const response = await GET(request as any, { params: Promise.resolve({ absence_id: '' }) })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/missing absence_id/i)
  })

  it('returns 404 when time off request is not found', async () => {
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValueOnce(null)

    const request = {
      nextUrl: new URL(
        'http://localhost:3000/api/sub-finder/coverage-request/absence-1/assigned-shifts'
      ),
    }
    const response = await GET(request as any, {
      params: Promise.resolve({ absence_id: 'absence-1' }),
    })
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toMatch(/not found/i)
  })

  it('returns 404 when absence has no coverage request id', async () => {
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'absence-1',
      coverage_request_id: null,
    })

    const request = {
      nextUrl: new URL(
        'http://localhost:3000/api/sub-finder/coverage-request/absence-1/assigned-shifts'
      ),
    }
    const response = await GET(request as any, {
      params: Promise.resolve({ absence_id: 'absence-1' }),
    })
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toMatch(/coverage request not found/i)
  })

  it('returns empty totals when coverage request has no shifts', async () => {
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'absence-1',
      coverage_request_id: 'coverage-1',
    })

    const coverageRequestsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { teacher_id: 'teacher-1' }, error: null }),
    }

    const coverageRequestShiftsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    }
    ;(coverageRequestShiftsQuery.eq as jest.Mock)
      .mockReturnValueOnce(coverageRequestShiftsQuery)
      .mockResolvedValueOnce({ data: [], error: null })

    const subAssignmentsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    }
    ;(subAssignmentsQuery.eq as jest.Mock)
      .mockReturnValueOnce(subAssignmentsQuery)
      .mockReturnValueOnce(subAssignmentsQuery)
      .mockReturnValueOnce(subAssignmentsQuery)
      .mockResolvedValueOnce({ data: [], error: null })
    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'coverage_requests') return coverageRequestsQuery
        if (table === 'coverage_request_shifts') return coverageRequestShiftsQuery
        if (table === 'sub_assignments') return subAssignmentsQuery
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = {
      nextUrl: new URL(
        'http://localhost:3000/api/sub-finder/coverage-request/absence-1/assigned-shifts'
      ),
    }
    const response = await GET(request as any, {
      params: Promise.resolve({ absence_id: 'absence-1' }),
    })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({
      assigned_shifts: [],
      remaining_shift_keys: [],
      remaining_shift_count: 0,
      total_shifts: 0,
    })
  })

  it('returns assigned and remaining shift details', async () => {
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'absence-1',
      coverage_request_id: 'coverage-1',
    })

    const coverageRequestsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { teacher_id: 'teacher-1' }, error: null }),
    }

    const coverageRequestShiftsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    }
    ;(coverageRequestShiftsQuery.eq as jest.Mock)
      .mockReturnValueOnce(coverageRequestShiftsQuery)
      .mockResolvedValueOnce({
        data: [
          { date: '2099-02-10', time_slot_id: 'slot-1', time_slots: { code: 'EM' } },
          { date: '2099-02-10', time_slot_id: 'slot-2', time_slots: { code: 'PM' } },
        ],
        error: null,
      })

    const subAssignmentsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    }
    ;(subAssignmentsQuery.eq as jest.Mock)
      .mockReturnValueOnce(subAssignmentsQuery)
      .mockReturnValueOnce(subAssignmentsQuery)
      .mockResolvedValueOnce({
        data: [
          {
            date: '2099-02-10',
            time_slot_id: 'slot-1',
            time_slots: { code: 'EM' },
            days_of_week: { name: 'Monday' },
          },
          {
            date: '2099-02-12',
            time_slot_id: 'slot-9',
            time_slots: { code: 'XX' },
            days_of_week: { name: 'Wednesday' },
          },
        ],
        error: null,
      })
    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'coverage_requests') return coverageRequestsQuery
        if (table === 'coverage_request_shifts') return coverageRequestShiftsQuery
        if (table === 'sub_assignments') return subAssignmentsQuery
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = {
      nextUrl: new URL(
        'http://localhost:3000/api/sub-finder/coverage-request/absence-1/assigned-shifts'
      ),
    }
    const response = await GET(request as any, {
      params: Promise.resolve({ absence_id: 'absence-1' }),
    })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.total_shifts).toBe(2)
    expect(json.assigned_shifts).toEqual([
      {
        date: '2099-02-10',
        time_slot_code: 'EM',
        day_name: 'Monday',
      },
    ])
    expect(json.remaining_shift_keys).toEqual(['2099-02-10|PM'])
    expect(json.remaining_shift_count).toBe(1)
  })
})
