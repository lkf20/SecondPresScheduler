/** @jest-environment node */

import { GET, POST } from '@/app/api/time-off/route'
import { createJsonRequest } from '@/tests/helpers/api'
import { getUserSchoolId } from '@/lib/utils/auth'

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))

describe('GET /api/time-off integration', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns 403 when school context is missing', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue(null)
    const request = createJsonRequest('http://localhost:3000/api/time-off', 'GET')

    const response = await GET(request as any)
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error).toMatch(/missing school_id|profile/i)
  })

  it('POST returns 403 when school context is missing', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue(null)
    const request = createJsonRequest('http://localhost:3000/api/time-off', 'POST', {
      teacher_id: 'teacher-1',
      start_date: '2026-02-20',
      end_date: '2026-02-20',
    })

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error).toMatch(/missing school_id|profile/i)
  })
})
