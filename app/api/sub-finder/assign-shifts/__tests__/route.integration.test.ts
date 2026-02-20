/** @jest-environment node */

import { POST } from '@/app/api/sub-finder/assign-shifts/route'
import { createJsonRequest } from '@/tests/helpers/api'

describe('POST /api/sub-finder/assign-shifts integration', () => {
  it('returns 400 when required fields are missing', async () => {
    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/assign-shifts',
      'POST',
      {
        coverage_request_id: 'request-1',
        sub_id: 'sub-1',
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/missing required fields/i)
  })
})
