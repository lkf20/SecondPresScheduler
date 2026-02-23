/** @jest-environment node */

import { GET } from '@/app/api/sub-finder/coverage-request/[absence_id]/route'
import { getTimeOffRequestById } from '@/lib/api/time-off'
import { getTimeOffShifts } from '@/lib/api/time-off-shifts'
import { createClient } from '@/lib/supabase/server'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/api/time-off', () => ({
  getTimeOffRequestById: jest.fn(),
}))

jest.mock('@/lib/api/time-off-shifts', () => ({
  getTimeOffShifts: jest.fn(),
}))

describe('GET /api/sub-finder/coverage-request/[absence_id] integration', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns 400 when absence_id is missing', async () => {
    const request = { nextUrl: new URL('http://localhost:3000/api/sub-finder/coverage-request/') }
    const response = await GET(request as any, { params: Promise.resolve({ absence_id: '' }) })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/missing absence_id/i)
  })

  it('returns 404 when time off request does not exist', async () => {
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValueOnce(null)

    const request = {
      nextUrl: new URL('http://localhost:3000/api/sub-finder/coverage-request/absence-1'),
    }
    const response = await GET(request as any, {
      params: Promise.resolve({ absence_id: 'absence-1' }),
    })
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toMatch(/not found/i)
  })

  it('returns existing coverage request mapping when already linked', async () => {
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'absence-1',
      teacher_id: 'teacher-1',
      coverage_request_id: 'coverage-1',
    })

    const coverageRequestShiftsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'crs-1',
            date: '2099-02-10',
            classroom_id: 'classroom-1',
            time_slot: { code: 'EM' },
          },
        ],
        error: null,
      }),
    }

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'coverage_request_shifts') return coverageRequestShiftsQuery
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = {
      nextUrl: new URL('http://localhost:3000/api/sub-finder/coverage-request/absence-1'),
    }
    const response = await GET(request as any, {
      params: Promise.resolve({ absence_id: 'absence-1' }),
    })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({
      coverage_request_id: 'coverage-1',
      shift_map: {
        '2099-02-10|EM|classroom-1': 'crs-1',
        '2099-02-10|EM': 'crs-1',
      },
    })
  })

  it('creates coverage request when missing and returns generated shift map', async () => {
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'absence-1',
      teacher_id: 'teacher-1',
      start_date: '2099-02-10',
      end_date: '2099-02-10',
      coverage_request_id: null,
    })
    ;(getTimeOffShifts as jest.Mock).mockResolvedValue([
      {
        id: 'shift-1',
        date: '2099-02-10',
        day_of_week_id: 'day-1',
        time_slot_id: 'slot-1',
      },
    ])

    const subAssignmentsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockResolvedValue({ data: [], error: null }),
    }

    const profilesQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { school_id: 'school-1' }, error: null }),
    }

    const coverageRequestsInsertQuery = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'coverage-new' }, error: null }),
      eq: jest.fn().mockReturnThis(),
    }

    const timeOffRequestsQuery = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    }

    const teacherSchedulesQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: [
          {
            day_of_week_id: 'day-1',
            time_slot_id: 'slot-1',
            classroom_id: 'classroom-1',
            class_group_id: null,
          },
        ],
        error: null,
      }),
    }

    const classroomsUnknownQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'classroom-fallback' }, error: null }),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    }

    const coverageRequestShiftsInsertQuery = {
      insert: jest.fn().mockResolvedValue({ error: null }),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'crs-1',
            date: '2099-02-10',
            classroom_id: 'classroom-1',
            time_slot: { code: 'EM' },
          },
        ],
        error: null,
      }),
    }

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'sub_assignments') return subAssignmentsQuery
        if (table === 'profiles') return profilesQuery
        if (table === 'coverage_requests') return coverageRequestsInsertQuery
        if (table === 'time_off_requests') return timeOffRequestsQuery
        if (table === 'teacher_schedules') return teacherSchedulesQuery
        if (table === 'classrooms') return classroomsUnknownQuery
        if (table === 'coverage_request_shifts') return coverageRequestShiftsInsertQuery
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = {
      nextUrl: new URL('http://localhost:3000/api/sub-finder/coverage-request/absence-1'),
    }
    const response = await GET(request as any, {
      params: Promise.resolve({ absence_id: 'absence-1' }),
    })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.coverage_request_id).toBe('coverage-new')
    expect(json.shift_map).toMatchObject({
      '2099-02-10|EM|classroom-1': 'crs-1',
    })
  })

  it('returns 500 when creating a new coverage request fails', async () => {
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'absence-1',
      teacher_id: 'teacher-1',
      start_date: '2099-02-10',
      end_date: '2099-02-10',
      coverage_request_id: null,
    })
    ;(getTimeOffShifts as jest.Mock).mockResolvedValue([])

    const subAssignmentsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockResolvedValue({ data: [], error: null }),
    }

    const profilesQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { school_id: 'school-1' }, error: null }),
    }

    const coverageRequestsQuery = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'insert failed' } }),
    }

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'sub_assignments') return subAssignmentsQuery
        if (table === 'profiles') return profilesQuery
        if (table === 'coverage_requests') return coverageRequestsQuery
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = {
      nextUrl: new URL('http://localhost:3000/api/sub-finder/coverage-request/absence-1'),
    }
    const response = await GET(request as any, {
      params: Promise.resolve({ absence_id: 'absence-1' }),
    })
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toMatch(/failed to create coverage request/i)
  })

  it('returns 500 when no classroom is available for generated coverage shifts', async () => {
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'absence-1',
      teacher_id: 'teacher-1',
      start_date: '2099-02-10',
      end_date: '2099-02-10',
      coverage_request_id: null,
    })
    ;(getTimeOffShifts as jest.Mock).mockResolvedValue([
      {
        id: 'shift-1',
        date: '2099-02-10',
        day_of_week_id: 'day-1',
        time_slot_id: 'slot-1',
      },
    ])

    const subAssignmentsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockResolvedValue({ data: [], error: null }),
    }

    const profilesQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { school_id: 'school-1' }, error: null }),
    }

    const coverageRequestsQuery = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest
        .fn()
        .mockResolvedValueOnce({ data: { id: 'coverage-new' }, error: null })
        .mockResolvedValueOnce({ data: { school_id: 'school-1' }, error: null }),
      eq: jest.fn().mockReturnThis(),
    }

    const timeOffRequestsQuery = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    }

    const teacherSchedulesQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: [
          {
            day_of_week_id: 'day-1',
            time_slot_id: 'slot-1',
            classroom_id: null,
            class_group_id: null,
          },
        ],
        error: null,
      }),
    }

    const classroomsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    }

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'sub_assignments') return subAssignmentsQuery
        if (table === 'profiles') return profilesQuery
        if (table === 'coverage_requests') return coverageRequestsQuery
        if (table === 'time_off_requests') return timeOffRequestsQuery
        if (table === 'teacher_schedules') return teacherSchedulesQuery
        if (table === 'classrooms') return classroomsQuery
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = {
      nextUrl: new URL('http://localhost:3000/api/sub-finder/coverage-request/absence-1'),
    }
    const response = await GET(request as any, {
      params: Promise.resolve({ absence_id: 'absence-1' }),
    })
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toMatch(/no classroom available/i)
  })
})
