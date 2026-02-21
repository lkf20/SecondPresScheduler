/** @jest-environment node */

import { GET, POST } from '@/app/api/staffing-events/flex/remove/route'
import { createJsonRequest } from '@/tests/helpers/api'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))

const makeAwaitableBuilder = (result: any) => {
  const builder: any = {}
  builder.eq = jest.fn(() => builder)
  builder.in = jest.fn(() => builder)
  builder.order = jest.fn(() => builder)
  builder.select = jest.fn(() => builder)
  builder.then = (resolve: (value: any) => any, reject?: (reason: any) => any) =>
    Promise.resolve(result).then(resolve, reject)
  return builder
}

const buildSupabaseMock = (overrides?: {
  eventMaybeSingleResult?: any
  dayRowsResult?: any
  shiftSelectResults?: any[]
  shiftUpdateSelectResult?: any
  eventUpdateResult?: any
}) => {
  const shiftSelectResults = [...(overrides?.shiftSelectResults || [])]

  const eventLookupBuilder = {
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(
      overrides?.eventMaybeSingleResult ?? {
        data: { id: 'event-1', start_date: '2026-01-01', end_date: '2026-03-01' },
        error: null,
      }
    ),
  }

  const eventUpdateBuilder = makeAwaitableBuilder(overrides?.eventUpdateResult ?? { error: null })
  const staffingEventSelect = jest.fn(() => eventLookupBuilder)
  const staffingEventUpdate = jest.fn(() => eventUpdateBuilder)

  const shiftUpdateBuilder = makeAwaitableBuilder({ data: null, error: null })
  shiftUpdateBuilder.select = jest.fn().mockResolvedValue(
    overrides?.shiftUpdateSelectResult ?? {
      data: [{ id: 'shift-1' }],
      error: null,
    }
  )
  const staffingShiftSelect = jest.fn(() =>
    makeAwaitableBuilder(shiftSelectResults.shift() ?? { data: [], error: null })
  )
  const staffingShiftUpdate = jest.fn(() => shiftUpdateBuilder)

  const daySelect = jest.fn(() =>
    makeAwaitableBuilder(
      overrides?.dayRowsResult ?? {
        data: [],
        error: null,
      }
    )
  )

  ;(createClient as jest.Mock).mockResolvedValue({
    from: jest.fn((table: string) => {
      if (table === 'staffing_events') {
        return {
          select: staffingEventSelect,
          update: staffingEventUpdate,
        }
      }
      if (table === 'staffing_event_shifts') {
        return {
          select: staffingShiftSelect,
          update: staffingShiftUpdate,
        }
      }
      if (table === 'days_of_week') {
        return {
          select: daySelect,
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    }),
  })

  return {
    staffingEventUpdate,
    shiftUpdateBuilder,
  }
}

describe('/api/staffing-events/flex/remove integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
  })

  it('GET returns 400 when event_id is missing', async () => {
    const request = createJsonRequest(
      'http://localhost:3000/api/staffing-events/flex/remove',
      'GET'
    )
    const response = await GET(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/event_id is required/i)
  })

  it('GET returns 403 when school context is missing', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue(null)
    const request = createJsonRequest(
      'http://localhost:3000/api/staffing-events/flex/remove?event_id=event-1',
      'GET'
    )
    const response = await GET(request as any)
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error).toMatch(/missing school context/i)
  })

  it('GET returns context details and sorted weekdays', async () => {
    buildSupabaseMock({
      shiftSelectResults: [
        {
          data: [{ day_of_week_id: 'wed' }, { day_of_week_id: 'mon' }, { day_of_week_id: 'mon' }],
          error: null,
        },
      ],
      dayRowsResult: {
        data: [
          { id: 'mon', name: 'Monday', day_number: 1 },
          { id: 'wed', name: 'Wednesday', day_number: 3 },
        ],
        error: null,
      },
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/staffing-events/flex/remove?event_id=event-1',
      'GET'
    )
    const response = await GET(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({
      start_date: '2026-01-01',
      end_date: '2026-03-01',
      weekdays: ['Monday', 'Wednesday'],
      matching_shift_count: 3,
    })
  })

  it('GET returns 404 when flex assignment is not found', async () => {
    buildSupabaseMock({
      eventMaybeSingleResult: {
        data: null,
        error: null,
      },
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/staffing-events/flex/remove?event_id=missing-event',
      'GET'
    )
    const response = await GET(request as any)
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toMatch(/flex assignment not found/i)
  })

  it('GET returns 500 when weekday lookup fails', async () => {
    buildSupabaseMock({
      shiftSelectResults: [
        {
          data: [{ day_of_week_id: 'mon' }],
          error: null,
        },
      ],
      dayRowsResult: {
        data: null,
        error: { message: 'weekday lookup failed' },
      },
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/staffing-events/flex/remove?event_id=event-1',
      'GET'
    )
    const response = await GET(request as any)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toMatch(/weekday lookup failed/i)
  })

  it('POST returns 400 when required fields are missing', async () => {
    const request = createJsonRequest(
      'http://localhost:3000/api/staffing-events/flex/remove',
      'POST',
      {
        event_id: 'event-1',
      }
    )
    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/event_id and scope are required/i)
  })

  it('POST validates scope-specific required fields', async () => {
    buildSupabaseMock()

    const missingClassroomAndTime = createJsonRequest(
      'http://localhost:3000/api/staffing-events/flex/remove',
      'POST',
      {
        event_id: 'event-1',
        scope: 'single_shift',
        date: '2026-02-09',
      }
    )
    const response1 = await POST(missingClassroomAndTime as any)
    const json1 = await response1.json()
    expect(response1.status).toBe(400)
    expect(json1.error).toMatch(/classroom_id and time_slot_id are required/i)

    const missingDate = createJsonRequest(
      'http://localhost:3000/api/staffing-events/flex/remove',
      'POST',
      {
        event_id: 'event-1',
        scope: 'single_shift',
        classroom_id: 'class-1',
        time_slot_id: 'slot-1',
      }
    )
    const response2 = await POST(missingDate as any)
    const json2 = await response2.json()
    expect(response2.status).toBe(400)
    expect(json2.error).toMatch(/date is required for single_shift/i)

    const missingDayOfWeek = createJsonRequest(
      'http://localhost:3000/api/staffing-events/flex/remove',
      'POST',
      {
        event_id: 'event-1',
        scope: 'weekday',
        classroom_id: 'class-1',
        time_slot_id: 'slot-1',
      }
    )
    const response3 = await POST(missingDayOfWeek as any)
    const json3 = await response3.json()
    expect(response3.status).toBe(400)
    expect(json3.error).toMatch(/day_of_week_id is required for weekday scope/i)
  })

  it('POST returns 404 when the flex event does not exist', async () => {
    buildSupabaseMock({
      eventMaybeSingleResult: {
        data: null,
        error: null,
      },
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/staffing-events/flex/remove',
      'POST',
      {
        event_id: 'missing-event',
        scope: 'all_shifts',
      }
    )
    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toMatch(/flex assignment not found/i)
  })

  it('POST returns 404 when no matching active shifts are found', async () => {
    buildSupabaseMock({
      shiftUpdateSelectResult: {
        data: [],
        error: null,
      },
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/staffing-events/flex/remove',
      'POST',
      {
        event_id: 'event-1',
        scope: 'weekday',
        classroom_id: 'class-1',
        time_slot_id: 'slot-1',
        day_of_week_id: 'mon',
      }
    )
    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toMatch(/no matching active shifts/i)
  })

  it('POST removes matching shifts and keeps event active when shifts remain', async () => {
    const { staffingEventUpdate } = buildSupabaseMock({
      shiftUpdateSelectResult: {
        data: [{ id: 's1' }, { id: 's2' }],
        error: null,
      },
      shiftSelectResults: [
        {
          count: 3,
          error: null,
        },
      ],
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/staffing-events/flex/remove',
      'POST',
      {
        event_id: 'event-1',
        scope: 'weekday',
        classroom_id: 'class-1',
        time_slot_id: 'slot-1',
        day_of_week_id: 'mon',
      }
    )
    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({
      success: true,
      removed_count: 2,
      remaining_active_shifts: 3,
    })
    expect(staffingEventUpdate).not.toHaveBeenCalled()
  })

  it('POST cancels parent event when all shifts are removed', async () => {
    const { staffingEventUpdate } = buildSupabaseMock({
      shiftUpdateSelectResult: {
        data: [{ id: 's1' }],
        error: null,
      },
      shiftSelectResults: [
        {
          count: 0,
          error: null,
        },
      ],
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/staffing-events/flex/remove',
      'POST',
      {
        event_id: 'event-1',
        scope: 'all_shifts',
      }
    )
    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({
      success: true,
      removed_count: 1,
      remaining_active_shifts: 0,
    })
    expect(staffingEventUpdate).toHaveBeenCalledTimes(1)
    expect(staffingEventUpdate).toHaveBeenCalledWith({ status: 'cancelled' })
  })

  it('POST returns 500 when active-shift recount fails', async () => {
    buildSupabaseMock({
      shiftUpdateSelectResult: {
        data: [{ id: 's1' }],
        error: null,
      },
      shiftSelectResults: [
        {
          count: null,
          error: { message: 'recount failed' },
        },
      ],
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/staffing-events/flex/remove',
      'POST',
      {
        event_id: 'event-1',
        scope: 'all_shifts',
      }
    )
    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toMatch(/recount failed/i)
  })
})
