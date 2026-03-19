/** @jest-environment node */

import { POST } from '@/app/api/staffing-events/flex/route'
import { createJsonRequest } from '@/tests/helpers/api'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getScheduleSettings } from '@/lib/api/schedule-settings'
import { getAuditActorContext, logAuditEvent } from '@/lib/audit/logAuditEvent'
import { getSchoolClosuresForDateRange } from '@/lib/api/school-calendar'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
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

jest.mock('@/lib/audit/logAuditEvent', () => ({
  getAuditActorContext: jest.fn(),
  logAuditEvent: jest.fn(),
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
  const mockShiftSelect = jest.fn()
  const mockCoverageSelect = jest.fn()
  const mockCoverageIn = jest.fn()
  const mockSubAssignmentInsert = jest.fn()
  const mockSubAssignmentSelect = jest.fn()

  const mockStaffMaybeSingle = jest.fn().mockResolvedValue({
    data: { first_name: 'Test', last_name: 'Staff', display_name: null },
    error: null,
  })
  const mockClassroomsIn = jest.fn().mockResolvedValue({
    data: [{ id: 'class-1', name: 'Room 1' }],
    error: null,
  })

  beforeEach(() => {
    jest.clearAllMocks()
    ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([])
    mockStaffMaybeSingle.mockResolvedValue({
      data: { first_name: 'Test', last_name: 'Staff', display_name: null },
      error: null,
    })
    mockClassroomsIn.mockResolvedValue({
      data: [{ id: 'class-1', name: 'Room 1' }],
      error: null,
    })
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
      if (table === 'coverage_request_shifts') {
        return {
          select: mockCoverageSelect,
        }
      }
      if (table === 'sub_assignments') {
        return {
          insert: mockSubAssignmentInsert,
        }
      }
      if (table === 'staff') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: mockStaffMaybeSingle,
        }
      }
      if (table === 'classrooms') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: mockClassroomsIn,
        }
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
    mockShiftInsert.mockReturnValue({ select: mockShiftSelect })
    mockShiftSelect.mockResolvedValue({
      data: [
        {
          id: 'shift-1',
          date: '2026-03-02',
          day_of_week_id: 'day-mon',
          time_slot_id: 'slot-1',
          classroom_id: 'class-1',
          source_classroom_id: null,
          coverage_request_shift_id: null,
        },
      ],
      error: null,
    })
    mockCoverageSelect.mockReturnValue({ in: mockCoverageIn })
    mockCoverageIn.mockResolvedValue({ data: [], error: null })
    mockSubAssignmentInsert.mockReturnValue({ select: mockSubAssignmentSelect })
    mockSubAssignmentSelect.mockResolvedValue({ data: [{ id: 'sa-1' }], error: null })
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(getAuditActorContext as jest.Mock).mockResolvedValue({
      actorUserId: 'user-1',
      actorDisplayName: 'Test User',
    })
    ;(logAuditEvent as jest.Mock).mockResolvedValue(undefined)
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

  it('returns 400 when staff_id is missing', async () => {
    const request = createJsonRequest('http://localhost:3000/api/staffing-events/flex', 'POST', {
      start_date: '2026-03-02',
      end_date: '2026-03-02',
      classroom_ids: ['class-1'],
      time_slot_ids: ['slot-1'],
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/staff_id, start_date, end_date are required/i)
  })

  it('returns 400 when time_slot_ids is missing or empty', async () => {
    const request = createJsonRequest('http://localhost:3000/api/staffing-events/flex', 'POST', {
      staff_id: 'staff-1',
      start_date: '2026-03-02',
      end_date: '2026-03-02',
      classroom_ids: ['class-1'],
      time_slot_ids: [],
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/time_slot_ids is required/i)
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

  it('returns 503 with actionable message when reassignment category is blocked by DB check constraint', async () => {
    mockEventSingle.mockResolvedValue({
      data: null,
      error: {
        code: '23514',
        message:
          'new row for relation "staffing_events" violates check constraint "staffing_events_event_category_check"',
      },
    })

    const request = createJsonRequest('http://localhost:3000/api/staffing-events/flex', 'POST', {
      staff_id: 'staff-1',
      start_date: '2026-03-02',
      end_date: '2026-03-02',
      classroom_ids: ['class-1'],
      time_slot_ids: ['slot-1'],
      event_category: 'reassignment',
      shifts: [
        {
          date: '2026-03-02',
          classroom_id: 'class-1',
          time_slot_id: 'slot-1',
          source_classroom_id: 'class-2',
        },
      ],
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(503)
    expect(json.error).toMatch(/including 119_fix_reassignment_event_category_and_linkage\.sql/i)
  })

  it('returns 409 when shift insert conflicts with existing assignment', async () => {
    mockShiftSelect.mockResolvedValue({
      data: null,
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
    mockShiftSelect.mockResolvedValue({
      data: null,
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

  it('skips shifts on school closed days when using explicit shifts', async () => {
    ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([
      { date: '2026-03-02', time_slot_id: null },
    ])
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
    expect(getSchoolClosuresForDateRange).toHaveBeenCalledWith(
      'school-1',
      '2026-03-02',
      '2026-03-10'
    )
    expect(json.shift_count).toBe(1)
    expect(mockShiftInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        date: '2026-03-03',
        time_slot_id: 'slot-1',
        classroom_id: 'class-1',
      }),
    ])
  })

  it('creates flex event with explicit shifts and returns created id + shift count', async () => {
    mockShiftSelect.mockResolvedValue({
      data: [
        {
          id: 'shift-1',
          date: '2026-03-02',
          day_of_week_id: 'day-mon',
          time_slot_id: 'slot-1',
          classroom_id: 'class-1',
          source_classroom_id: null,
          coverage_request_shift_id: null,
        },
        {
          id: 'shift-2',
          date: '2026-03-03',
          day_of_week_id: 'day-tue',
          time_slot_id: 'slot-1',
          classroom_id: 'class-1',
          source_classroom_id: null,
          coverage_request_shift_id: null,
        },
      ],
      error: null,
    })
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
    expect(json).toEqual({ id: 'event-1', shift_count: 2, linked_sub_assignment_count: 0 })
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

  it('creates generated shifts when explicit shifts are not provided', async () => {
    ;(getScheduleSettings as jest.Mock).mockResolvedValue(null)

    const request = createJsonRequest('http://localhost:3000/api/staffing-events/flex', 'POST', {
      staff_id: 'staff-1',
      start_date: '2026-03-02',
      end_date: '2026-03-02',
      classroom_ids: ['class-1', 'class-2'],
      time_slot_ids: ['slot-1'],
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ id: 'event-1', shift_count: 2, linked_sub_assignment_count: 0 })
    expect(mockEventInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: null,
      })
    )
    expect(mockShiftInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        staffing_event_id: 'event-1',
        staff_id: 'staff-1',
        date: '2026-03-02',
        day_of_week_id: 'day-mon',
        time_slot_id: 'slot-1',
        classroom_id: 'class-1',
      }),
      expect.objectContaining({
        staffing_event_id: 'event-1',
        staff_id: 'staff-1',
        date: '2026-03-02',
        day_of_week_id: 'day-mon',
        time_slot_id: 'slot-1',
        classroom_id: 'class-2',
      }),
    ])
  })

  it('requires source_classroom_id for reassignment shifts', async () => {
    const request = createJsonRequest('http://localhost:3000/api/staffing-events/flex', 'POST', {
      staff_id: 'staff-1',
      start_date: '2026-03-02',
      end_date: '2026-03-02',
      classroom_ids: ['class-1'],
      time_slot_ids: ['slot-1'],
      shifts: [{ date: '2026-03-02', classroom_id: 'class-1', time_slot_id: 'slot-1' }],
      event_category: 'reassignment',
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/source_classroom_id is required/i)
  })

  it('creates linked sub assignment for reassignment coverage shift', async () => {
    mockCoverageIn.mockResolvedValue({
      data: [
        {
          id: 'crs-1',
          school_id: 'school-1',
          status: 'active',
          date: '2026-03-02',
          time_slot_id: 'slot-1',
          classroom_id: 'class-1',
          coverage_requests: { teacher_id: 'teacher-1', school_id: 'school-1', status: 'open' },
        },
      ],
      error: null,
    })
    mockShiftSelect.mockResolvedValue({
      data: [
        {
          id: 'ses-1',
          date: '2026-03-02',
          day_of_week_id: 'day-mon',
          time_slot_id: 'slot-1',
          classroom_id: 'class-1',
          source_classroom_id: 'class-2',
          coverage_request_shift_id: 'crs-1',
        },
      ],
      error: null,
    })

    const request = createJsonRequest('http://localhost:3000/api/staffing-events/flex', 'POST', {
      staff_id: 'staff-1',
      start_date: '2026-03-02',
      end_date: '2026-03-02',
      classroom_ids: ['class-1'],
      time_slot_ids: ['slot-1'],
      event_category: 'reassignment',
      shifts: [
        {
          date: '2026-03-02',
          classroom_id: 'class-1',
          source_classroom_id: 'class-2',
          time_slot_id: 'slot-1',
          coverage_request_shift_id: 'crs-1',
        },
      ],
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.linked_sub_assignment_count).toBe(1)
    expect(mockSubAssignmentInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          staffing_event_shift_id: 'ses-1',
          coverage_request_shift_id: 'crs-1',
          sub_id: 'staff-1',
          teacher_id: 'teacher-1',
          non_sub_override: true,
        }),
      ])
    )
  })

  // Break Coverage UI is off (BREAK_COVERAGE_ENABLED = false). Backend still accepts break; re-enable test when feature is on.
  it.skip('creates break coverage event with event_category, covered_staff_id, start_time, end_time', async () => {
    const request = createJsonRequest('http://localhost:3000/api/staffing-events/flex', 'POST', {
      staff_id: 'staff-1',
      start_date: '2026-03-02',
      end_date: '2026-03-02',
      classroom_ids: ['class-1'],
      time_slot_ids: ['slot-1'],
      event_category: 'break',
      covered_staff_id: 'teacher-1',
      start_time: '11:00',
      end_time: '11:30',
      shifts: [{ date: '2026-03-02', classroom_id: 'class-1', time_slot_id: 'slot-1' }],
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ id: 'event-1', shift_count: 1, linked_sub_assignment_count: 0 })
    expect(mockEventInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        school_id: 'school-1',
        event_type: 'temporary_coverage',
        event_category: 'break',
        covered_staff_id: 'teacher-1',
        start_time: '11:00',
        end_time: '11:30',
        staff_id: 'staff-1',
        start_date: '2026-03-02',
        end_date: '2026-03-02',
        status: 'active',
      })
    )
  })

  it('returns 500 when request parsing throws unexpectedly', async () => {
    const badRequest = {
      json: jest.fn(async () => {
        throw new Error('malformed json')
      }),
    }

    const response = await POST(badRequest as any)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toMatch(/malformed json/i)
  })
})
