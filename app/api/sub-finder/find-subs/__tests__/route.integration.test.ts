/** @jest-environment node */

import { POST } from '@/app/api/sub-finder/find-subs/route'
import { createJsonRequest } from '@/tests/helpers/api'
import { getUserSchoolId } from '@/lib/utils/auth'
import { createClient } from '@/lib/supabase/server'
import { getTimeOffRequestById, getTimeOffRequests } from '@/lib/api/time-off'
import { getTimeOffShifts, getTeacherScheduledShifts } from '@/lib/api/time-off-shifts'
import { findTopCombinations } from '@/lib/utils/sub-combination'
import { buildShiftChips } from '@/lib/server/coverage/shift-chips'

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/api/time-off', () => ({
  getTimeOffRequestById: jest.fn(),
  getTimeOffRequests: jest.fn(),
}))

jest.mock('@/lib/api/time-off-shifts', () => ({
  getTimeOffShifts: jest.fn(),
  getTeacherScheduledShifts: jest.fn(),
}))

jest.mock('@/lib/utils/sub-combination', () => ({
  findTopCombinations: jest.fn(),
}))

jest.mock('@/lib/server/coverage/shift-chips', () => ({
  buildShiftChips: jest.fn(),
}))

describe('POST /api/sub-finder/find-subs integration', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns 403 when school context is missing', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue(null)
    const request = createJsonRequest('http://localhost:3000/api/sub-finder/find-subs', 'POST', {
      absence_id: 'absence-1',
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error).toMatch(/missing school_id|profile/i)
  })

  it('returns 400 when absence_id is missing', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    const request = createJsonRequest('http://localhost:3000/api/sub-finder/find-subs', 'POST', {})

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/absence_id is required/i)
  })

  it('returns 404 when absence cannot be found', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(createClient as jest.Mock).mockResolvedValue({ from: jest.fn() })
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue(null)

    const request = createJsonRequest('http://localhost:3000/api/sub-finder/find-subs', 'POST', {
      absence_id: 'absence-missing',
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toMatch(/not found/i)
  })

  it('returns empty array when no shifts remain to cover', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(createClient as jest.Mock).mockResolvedValue({ from: jest.fn() })
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'absence-1',
      teacher_id: 'teacher-1',
      start_date: '2099-02-09',
      end_date: '2099-02-09',
    })
    ;(getTimeOffShifts as jest.Mock).mockResolvedValue([])

    const request = createJsonRequest('http://localhost:3000/api/sub-finder/find-subs', 'POST', {
      absence_id: 'absence-1',
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual([])
  })

  it('returns recommended subs payload for a valid request', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')

    const teacherSchedulesQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: [
          {
            day_of_week_id: 'day-1',
            time_slot_id: 'slot-1',
            classroom: { name: 'Infant Room', color: '#dbeafe' },
          },
        ],
        error: null,
      }),
    }

    const roleTypesQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: [], error: null }),
    }

    const staffQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn((field: string) => {
        if (field === 'school_id') return staffQuery
        if (field === 'is_sub') {
          return Promise.resolve({
            data: [
              {
                id: 'sub-1',
                first_name: 'Sally',
                last_name: 'Anderson',
                display_name: 'Sally A.',
                is_sub: true,
                active: true,
                phone: '555-111-2222',
                email: 'sally@example.com',
                can_change_diapers: true,
                can_lift_children: true,
              },
            ],
            error: null,
          })
        }
        return staffQuery
      }),
      or: jest.fn(),
    }

    const availabilityQuery = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({
        data: [
          {
            sub_id: 'sub-1',
            day_of_week_id: 'day-1',
            time_slot_id: 'slot-1',
            available: true,
          },
        ],
        error: null,
      }),
    }

    const exceptionsQuery = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockResolvedValue({ data: [], error: null }),
    }

    const classPreferencesQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    }
    ;(classPreferencesQuery.eq as jest.Mock)
      .mockReturnValueOnce(classPreferencesQuery)
      .mockResolvedValueOnce({ data: [], error: null })
    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'teacher_schedules') return teacherSchedulesQuery
        if (table === 'staff_role_types') return roleTypesQuery
        if (table === 'staff') return staffQuery
        if (table === 'sub_availability') return availabilityQuery
        if (table === 'sub_availability_exceptions') return exceptionsQuery
        if (table === 'sub_class_preferences') return classPreferencesQuery
        throw new Error(`Unexpected table: ${table}`)
      }),
    })
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'absence-1',
      teacher_id: 'teacher-1',
      start_date: '2099-02-09',
      end_date: '2099-02-09',
    })
    ;(getTimeOffShifts as jest.Mock).mockResolvedValue([
      {
        id: 'shift-1',
        date: '2099-02-09',
        day_of_week_id: 'day-1',
        day_of_week: { name: 'Monday' },
        time_slot_id: 'slot-1',
        time_slot: { code: 'EM' },
      },
    ])
    ;(getTimeOffRequests as jest.Mock).mockResolvedValue([])
    ;(getTeacherScheduledShifts as jest.Mock).mockResolvedValue([])
    ;(buildShiftChips as jest.Mock).mockReturnValue([])
    ;(findTopCombinations as jest.Mock).mockReturnValue([])

    const request = createJsonRequest('http://localhost:3000/api/sub-finder/find-subs', 'POST', {
      absence_id: 'absence-1',
      include_flexible_staff: true,
    })

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
      can_cover: [
        expect.objectContaining({
          date: '2099-02-09',
          time_slot_code: 'EM',
          classroom_name: 'Infant Room',
        }),
      ],
    })
    expect(json.recommended_combinations).toEqual([])
  })

  it('filters out zero-coverage matches when include_flexible_staff is false', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')

    const teacherSchedulesQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: [
          {
            day_of_week_id: 'day-1',
            time_slot_id: 'slot-1',
            classroom: { name: 'Infant Room', color: '#dbeafe' },
          },
        ],
        error: null,
      }),
    }

    const roleTypesQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: [], error: null }),
    }

    const staffQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn((field: string) => {
        if (field === 'school_id') return staffQuery
        if (field === 'is_sub') {
          return Promise.resolve({
            data: [
              {
                id: 'sub-2',
                first_name: 'Unavailable',
                last_name: 'Sub',
                display_name: 'Unavailable S.',
                is_sub: true,
                active: true,
              },
            ],
            error: null,
          })
        }
        return staffQuery
      }),
      or: jest.fn(),
    }

    const availabilityQuery = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({ data: [], error: null }),
    }

    const exceptionsQuery = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockResolvedValue({ data: [], error: null }),
    }

    const classPreferencesQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    }
    ;(classPreferencesQuery.eq as jest.Mock)
      .mockReturnValueOnce(classPreferencesQuery)
      .mockResolvedValueOnce({ data: [], error: null })
    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'teacher_schedules') return teacherSchedulesQuery
        if (table === 'staff_role_types') return roleTypesQuery
        if (table === 'staff') return staffQuery
        if (table === 'sub_availability') return availabilityQuery
        if (table === 'sub_availability_exceptions') return exceptionsQuery
        if (table === 'sub_class_preferences') return classPreferencesQuery
        throw new Error(`Unexpected table: ${table}`)
      }),
    })
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'absence-1',
      teacher_id: 'teacher-1',
      start_date: '2099-02-09',
      end_date: '2099-02-09',
    })
    ;(getTimeOffShifts as jest.Mock).mockResolvedValue([
      {
        id: 'shift-1',
        date: '2099-02-09',
        day_of_week_id: 'day-1',
        day_of_week: { name: 'Monday' },
        time_slot_id: 'slot-1',
        time_slot: { code: 'EM' },
      },
    ])
    ;(getTimeOffRequests as jest.Mock).mockResolvedValue([])
    ;(getTeacherScheduledShifts as jest.Mock).mockResolvedValue([])
    ;(buildShiftChips as jest.Mock).mockReturnValue([])
    ;(findTopCombinations as jest.Mock).mockReturnValue([])

    const request = createJsonRequest('http://localhost:3000/api/sub-finder/find-subs', 'POST', {
      absence_id: 'absence-1',
      include_flexible_staff: false,
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.subs).toEqual([])
  })
})
