/** @jest-environment node */

import { GET, POST } from '@/app/api/time-off/route'
import { createJsonRequest } from '@/tests/helpers/api'
import { getUserSchoolId } from '@/lib/utils/auth'
import {
  getTimeOffRequests,
  createTimeOffRequest,
  updateTimeOffRequest,
  findOverlappingTimeOffRequest,
} from '@/lib/api/time-off'
import {
  createTimeOffShifts,
  getTeacherScheduledShifts,
  getTeacherTimeOffShifts,
  validateShiftsHaveClassroom,
} from '@/lib/api/time-off-shifts'
import { getScheduleSettings } from '@/lib/api/schedule-settings'
import { revalidatePath } from 'next/cache'
import { getAuditActorContext, logAuditEvent } from '@/lib/audit/logAuditEvent'
import { createClient } from '@/lib/supabase/server'
import { getSchoolClosuresForDateRange } from '@/lib/api/school-calendar'
import { getStaffById } from '@/lib/api/staff'

jest.mock('@/lib/api/staff', () => ({
  getStaffById: jest.fn(),
}))

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))

jest.mock('@/lib/api/time-off', () => ({
  getTimeOffRequests: jest.fn(),
  createTimeOffRequest: jest.fn(),
  updateTimeOffRequest: jest.fn().mockResolvedValue(undefined),
  findOverlappingTimeOffRequest: jest.fn(),
}))

jest.mock('@/lib/api/time-off-shifts', () => ({
  createTimeOffShifts: jest.fn(),
  getTeacherScheduledShifts: jest.fn(),
  getTeacherTimeOffShifts: jest.fn(),
  validateShiftsHaveClassroom: jest.fn().mockResolvedValue({ valid: true }),
}))

jest.mock('@/lib/api/schedule-settings', () => ({
  getScheduleSettings: jest.fn(),
}))

jest.mock('@/lib/api/school-calendar', () => ({
  getSchoolClosuresForDateRange: jest.fn().mockResolvedValue([]),
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
    ;(getStaffById as jest.Mock).mockResolvedValue({ id: 'teacher-1', active: true })
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

  it('POST returns 400 when teacher is not found', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getStaffById as jest.Mock).mockResolvedValue(null)

    const request = createJsonRequest('http://localhost:3000/api/time-off', 'POST', {
      teacher_id: 'teacher-missing',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.code).toBe('TEACHER_NOT_FOUND')
    expect(json.error).toMatch(/teacher not found/i)
    expect(createTimeOffRequest).not.toHaveBeenCalled()
  })

  it('POST returns 400 when teacher is inactive', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getStaffById as jest.Mock).mockResolvedValue({ id: 'teacher-1', active: false })

    const request = createJsonRequest('http://localhost:3000/api/time-off', 'POST', {
      teacher_id: 'teacher-1',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.code).toBe('TEACHER_INACTIVE')
    expect(json.error).toMatch(/inactive|activate/i)
    expect(createTimeOffRequest).not.toHaveBeenCalled()
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
      school_id: 'school-1',
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

  it('POST returns 409 when new request overlaps another draft or active request', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(findOverlappingTimeOffRequest as jest.Mock).mockResolvedValue({
      id: 'existing-request-1',
      start_date: '2026-02-04',
      end_date: '2026-02-10',
      status: 'active',
    })

    const request = createJsonRequest('http://localhost:3000/api/time-off', 'POST', {
      teacher_id: 'teacher-1',
      start_date: '2026-02-09',
      end_date: '2026-02-10',
      reason: 'Sick',
      shift_selection_mode: 'select_shifts',
      shifts: [
        {
          date: '2026-02-09',
          day_of_week_id: 'day-1',
          time_slot_id: 'slot-1',
        },
      ],
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(409)
    expect(json.code).toBe('TIME_OFF_OVERLAP')
    expect(json.existingRequestId).toBe('existing-request-1')
    expect(json.existingStartDate).toBe('2026-02-04')
    expect(json.existingEndDate).toBe('2026-02-10')
    expect(json.existingStatus).toBe('active')
    expect(createTimeOffRequest).not.toHaveBeenCalled()
  })

  it('POST returns 400 when shifts lack scheduled classroom', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(findOverlappingTimeOffRequest as jest.Mock).mockResolvedValue(null)
    ;(getTeacherTimeOffShifts as jest.Mock).mockResolvedValue([])
    ;(validateShiftsHaveClassroom as jest.Mock).mockResolvedValue({
      valid: false,
      missingShifts: [{ day_of_week_id: 'day-1', time_slot_id: 'slot-1' }],
    })

    const request = createJsonRequest('http://localhost:3000/api/time-off', 'POST', {
      teacher_id: 'teacher-1',
      start_date: '2026-02-10',
      end_date: '2026-02-10',
      reason: 'Sick',
      shift_selection_mode: 'select_shifts',
      shifts: [{ date: '2026-02-10', day_of_week_id: 'day-1', time_slot_id: 'slot-1' }],
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.code).toBe('SHIFTS_MISSING_CLASSROOM')
    expect(json.error).toMatch(/no scheduled classroom|baseline schedule/i)
    expect(json.missingShifts).toEqual([{ day_of_week_id: 'day-1', time_slot_id: 'slot-1' }])
    expect(createTimeOffRequest).not.toHaveBeenCalled()
    expect(createTimeOffShifts).not.toHaveBeenCalled()
  })

  it('POST creates request + shifts and returns 201', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(findOverlappingTimeOffRequest as jest.Mock).mockResolvedValue(null)
    ;(getTeacherTimeOffShifts as jest.Mock).mockResolvedValue([])
    ;(validateShiftsHaveClassroom as jest.Mock).mockResolvedValue({ valid: true })
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
      reason: 'Sick',
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
      reason: 'Sick',
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
      reason: 'Sick',
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

  it('POST excludes shifts on school closed days and returns 400 when all shifts closed (active requires at least one shift)', async () => {
    ;(createTimeOffRequest as jest.Mock).mockClear()
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(findOverlappingTimeOffRequest as jest.Mock).mockResolvedValue(null)
    ;(getTeacherTimeOffShifts as jest.Mock).mockResolvedValue([])
    ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([
      { date: '2026-02-10', time_slot_id: null },
    ])

    const request = createJsonRequest('http://localhost:3000/api/time-off', 'POST', {
      teacher_id: 'teacher-1',
      start_date: '2026-02-10',
      end_date: '2026-02-10',
      status: 'active',
      reason: 'Sick',
      shift_selection_mode: 'select_shifts',
      shifts: [
        { date: '2026-02-10', day_of_week_id: 'day-1', time_slot_id: 'slot-1' },
        { date: '2026-02-10', day_of_week_id: 'day-1', time_slot_id: 'slot-2' },
      ],
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.code).toBe('TIME_OFF_REQUIRES_SHIFTS')
    expect(getSchoolClosuresForDateRange).toHaveBeenCalledWith(
      'school-1',
      '2026-02-10',
      '2026-02-10'
    )
    expect(createTimeOffRequest).not.toHaveBeenCalled()
  })

  it('POST creates draft without shifts when no shifts are selected', async () => {
    ;(createTimeOffShifts as jest.Mock).mockClear()
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(createTimeOffRequest as jest.Mock).mockResolvedValue({
      id: 'request-5',
      teacher_id: 'teacher-1',
      start_date: '2026-02-10',
      end_date: '2026-02-10',
      status: 'draft',
    })

    const request = createJsonRequest('http://localhost:3000/api/time-off', 'POST', {
      teacher_id: 'teacher-1',
      start_date: '2026-02-10',
      end_date: '2026-02-10',
      status: 'draft',
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

  it('POST returns 400 when saving as active with no shifts', async () => {
    ;(createTimeOffRequest as jest.Mock).mockClear()
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(findOverlappingTimeOffRequest as jest.Mock).mockResolvedValue(null)

    const request = createJsonRequest('http://localhost:3000/api/time-off', 'POST', {
      teacher_id: 'teacher-1',
      start_date: '2026-02-10',
      end_date: '2026-02-10',
      status: 'active',
      reason: 'Sick',
      shift_selection_mode: 'select_shifts',
      shifts: [],
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.code).toBe('TIME_OFF_REQUIRES_SHIFTS')
    expect(json.error).toMatch(/at least one shift|draft/i)
    expect(createTimeOffRequest).not.toHaveBeenCalled()
  })

  it('POST returns fallback unknown error when thrown error has no message', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(createTimeOffRequest as jest.Mock).mockRejectedValue({})

    const request = createJsonRequest('http://localhost:3000/api/time-off', 'POST', {
      teacher_id: 'teacher-1',
      start_date: '2026-02-10',
      end_date: '2026-02-10',
      status: 'draft',
      shift_selection_mode: 'select_shifts',
      shifts: [],
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe('Unknown error occurred')
  })
})
