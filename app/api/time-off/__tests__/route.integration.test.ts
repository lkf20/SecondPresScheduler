/** @jest-environment node */

import { GET, POST } from '@/app/api/time-off/route'
import { createJsonRequest } from '@/tests/helpers/api'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getTimeOffRequests, createTimeOffRequest } from '@/lib/api/time-off'
import { createTimeOffShifts, getTeacherTimeOffShifts } from '@/lib/api/time-off-shifts'
import { getScheduleSettings } from '@/lib/api/schedule-settings'
import { revalidatePath } from 'next/cache'

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))

jest.mock('@/lib/api/time-off', () => ({
  getTimeOffRequests: jest.fn(),
  createTimeOffRequest: jest.fn(),
}))

jest.mock('@/lib/api/time-off-shifts', () => ({
  createTimeOffShifts: jest.fn(),
  getTeacherScheduledShifts: jest.fn(),
  getTeacherTimeOffShifts: jest.fn(),
}))

jest.mock('@/lib/api/schedule-settings', () => ({
  getScheduleSettings: jest.fn(),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

describe('GET /api/time-off integration', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns 403 when school context is missing', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue(null)
    const request = createJsonRequest('http://localhost:3000/api/time-off', 'GET')

    const response = await GET(request as any)
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error).toMatch(/missing school_id|profile/i)
  })

  it('POST returns 403 when school context is missing', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue(null)
    const request = createJsonRequest('http://localhost:3000/api/time-off', 'POST', {
      teacher_id: 'teacher-1',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error).toMatch(/missing school_id|profile/i)
  })

  it('GET returns filtered requests when school context exists', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getTimeOffRequests as jest.Mock).mockResolvedValue([
      { id: 'request-1', teacher_id: 'teacher-1' },
    ])

    const request = createJsonRequest(
      'http://localhost:3000/api/time-off?teacher_id=teacher-1&start_date=2026-02-10&end_date=2026-02-12',
      'GET'
    )

    const response = await GET(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(getTimeOffRequests).toHaveBeenCalledWith({
      teacher_id: 'teacher-1',
      start_date: '2026-02-10',
      end_date: '2026-02-12',
    })
    expect(json).toEqual([{ id: 'request-1', teacher_id: 'teacher-1' }])
  })

  it('POST creates request + shifts and returns 201', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(getTeacherTimeOffShifts as jest.Mock).mockResolvedValue([])
    ;(createTimeOffRequest as jest.Mock).mockResolvedValue({
      id: 'request-1',
      teacher_id: 'teacher-1',
      start_date: '2026-02-10',
      end_date: '2026-02-10',
    })

    const request = createJsonRequest('http://localhost:3000/api/time-off', 'POST', {
      teacher_id: 'teacher-1',
      start_date: '2026-02-10',
      end_date: '2026-02-10',
      shift_selection_mode: 'select_shifts',
      shifts: [
        {
          date: '2026-02-10',
          day_of_week_id: 'day-1',
          time_slot_id: 'slot-1',
        },
      ],
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(createTimeOffRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        teacher_id: 'teacher-1',
        school_id: 'school-1',
        status: 'active',
      })
    )
    expect(createTimeOffShifts).toHaveBeenCalledWith('request-1', [
      {
        date: '2026-02-10',
        day_of_week_id: 'day-1',
        time_slot_id: 'slot-1',
      },
    ])
    expect(revalidatePath).toHaveBeenCalledWith('/time-off')
    expect(json.id).toBe('request-1')
  })
})
