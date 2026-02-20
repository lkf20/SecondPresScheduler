/** @jest-environment node */

import { PUT } from '@/app/api/time-off/[id]/route'
import { createJsonRequest } from '@/tests/helpers/api'
import { getTimeOffRequestById } from '@/lib/api/time-off'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getScheduleSettings } from '@/lib/api/schedule-settings'
import { canTransitionTimeOffStatus } from '@/lib/lifecycle/status-transitions'

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

jest.mock('@/lib/lifecycle/status-transitions', () => ({
  canTransitionTimeOffStatus: jest.fn(),
  formatTransitionError: jest.fn(() => 'Invalid status transition'),
}))

describe('PUT /api/time-off/[id] integration', () => {
  afterEach(() => {
    jest.restoreAllMocks()
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
})
