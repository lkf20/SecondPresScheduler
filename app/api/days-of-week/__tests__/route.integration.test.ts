/** @jest-environment node */

import { NextResponse } from 'next/server'
import { GET } from '@/app/api/days-of-week/route'
import { getDaysOfWeek, ensureDaysOfWeekSeeded } from '@/lib/api/days-of-week'
import { createErrorResponse } from '@/lib/utils/errors'

jest.mock('@/lib/api/days-of-week', () => ({
  getDaysOfWeek: jest.fn(),
  ensureDaysOfWeekSeeded: jest.fn(),
}))

jest.mock('@/lib/utils/errors', () => ({
  createErrorResponse: jest.fn(),
}))

describe('days-of-week route integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createErrorResponse as jest.Mock).mockImplementation(
      (_error: unknown, message: string, status: number) =>
        NextResponse.json({ error: message }, { status })
    )
  })

  it('returns seeded days list when available', async () => {
    ;(ensureDaysOfWeekSeeded as jest.Mock).mockResolvedValue(undefined)
    ;(getDaysOfWeek as jest.Mock).mockResolvedValue([
      { id: 'day-mon', name: 'Monday', day_number: 1 },
    ])

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(ensureDaysOfWeekSeeded).toHaveBeenCalled()
    expect(json).toEqual([{ id: 'day-mon', name: 'Monday', day_number: 1 }])
  })

  it('returns empty array when days are still empty after seeding', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    ;(ensureDaysOfWeekSeeded as jest.Mock).mockResolvedValue(undefined)
    ;(getDaysOfWeek as jest.Mock).mockResolvedValue([])

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual([])
    expect(warnSpy).toHaveBeenCalled()
  })

  it('returns error response when fetch fails', async () => {
    ;(ensureDaysOfWeekSeeded as jest.Mock).mockRejectedValue(new Error('seed failed'))

    const response = await GET()
    const json = await response.json()

    expect(createErrorResponse).toHaveBeenCalled()
    expect(response.status).toBe(500)
    expect(json.error).toBe('Failed to fetch days of week')
  })
})
