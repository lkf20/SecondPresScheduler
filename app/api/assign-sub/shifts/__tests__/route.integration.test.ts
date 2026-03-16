/** @jest-environment node */

import { POST } from '@/app/api/assign-sub/shifts/route'
import { createJsonRequest } from '@/tests/helpers/api'
import { getUserSchoolId } from '@/lib/utils/auth'
import { createClient } from '@/lib/supabase/server'
import { getTeacherShiftsForAssignSub } from '@/lib/api/coverage-requests'
import { getSchoolClosuresForDateRange } from '@/lib/api/school-calendar'

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/api/coverage-requests', () => ({
  getTeacherShiftsForAssignSub: jest.fn(),
}))

jest.mock('@/lib/api/school-calendar', () => ({
  getSchoolClosuresForDateRange: jest.fn().mockResolvedValue([]),
}))

function mockSupabaseEmpty() {
  const timeOffChain = {
    select: jest.fn().mockReturnThis(),
    in: jest.fn().mockResolvedValue({ data: [] }),
  }
  const coverageShiftsChain = {
    select: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ data: [] }),
  }
  const subAssignmentsChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockResolvedValue({ data: [] }),
  }
  ;(createClient as jest.Mock).mockResolvedValue({
    from: jest.fn((table: string) => {
      if (table === 'time_off_requests') return timeOffChain
      if (table === 'coverage_request_shifts') return coverageShiftsChain
      if (table === 'sub_assignments') return subAssignmentsChain
      throw new Error(`Unexpected table: ${table}`)
    }),
  })
}

describe('POST /api/assign-sub/shifts', () => {
  beforeEach(() => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    mockSupabaseEmpty()
    ;(getTeacherShiftsForAssignSub as jest.Mock).mockResolvedValue([
      {
        id: '2026-03-10|dow-2|slot-1',
        date: '2026-03-10',
        day_of_week_id: 'dow-2',
        time_slot_id: 'slot-1',
        time_slot_code: 'AM',
        classroom_id: 'class-1',
        has_time_off: false,
        time_off_request_id: null,
      },
      {
        id: '2026-03-10|dow-2|slot-2',
        date: '2026-03-10',
        day_of_week_id: 'dow-2',
        time_slot_id: 'slot-2',
        time_slot_code: 'PM',
        classroom_id: 'class-1',
        has_time_off: false,
        time_off_request_id: null,
      },
    ])
  })

  it('returns 403 when user has no school_id', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue(null)
    const request = createJsonRequest('http://localhost:3000/api/assign-sub/shifts', 'POST', {
      teacher_id: 'teacher-1',
      start_date: '2026-03-10',
      end_date: '2026-03-10',
    })
    const response = await POST(request as any)
    expect(response.status).toBe(403)
  })

  it('returns shifts with school_closure true for closed date/slot', async () => {
    ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([
      { date: '2026-03-10', time_slot_id: 'slot-1' },
    ])
    const request = createJsonRequest('http://localhost:3000/api/assign-sub/shifts', 'POST', {
      teacher_id: 'teacher-1',
      start_date: '2026-03-10',
      end_date: '2026-03-10',
    })
    const response = await POST(request as any)
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(getSchoolClosuresForDateRange).toHaveBeenCalledWith(
      'school-1',
      '2026-03-10',
      '2026-03-10'
    )
    expect(json.shifts).toHaveLength(2)
    const amShift = json.shifts.find((s: any) => s.time_slot_id === 'slot-1')
    const pmShift = json.shifts.find((s: any) => s.time_slot_id === 'slot-2')
    expect(amShift.school_closure).toBe(true)
    expect(pmShift.school_closure).toBe(false)
  })

  it('returns shifts with school_closure true for whole-day closure', async () => {
    ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([
      { date: '2026-03-10', time_slot_id: null },
    ])
    const request = createJsonRequest('http://localhost:3000/api/assign-sub/shifts', 'POST', {
      teacher_id: 'teacher-1',
      start_date: '2026-03-10',
      end_date: '2026-03-10',
    })
    const response = await POST(request as any)
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.shifts.every((s: any) => s.school_closure === true)).toBe(true)
  })

  it('returns shifts with school_closure false when no closures in range', async () => {
    ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([])
    const request = createJsonRequest('http://localhost:3000/api/assign-sub/shifts', 'POST', {
      teacher_id: 'teacher-1',
      start_date: '2026-03-10',
      end_date: '2026-03-10',
    })
    const response = await POST(request as any)
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.shifts.every((s: any) => s.school_closure === false)).toBe(true)
  })

  it('normalizes ISO date strings and returns shifts', async () => {
    const request = createJsonRequest('http://localhost:3000/api/assign-sub/shifts', 'POST', {
      teacher_id: 'teacher-1',
      start_date: '2026-03-10T00:00:00.000Z',
      end_date: '2026-03-10T00:00:00.000Z',
    })
    const response = await POST(request as any)
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(getTeacherShiftsForAssignSub).toHaveBeenCalledWith(
      'teacher-1',
      '2026-03-10',
      '2026-03-10'
    )
    expect(json.shifts).toHaveLength(2)
  })

  it('returns 400 when start_date is invalid', async () => {
    const request = createJsonRequest('http://localhost:3000/api/assign-sub/shifts', 'POST', {
      teacher_id: 'teacher-1',
      start_date: 'not-a-date',
      end_date: '2026-03-10',
    })
    const response = await POST(request as any)
    expect(response.status).toBe(400)
  })

  it('returns coverage_request_shift_id and assignment fields for assigned time-off shifts', async () => {
    ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([])
    ;(getTeacherShiftsForAssignSub as jest.Mock).mockResolvedValue([
      {
        id: '2026-03-10|dow-2|slot-1',
        date: '2026-03-10',
        day_of_week_id: 'dow-2',
        time_slot_id: 'slot-1',
        time_slot_code: 'AM',
        classroom_id: 'class-1',
        has_time_off: true,
        time_off_request_id: 'tor-1',
      },
    ])
    const timeOffChain = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({
        data: [{ id: 'tor-1', coverage_request_id: 'cr-1' }],
      }),
    }
    const coverageShiftsChain = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'crs-1',
            coverage_request_id: 'cr-1',
            date: '2026-03-10',
            time_slot_id: 'slot-1',
            classroom_id: 'class-1',
            time_slots: { code: 'AM' },
          },
        ],
      }),
    }
    const subAssignmentsChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'assign-1',
            sub_id: 'sub-1',
            date: '2026-03-10',
            time_slot_id: 'slot-1',
            staff: { first_name: 'Jane', last_name: 'Doe', display_name: null },
          },
        ],
      }),
    }
    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'time_off_requests') return timeOffChain
        if (table === 'coverage_request_shifts') return coverageShiftsChain
        if (table === 'sub_assignments') return subAssignmentsChain
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = createJsonRequest('http://localhost:3000/api/assign-sub/shifts', 'POST', {
      teacher_id: 'teacher-1',
      start_date: '2026-03-10',
      end_date: '2026-03-10',
    })
    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.shifts).toHaveLength(1)
    const shift = json.shifts[0]
    expect(shift.coverage_request_shift_id).toBe('crs-1')
    expect(shift.assignment_id).toBe('assign-1')
    expect(shift.assigned_sub_id).toBe('sub-1')
    expect(shift.assigned_sub_name).toBe('Jane D.')
  })

  it('returns shifts from sub_assignments when baseline returns none (fallback for Update sub from Dashboard)', async () => {
    ;(getTeacherShiftsForAssignSub as jest.Mock).mockResolvedValue([])
    ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([])
    const subAssignmentsChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'assign-1',
            sub_id: 'sub-1',
            date: '2026-03-10',
            day_of_week_id: 'dow-2',
            time_slot_id: 'slot-1',
            classroom_id: 'class-1',
            coverage_request_shift_id: 'crs-1',
            staff: { first_name: 'Jane', last_name: 'Doe', display_name: null },
            time_slots: { code: 'AM' },
          },
        ],
      }),
    }
    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'time_off_requests')
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({ data: [] }),
          }
        if (table === 'sub_assignments') return subAssignmentsChain
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = createJsonRequest('http://localhost:3000/api/assign-sub/shifts', 'POST', {
      teacher_id: 'teacher-1',
      start_date: '2026-03-10',
      end_date: '2026-03-10',
    })
    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.shifts).toHaveLength(1)
    const shift = json.shifts[0]
    expect(shift.date).toBe('2026-03-10')
    expect(shift.time_slot_code).toBe('AM')
    expect(shift.coverage_request_shift_id).toBe('crs-1')
    expect(shift.assignment_id).toBe('assign-1')
    expect(shift.assigned_sub_name).toBe('Jane D.')
  })
})
