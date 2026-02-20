/** @jest-environment node */

import { GET } from '@/app/api/sub-finder/absences/route'
import { getUserSchoolId } from '@/lib/utils/auth'

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))

describe('GET /api/sub-finder/absences integration', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns 403 when school context is missing', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue(null)
    const request = {
      nextUrl: new URL('http://localhost:3000/api/sub-finder/absences'),
    }

    const response = await GET(request as any)
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error).toMatch(/missing school_id|profile/i)
  })
})
