/** @jest-environment node */

import { POST } from '@/app/api/assign-sub/shifts/route'
import { createJsonRequest } from '@/tests/helpers/api'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getTeacherShiftsForAssignSub } from '@/lib/api/coverage-requests'
import { getSchoolClosuresForDateRange } from '@/lib/api/school-calendar'

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))

jest.mock('@/lib/api/coverage-requests', () => ({
  getTeacherShiftsForAssignSub: jest.fn(),
}))

jest.mock('@/lib/api/school-calendar', () => ({
  getSchoolClosuresForDateRange: jest.fn().mockResolvedValue([]),
}))

describe('POST /api/assign-sub/shifts', () => {
  beforeEach(() => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
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
})
