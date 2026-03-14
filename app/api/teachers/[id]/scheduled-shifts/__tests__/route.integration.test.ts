/** @jest-environment node */

import { GET } from '@/app/api/teachers/[id]/scheduled-shifts/route'
import { getTeacherScheduledShifts } from '@/lib/api/time-off-shifts'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getScheduleSettings } from '@/lib/api/schedule-settings'
import { getSchoolClosuresForDateRange } from '@/lib/api/school-calendar'

jest.mock('@/lib/api/time-off-shifts', () => ({
  getTeacherScheduledShifts: jest.fn(),
}))

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))

jest.mock('@/lib/api/schedule-settings', () => ({
  getScheduleSettings: jest.fn(),
}))

jest.mock('@/lib/api/school-calendar', () => ({
  getSchoolClosuresForDateRange: jest.fn().mockResolvedValue([]),
}))

describe('GET /api/teachers/[id]/scheduled-shifts', () => {
  beforeEach(() => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(getTeacherScheduledShifts as jest.Mock).mockResolvedValue([
      {
        date: '2026-03-10',
        day_of_week_id: 'dow-2',
        day_name: 'Tuesday',
        day_number: 2,
        time_slot_id: 'slot-1',
        time_slot_code: 'AM',
        time_slot_name: 'Morning',
      },
      {
        date: '2026-03-10',
        day_of_week_id: 'dow-2',
        day_name: 'Tuesday',
        day_number: 2,
        time_slot_id: 'slot-2',
        time_slot_code: 'PM',
        time_slot_name: 'Afternoon',
      },
    ])
  })

  it('returns 400 when start_date or end_date is missing', async () => {
    const request = {
      nextUrl: new URL('http://localhost:3000/api/teachers/teacher-1/scheduled-shifts'),
    }
    const response = await GET(request as any, {
      params: Promise.resolve({ id: 'teacher-1' }),
    })
    expect(response.status).toBe(400)
  })

  it('returns shifts with school_closure true for closed date/slot', async () => {
    ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([
      { date: '2026-03-10', time_slot_id: 'slot-1' },
    ])
    const request = {
      nextUrl: new URL(
        'http://localhost:3000/api/teachers/teacher-1/scheduled-shifts?start_date=2026-03-10&end_date=2026-03-10'
      ),
    }
    const response = await GET(request as any, {
      params: Promise.resolve({ id: 'teacher-1' }),
    })
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(getSchoolClosuresForDateRange).toHaveBeenCalledWith(
      'school-1',
      '2026-03-10',
      '2026-03-10'
    )
    expect(json).toHaveLength(2)
    const amShift = json.find((s: any) => s.time_slot_id === 'slot-1')
    const pmShift = json.find((s: any) => s.time_slot_id === 'slot-2')
    expect(amShift.school_closure).toBe(true)
    expect(pmShift.school_closure).toBe(false)
  })

  it('returns shifts with school_closure false when no closures', async () => {
    ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([])
    const request = {
      nextUrl: new URL(
        'http://localhost:3000/api/teachers/teacher-1/scheduled-shifts?start_date=2026-03-10&end_date=2026-03-10'
      ),
    }
    const response = await GET(request as any, {
      params: Promise.resolve({ id: 'teacher-1' }),
    })
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.every((s: any) => s.school_closure === false)).toBe(true)
  })
})
