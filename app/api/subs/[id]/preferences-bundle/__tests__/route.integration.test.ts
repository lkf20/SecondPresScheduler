/** @jest-environment node */

import { NextRequest } from 'next/server'
import { PUT } from '@/app/api/subs/[id]/preferences-bundle/route'
import { createClient } from '@/lib/supabase/server'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

describe('PUT /api/subs/[id]/preferences-bundle', () => {
  const rpcMock = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    rpcMock.mockResolvedValue({ error: null })
    ;(createClient as jest.Mock).mockResolvedValue({
      rpc: rpcMock,
    })
  })

  it('whitelists capability keys and does not pass capabilities_notes to rpc', async () => {
    const request = new NextRequest('http://localhost/api/subs/sub-1/preferences-bundle', {
      method: 'PUT',
      body: JSON.stringify({
        class_group_ids: ['cg-1'],
        qualifications: [],
        capabilities: {
          can_change_diapers: true,
          can_lift_children: false,
          can_assist_with_toileting: true,
          capabilities_notes: 'should not be persisted here',
        },
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PUT(request, { params: Promise.resolve({ id: 'sub-1' }) })
    expect(response.status).toBe(200)
    expect(rpcMock).toHaveBeenCalledWith('save_sub_preferences_bundle', {
      p_sub_id: 'sub-1',
      p_class_group_ids: ['cg-1'],
      p_qualifications: [],
      p_capabilities: {
        can_change_diapers: true,
        can_lift_children: false,
        can_assist_with_toileting: true,
      },
    })
  })
})
