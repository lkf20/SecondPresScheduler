/** @jest-environment node */

import { GET, POST } from '@/app/api/time-off/route'
import { createJsonRequest } from '@/tests/helpers/api'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getTimeOffRequests, createTimeOffRequest } from '@/lib/api/time-off'
import {
  createTimeOffShifts,
  getTeacherScheduledShifts,
  getTeacherTimeOffShifts,
} from '@/lib/api/time-off-shifts'
import { getScheduleSettings } from '@/lib/api/schedule-settings'
import { revalidatePath } from 'next/cache'
import { getAuditActorContext, logAuditEvent } from '@/lib/audit/logAuditEvent'
import { createClient } from '@/lib/supabase/server'

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

jest.mock('@/lib/audit/logAuditEvent', () => ({
  getAuditActorContext: jest.fn(),
  logAuditEvent: jest.fn(),
}))

const mockMaybeSingle = jest.fn()
const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }))
const mockSelect = jest.fn(() => ({ eq: mockEq }))
const mockFrom = jest.fn(() => ({ select: mockSelect }))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: mockFrom,
  })),
}))

describe('GET /api/time-off integration', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    ;(getAuditActorContext as jest.Mock).mockResolvedValue({
      actorUserId: 'user-1',
      actorDisplayName: 'Test User',
    })
    ;(logAuditEvent as jest.Mock).mockResolvedValue(undefined)
    mockMaybeSingle.mockResolvedValue({
      data: {
        first_name: 'Teacher',
        last_name: 'One',
        display_name: 'Teacher One',
      },
      error: null,
    })
    ;(createClient as jest.Mock).mockResolvedValue({ from: mockFrom })
  })

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

  it('GET returns 500 when request fetch fails', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getTimeOffRequests as jest.Mock).mockRejectedValue(new Error('fetch failed'))

    const request = createJsonRequest('http://localhost:3000/api/time-off', 'GET')
    const response = await GET(request as any)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toMatch(/fetch failed/i)
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

  it('POST all_scheduled mode filters conflicts and returns warning metadata', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(getTeacherScheduledShifts as jest.Mock).mockResolvedValue([
      { date: '2026-02-10', day_of_week_id: 'day-1', time_slot_id: 'slot-1' },
      { date: '2026-02-10', day_of_week_id: 'day-1', time_slot_id: 'slot-2' },
    ])
    ;(getTeacherTimeOffShifts as jest.Mock).mockResolvedValue([
      { date: '2026-02-10', time_slot_id: 'slot-1' },
    ])
    ;(createTimeOffRequest as jest.Mock).mockResolvedValue({
      id: 'request-2',
      teacher_id: 'teacher-1',
      start_date: '2026-02-10',
      end_date: '2026-02-10',
      status: 'active',
    })

    const request = createJsonRequest('http://localhost:3000/api/time-off', 'POST', {
      teacher_id: 'teacher-1',
      start_date: '2026-02-10',
      end_date: '2026-02-10',
      shift_selection_mode: 'all_scheduled',
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(createTimeOffShifts).toHaveBeenCalledWith('request-2', [
      {
        date: '2026-02-10',
        day_of_week_id: 'day-1',
        time_slot_id: 'slot-2',
        is_partial: false,
        start_time: null,
        end_time: null,
      },
    ])
    expect(json.excludedShiftCount).toBe(1)
    expect(json.warning).toMatch(/already has time off recorded/i)
  })

  it('POST draft mode skips conflict filtering and still creates shifts', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(createTimeOffRequest as jest.Mock).mockResolvedValue({
      id: 'request-3',
      teacher_id: 'teacher-1',
      start_date: '2026-02-10',
      end_date: '2026-02-10',
      status: 'draft',
    })

    const request = createJsonRequest('http://localhost:3000/api/time-off', 'POST', {
      teacher_id: 'teacher-1',
      status: 'draft',
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
    expect(createTimeOffShifts).toHaveBeenCalledWith('request-3', [
      {
        date: '2026-02-10',
        day_of_week_id: 'day-1',
        time_slot_id: 'slot-1',
      },
    ])
    expect(json.warning).toBeNull()
    expect(json.excludedShiftCount).toBe(0)
  })

  it('POST normalizes ISO datetime shifts and deduplicates excluded dates in warning', async () => {
    ;(createTimeOffShifts as jest.Mock).mockClear()
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(getTeacherTimeOffShifts as jest.Mock).mockResolvedValue([
      { date: '2026-02-10', time_slot_id: 'slot-1' },
      { date: '2026-02-10', time_slot_id: 'slot-2' },
    ])
    ;(createTimeOffRequest as jest.Mock).mockResolvedValue({
      id: 'request-4',
      teacher_id: 'teacher-1',
      start_date: '2026-02-10',
      end_date: '2026-02-10',
      status: 'active',
    })

    const request = createJsonRequest('http://localhost:3000/api/time-off', 'POST', {
      teacher_id: 'teacher-1',
      start_date: '2026-02-10',
      end_date: '2026-02-10',
      shift_selection_mode: 'select_shifts',
      shifts: [
        {
          date: '2026-02-10T00:00:00.000Z',
          day_of_week_id: 'day-1',
          time_slot_id: 'slot-1',
        },
        {
          date: '2026-02-10T00:00:00.000Z',
          day_of_week_id: 'day-1',
          time_slot_id: 'slot-2',
        },
        {
          date: '2026-02-10T00:00:00.000Z',
          day_of_week_id: 'day-1',
          time_slot_id: 'slot-3',
        },
      ],
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(createTimeOffShifts).toHaveBeenCalledWith('request-4', [
      {
        date: '2026-02-10T00:00:00.000Z',
        day_of_week_id: 'day-1',
        time_slot_id: 'slot-3',
      },
    ])
    expect(json.excludedShiftCount).toBe(2)
    expect(json.warning).toMatch(/will not be recorded: Tue,?\s+Feb 10/i)
  })

  it('POST creates request without shifts when no shifts are selected', async () => {
    ;(createTimeOffShifts as jest.Mock).mockClear()
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(createTimeOffRequest as jest.Mock).mockResolvedValue({
      id: 'request-5',
      teacher_id: 'teacher-1',
      start_date: '2026-02-10',
      end_date: '2026-02-10',
      status: 'active',
    })

    const request = createJsonRequest('http://localhost:3000/api/time-off', 'POST', {
      teacher_id: 'teacher-1',
      start_date: '2026-02-10',
      end_date: '2026-02-10',
      shift_selection_mode: 'select_shifts',
      shifts: [],
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(createTimeOffRequest).toHaveBeenCalled()
    expect(createTimeOffShifts).not.toHaveBeenCalled()
    expect(json.warning).toBeNull()
    expect(json.excludedShiftCount).toBe(0)
  })

  it('POST returns fallback unknown error when thrown error has no message', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(createTimeOffRequest as jest.Mock).mockRejectedValue({})

    const request = createJsonRequest('http://localhost:3000/api/time-off', 'POST', {
      teacher_id: 'teacher-1',
      start_date: '2026-02-10',
      end_date: '2026-02-10',
      shift_selection_mode: 'select_shifts',
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe('Unknown error occurred')
  })
})
