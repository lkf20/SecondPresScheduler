/** @jest-environment node */

import { POST } from '@/app/api/staffing-events/flex/availability/route'
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

jest.mock('@/lib/api/time-off-shifts', () => ({
  getTeacherScheduledShifts: jest.fn(async () => []),
  getTimeOffShifts: jest.fn(async () => []),
}))

jest.mock('@/lib/api/time-off', () => ({
  getTimeOffRequests: jest.fn(async () => []),
}))

describe('POST /api/staffing-events/flex/availability integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({
      time_zone: 'UTC',
      selected_day_ids: ['day-mon'],
      default_display_name_format: 'first_last_initial',
    })
  })

  it('returns 403 when school context is missing', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue(null)
    const request = createJsonRequest(
      'http://localhost:3000/api/staffing-events/flex/availability',
      'POST',
      {
        start_date: '2026-03-02',
        end_date: '2026-03-02',
        time_slot_ids: ['slot-1'],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error).toMatch(/missing school context/i)
  })

  it('returns 400 when required request fields are missing', async () => {
    const request = createJsonRequest(
      'http://localhost:3000/api/staffing-events/flex/availability',
      'POST',
      {
        start_date: '2026-03-02',
        end_date: '2026-03-02',
        time_slot_ids: [],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/start_date, end_date, and time_slot_ids are required/i)
  })

  it('returns 400 when start_date is after end_date', async () => {
    const request = createJsonRequest(
      'http://localhost:3000/api/staffing-events/flex/availability',
      'POST',
      {
        start_date: '2026-03-10',
        end_date: '2026-03-02',
        time_slot_ids: ['slot-1'],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/start_date must be before end_date/i)
  })

  it('returns empty payload when no flex staff exist for the school', async () => {
    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'days_of_week') {
          return {
            select: jest.fn().mockResolvedValue({
              data: [{ id: 'day-mon', name: 'Monday', day_number: 1 }],
              error: null,
            }),
          }
        }
        if (table === 'staff') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'staff-1',
                  first_name: 'Amy',
                  last_name: 'P',
                  display_name: 'Amy P.',
                  staff_role_type_assignments: [{ staff_role_types: { code: 'TEACHER' } }],
                },
              ],
              error: null,
            }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/staffing-events/flex/availability',
      'POST',
      {
        start_date: '2026-03-02',
        end_date: '2026-03-02',
        time_slot_ids: ['slot-1'],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({
      staff: [],
      shifts: [],
    })
  })
})
