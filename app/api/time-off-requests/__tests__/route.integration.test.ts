/** @jest-environment node */

import { GET } from '@/app/api/time-off-requests/route'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({})),
}))

jest.mock('@/lib/api/time-off', () => ({
  getTimeOffRequests: jest.fn(async () => {
    throw new Error('forced failure')
  }),
}))

describe('GET /api/time-off-requests integration', () => {
  it('returns 500 with error payload when fetching requests fails', async () => {
    const request = {
      nextUrl: new URL('http://localhost:3000/api/time-off-requests'),
    }

    const response = await GET(request as any)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toMatch(/forced failure/i)
  })
})
