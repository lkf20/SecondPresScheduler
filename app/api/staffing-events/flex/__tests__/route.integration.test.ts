/** @jest-environment node */

import { POST } from '@/app/api/staffing-events/flex/route'
import { createJsonRequest } from '@/tests/helpers/api'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getScheduleSettings } from '@/lib/api/schedule-settings'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))

jest.mock('@/lib/api/schedule-settings', () => ({
  getScheduleSettings: jest.fn(),
}))

jest.mock('@/lib/utils/date', () => {
  const actual = jest.requireActual('@/lib/utils/date')
  return {
    ...actual,
    expandDateRangeWithTimeZone: jest.fn(() => [{ date: '2026-03-02', day_number: 1 }]),
  }
})

describe('POST /api/staffing-events/flex integration', () => {
  const mockFrom = jest.fn()
  const mockDaysSelect = jest.fn()
  const mockEventInsert = jest.fn()
  const mockEventSelect = jest.fn()
  const mockEventSingle = jest.fn()
  const mockShiftInsert = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(createClient as jest.Mock).mockResolvedValue({
      from: mockFrom,
    })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'days_of_week') {
        return { select: mockDaysSelect }
      }
      if (table === 'staffing_events') {
        return { insert: mockEventInsert }
      }
      if (table === 'staffing_event_shifts') {
        return { insert: mockShiftInsert }
      }
      return {}
    })
    mockDaysSelect.mockResolvedValue({
      data: [
        { id: 'day-mon', day_number: 1 },
        { id: 'day-tue', day_number: 2 },
      ],
      error: null,
    })
    mockEventInsert.mockReturnValue({
      select: mockEventSelect,
    })
    mockEventSelect.mockReturnValue({
      single: mockEventSingle,
    })
    mockEventSingle.mockResolvedValue({
      data: { id: 'event-1' },
      error: null,
    })
    mockShiftInsert.mockResolvedValue({ error: null })
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
  })

  it('returns 403 when school context is missing', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue(null)
    const request = createJsonRequest('http://localhost:3000/api/staffing-events/flex', 'POST', {})

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error).toMatch(/missing school context/i)
  })

  it('returns 400 for missing required fields', async () => {
    const request = createJsonRequest('http://localhost:3000/api/staffing-events/flex', 'POST', {
      staff_id: 'staff-1',
      start_date: '2026-03-02',
      end_date: '2026-03-02',
      classroom_ids: [],
      time_slot_ids: ['slot-1'],
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/classroom_ids is required/i)
  })

  it('returns 400 when start_date is after end_date', async () => {
    const request = createJsonRequest('http://localhost:3000/api/staffing-events/flex', 'POST', {
      staff_id: 'staff-1',
      start_date: '2026-03-10',
      end_date: '2026-03-02',
      classroom_ids: ['class-1'],
      time_slot_ids: ['slot-1'],
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/start_date must be before end_date/i)
  })

  it('returns 400 when start_date or end_date is invalid', async () => {
    const request = createJsonRequest('http://localhost:3000/api/staffing-events/flex', 'POST', {
      staff_id: 'staff-1',
      start_date: 'invalid-date',
      end_date: '2026-03-02',
      classroom_ids: ['class-1'],
      time_slot_ids: ['slot-1'],
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/invalid start_date or end_date/i)
  })

  it('returns 400 when no shifts match selected day filters', async () => {
    const request = createJsonRequest('http://localhost:3000/api/staffing-events/flex', 'POST', {
      staff_id: 'staff-1',
      start_date: '2026-03-02',
      end_date: '2026-03-02',
      classroom_ids: ['class-1'],
      time_slot_ids: ['slot-1'],
      day_of_week_ids: ['day-tue'],
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/no shifts matched/i)
  })

  it('returns 500 when days_of_week lookup fails', async () => {
    mockDaysSelect.mockResolvedValue({
      data: null,
      error: { message: 'days lookup failed' },
    })

    const request = createJsonRequest('http://localhost:3000/api/staffing-events/flex', 'POST', {
      staff_id: 'staff-1',
      start_date: '2026-03-02',
      end_date: '2026-03-02',
      classroom_ids: ['class-1'],
      time_slot_ids: ['slot-1'],
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toMatch(/days lookup failed/i)
  })

  it('returns 500 when staffing event creation fails', async () => {
    mockEventSingle.mockResolvedValue({
      data: null,
      error: { message: 'insert failed' },
    })

    const request = createJsonRequest('http://localhost:3000/api/staffing-events/flex', 'POST', {
      staff_id: 'staff-1',
      start_date: '2026-03-02',
      end_date: '2026-03-02',
      classroom_ids: ['class-1'],
      time_slot_ids: ['slot-1'],
      day_of_week_ids: ['day-mon'],
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toMatch(/insert failed/i)
  })

  it('returns 409 when shift insert conflicts with existing assignment', async () => {
    mockShiftInsert.mockResolvedValue({
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })
    const request = createJsonRequest('http://localhost:3000/api/staffing-events/flex', 'POST', {
      staff_id: 'staff-1',
      start_date: '2026-03-02',
      end_date: '2026-03-02',
      classroom_ids: ['class-1'],
      time_slot_ids: ['slot-1'],
      day_of_week_ids: ['day-mon'],
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(409)
    expect(json.error).toMatch(/conflicts with an existing active assignment/i)
  })

  it('returns 500 when shift insert fails for non-conflict error', async () => {
    mockShiftInsert.mockResolvedValue({
      error: { code: 'PGRST999', message: 'insert shift failed' },
    })
    const request = createJsonRequest('http://localhost:3000/api/staffing-events/flex', 'POST', {
      staff_id: 'staff-1',
      start_date: '2026-03-02',
      end_date: '2026-03-02',
      classroom_ids: ['class-1'],
      time_slot_ids: ['slot-1'],
      day_of_week_ids: ['day-mon'],
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toMatch(/insert shift failed/i)
  })

  it('creates flex event with explicit shifts and returns created id + shift count', async () => {
    const request = createJsonRequest('http://localhost:3000/api/staffing-events/flex', 'POST', {
      staff_id: 'staff-1',
      start_date: '2026-03-02',
      end_date: '2026-03-10',
      classroom_ids: ['class-1'],
      time_slot_ids: ['slot-1'],
      shifts: [
        { date: '2026-03-02', classroom_id: 'class-1', time_slot_id: 'slot-1' },
        { date: '2026-03-03', classroom_id: 'class-1', time_slot_id: 'slot-1' },
      ],
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ id: 'event-1', shift_count: 2 })
    expect(mockShiftInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        school_id: 'school-1',
        staffing_event_id: 'event-1',
        staff_id: 'staff-1',
        date: '2026-03-02',
        day_of_week_id: 'day-mon',
        time_slot_id: 'slot-1',
        classroom_id: 'class-1',
        status: 'active',
      }),
      expect.objectContaining({
        school_id: 'school-1',
        staffing_event_id: 'event-1',
        staff_id: 'staff-1',
        date: '2026-03-03',
        day_of_week_id: 'day-tue',
        time_slot_id: 'slot-1',
        classroom_id: 'class-1',
        status: 'active',
      }),
    ])
  })
})
