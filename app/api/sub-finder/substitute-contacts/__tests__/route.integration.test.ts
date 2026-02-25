/** @jest-environment node */

import { GET, PUT } from '@/app/api/sub-finder/substitute-contacts/route'
import { createJsonRequest } from '@/tests/helpers/api'
import {
  getOrCreateSubstituteContact,
  getSubstituteContact,
  updateSubstituteContact,
  upsertShiftOverrides,
} from '@/lib/api/substitute-contacts'

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

  it('GET returns contact details when parameters are provided', async () => {
    const request = {
      nextUrl: new URL(
        'http://localhost:3000/api/sub-finder/substitute-contacts?coverage_request_id=coverage-1&sub_id=sub-1'
      ),
    }

    const response = await GET(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(getOrCreateSubstituteContact).toHaveBeenCalledWith('coverage-1', 'sub-1')
    expect(getSubstituteContact).toHaveBeenCalledWith('coverage-1', 'sub-1')
    expect(json.id).toBe('contact-1')
  })

  it('PUT updates contact and shift overrides', async () => {
    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/substitute-contacts',
      'PUT',
      {
        id: 'contact-1',
        response_status: 'pending',
        is_contacted: true,
        notes: 'Texted',
        shift_overrides: [{ coverage_request_shift_id: 'crs-1', selected: true }],
      }
    )

    const response = await PUT(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(updateSubstituteContact).toHaveBeenCalledWith('contact-1', {
      response_status: 'pending',
      is_contacted: true,
      notes: 'Texted',
    })
    expect(upsertShiftOverrides).toHaveBeenCalledWith('contact-1', [
      { coverage_request_shift_id: 'crs-1', selected: true },
    ])
    expect(json.id).toBe('contact-1')
  })

  it('PUT falls back to updated contact when detail fetch fails', async () => {
    ;(getSubstituteContact as jest.Mock).mockRejectedValueOnce(new Error('detail fetch failed'))

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/substitute-contacts',
      'PUT',
      {
        id: 'contact-1',
        response_status: 'confirmed',
      }
    )

    const response = await PUT(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      id: 'contact-1',
      coverage_request_id: 'coverage-1',
      sub_id: 'sub-1',
    })
  })

  it('PUT returns 500 when override upsert fails', async () => {
    ;(upsertShiftOverrides as jest.Mock).mockRejectedValueOnce(new Error('override failed'))

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/substitute-contacts',
      'PUT',
      {
        id: 'contact-1',
        shift_overrides: [{ coverage_request_shift_id: 'crs-1', selected: true }],
      }
    )

    const response = await PUT(request as any)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe('Failed to upsert shift overrides')
    expect(json.details).toMatch(/override failed/i)
  })
})
