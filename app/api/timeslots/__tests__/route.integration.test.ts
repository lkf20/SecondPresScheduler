/** @jest-environment node */

import { NextResponse } from 'next/server'
import { GET, POST } from '@/app/api/timeslots/route'
import { getTimeSlots, getTimeSlotsWithInactive, createTimeSlot } from '@/lib/api/timeslots'
import { createErrorResponse } from '@/lib/utils/errors'
import { revalidatePath } from 'next/cache'
import { NextRequest } from 'next/server'

jest.mock('@/lib/api/timeslots', () => ({
  getTimeSlots: jest.fn(),
  getTimeSlotsWithInactive: jest.fn(),
  createTimeSlot: jest.fn(),
}))

jest.mock('@/lib/utils/errors', () => ({
  createErrorResponse: jest.fn(),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
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

    const response = await GET(new NextRequest('http://localhost/api/timeslots') as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(getTimeSlots).toHaveBeenCalled()
    expect(json).toEqual([{ id: 'slot-em', code: 'EM' }])
  })

  it('GET routes failures through createErrorResponse', async () => {
    ;(getTimeSlots as jest.Mock).mockRejectedValue(new Error('read failed'))

    const response = await GET(new NextRequest('http://localhost/api/timeslots') as any)
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
    expect(revalidatePath).toHaveBeenCalled()
    expect(json).toEqual({ id: 'slot-am', code: 'AM' })
  })

  it('GET uses inactive API when includeInactive=true', async () => {
    ;(getTimeSlotsWithInactive as jest.Mock).mockResolvedValue([{ id: 'slot-em', code: 'EM' }])

    const response = await GET(
      new NextRequest('http://localhost/api/timeslots?includeInactive=true') as any
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(getTimeSlotsWithInactive).toHaveBeenCalled()
    expect(json).toEqual([{ id: 'slot-em', code: 'EM' }])
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
