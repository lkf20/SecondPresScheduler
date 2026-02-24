/** @jest-environment node */

import { GET, PUT, DELETE } from '@/app/api/timeslots/[id]/route'
import { getTimeSlotById, updateTimeSlot, deleteTimeSlot } from '@/lib/api/timeslots'

jest.mock('@/lib/api/timeslots', () => ({
  getTimeSlotById: jest.fn(),
  updateTimeSlot: jest.fn(),
  deleteTimeSlot: jest.fn(),
}))

describe('timeslots id route integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('GET returns timeslot by id', async () => {
    ;(getTimeSlotById as jest.Mock).mockResolvedValue({ id: 'slot-em', code: 'EM' })

    const response = await GET(new Request('http://localhost/api/timeslots/slot-em') as any, {
      params: Promise.resolve({ id: 'slot-em' }),
    })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(getTimeSlotById).toHaveBeenCalledWith('slot-em')
    expect(json).toEqual({ id: 'slot-em', code: 'EM' })
  })

  it('GET returns 500 when fetch fails', async () => {
    ;(getTimeSlotById as jest.Mock).mockRejectedValue(new Error('fetch failed'))

    const response = await GET(new Request('http://localhost/api/timeslots/slot-em') as any, {
      params: Promise.resolve({ id: 'slot-em' }),
    })
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe('fetch failed')
  })

  it('PUT updates timeslot by id', async () => {
    ;(updateTimeSlot as jest.Mock).mockResolvedValue({ id: 'slot-em', code: 'AM' })

    const response = await PUT(
      new Request('http://localhost/api/timeslots/slot-em', {
        method: 'PUT',
        body: JSON.stringify({ code: 'AM' }),
      }) as any,
      {
        params: Promise.resolve({ id: 'slot-em' }),
      }
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(updateTimeSlot).toHaveBeenCalledWith('slot-em', { code: 'AM' })
    expect(json).toEqual({ id: 'slot-em', code: 'AM' })
  })

  it('PUT returns 500 when update fails', async () => {
    ;(updateTimeSlot as jest.Mock).mockRejectedValue(new Error('update failed'))

    const response = await PUT(
      new Request('http://localhost/api/timeslots/slot-em', {
        method: 'PUT',
        body: JSON.stringify({ code: 'AM' }),
      }) as any,
      {
        params: Promise.resolve({ id: 'slot-em' }),
      }
    )
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe('update failed')
  })

  it('DELETE removes timeslot by id', async () => {
    ;(deleteTimeSlot as jest.Mock).mockResolvedValue(undefined)

    const response = await DELETE(
      new Request('http://localhost/api/timeslots/slot-em', { method: 'DELETE' }) as any,
      {
        params: Promise.resolve({ id: 'slot-em' }),
      }
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(deleteTimeSlot).toHaveBeenCalledWith('slot-em')
    expect(json).toEqual({ success: true })
  })

  it('DELETE returns 500 when delete fails', async () => {
    ;(deleteTimeSlot as jest.Mock).mockRejectedValue(new Error('delete failed'))

    const response = await DELETE(
      new Request('http://localhost/api/timeslots/slot-em', { method: 'DELETE' }) as any,
      {
        params: Promise.resolve({ id: 'slot-em' }),
      }
    )
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe('delete failed')
  })
})
