/** @jest-environment node */

import { GET, PUT } from '@/app/api/sub-finder/substitute-contacts/route'
import { createJsonRequest } from '@/tests/helpers/api'
import { updateSubstituteContact } from '@/lib/api/substitute-contacts'

jest.mock('@/lib/api/substitute-contacts', () => ({
  getOrCreateSubstituteContact: jest.fn(async () => ({ id: 'contact-1' })),
  getSubstituteContact: jest.fn(async () => ({ id: 'contact-1' })),
  updateSubstituteContact: jest.fn(async () => ({
    id: 'contact-1',
    coverage_request_id: 'coverage-1',
    sub_id: 'sub-1',
  })),
  upsertShiftOverrides: jest.fn(async () => undefined),
}))

describe('substitute-contacts route integration', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('GET returns 400 when required params are missing', async () => {
    const request = {
      nextUrl: new URL('http://localhost:3000/api/sub-finder/substitute-contacts'),
    }

    const response = await GET(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/missing required parameters/i)
  })

  it('PUT returns 400 when id is missing', async () => {
    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/substitute-contacts',
      'PUT',
      {
        response_status: 'pending',
      }
    )

    const response = await PUT(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/missing required parameter: id/i)
  })

  it('PUT returns 400 when declined_all has selected shifts', async () => {
    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/substitute-contacts',
      'PUT',
      {
        id: 'contact-1',
        response_status: 'declined_all',
        selected_shift_keys: ['2026-02-10|EM'],
      }
    )

    const response = await PUT(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(updateSubstituteContact).toHaveBeenCalled()
    expect(json.error).toMatch(/cannot decline all while shifts are selected/i)
  })
})
