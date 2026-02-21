/** @jest-environment node */

import { POST } from '@/app/api/staffing-events/[id]/cancel/route'
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
  builder.then = (resolve: (value: any) => any, reject?: (reason: any) => any) =>
    Promise.resolve(result).then(resolve, reject)
  return builder
}

describe('POST /api/staffing-events/[id]/cancel integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
  })

  it('returns 403 when school context is missing', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue(null)

    const request = createJsonRequest(
      'http://localhost:3000/api/staffing-events/event-1/cancel',
      'POST',
      {}
    )
    const response = await POST(request as any, {
      params: Promise.resolve({ id: 'event-1' }),
    })
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error).toMatch(/missing school context/i)
  })

  it('returns 400 when event id is missing from params', async () => {
    const request = createJsonRequest(
      'http://localhost:3000/api/staffing-events//cancel',
      'POST',
      {}
    )
    const response = await POST(request as any, {
      params: Promise.resolve({ id: '' }),
    })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/missing event id/i)
  })

  it('returns 500 when event cancellation update fails', async () => {
    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'staffing_events') {
          return {
            update: jest
              .fn()
              .mockReturnValue(makeAwaitableBuilder({ error: { message: 'event update failed' } })),
          }
        }
        if (table === 'staffing_event_shifts') {
          return {
            update: jest.fn().mockReturnValue(makeAwaitableBuilder({ error: null })),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/staffing-events/event-1/cancel',
      'POST',
      {}
    )
    const response = await POST(request as any, {
      params: Promise.resolve({ id: 'event-1' }),
    })
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toMatch(/event update failed/i)
  })

  it('returns 500 when shift cancellation update fails', async () => {
    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'staffing_events') {
          return {
            update: jest.fn().mockReturnValue(makeAwaitableBuilder({ error: null })),
          }
        }
        if (table === 'staffing_event_shifts') {
          return {
            update: jest
              .fn()
              .mockReturnValue(makeAwaitableBuilder({ error: { message: 'shift update failed' } })),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/staffing-events/event-1/cancel',
      'POST',
      {}
    )
    const response = await POST(request as any, {
      params: Promise.resolve({ id: 'event-1' }),
    })
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toMatch(/shift update failed/i)
  })

  it('returns success when both event and shift updates succeed', async () => {
    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'staffing_events' || table === 'staffing_event_shifts') {
          return {
            update: jest.fn().mockReturnValue(makeAwaitableBuilder({ error: null })),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/staffing-events/event-1/cancel',
      'POST',
      {}
    )
    const response = await POST(request as any, {
      params: Promise.resolve({ id: 'event-1' }),
    })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ success: true })
  })
})
