/** @jest-environment node */

import { POST } from '@/app/api/sub-finder/check-conflicts/route'
import { createJsonRequest } from '@/tests/helpers/api'
import { createClient } from '@/lib/supabase/server'
import { getSubAvailability, getSubAvailabilityExceptions } from '@/lib/api/sub-availability'
import { getTeacherScheduledShifts, getTimeOffShifts } from '@/lib/api/time-off-shifts'
import { getTimeOffRequests } from '@/lib/api/time-off'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/api/sub-availability', () => ({
  getSubAvailability: jest.fn(),
  getSubAvailabilityExceptions: jest.fn(),
}))

jest.mock('@/lib/api/time-off-shifts', () => ({
  getTeacherScheduledShifts: jest.fn(),
  getTimeOffShifts: jest.fn(),
}))

jest.mock('@/lib/api/time-off', () => ({
  getTimeOffRequests: jest.fn(),
}))

describe('POST /api/sub-finder/check-conflicts integration', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns 400 when required fields are missing', async () => {
    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/check-conflicts',
      'POST',
      {
        sub_id: 'sub-1',
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/missing required fields/i)
  })

  it('returns 404 when coverage request does not exist', async () => {
    const coverageRequestsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    }

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'coverage_requests') return coverageRequestsQuery
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/check-conflicts',
      'POST',
      {
        sub_id: 'sub-1',
        coverage_request_id: 'coverage-1',
        shift_ids: ['shift-1'],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toMatch(/coverage request not found/i)
  })

  it('returns empty array when no coverage_request_shifts match', async () => {
    const coverageRequestsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { teacher_id: 'teacher-1', start_date: '2099-02-10', end_date: '2099-02-10' },
        error: null,
      }),
    }

    const coverageRequestShiftsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({ data: [], error: null }),
    }

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'coverage_requests') return coverageRequestsQuery
        if (table === 'coverage_request_shifts') return coverageRequestShiftsQuery
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/check-conflicts',
      'POST',
      {
        sub_id: 'sub-1',
        coverage_request_id: 'coverage-1',
        shift_ids: ['shift-1'],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual([])
  })

  it('returns 500 when coverage_request_shifts lookup fails', async () => {
    const coverageRequestsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { teacher_id: 'teacher-1', start_date: '2099-02-10', end_date: '2099-02-10' },
        error: null,
      }),
    }

    const coverageRequestShiftsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }),
    }

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'coverage_requests') return coverageRequestsQuery
        if (table === 'coverage_request_shifts') return coverageRequestShiftsQuery
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/check-conflicts',
      'POST',
      {
        sub_id: 'sub-1',
        coverage_request_id: 'coverage-1',
        shift_ids: ['shift-1'],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toMatch(/failed to fetch shifts/i)
  })

  it('returns mixed conflict statuses for requested shifts', async () => {
    const coverageRequestsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { teacher_id: 'teacher-1', start_date: '2099-02-10', end_date: '2099-02-10' },
        error: null,
      }),
    }

    const coverageRequestShiftsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'shift-available',
            date: '2099-02-10',
            day_of_week_id: 'day-1',
            time_slot_id: 'slot-1',
            classroom_id: 'classroom-1',
          },
          {
            id: 'shift-sub-conflict',
            date: '2099-02-10',
            day_of_week_id: 'day-1',
            time_slot_id: 'slot-2',
            classroom_id: 'classroom-2',
          },
          {
            id: 'shift-unavailable',
            date: '2099-02-10',
            day_of_week_id: 'day-1',
            time_slot_id: 'slot-3',
            classroom_id: 'classroom-3',
          },
        ],
        error: null,
      }),
    }

    const subAssignmentsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockResolvedValue({
        data: [
          {
            date: '2099-02-10',
            time_slot_id: 'slot-2',
            teacher_id: 'teacher-2',
            classroom_id: 'classroom-2',
            staff: { display_name: 'Teacher Two' },
          },
        ],
        error: null,
      }),
    }

    const classroomsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { name: 'Toddler Room' }, error: null }),
    }

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'coverage_requests') return coverageRequestsQuery
        if (table === 'coverage_request_shifts') return coverageRequestShiftsQuery
        if (table === 'sub_assignments') return subAssignmentsQuery
        if (table === 'classrooms') return classroomsQuery
        throw new Error(`Unexpected table: ${table}`)
      }),
    })
    ;(getSubAvailability as jest.Mock).mockResolvedValue([
      { day_of_week_id: 'day-1', time_slot_id: 'slot-1', available: true },
      { day_of_week_id: 'day-1', time_slot_id: 'slot-2', available: true },
      { day_of_week_id: 'day-1', time_slot_id: 'slot-3', available: false },
    ])
    ;(getSubAvailabilityExceptions as jest.Mock).mockResolvedValue([])
    ;(getTeacherScheduledShifts as jest.Mock).mockResolvedValue([])
    ;(getTimeOffRequests as jest.Mock).mockResolvedValue([])
    ;(getTimeOffShifts as jest.Mock).mockResolvedValue([])

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/check-conflicts',
      'POST',
      {
        sub_id: 'sub-1',
        coverage_request_id: 'coverage-1',
        shift_ids: ['shift-available', 'shift-sub-conflict', 'shift-unavailable'],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toHaveLength(3)

    expect(json).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ shift_id: 'shift-available', status: 'available' }),
        expect.objectContaining({
          shift_id: 'shift-sub-conflict',
          status: 'conflict_sub',
          message: expect.stringMatching(/Teacher Two/),
        }),
        expect.objectContaining({ shift_id: 'shift-unavailable', status: 'unavailable' }),
      ])
    )
  })

  it('prefers teaching-conflict over sub/time-off conflicts and honors date exceptions', async () => {
    const coverageRequestsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { teacher_id: 'teacher-1', start_date: '2099-02-10', end_date: '2099-02-10' },
        error: null,
      }),
    }

    const coverageRequestShiftsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'shift-teaching-conflict',
            date: '2099-02-10',
            day_of_week_id: 'day-1',
            time_slot_id: 'slot-1',
            classroom_id: 'classroom-1',
          },
          {
            id: 'shift-time-off',
            date: '2099-02-10',
            day_of_week_id: 'day-1',
            time_slot_id: 'slot-2',
            classroom_id: 'classroom-2',
          },
        ],
        error: null,
      }),
    }

    const subAssignmentsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockResolvedValue({
        data: [
          {
            date: '2099-02-10',
            time_slot_id: 'slot-1',
            teacher_id: 'teacher-2',
            classroom_id: null,
            staff: { first_name: 'Sam', last_name: 'Sub' },
          },
        ],
        error: null,
      }),
    }

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'coverage_requests') return coverageRequestsQuery
        if (table === 'coverage_request_shifts') return coverageRequestShiftsQuery
        if (table === 'sub_assignments') return subAssignmentsQuery
        if (table === 'classrooms') {
          throw new Error('classrooms lookup should not run for null classroom_id')
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    })
    ;(getSubAvailability as jest.Mock).mockResolvedValue([
      { day_of_week_id: 'day-1', time_slot_id: 'slot-1', available: true },
      { day_of_week_id: 'day-1', time_slot_id: 'slot-2', available: false },
    ])
    ;(getSubAvailabilityExceptions as jest.Mock).mockResolvedValue([
      // Override day-based unavailable => available
      { date: '2099-02-10', time_slot_id: 'slot-2', available: true },
    ])
    ;(getTeacherScheduledShifts as jest.Mock).mockResolvedValue([
      { date: '2099-02-10', time_slot_id: 'slot-1' },
    ])
    ;(getTimeOffRequests as jest.Mock).mockResolvedValue([{ id: 'tor-1' }])
    ;(getTimeOffShifts as jest.Mock).mockResolvedValue([
      { date: '2099-02-10', time_slot_id: 'slot-2' },
    ])

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/check-conflicts',
      'POST',
      {
        sub_id: 'sub-1',
        coverage_request_id: 'coverage-1',
        shift_ids: ['shift-teaching-conflict', 'shift-time-off'],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          shift_id: 'shift-teaching-conflict',
          status: 'conflict_teaching',
        }),
        expect.objectContaining({
          shift_id: 'shift-time-off',
          status: 'unavailable',
          message: 'Has time off',
        }),
      ])
    )
  })

  it('continues when fetching a time-off request shifts throws', async () => {
    const coverageRequestsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { teacher_id: 'teacher-1', start_date: '2099-02-10', end_date: '2099-02-10' },
        error: null,
      }),
    }

    const coverageRequestShiftsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'shift-1',
            date: '2099-02-10',
            day_of_week_id: 'day-1',
            time_slot_id: 'slot-1',
            classroom_id: 'classroom-1',
          },
        ],
        error: null,
      }),
    }

    const subAssignmentsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockResolvedValue({ data: [], error: null }),
    }

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'coverage_requests') return coverageRequestsQuery
        if (table === 'coverage_request_shifts') return coverageRequestShiftsQuery
        if (table === 'sub_assignments') return subAssignmentsQuery
        throw new Error(`Unexpected table: ${table}`)
      }),
    })
    ;(getSubAvailability as jest.Mock).mockResolvedValue([
      { day_of_week_id: 'day-1', time_slot_id: 'slot-1', available: true },
    ])
    ;(getSubAvailabilityExceptions as jest.Mock).mockResolvedValue([])
    ;(getTeacherScheduledShifts as jest.Mock).mockResolvedValue([])
    ;(getTimeOffRequests as jest.Mock).mockResolvedValue([{ id: 'tor-1' }])
    ;(getTimeOffShifts as jest.Mock).mockRejectedValue(new Error('shift fetch failed'))
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/check-conflicts',
      'POST',
      {
        sub_id: 'sub-1',
        coverage_request_id: 'coverage-1',
        shift_ids: ['shift-1'],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual([
      expect.objectContaining({
        shift_id: 'shift-1',
        status: 'available',
      }),
    ])
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/error fetching shifts/i),
      expect.any(Error)
    )
  })
})
