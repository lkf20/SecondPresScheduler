/** @jest-environment node */

import { DELETE, GET, PUT } from '@/app/api/time-off/[id]/route'
import { createJsonRequest } from '@/tests/helpers/api'
import {
  cancelTimeOffRequest,
  findOverlappingTimeOffRequest,
  getActiveSubAssignmentsForTimeOffRequest,
  getTimeOffRequestById,
} from '@/lib/api/time-off'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getScheduleSettings } from '@/lib/api/schedule-settings'
import { canTransitionTimeOffStatus } from '@/lib/lifecycle/status-transitions'
import {
  getTimeOffShifts,
  deleteTimeOffShifts,
  createTimeOffShifts,
  getTeacherScheduledShifts,
  getTeacherTimeOffShifts,
  validateShiftsHaveClassroom,
} from '@/lib/api/time-off-shifts'
import { updateTimeOffRequest } from '@/lib/api/time-off'
import { revalidatePath } from 'next/cache'
import { getAuditActorContext, logAuditEvent } from '@/lib/audit/logAuditEvent'
import { getSchoolClosuresForDateRange } from '@/lib/api/school-calendar'
import { getStaffById } from '@/lib/api/staff'

jest.mock('@/lib/api/staff', () => ({
  getStaffById: jest.fn(),
}))

jest.mock('@/lib/api/time-off', () => ({
  getTimeOffRequestById: jest.fn(),
  updateTimeOffRequest: jest.fn(),
  getActiveSubAssignmentsForTimeOffRequest: jest.fn(),
  cancelTimeOffRequest: jest.fn(),
  findOverlappingTimeOffRequest: jest.fn(),
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

const mockEq = jest.fn()
const mockSingle = jest.fn()
const mockSelect = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: mockFrom,
  })),
}))

jest.mock('@/lib/api/time-off-shifts', () => ({
  getTimeOffShifts: jest.fn(),
  createTimeOffShifts: jest.fn(),
  deleteTimeOffShifts: jest.fn(),
  getTeacherScheduledShifts: jest.fn(async () => []),
  getTeacherTimeOffShifts: jest.fn(async () => []),
  validateShiftsHaveClassroom: jest.fn().mockResolvedValue({ valid: true }),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

jest.mock('@/lib/lifecycle/status-transitions', () => ({
  canTransitionTimeOffStatus: jest.fn(),
  formatTransitionError: jest.fn(() => 'Invalid status transition'),
}))

jest.mock('@/lib/audit/logAuditEvent', () => ({
  getAuditActorContext: jest.fn(),
  logAuditEvent: jest.fn(),
}))

describe('PUT /api/time-off/[id] integration', () => {
  beforeEach(() => {
    ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([])
    ;(validateShiftsHaveClassroom as jest.Mock).mockResolvedValue({ valid: true })
    jest.spyOn(console, 'log').mockImplementation(() => {})
    ;(findOverlappingTimeOffRequest as jest.Mock).mockResolvedValue(null)
    ;(getTimeOffShifts as jest.Mock).mockResolvedValue([])
    ;(getAuditActorContext as jest.Mock).mockResolvedValue({
      actorUserId: 'user-1',
      actorDisplayName: 'Test User',
    })
    ;(logAuditEvent as jest.Mock).mockResolvedValue(undefined)
    mockFrom.mockImplementation(() => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
      return chain
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  it('GET returns request with shifts', async () => {
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'timeoff-1',
      teacher_id: 'teacher-1',
    })
    ;(getTimeOffShifts as jest.Mock).mockResolvedValue([
      { id: 'shift-1', date: '2026-02-20', time_slot_id: 'slot-1' },
    ])

    const request = createJsonRequest('http://localhost:3000/api/time-off/timeoff-1', 'GET')
    const response = await GET(request as any, { params: Promise.resolve({ id: 'timeoff-1' }) })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.id).toBe('timeoff-1')
    expect(json.shifts).toHaveLength(1)
  })

  it('GET returns 404 when request lookup fails', async () => {
    ;(getTimeOffRequestById as jest.Mock).mockRejectedValue(new Error('missing'))

    const request = createJsonRequest('http://localhost:3000/api/time-off/missing', 'GET')
    const response = await GET(request as any, { params: Promise.resolve({ id: 'missing' }) })
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toMatch(/missing/i)
  })

  it('returns 400 when status transition is not allowed', async () => {
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'timeoff-1',
      school_id: 'school-1',
      reason: 'Sick',
      status: 'cancelled',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
      teacher_id: 'teacher-1',
      shift_selection_mode: 'all_scheduled',
    })
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(canTransitionTimeOffStatus as jest.Mock).mockReturnValue(false)

    const request = createJsonRequest('http://localhost:3000/api/time-off/timeoff-1', 'PUT', {
      status: 'active',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
    })

    const response = await PUT(request as any, { params: Promise.resolve({ id: 'timeoff-1' }) })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/invalid status transition/i)
  })

  it('PUT updates request and rebuilds shifts', async () => {
    const previousNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    mockSingle.mockResolvedValue({
      data: {
        coverage_request_id: null,
        start_date: '2026-02-20',
        end_date: '2026-02-20',
      },
      error: null,
    })
    mockEq.mockReturnValue({ single: mockSingle })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'timeoff-1',
      school_id: 'school-1',
      reason: 'Sick',
      status: 'active',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
      teacher_id: 'teacher-1',
      shift_selection_mode: 'select_shifts',
    })
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(canTransitionTimeOffStatus as jest.Mock).mockReturnValue(true)
    ;(getTeacherTimeOffShifts as jest.Mock).mockResolvedValue([])
    ;(updateTimeOffRequest as jest.Mock).mockResolvedValue({
      id: 'timeoff-1',
      school_id: 'school-1',
      reason: 'Sick',
      status: 'active',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
      teacher_id: 'teacher-1',
      shift_selection_mode: 'select_shifts',
    })
    const createdShift = { id: 's1', date: '2026-02-20', time_slot_id: 'slot-1' }
    ;(getTimeOffShifts as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([createdShift])
      .mockResolvedValue([createdShift])

    const request = createJsonRequest('http://localhost:3000/api/time-off/timeoff-1', 'PUT', {
      status: 'active',
      teacher_id: 'teacher-1',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
      shift_selection_mode: 'select_shifts',
      shifts: [
        {
          date: '2026-02-20',
          day_of_week_id: 'day-1',
          time_slot_id: 'slot-1',
        },
      ],
    })

    const response = await PUT(request as any, { params: Promise.resolve({ id: 'timeoff-1' }) })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(deleteTimeOffShifts).not.toHaveBeenCalled()
    expect(createTimeOffShifts).toHaveBeenCalledWith('timeoff-1', [
      {
        date: '2026-02-20',
        day_of_week_id: 'day-1',
        time_slot_id: 'slot-1',
        is_partial: false,
        start_time: null,
        end_time: null,
      },
    ])
    expect(revalidatePath).toHaveBeenCalledWith('/time-off')
    expect(json.id).toBe('timeoff-1')

    process.env.NODE_ENV = previousNodeEnv
  })

  it('PUT returns 400 when new shifts lack scheduled classroom', async () => {
    const previousNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    mockSingle.mockResolvedValue({
      data: { coverage_request_id: null, start_date: '2026-02-20', end_date: '2026-02-20' },
      error: null,
    })
    mockEq.mockReturnValue({ single: mockSingle })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'timeoff-1',
      school_id: 'school-1',
      reason: 'Sick',
      status: 'active',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
      teacher_id: 'teacher-1',
      shift_selection_mode: 'select_shifts',
    })
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(canTransitionTimeOffStatus as jest.Mock).mockReturnValue(true)
    ;(getTeacherTimeOffShifts as jest.Mock).mockResolvedValue([])
    ;(getTimeOffShifts as jest.Mock).mockResolvedValue([])
    ;(validateShiftsHaveClassroom as jest.Mock).mockResolvedValue({
      valid: false,
      missingShifts: [{ day_of_week_id: 'day-1', time_slot_id: 'slot-1' }],
    })

    const request = createJsonRequest('http://localhost:3000/api/time-off/timeoff-1', 'PUT', {
      status: 'active',
      teacher_id: 'teacher-1',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
      shift_selection_mode: 'select_shifts',
      shifts: [{ date: '2026-02-20', day_of_week_id: 'day-1', time_slot_id: 'slot-1' }],
    })

    const response = await PUT(request as any, { params: Promise.resolve({ id: 'timeoff-1' }) })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.code).toBe('SHIFTS_MISSING_CLASSROOM')
    expect(json.error).toMatch(/no scheduled classroom|baseline schedule/i)
    expect(json.missingShifts).toEqual([{ day_of_week_id: 'day-1', time_slot_id: 'slot-1' }])
    expect(createTimeOffShifts).not.toHaveBeenCalled()

    process.env.NODE_ENV = previousNodeEnv
  })

  it('PUT excludes shifts on school closed days from shiftsToCreate', async () => {
    const previousNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([
      { date: '2026-02-20', time_slot_id: null },
    ])
    mockSingle.mockResolvedValue({
      data: { coverage_request_id: null, start_date: '2026-02-20', end_date: '2026-02-20' },
      error: null,
    })
    mockEq.mockReturnValue({ single: mockSingle })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'timeoff-1',
      school_id: 'school-1',
      reason: 'Sick',
      status: 'active',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
      teacher_id: 'teacher-1',
      shift_selection_mode: 'select_shifts',
    })
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(canTransitionTimeOffStatus as jest.Mock).mockReturnValue(true)
    ;(getTeacherTimeOffShifts as jest.Mock).mockResolvedValue([])
    ;(updateTimeOffRequest as jest.Mock).mockResolvedValue({
      id: 'timeoff-1',
      school_id: 'school-1',
      reason: 'Sick',
      status: 'active',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
      teacher_id: 'teacher-1',
      shift_selection_mode: 'select_shifts',
    })
    const keptShift = { id: 's1', date: '2026-02-20', time_slot_id: 'slot-1' }
    ;(getTimeOffShifts as jest.Mock).mockResolvedValueOnce([]).mockResolvedValue([keptShift])

    const request = createJsonRequest('http://localhost:3000/api/time-off/timeoff-1', 'PUT', {
      status: 'active',
      teacher_id: 'teacher-1',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
      shift_selection_mode: 'select_shifts',
      shifts: [{ date: '2026-02-20', day_of_week_id: 'day-1', time_slot_id: 'slot-1' }],
    })

    const response = await PUT(request as any, { params: Promise.resolve({ id: 'timeoff-1' }) })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(getSchoolClosuresForDateRange).toHaveBeenCalledWith(
      'school-1',
      '2026-02-20',
      '2026-02-20'
    )
    expect(deleteTimeOffShifts).not.toHaveBeenCalled()
    expect(createTimeOffShifts).not.toHaveBeenCalled()

    process.env.NODE_ENV = previousNodeEnv
  })

  it('PUT all_scheduled mode excludes conflicting shifts and returns warning metadata', async () => {
    const previousNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    const timeOffRequestsTable = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          coverage_request_id: 'coverage-1',
          start_date: '2026-02-20',
          end_date: '2026-02-21',
        },
        error: null,
      }),
    }

    const coverageRequestsTable = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest
        .fn()
        .mockResolvedValueOnce({
          data: { start_date: '2026-02-20', end_date: '2026-02-21' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: null,
        }),
    }

    const coverageRequestShiftsTable = {
      select: jest.fn().mockReturnThis(),
      eq: jest
        .fn()
        .mockResolvedValueOnce({
          data: [{ date: '2026-02-21' }, { date: '2026-02-22' }],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [{ date: '2026-02-21' }, { date: '2026-02-22' }],
          error: null,
        }),
    }

    const timeOffShiftsTable = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({ data: null, error: null }),
      delete: jest.fn().mockReturnThis(),
    }
    const subAssignmentsTable = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: [], error: null }),
    }
    mockFrom.mockImplementation((table: string) => {
      if (table === 'time_off_requests') return timeOffRequestsTable
      if (table === 'coverage_requests') return coverageRequestsTable
      if (table === 'coverage_request_shifts') return coverageRequestShiftsTable
      if (table === 'time_off_shifts') return timeOffShiftsTable
      if (table === 'sub_assignments') return subAssignmentsTable
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: null }) }
    })
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'timeoff-1',
      school_id: 'school-1',
      reason: 'Sick',
      status: 'active',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
      teacher_id: 'teacher-1',
      shift_selection_mode: 'all_scheduled',
    })
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(canTransitionTimeOffStatus as jest.Mock).mockReturnValue(true)
    ;(getTeacherTimeOffShifts as jest.Mock).mockResolvedValue([])
    ;(updateTimeOffRequest as jest.Mock).mockResolvedValue({
      id: 'timeoff-1',
      school_id: 'school-1',
      reason: 'Sick',
      status: 'active',
      start_date: '2026-02-20',
      end_date: '2026-02-21',
      teacher_id: 'teacher-1',
      shift_selection_mode: 'all_scheduled',
    })
    ;(getTeacherScheduledShifts as jest.Mock).mockResolvedValue([
      { date: '2026-02-20', day_of_week_id: 'day-1', time_slot_id: 'slot-1' },
      { date: '2026-02-21', day_of_week_id: 'day-2', time_slot_id: 'slot-2' },
    ])
    ;(getTeacherTimeOffShifts as jest.Mock).mockResolvedValue([
      { date: '2026-02-20', time_slot_id: 'slot-1' },
    ])
    const allScheduledShifts = [
      { id: 's1', date: '2026-02-20', time_slot_id: 'slot-1' },
      { id: 's2', date: '2026-02-21', time_slot_id: 'slot-2' },
    ]
    let getTimeOffShiftsCallCount = 0
    ;(getTimeOffShifts as jest.Mock).mockImplementation(async () => {
      getTimeOffShiftsCallCount++
      return getTimeOffShiftsCallCount === 1
        ? [{ id: 's1', date: '2026-02-20', time_slot_id: 'slot-1' }]
        : allScheduledShifts
    })

    const request = createJsonRequest('http://localhost:3000/api/time-off/timeoff-1', 'PUT', {
      status: 'active',
      teacher_id: 'teacher-1',
      start_date: '2026-02-20',
      end_date: '2026-02-22',
      shift_selection_mode: 'all_scheduled',
    })

    const response = await PUT(request as any, { params: Promise.resolve({ id: 'timeoff-1' }) })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(deleteTimeOffShifts).not.toHaveBeenCalled()
    expect(createTimeOffShifts).toHaveBeenCalledWith('timeoff-1', [
      {
        date: '2026-02-21',
        day_of_week_id: 'day-2',
        time_slot_id: 'slot-2',
        is_partial: false,
        start_time: null,
        end_time: null,
      },
    ])
    expect(json.excludedShiftCount).toBe(1)
    expect(json.warning).toMatch(/already has time off recorded/i)
    expect(json.warning).toMatch(/will not be recorded/i)
    expect(revalidatePath).toHaveBeenCalledWith('/time-off')

    process.env.NODE_ENV = previousNodeEnv
  })

  it('DELETE returns assignment summary when action is not provided', async () => {
    ;(getActiveSubAssignmentsForTimeOffRequest as jest.Mock).mockResolvedValue([
      {
        id: 'assignment-1',
        coverage_request_shift: {
          date: '2026-02-10',
          days_of_week: { name: 'Monday' },
          time_slots: { code: 'EM' },
          classrooms: { name: 'Infant Room' },
        },
        sub: {
          display_name: 'Sally A.',
        },
      },
    ])
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'timeoff-1',
      teacher: { display_name: 'Bella W.' },
    })

    const request = createJsonRequest('http://localhost:3000/api/time-off/timeoff-1', 'DELETE', {})
    const response = await DELETE(request as any, { params: Promise.resolve({ id: 'timeoff-1' }) })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      hasAssignments: true,
      assignmentCount: 1,
      teacherName: 'Bella W.',
    })
    expect(json.assignments[0].display).toMatch(/Sally A\./)
  })

  it('DELETE summary uses fallback name formatting when display names are missing', async () => {
    ;(getActiveSubAssignmentsForTimeOffRequest as jest.Mock).mockResolvedValue([
      {
        id: 'assignment-1',
        coverage_request_shift: {
          date: '2026-02-10',
          days_of_week: { name: 'Monday' },
          time_slots: { code: 'EM' },
          classrooms: { name: 'Infant Room' },
        },
        sub: {
          first_name: 'Sally',
          last_name: 'Anders',
        },
      },
    ])
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'timeoff-1',
      teacher: { first_name: 'Bella', last_name: 'Wilbanks' },
    })

    const request = createJsonRequest('http://localhost:3000/api/time-off/timeoff-1', 'DELETE', {})
    const response = await DELETE(request as any, { params: Promise.resolve({ id: 'timeoff-1' }) })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.teacherName).toBe('Bella Wilbanks')
    expect(json.assignments[0].subName).toBe('Sally Anders')
    expect(json.assignments[0].display).toMatch(/Mon Feb/)
  })

  it('DELETE cancellation accepts malformed JSON body and uses defaults', async () => {
    ;(getActiveSubAssignmentsForTimeOffRequest as jest.Mock).mockResolvedValue([])
    ;(cancelTimeOffRequest as jest.Mock).mockResolvedValue({
      cancelled: true,
      removedAssignments: 0,
    })

    const request = {
      method: 'DELETE',
      nextUrl: new URL('http://localhost:3000/api/time-off/timeoff-1'),
      headers: new Headers(),
      json: async () => {
        throw new Error('invalid json')
      },
    }

    const response = await DELETE(request as any, { params: Promise.resolve({ id: 'timeoff-1' }) })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(cancelTimeOffRequest).toHaveBeenCalledWith('timeoff-1', {
      keepAssignmentsAsExtraCoverage: false,
      assignmentIdsToKeep: undefined,
    })
    expect(json.success).toBe(true)
  })

  it('PUT draft mode rebuilds shifts without conflict filtering', async () => {
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'timeoff-1',
      school_id: 'school-1',
      reason: 'Sick',
      status: 'draft',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
      teacher_id: 'teacher-1',
      shift_selection_mode: 'select_shifts',
    })
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(canTransitionTimeOffStatus as jest.Mock).mockReturnValue(true)
    ;(updateTimeOffRequest as jest.Mock).mockResolvedValue({
      id: 'timeoff-1',
      school_id: 'school-1',
      reason: 'Sick',
      status: 'draft',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
      teacher_id: 'teacher-1',
      shift_selection_mode: 'select_shifts',
    })

    const request = createJsonRequest('http://localhost:3000/api/time-off/timeoff-1', 'PUT', {
      status: 'draft',
      teacher_id: 'teacher-1',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
      shift_selection_mode: 'select_shifts',
      shifts: [
        {
          date: '2026-02-20',
          day_of_week_id: 'day-1',
          time_slot_id: 'slot-1',
        },
      ],
    })

    const response = await PUT(request as any, { params: Promise.resolve({ id: 'timeoff-1' }) })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(getTeacherTimeOffShifts).not.toHaveBeenCalled()
    expect(createTimeOffShifts).toHaveBeenCalledWith('timeoff-1', [
      {
        date: '2026-02-20',
        day_of_week_id: 'day-1',
        time_slot_id: 'slot-1',
        is_partial: false,
        start_time: null,
        end_time: null,
      },
    ])
    expect(json.warning).toBeNull()
    expect(json.excludedShiftCount).toBe(0)
  })

  it('PUT returns 400 when saving draft with no shifts as active (reverts status)', async () => {
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'timeoff-1',
      school_id: 'school-1',
      reason: 'Sick',
      status: 'draft',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
      teacher_id: 'teacher-1',
      shift_selection_mode: 'select_shifts',
      coverage_request_id: null,
    })
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(canTransitionTimeOffStatus as jest.Mock).mockReturnValue(true)
    ;(updateTimeOffRequest as jest.Mock)
      .mockResolvedValueOnce({
        id: 'timeoff-1',
        school_id: 'school-1',
        status: 'active',
        start_date: '2026-02-20',
        end_date: '2026-02-20',
        teacher_id: 'teacher-1',
        shift_selection_mode: 'select_shifts',
      })
      .mockResolvedValueOnce(undefined)
    ;(getTimeOffShifts as jest.Mock).mockResolvedValue([])

    const request = createJsonRequest('http://localhost:3000/api/time-off/timeoff-1', 'PUT', {
      status: 'active',
      teacher_id: 'teacher-1',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
      shift_selection_mode: 'select_shifts',
      shifts: [],
    })

    const response = await PUT(request as any, { params: Promise.resolve({ id: 'timeoff-1' }) })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.code).toBe('TIME_OFF_REQUIRES_SHIFTS')
    expect(json.error).toMatch(/at least one shift|draft/i)
    expect(updateTimeOffRequest).toHaveBeenCalledTimes(2)
    expect(updateTimeOffRequest).toHaveBeenNthCalledWith(
      1,
      'timeoff-1',
      expect.objectContaining({ status: 'active' })
    )
    expect(updateTimeOffRequest).toHaveBeenNthCalledWith(2, 'timeoff-1', { status: 'draft' })
  })

  it('DELETE cancels request and revalidates when action is provided', async () => {
    ;(getActiveSubAssignmentsForTimeOffRequest as jest.Mock).mockResolvedValue([])
    ;(cancelTimeOffRequest as jest.Mock).mockResolvedValue({
      cancelled: true,
      removedAssignments: 0,
    })

    const request = createJsonRequest('http://localhost:3000/api/time-off/timeoff-1', 'DELETE', {
      action: 'cancel',
      keepAssignmentsAsExtraCoverage: true,
      assignmentIdsToKeep: ['assignment-1'],
    })

    const response = await DELETE(request as any, { params: Promise.resolve({ id: 'timeoff-1' }) })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(cancelTimeOffRequest).toHaveBeenCalledWith('timeoff-1', {
      keepAssignmentsAsExtraCoverage: true,
      assignmentIdsToKeep: ['assignment-1'],
    })
    expect(revalidatePath).toHaveBeenCalledWith('/time-off')
    expect(json.success).toBe(true)
  })

  it('DELETE returns 409 when already cancelled', async () => {
    ;(getActiveSubAssignmentsForTimeOffRequest as jest.Mock).mockResolvedValue([])
    ;(cancelTimeOffRequest as jest.Mock).mockRejectedValue(
      new Error('Time off request is already cancelled')
    )

    const request = createJsonRequest('http://localhost:3000/api/time-off/timeoff-1', 'DELETE', {
      action: 'cancel',
    })
    const response = await DELETE(request as any, { params: Promise.resolve({ id: 'timeoff-1' }) })
    const json = await response.json()

    expect(response.status).toBe(409)
    expect(json.error).toMatch(/already cancelled/i)
  })

  it('DELETE returns 500 for unexpected cancellation errors', async () => {
    ;(getActiveSubAssignmentsForTimeOffRequest as jest.Mock).mockResolvedValue([])
    ;(cancelTimeOffRequest as jest.Mock).mockRejectedValue(new Error('db failure'))

    const request = createJsonRequest('http://localhost:3000/api/time-off/timeoff-1', 'DELETE', {
      action: 'cancel',
    })
    const response = await DELETE(request as any, { params: Promise.resolve({ id: 'timeoff-1' }) })
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toMatch(/db failure/i)
  })

  it('PUT in non-production checks persisted shift count after rebuild', async () => {
    const previousNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'test'

    const timeOffRequestsTable = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          coverage_request_id: null,
          start_date: '2026-02-20',
          end_date: '2026-02-20',
        },
        error: null,
      }),
    }

    const timeOffShiftsTable = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        count: 1,
        error: null,
      }),
    }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'time_off_requests') return timeOffRequestsTable
      if (table === 'time_off_shifts') return timeOffShiftsTable
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: null }) }
    })
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'timeoff-2',
      school_id: 'school-1',
      reason: 'Sick',
      status: 'active',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
      teacher_id: 'teacher-1',
      shift_selection_mode: 'select_shifts',
    })
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(canTransitionTimeOffStatus as jest.Mock).mockReturnValue(true)
    ;(updateTimeOffRequest as jest.Mock).mockResolvedValue({
      id: 'timeoff-2',
      school_id: 'school-1',
      reason: 'Sick',
      status: 'active',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
      teacher_id: 'teacher-1',
      shift_selection_mode: 'select_shifts',
    })
    const nonProdShift = { id: 's1', date: '2026-02-20', time_slot_id: 'slot-1' }
    ;(getTimeOffShifts as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([nonProdShift])
      .mockResolvedValue([nonProdShift])

    const request = createJsonRequest('http://localhost:3000/api/time-off/timeoff-2', 'PUT', {
      status: 'active',
      teacher_id: 'teacher-1',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
      shift_selection_mode: 'select_shifts',
      shifts: [
        {
          date: '2026-02-20',
          day_of_week_id: 'day-1',
          time_slot_id: 'slot-1',
        },
      ],
    })

    const response = await PUT(request as any, { params: Promise.resolve({ id: 'timeoff-2' }) })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(timeOffShiftsTable.select).toHaveBeenCalledWith('id', { count: 'exact', head: true })
    expect(timeOffShiftsTable.eq).toHaveBeenCalledWith('time_off_request_id', 'timeoff-2')
    expect(deleteTimeOffShifts).not.toHaveBeenCalled()
    expect(json.id).toBe('timeoff-2')

    process.env.NODE_ENV = previousNodeEnv
  })

  it('PUT select_shifts diff-based: adds only new shifts and removes only removed shifts', async () => {
    mockSingle.mockResolvedValue({
      data: { coverage_request_id: null, start_date: '2026-02-20', end_date: '2026-02-21' },
      error: null,
    })
    mockEq.mockReturnValue({ single: mockSingle })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReset()
    mockFrom.mockImplementation((table: string) => {
      const chain: any = {
        select: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        eq: jest.fn(),
        in: jest.fn().mockImplementation(function (this: any) {
          if (table === 'sub_assignments') {
            return { eq: jest.fn().mockResolvedValue({ data: [], error: null }) }
          }
          return Promise.resolve({ data: null, error: null })
        }),
        gte: jest.fn(),
        lte: jest.fn(),
        single: mockSingle,
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
      chain.select.mockReturnValue(chain)
      chain.update.mockReturnValue(chain)
      chain.delete.mockReturnValue(chain)
      chain.eq.mockReturnValue(chain)
      chain.gte.mockReturnValue(chain)
      chain.lte.mockReturnValue(chain)
      return chain
    })
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'timeoff-1',
      school_id: 'school-1',
      reason: 'Sick',
      status: 'active',
      start_date: '2026-02-20',
      end_date: '2026-02-21',
      teacher_id: 'teacher-1',
      shift_selection_mode: 'select_shifts',
    })
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(canTransitionTimeOffStatus as jest.Mock).mockReturnValue(true)
    ;(updateTimeOffRequest as jest.Mock).mockResolvedValue({
      id: 'timeoff-1',
      school_id: 'school-1',
      reason: 'Sick',
      status: 'active',
      start_date: '2026-02-20',
      end_date: '2026-02-21',
      teacher_id: 'teacher-1',
      shift_selection_mode: 'select_shifts',
    })
    ;(getTimeOffShifts as jest.Mock).mockResolvedValue([
      { id: 'shift-a', date: '2026-02-20', time_slot_id: 'slot-1' },
      { id: 'shift-b', date: '2026-02-21', time_slot_id: 'slot-1' },
    ])
    ;(getTeacherTimeOffShifts as jest.Mock).mockResolvedValue([])

    const request = createJsonRequest('http://localhost:3000/api/time-off/timeoff-1', 'PUT', {
      status: 'active',
      teacher_id: 'teacher-1',
      start_date: '2026-02-20',
      end_date: '2026-02-21',
      shift_selection_mode: 'select_shifts',
      shifts: [
        { date: '2026-02-20', day_of_week_id: 'day-1', time_slot_id: 'slot-1' },
        { date: '2026-02-21', day_of_week_id: 'day-2', time_slot_id: 'slot-2' },
      ],
    })

    const response = await PUT(request as any, { params: Promise.resolve({ id: 'timeoff-1' }) })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(getTimeOffShifts).toHaveBeenCalledWith('timeoff-1')
    expect(createTimeOffShifts).toHaveBeenCalledWith(
      'timeoff-1',
      expect.arrayContaining([
        expect.objectContaining({
          date: '2026-02-21',
          time_slot_id: 'slot-2',
          day_of_week_id: 'day-2',
        }),
      ])
    )
    expect(createTimeOffShifts).toHaveBeenCalledTimes(1)
    expect(json.id).toBe('timeoff-1')
  })

  it('PUT filters out shifts outside request date range (date normalization)', async () => {
    mockSingle.mockResolvedValue({
      data: { coverage_request_id: null, start_date: '2026-02-20', end_date: '2026-02-21' },
      error: null,
    })
    mockEq.mockReturnValue({ single: mockSingle })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReset()
    mockFrom.mockImplementation((table: string) => {
      const chain: any = {
        select: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        eq: jest.fn(),
        in: jest.fn().mockImplementation(function (this: any) {
          if (table === 'sub_assignments') {
            return { eq: jest.fn().mockResolvedValue({ data: [], error: null }) }
          }
          return Promise.resolve({ data: null, error: null })
        }),
        gte: jest.fn(),
        lte: jest.fn(),
        single: mockSingle,
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
      chain.select.mockReturnValue(chain)
      chain.update.mockReturnValue(chain)
      chain.delete.mockReturnValue(chain)
      chain.eq.mockReturnValue(chain)
      chain.gte.mockReturnValue(chain)
      chain.lte.mockReturnValue(chain)
      return chain
    })
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'timeoff-1',
      school_id: 'school-1',
      reason: 'Sick',
      status: 'active',
      start_date: '2026-02-20',
      end_date: '2026-02-21',
      teacher_id: 'teacher-1',
      shift_selection_mode: 'select_shifts',
    })
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(canTransitionTimeOffStatus as jest.Mock).mockReturnValue(true)
    ;(updateTimeOffRequest as jest.Mock).mockResolvedValue({
      id: 'timeoff-1',
      school_id: 'school-1',
      reason: 'Sick',
      status: 'active',
      start_date: '2026-02-20',
      end_date: '2026-02-21',
      teacher_id: 'teacher-1',
      shift_selection_mode: 'select_shifts',
    })
    const normShifts = [
      { id: 's1', date: '2026-02-20', time_slot_id: 'slot-1' },
      { id: 's2', date: '2026-02-21', time_slot_id: 'slot-2' },
    ]
    ;(getTimeOffShifts as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(normShifts)
      .mockResolvedValue(normShifts)
    ;(getTeacherTimeOffShifts as jest.Mock).mockResolvedValue([])

    const request = createJsonRequest('http://localhost:3000/api/time-off/timeoff-1', 'PUT', {
      status: 'active',
      teacher_id: 'teacher-1',
      start_date: '2026-02-20',
      end_date: '2026-02-21',
      shift_selection_mode: 'select_shifts',
      shifts: [
        { date: '2026-02-19', day_of_week_id: 'day-1', time_slot_id: 'slot-1' },
        { date: '2026-02-20', day_of_week_id: 'day-1', time_slot_id: 'slot-1' },
        { date: '2026-02-21', day_of_week_id: 'day-2', time_slot_id: 'slot-2' },
        { date: '2026-02-22', day_of_week_id: 'day-3', time_slot_id: 'slot-1' },
      ],
    })

    const response = await PUT(request as any, { params: Promise.resolve({ id: 'timeoff-1' }) })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(createTimeOffShifts).toHaveBeenCalledTimes(1)
    const createdShifts = (createTimeOffShifts as jest.Mock).mock.calls[0][1]
    expect(createdShifts).toHaveLength(2)
    expect(createdShifts.map((s: { date: string }) => s.date).sort()).toEqual([
      '2026-02-20',
      '2026-02-21',
    ])
    expect(json.id).toBe('timeoff-1')
  })

  it('PUT teacher change updates coverage_requests.teacher_id and sub_assignments.teacher_id', async () => {
    const coverageRequestsEq = jest.fn().mockResolvedValue({ error: null })
    const coverageRequestsUpdate = jest.fn().mockReturnValue({ eq: coverageRequestsEq })
    const coverageRequestShiftsSelect = jest.fn().mockReturnThis()
    const coverageRequestShiftsEq = jest.fn().mockResolvedValue({
      data: [{ id: 'cr-shift-1' }, { id: 'cr-shift-2' }],
      error: null,
    })
    const subAssignmentsUpdate = jest.fn().mockReturnThis()
    const subAssignmentsIn = jest.fn().mockResolvedValue({ data: null, error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'time_off_requests') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              coverage_request_id: 'coverage-1',
              start_date: '2026-02-20',
              end_date: '2026-02-20',
            },
            error: null,
          }),
        }
      }
      if (table === 'coverage_requests') {
        return { update: coverageRequestsUpdate, eq: coverageRequestsEq }
      }
      if (table === 'coverage_request_shifts') {
        return {
          select: coverageRequestShiftsSelect,
          eq: coverageRequestShiftsEq,
        }
      }
      if (table === 'sub_assignments') {
        const subChain = {
          in: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        }
        return {
          update: subAssignmentsUpdate,
          in: subAssignmentsIn,
          select: jest.fn().mockReturnValue(subChain),
        }
      }
      // time_off_shifts: route uses .select().in(), .delete().eq().in(), .select().eq().gt(), etc.
      if (table === 'time_off_shifts') {
        const eqReturn: any = Promise.resolve({ data: null, error: null, count: 0 })
        eqReturn.gt = () => Promise.resolve({ data: null, error: null })
        eqReturn.in = () => Promise.resolve({ data: null, error: null })
        const chain: any = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnValue(eqReturn),
          gt: jest.fn().mockResolvedValue({ data: null, error: null }),
          delete: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue({ data: null, error: null }),
        }
        return chain
      }
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: null }) }
    })
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'timeoff-1',
      school_id: 'school-1',
      reason: 'Sick',
      status: 'active',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
      teacher_id: 'teacher-1',
      shift_selection_mode: 'all_scheduled',
    })
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(canTransitionTimeOffStatus as jest.Mock).mockReturnValue(true)
    ;(updateTimeOffRequest as jest.Mock)
      .mockResolvedValueOnce({
        id: 'timeoff-1',
        school_id: 'school-1',
        status: 'active',
        start_date: '2026-02-20',
        end_date: '2026-02-20',
        teacher_id: 'teacher-2',
        shift_selection_mode: 'all_scheduled',
      })
      .mockResolvedValueOnce({
        id: 'timeoff-1',
        school_id: 'school-1',
        status: 'active',
        start_date: '2026-02-20',
        end_date: '2026-02-20',
        teacher_id: 'teacher-2',
        shift_selection_mode: 'all_scheduled',
      })
    const teacherChangeShift = { id: 's1', date: '2026-02-20', time_slot_id: 'slot-1' }
    ;(getTimeOffShifts as jest.Mock).mockImplementation(async () => [teacherChangeShift])
    ;(getTeacherScheduledShifts as jest.Mock).mockResolvedValue([])
    ;(getStaffById as jest.Mock).mockResolvedValue({ id: 'teacher-2', active: true })

    const request = createJsonRequest('http://localhost:3000/api/time-off/timeoff-1', 'PUT', {
      status: 'active',
      teacher_id: 'teacher-2',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
      shift_selection_mode: 'all_scheduled',
    })

    const response = await PUT(request as any, { params: Promise.resolve({ id: 'timeoff-1' }) })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(updateTimeOffRequest).toHaveBeenCalledWith(
      'timeoff-1',
      expect.objectContaining({ teacher_id: 'teacher-2' })
    )
    expect(coverageRequestsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ teacher_id: 'teacher-2' })
    )
    expect(subAssignmentsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ teacher_id: 'teacher-2' })
    )
    expect(subAssignmentsIn).toHaveBeenCalledWith('coverage_request_shift_id', [
      'cr-shift-1',
      'cr-shift-2',
    ])
    expect(json.id).toBe('timeoff-1')
  })

  it('PUT returns 400 when shift_selection_mode is select_shifts but shifts is not an array', async () => {
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'timeoff-1',
      school_id: 'school-1',
      reason: 'Sick',
      status: 'active',
      start_date: '2026-02-20',
      end_date: '2026-02-21',
      teacher_id: 'teacher-1',
      shift_selection_mode: 'all_scheduled',
    })
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(canTransitionTimeOffStatus as jest.Mock).mockReturnValue(true)

    const request = createJsonRequest('http://localhost:3000/api/time-off/timeoff-1', 'PUT', {
      status: 'active',
      teacher_id: 'teacher-1',
      start_date: '2026-02-20',
      end_date: '2026-02-21',
      shift_selection_mode: 'select_shifts',
      // shifts omitted intentionally
    })

    const response = await PUT(request as any, { params: Promise.resolve({ id: 'timeoff-1' }) })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect((json as { code?: string }).code).toBe('SELECT_SHIFTS_REQUIRES_SHIFTS_ARRAY')
    expect(updateTimeOffRequest).not.toHaveBeenCalled()
  })

  it('PUT teacher change returns 400 when new teacher is inactive', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'time_off_requests') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              coverage_request_id: 'coverage-1',
              start_date: '2026-02-20',
              end_date: '2026-02-20',
            },
            error: null,
          }),
        }
      }
      if (table === 'time_off_shifts') {
        const eqReturn: any = Promise.resolve({ data: null, error: null, count: 0 })
        eqReturn.gt = () => Promise.resolve({ data: null, error: null })
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnValue(eqReturn),
          gt: jest.fn().mockResolvedValue({ data: null, error: null }),
          delete: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue({ data: null, error: null }),
        }
      }
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: null }) }
    })
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'timeoff-1',
      school_id: 'school-1',
      reason: 'Sick',
      status: 'active',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
      teacher_id: 'teacher-1',
      shift_selection_mode: 'all_scheduled',
    })
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(canTransitionTimeOffStatus as jest.Mock).mockReturnValue(true)
    ;(updateTimeOffRequest as jest.Mock).mockResolvedValue({
      id: 'timeoff-1',
      school_id: 'school-1',
      reason: 'Sick',
      status: 'active',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
      teacher_id: 'teacher-2',
      shift_selection_mode: 'all_scheduled',
    })
    ;(getStaffById as jest.Mock).mockResolvedValue({ id: 'teacher-2', active: false })

    const request = createJsonRequest('http://localhost:3000/api/time-off/timeoff-1', 'PUT', {
      status: 'active',
      teacher_id: 'teacher-2',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
      shift_selection_mode: 'all_scheduled',
    })

    const response = await PUT(request as any, { params: Promise.resolve({ id: 'timeoff-1' }) })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect((json as { code?: string }).code).toBe('TEACHER_INACTIVE')
  })

  it('PUT select_shifts returns 409 when removing a shift that has a sub assignment', async () => {
    mockSingle.mockResolvedValue({
      data: { coverage_request_id: null, start_date: '2026-02-20', end_date: '2026-02-20' },
      error: null,
    })
    mockEq.mockReturnValue({ single: mockSingle })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockImplementation((table: string) => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockImplementation(function (this: any) {
          if (table === 'sub_assignments') {
            return {
              eq: jest.fn().mockResolvedValue({
                data: [{ coverage_request_shift_id: 'shift-1' }],
                error: null,
              }),
            }
          }
          if (table === 'time_off_shifts') {
            return Promise.resolve({
              data: [{ date: '2026-02-20', time_slot_id: 'slot-1' }],
              error: null,
            })
          }
          return Promise.resolve({ data: null, error: null })
        }),
        single: mockSingle,
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
      return chain
    })
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'timeoff-1',
      school_id: 'school-1',
      reason: 'Sick',
      status: 'active',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
      teacher_id: 'teacher-1',
      shift_selection_mode: 'select_shifts',
    })
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(canTransitionTimeOffStatus as jest.Mock).mockReturnValue(true)
    ;(updateTimeOffRequest as jest.Mock).mockResolvedValue({
      id: 'timeoff-1',
      school_id: 'school-1',
      reason: 'Sick',
      status: 'active',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
      teacher_id: 'teacher-1',
      shift_selection_mode: 'select_shifts',
    })
    ;(getTimeOffShifts as jest.Mock).mockResolvedValue([
      { id: 'shift-1', date: '2026-02-20', time_slot_id: 'slot-1' },
    ])

    const request = createJsonRequest('http://localhost:3000/api/time-off/timeoff-1', 'PUT', {
      status: 'active',
      teacher_id: 'teacher-1',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
      shift_selection_mode: 'select_shifts',
      shifts: [],
    })

    const response = await PUT(request as any, { params: Promise.resolve({ id: 'timeoff-1' }) })
    const json = await response.json()

    expect(response.status).toBe(409)
    expect(json.code).toBe('SHIFTS_HAVE_ASSIGNMENTS')
    expect(json.error).toMatch(/sub assigned|remove the sub assignment/i)
    expect(json.shifts).toEqual([{ date: '2026-02-20', time_slot_id: 'slot-1' }])
    expect(createTimeOffShifts).not.toHaveBeenCalled()
  })

  it('PUT concurrent edits both complete and last update wins', async () => {
    mockSingle.mockResolvedValue({
      data: { coverage_request_id: null, start_date: '2026-02-20', end_date: '2026-02-20' },
      error: null,
    })
    mockEq.mockReturnValue({ single: mockSingle })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({
      select: mockSelect,
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: mockEq,
      in: jest.fn().mockResolvedValue({ data: null, error: null }),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      single: mockSingle,
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    })
    ;(getTimeOffRequestById as jest.Mock)
      .mockResolvedValueOnce({
        id: 'timeoff-1',
        school_id: 'school-1',
        reason: 'Sick',
        status: 'active',
        start_date: '2026-02-20',
        end_date: '2026-02-20',
        teacher_id: 'teacher-1',
        shift_selection_mode: 'select_shifts',
      })
      .mockResolvedValueOnce({
        id: 'timeoff-1',
        school_id: 'school-1',
        reason: 'Sick',
        status: 'active',
        start_date: '2026-02-20',
        end_date: '2026-02-20',
        teacher_id: 'teacher-1',
        shift_selection_mode: 'select_shifts',
      })
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(canTransitionTimeOffStatus as jest.Mock).mockReturnValue(true)
    ;(updateTimeOffRequest as jest.Mock).mockResolvedValue({
      id: 'timeoff-1',
      school_id: 'school-1',
      reason: 'Sick',
      status: 'active',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
      teacher_id: 'teacher-1',
      shift_selection_mode: 'select_shifts',
    })
    const concShift = { id: 's1', date: '2026-02-20', time_slot_id: 'slot-1' }
    ;(getTimeOffShifts as jest.Mock).mockReset().mockImplementation(async () => [concShift])
    ;(getTeacherTimeOffShifts as jest.Mock).mockResolvedValue([])

    const put1 = PUT(
      createJsonRequest('http://localhost:3000/api/time-off/timeoff-1', 'PUT', {
        status: 'active',
        teacher_id: 'teacher-1',
        start_date: '2026-02-20',
        end_date: '2026-02-20',
        shift_selection_mode: 'select_shifts',
        shifts: [{ date: '2026-02-20', day_of_week_id: 'day-1', time_slot_id: 'slot-1' }],
      }) as any,
      { params: Promise.resolve({ id: 'timeoff-1' }) }
    )
    const put2 = PUT(
      createJsonRequest('http://localhost:3000/api/time-off/timeoff-1', 'PUT', {
        status: 'active',
        teacher_id: 'teacher-1',
        start_date: '2026-02-20',
        end_date: '2026-02-20',
        shift_selection_mode: 'select_shifts',
        shifts: [
          { date: '2026-02-20', day_of_week_id: 'day-1', time_slot_id: 'slot-1' },
          { date: '2026-02-21', day_of_week_id: 'day-2', time_slot_id: 'slot-1' },
        ],
      }) as any,
      { params: Promise.resolve({ id: 'timeoff-1' }) }
    )

    const [res1, res2] = await Promise.all([put1, put2])
    const json1 = await res1.json()
    const json2 = await res2.json()

    expect(json1.id).toBe('timeoff-1')
    expect(json2.id).toBe('timeoff-1')
    const both200 = res1.status === 200 && res2.status === 200
    const both400 = res1.status === 400 && res2.status === 400
    expect(both200 || both400).toBe(true)
    // Each PUT: one update at start; then either dates update (200) or revert (400). So 4 calls total.
    expect(updateTimeOffRequest).toHaveBeenCalledTimes(4)
  })
})
