/** @jest-environment node */

import { GET } from '@/app/api/sub-finder/coverage-request/[absence_id]/route'
import { getTimeOffRequestById } from '@/lib/api/time-off'
import { getTimeOffShifts } from '@/lib/api/time-off-shifts'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/api/time-off', () => ({
  getTimeOffRequestById: jest.fn(),
}))

jest.mock('@/lib/api/time-off-shifts', () => ({
  getTimeOffShifts: jest.fn(),
}))

jest.mock('@/lib/api/school-calendar', () => ({
  getSchoolClosuresForDateRange: jest.fn().mockResolvedValue([]),
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
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
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
            time_slot_id: 'slot-1',
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
    expect(json).toMatchObject({
      coverage_request_id: 'coverage-1',
      shift_map: {
        '2099-02-10|slot-1|classroom-1': 'crs-1',
        '2099-02-10|EM|classroom-1': 'crs-1',
        '2099-02-10|slot-1': 'crs-1',
        '2099-02-10|EM': 'crs-1',
      },
      needs_classroom_review: false,
      needs_review_shift_count: 0,
      omitted_shift_count: 0,
      omitted_shifts: [],
    })
  })

  it('flags coverage requests that contain Unknown (needs review) shifts', async () => {
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
            time_slot_id: 'slot-1',
            classroom_id: 'classroom-needs-review',
            classroom: { name: 'Unknown (needs review)' },
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
    expect(json.needs_classroom_review).toBe(true)
    expect(json.needs_review_shift_count).toBe(1)
    expect(json.omitted_shift_count).toBe(0)
    expect(json.omitted_shifts).toEqual([])
  })

  it('excludes coverage_request_shifts outside the time off request date range', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'absence-1',
      teacher_id: 'teacher-1',
      start_date: '2099-02-10',
      end_date: '2099-02-10',
      coverage_request_id: 'coverage-1',
    })

    const coverageRequestShiftsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'crs-in-range',
            date: '2099-02-10',
            time_slot_id: 'slot-1',
            classroom_id: 'classroom-1',
            time_slot: { code: 'EM' },
          },
          {
            id: 'crs-out-of-range',
            date: '2099-02-09',
            time_slot_id: 'slot-1',
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
    expect(json.coverage_request_id).toBe('coverage-1')
    expect(json.shift_map).toEqual({
      '2099-02-10|slot-1|classroom-1': 'crs-in-range',
      '2099-02-10|EM|classroom-1': 'crs-in-range',
      '2099-02-10|slot-1': 'crs-in-range',
      '2099-02-10|EM': 'crs-in-range',
    })
  })

  it('creates coverage request when missing and returns generated shift map', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
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

    const teacherSchedulesQuery: {
      select: ReturnType<typeof jest.fn>
      eq: ReturnType<typeof jest.fn>
    } = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn(),
    }
    teacherSchedulesQuery.eq.mockImplementation((key: string) =>
      key === 'school_id'
        ? Promise.resolve({
            data: [
              {
                day_of_week_id: 'day-1',
                time_slot_id: 'slot-1',
                classroom_id: 'classroom-1',
                class_group_id: null,
              },
            ],
            error: null,
          })
        : teacherSchedulesQuery
    )

    const coverageRequestShiftsInsertQuery = {
      insert: jest.fn().mockResolvedValue({ error: null }),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'crs-1',
            date: '2099-02-10',
            time_slot_id: 'slot-1',
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
      '2099-02-10|slot-1|classroom-1': 'crs-1',
      '2099-02-10|EM|classroom-1': 'crs-1',
      '2099-02-10|slot-1': 'crs-1',
    })
    expect(json.needs_classroom_review).toBe(false)
    expect(json.needs_review_shift_count).toBe(0)
    expect(json.omitted_shift_count).toBe(0)
    expect(json.omitted_shifts).toEqual([])
  })

  it('creates one coverage_request_shift per classroom with time_off_shift_id for multi-room teacher', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'absence-1',
      teacher_id: 'teacher-1',
      start_date: '2099-02-10',
      end_date: '2099-02-10',
      coverage_request_id: null,
    })
    ;(getTimeOffShifts as jest.Mock).mockResolvedValue([
      {
        id: 'tos-1',
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

    const teacherSchedulesMultiQuery: {
      select: ReturnType<typeof jest.fn>
      eq: ReturnType<typeof jest.fn>
    } = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn(),
    }
    teacherSchedulesMultiQuery.eq.mockImplementation((key: string) =>
      key === 'school_id'
        ? Promise.resolve({
            data: [
              {
                day_of_week_id: 'day-1',
                time_slot_id: 'slot-1',
                classroom_id: 'classroom-a',
                class_group_id: null,
              },
              {
                day_of_week_id: 'day-1',
                time_slot_id: 'slot-1',
                classroom_id: 'classroom-b',
                class_group_id: null,
              },
            ],
            error: null,
          })
        : teacherSchedulesMultiQuery
    )

    const coverageShiftsInsertMock = jest.fn().mockResolvedValue({ error: null })
    const coverageRequestShiftsInsertQuery = {
      insert: coverageShiftsInsertMock,
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'crs-a',
            date: '2099-02-10',
            classroom_id: 'classroom-a',
            time_slot: { code: 'EM' },
          },
          {
            id: 'crs-b',
            date: '2099-02-10',
            classroom_id: 'classroom-b',
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
        if (table === 'teacher_schedules') return teacherSchedulesMultiQuery
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
    expect(coverageShiftsInsertMock).toHaveBeenCalledTimes(1)
    const inserted = coverageShiftsInsertMock.mock.calls[0][0] as Array<{
      classroom_id: string
      time_off_shift_id: string
    }>
    expect(inserted).toHaveLength(2)
    expect(new Set(inserted.map(r => r.classroom_id))).toEqual(
      new Set(['classroom-a', 'classroom-b'])
    )
    expect(inserted.every(r => r.time_off_shift_id === 'tos-1')).toBe(true)
    expect(json.shift_map['2099-02-10|EM|classroom-a']).toBeDefined()
    expect(json.shift_map['2099-02-10|EM|classroom-b']).toBeDefined()
  })

  it('returns 500 when creating a new coverage request fails', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
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

  it('omits shifts when teacher has no scheduled classroom and returns omitted count', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
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

    const teacherSchedulesNoClassroomQuery: {
      select: ReturnType<typeof jest.fn>
      eq: ReturnType<typeof jest.fn>
    } = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn(),
    }
    teacherSchedulesNoClassroomQuery.eq.mockImplementation((key: string) =>
      key === 'school_id'
        ? Promise.resolve({
            data: [
              {
                day_of_week_id: 'day-1',
                time_slot_id: 'slot-1',
                classroom_id: null,
                class_group_id: null,
              },
            ],
            error: null,
          })
        : teacherSchedulesNoClassroomQuery
    )

    const coverageRequestShiftsSelectQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: [], error: null }),
    }

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'sub_assignments') return subAssignmentsQuery
        if (table === 'profiles') return profilesQuery
        if (table === 'coverage_requests') return coverageRequestsQuery
        if (table === 'time_off_requests') return timeOffRequestsQuery
        if (table === 'teacher_schedules') return teacherSchedulesNoClassroomQuery
        if (table === 'coverage_request_shifts') return coverageRequestShiftsSelectQuery
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
    expect(json.omitted_shift_count).toBe(1)
    expect(json.omitted_shifts).toEqual([
      { date: '2099-02-10', day_of_week_id: 'day-1', time_slot_id: 'slot-1' },
    ])
  })

  it('omits only shifts without classroom when some have classroom', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'absence-1',
      teacher_id: 'teacher-1',
      start_date: '2099-02-10',
      end_date: '2099-02-10',
      coverage_request_id: null,
    })
    ;(getTimeOffShifts as jest.Mock).mockResolvedValue([
      { id: 'shift-1', date: '2099-02-10', day_of_week_id: 'day-1', time_slot_id: 'slot-1' },
      { id: 'shift-2', date: '2099-02-10', day_of_week_id: 'day-1', time_slot_id: 'slot-2' },
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
    const teacherSchedulesPartialQuery: {
      select: ReturnType<typeof jest.fn>
      eq: ReturnType<typeof jest.fn>
    } = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn(),
    }
    teacherSchedulesPartialQuery.eq.mockImplementation((key: string) =>
      key === 'school_id'
        ? Promise.resolve({
            data: [
              {
                day_of_week_id: 'day-1',
                time_slot_id: 'slot-1',
                classroom_id: 'classroom-1',
                class_group_id: null,
              },
            ],
            error: null,
          })
        : teacherSchedulesPartialQuery
    )
    const coverageRequestShiftsInsertQuery = {
      insert: jest.fn().mockResolvedValue({ error: null }),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'crs-1',
            date: '2099-02-10',
            time_slot_id: 'slot-1',
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
        if (table === 'coverage_requests') return coverageRequestsQuery
        if (table === 'time_off_requests') return timeOffRequestsQuery
        if (table === 'teacher_schedules') return teacherSchedulesPartialQuery
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
    expect(json.omitted_shift_count).toBe(1)
    expect(json.omitted_shifts).toHaveLength(1)
    expect(json.omitted_shifts[0]).toMatchObject({
      day_of_week_id: 'day-1',
      time_slot_id: 'slot-2',
    })
    expect(json.shift_map).toMatchObject({
      '2099-02-10|EM|classroom-1': 'crs-1',
    })
  })

  it('returns correct omitted_shift_count and omitted_shifts when coverage request already exists and had shifts omitted', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'absence-1',
      teacher_id: 'teacher-1',
      start_date: '2099-02-10',
      end_date: '2099-02-10',
      coverage_request_id: 'coverage-1',
    })
    ;(getTimeOffShifts as jest.Mock).mockResolvedValue([
      { id: 'tos-1', date: '2099-02-10', day_of_week_id: 'day-1', time_slot_id: 'slot-1' },
      { id: 'tos-2', date: '2099-02-10', day_of_week_id: 'day-1', time_slot_id: 'slot-2' },
    ])

    const coverageRequestShiftsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'crs-1',
            date: '2099-02-10',
            time_slot_id: 'slot-1',
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
    expect(json.coverage_request_id).toBe('coverage-1')
    expect(json.omitted_shift_count).toBe(1)
    expect(json.omitted_shifts).toHaveLength(1)
    expect(json.omitted_shifts[0]).toMatchObject({
      date: '2099-02-10',
      day_of_week_id: 'day-1',
      time_slot_id: 'slot-2',
    })
  })
})
