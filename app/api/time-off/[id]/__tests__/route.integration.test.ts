/** @jest-environment node */

import { DELETE, GET, PUT } from '@/app/api/time-off/[id]/route'
import { createJsonRequest } from '@/tests/helpers/api'
import {
  cancelTimeOffRequest,
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
} from '@/lib/api/time-off-shifts'
import { updateTimeOffRequest } from '@/lib/api/time-off'
import { revalidatePath } from 'next/cache'

jest.mock('@/lib/api/time-off', () => ({
  getTimeOffRequestById: jest.fn(),
  updateTimeOffRequest: jest.fn(),
  getActiveSubAssignmentsForTimeOffRequest: jest.fn(),
  cancelTimeOffRequest: jest.fn(),
}))

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))

jest.mock('@/lib/api/schedule-settings', () => ({
  getScheduleSettings: jest.fn(),
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
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

jest.mock('@/lib/lifecycle/status-transitions', () => ({
  canTransitionTimeOffStatus: jest.fn(),
  formatTransitionError: jest.fn(() => 'Invalid status transition'),
}))

describe('PUT /api/time-off/[id] integration', () => {
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
      status: 'active',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
      teacher_id: 'teacher-1',
      shift_selection_mode: 'select_shifts',
    })

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
    expect(deleteTimeOffShifts).toHaveBeenCalledWith('timeoff-1')
    expect(createTimeOffShifts).toHaveBeenCalledWith('timeoff-1', [
      {
        date: '2026-02-20',
        day_of_week_id: 'day-1',
        time_slot_id: 'slot-1',
      },
    ])
    expect(revalidatePath).toHaveBeenCalledWith('/time-off')
    expect(json.id).toBe('timeoff-1')

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
      eq: jest.fn().mockResolvedValue({
        data: [{ date: '2026-02-21' }, { date: '2026-02-22' }],
        error: null,
      }),
    }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'time_off_requests') return timeOffRequestsTable
      if (table === 'coverage_requests') return coverageRequestsTable
      if (table === 'coverage_request_shifts') return coverageRequestShiftsTable
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: null }) }
    })
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValue({
      id: 'timeoff-1',
      school_id: 'school-1',
      status: 'active',
      start_date: '2026-02-20',
      end_date: '2026-02-21',
      teacher_id: 'teacher-1',
      shift_selection_mode: 'all_scheduled',
    })
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ time_zone: 'UTC' })
    ;(canTransitionTimeOffStatus as jest.Mock).mockReturnValue(true)
    ;(updateTimeOffRequest as jest.Mock).mockResolvedValue({
      id: 'timeoff-1',
      school_id: 'school-1',
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

    const request = createJsonRequest('http://localhost:3000/api/time-off/timeoff-1', 'PUT', {
      status: 'active',
      teacher_id: 'teacher-1',
      start_date: '2026-02-20',
      end_date: '2026-02-21',
      shift_selection_mode: 'all_scheduled',
    })

    const response = await PUT(request as any, { params: Promise.resolve({ id: 'timeoff-1' }) })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(deleteTimeOffShifts).toHaveBeenCalledWith('timeoff-1')
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
})
