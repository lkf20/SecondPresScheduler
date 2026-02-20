/** @jest-environment node */

import { POST } from '@/app/api/sub-finder/find-subs/route'
import { createJsonRequest } from '@/tests/helpers/api'
import { getUserSchoolId } from '@/lib/utils/auth'

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))

describe('POST /api/sub-finder/find-subs integration', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns 403 when school context is missing', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue(null)
    const request = createJsonRequest('http://localhost:3000/api/sub-finder/find-subs', 'POST', {
      absence_id: 'absence-1',
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error).toMatch(/missing school_id|profile/i)
  })

  it('returns 400 when absence_id is missing', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    const request = createJsonRequest('http://localhost:3000/api/sub-finder/find-subs', 'POST', {})

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/absence_id is required/i)
  })
})
