/** @jest-environment node */

import { GET, PUT } from '@/app/api/time-off/[id]/route'
import { createJsonRequest } from '@/tests/helpers/api'
import { getTimeOffRequestById } from '@/lib/api/time-off'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getScheduleSettings } from '@/lib/api/schedule-settings'
import { canTransitionTimeOffStatus } from '@/lib/lifecycle/status-transitions'
import {
  getTimeOffShifts,
  deleteTimeOffShifts,
  createTimeOffShifts,
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
})
