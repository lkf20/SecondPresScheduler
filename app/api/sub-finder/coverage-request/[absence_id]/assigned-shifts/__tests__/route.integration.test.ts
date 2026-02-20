/** @jest-environment node */

import { GET } from '@/app/api/sub-finder/coverage-request/[absence_id]/assigned-shifts/route'
import { getTimeOffRequestById } from '@/lib/api/time-off'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({})),
}))

jest.mock('@/lib/api/time-off', () => ({
  getTimeOffRequestById: jest.fn(),
}))

describe('GET /api/sub-finder/coverage-request/[absence_id]/assigned-shifts integration', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns 400 when absence_id is missing', async () => {
    const request = {
      nextUrl: new URL('http://localhost:3000/api/sub-finder/coverage-request//assigned-shifts'),
    }
    const response = await GET(request as any, { params: Promise.resolve({ absence_id: '' }) })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/missing absence_id/i)
  })

  it('returns 404 when time off request is not found', async () => {
    ;(getTimeOffRequestById as jest.Mock).mockResolvedValueOnce(null)

    const request = {
      nextUrl: new URL(
        'http://localhost:3000/api/sub-finder/coverage-request/absence-1/assigned-shifts'
      ),
    }
    const response = await GET(request as any, {
      params: Promise.resolve({ absence_id: 'absence-1' }),
    })
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toMatch(/not found/i)
  })
})
