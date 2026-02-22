/** @jest-environment node */

import { NextResponse } from 'next/server'
import { GET, POST } from '@/app/api/timeslots/route'
import { getTimeSlots, createTimeSlot } from '@/lib/api/timeslots'
import { createErrorResponse } from '@/lib/utils/errors'

jest.mock('@/lib/api/timeslots', () => ({
  getTimeSlots: jest.fn(),
  createTimeSlot: jest.fn(),
}))

jest.mock('@/lib/utils/errors', () => ({
  createErrorResponse: jest.fn(),
}))

describe('timeslots collection route integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createErrorResponse as jest.Mock).mockImplementation(
      (_error: unknown, message: string, status: number) =>
        NextResponse.json({ error: message }, { status })
    )
  })

  it('GET returns list of time slots', async () => {
    ;(getTimeSlots as jest.Mock).mockResolvedValue([{ id: 'slot-em', code: 'EM' }])

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(getTimeSlots).toHaveBeenCalled()
    expect(json).toEqual([{ id: 'slot-em', code: 'EM' }])
  })

  it('GET routes failures through createErrorResponse', async () => {
    ;(getTimeSlots as jest.Mock).mockRejectedValue(new Error('read failed'))

    const response = await GET()
    const json = await response.json()

    expect(createErrorResponse).toHaveBeenCalled()
    expect(response.status).toBe(500)
    expect(json.error).toBe('Failed to fetch time slots')
  })

  it('POST creates a new time slot', async () => {
    ;(createTimeSlot as jest.Mock).mockResolvedValue({ id: 'slot-am', code: 'AM' })

    const response = await POST(
      new Request('http://localhost/api/timeslots', {
        method: 'POST',
        body: JSON.stringify({ code: 'AM' }),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(createTimeSlot).toHaveBeenCalledWith({ code: 'AM' })
    expect(json).toEqual({ id: 'slot-am', code: 'AM' })
  })

  it('POST routes failures through createErrorResponse', async () => {
    ;(createTimeSlot as jest.Mock).mockRejectedValue(new Error('insert failed'))

    const response = await POST(
      new Request('http://localhost/api/timeslots', {
        method: 'POST',
        body: JSON.stringify({ code: 'AM' }),
      }) as any
    )
    const json = await response.json()

    expect(createErrorResponse).toHaveBeenCalled()
    expect(response.status).toBe(500)
    expect(json.error).toBe('Failed to create time slot')
  })
})
