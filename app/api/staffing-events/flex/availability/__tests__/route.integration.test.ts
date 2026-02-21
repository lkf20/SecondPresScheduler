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
  const makeThenableBuilder = (result: any, methods: string[]) => {
    const builder: any = {}
    for (const method of methods) {
      builder[method] = jest.fn(() => builder)
    }
    builder.then = (resolve: (value: any) => any, reject?: (reason: any) => any) =>
      Promise.resolve(result).then(resolve, reject)
    return builder
  }

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

  it('returns flex availability, day options, and staffing metrics for matched shifts', async () => {
    let staffingEventShiftSelectCount = 0

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'days_of_week') {
          return {
            select: jest.fn().mockResolvedValue({
              data: [
                { id: 'day-mon', name: 'Monday', day_number: 1 },
                { id: 'day-tue', name: 'Tuesday', day_number: 2 },
              ],
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
                  id: 'staff-flex-1',
                  first_name: 'Bella',
                  last_name: 'Wilbanks',
                  display_name: null,
                  staff_role_type_assignments: [{ staff_role_types: { code: 'FLEXIBLE' } }],
                },
              ],
              error: null,
            }),
          }
        }
        if (table === 'time_slots') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: [{ id: 'slot-1', code: 'EM' }],
              error: null,
            }),
          }
        }
        if (table === 'sub_availability') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: [
                {
                  sub_id: 'staff-flex-1',
                  day_of_week_id: 'day-mon',
                  time_slot_id: 'slot-1',
                  available: true,
                },
              ],
              error: null,
            }),
          }
        }
        if (table === 'sub_availability_exceptions') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }
        }
        if (table === 'staffing_event_shifts') {
          staffingEventShiftSelectCount += 1
          if (staffingEventShiftSelectCount === 1) {
            return {
              select: jest.fn(() =>
                makeThenableBuilder({ data: [], error: null }, ['in', 'eq', 'gte', 'lte'])
              ),
            }
          }
          return {
            select: jest.fn(() =>
              makeThenableBuilder({ data: [], error: null }, ['eq', 'gte', 'lte'])
            ),
          }
        }
        if (table === 'schedule_cells') {
          return {
            select: jest.fn(() =>
              makeThenableBuilder(
                {
                  data: [
                    {
                      id: 'cell-1',
                      classroom_id: 'class-1',
                      day_of_week_id: 'day-mon',
                      time_slot_id: 'slot-1',
                      enrollment_for_staffing: 8,
                      is_active: true,
                      classroom: { id: 'class-1', name: 'Infant Room', color: '#ffffff' },
                      schedule_cell_class_groups: [
                        {
                          class_group: {
                            id: 'cg-1',
                            name: 'Infant',
                            min_age: 1,
                            max_age: 2,
                            required_ratio: 4,
                            preferred_ratio: 3,
                          },
                        },
                      ],
                    },
                  ],
                  error: null,
                },
                ['eq']
              )
            ),
          }
        }
        if (table === 'teacher_schedules') {
          return {
            select: jest.fn(() =>
              makeThenableBuilder(
                {
                  data: [
                    { day_of_week_id: 'day-mon', time_slot_id: 'slot-1', classroom_id: 'class-1' },
                  ],
                  error: null,
                },
                ['eq']
              )
            ),
          }
        }
        if (table === 'sub_assignments') {
          return {
            select: jest.fn(() =>
              makeThenableBuilder(
                {
                  data: [],
                  error: null,
                },
                ['eq', 'gte', 'lte']
              )
            ),
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
        classroom_ids: ['class-1'],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.staff).toEqual([
      {
        id: 'staff-flex-1',
        name: 'Bella W.',
        availableShiftKeys: ['2026-03-02|slot-1'],
      },
    ])
    expect(json.day_options).toEqual([
      {
        id: 'day-mon',
        name: 'Monday',
        short_name: 'Mon',
        day_number: 1,
      },
    ])
    expect(json.shift_metrics).toEqual([
      {
        date: '2026-03-02',
        time_slot_id: 'slot-1',
        time_slot_code: 'EM',
        classroom_id: 'class-1',
        classroom_name: 'Infant Room',
        required_staff: 2,
        preferred_staff: 3,
        scheduled_staff: 1,
        status: 'below_required',
      },
    ])
  })
})
