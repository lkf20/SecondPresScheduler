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

  it('filters out past shifts by default when include_past_shifts is false', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(createClient as jest.Mock).mockResolvedValue({ from: jest.fn() })
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'absence-1',
      teacher_id: 'teacher-1',
      start_date: '2020-02-09',
      end_date: '2020-02-09',
    })
    ;(getTimeOffShifts as jest.Mock).mockResolvedValue([
      {
        id: 'shift-1',
        date: '2020-02-09',
        day_of_week_id: 'day-1',
        day_of_week: { name: 'Monday' },
        time_slot_id: 'slot-1',
        time_slot: { code: 'EM' },
      },
    ])

    const request = createJsonRequest('http://localhost:3000/api/sub-finder/find-subs', 'POST', {
      absence_id: 'absence-1',
      include_past_shifts: false,
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual([])
  })

  it('returns 500 when staff lookup fails', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')

    const teacherSchedulesQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: [],
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
            data: null,
            error: { message: 'staff query failed' },
          })
        }
        return staffQuery
      }),
      or: jest.fn(),
    }

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'teacher_schedules') return teacherSchedulesQuery
        if (table === 'staff_role_types') return roleTypesQuery
        if (table === 'staff') return staffQuery
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

    const request = createJsonRequest('http://localhost:3000/api/sub-finder/find-subs', 'POST', {
      absence_id: 'absence-1',
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toMatch(/staff query failed|failed to find subs/i)
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

  it('keeps flexible staff with 0% coverage and includes assignment/contact enrichment', async () => {
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
      eq: jest.fn().mockResolvedValue({
        data: [{ id: 'role-flex-1', code: 'FLEXIBLE' }],
        error: null,
      }),
    }

    const roleAssignmentsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({
        data: [{ staff_id: 'staff-flex-1' }],
        error: null,
      }),
    }

    const staffQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      or: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'staff-flex-1',
            first_name: 'Flex',
            last_name: 'Teacher',
            display_name: 'Flex T.',
            is_sub: false,
            active: true,
            phone: null,
            email: null,
            can_change_diapers: false,
            can_lift_children: false,
          },
        ],
        error: null,
      }),
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

    const coverageRequestShiftsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'crs-1',
            date: '2099-02-09',
            time_slot_id: 'slot-1',
            classroom_id: null,
            class_group_id: null,
            class_groups: null,
            time_slots: { code: 'EM' },
          },
        ],
        error: null,
      }),
    }

    const coverageRequestsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { teacher_id: 'teacher-1' },
        error: null,
      }),
    }

    const subAssignmentsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
    }
    ;(subAssignmentsQuery.eq as jest.Mock)
      .mockReturnValueOnce(subAssignmentsQuery)
      .mockReturnValueOnce(subAssignmentsQuery)
      .mockResolvedValueOnce({
        data: [
          {
            date: '2099-02-09',
            time_slots: { code: 'EM' },
            days_of_week: { name: 'Monday' },
          },
        ],
        error: null,
      })

    const substituteContactsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { response_status: 'pending', notes: 'Already texted' },
        error: null,
      }),
    }

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'teacher_schedules') return teacherSchedulesQuery
        if (table === 'staff_role_types') return roleTypesQuery
        if (table === 'staff_role_type_assignments') return roleAssignmentsQuery
        if (table === 'staff') return staffQuery
        if (table === 'sub_availability') return availabilityQuery
        if (table === 'sub_availability_exceptions') return exceptionsQuery
        if (table === 'sub_class_preferences') return classPreferencesQuery
        if (table === 'coverage_request_shifts') return coverageRequestShiftsQuery
        if (table === 'coverage_requests') return coverageRequestsQuery
        if (table === 'sub_assignments') return subAssignmentsQuery
        if (table === 'substitute_contacts') return substituteContactsQuery
        throw new Error(`Unexpected table: ${table}`)
      }),
    })
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'absence-1',
      teacher_id: 'teacher-1',
      coverage_request_id: 'coverage-1',
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
    ;(buildShiftChips as jest.Mock).mockReturnValue(['Mon EM'])
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
      id: 'staff-flex-1',
      is_flexible_staff: true,
      coverage_percent: 0,
      shifts_covered: 0,
      response_status: 'pending',
      notes: 'Already texted',
      has_assigned_shifts: true,
      remaining_shift_count: 0,
      assigned_shifts: [
        expect.objectContaining({
          date: '2099-02-09',
          time_slot_code: 'EM',
        }),
      ],
      cannot_cover: [
        expect.objectContaining({
          reason: 'Marked as unavailable',
        }),
      ],
    })
    expect(json.subs[0].shift_chips).toEqual(['Mon EM'])
  })
})
