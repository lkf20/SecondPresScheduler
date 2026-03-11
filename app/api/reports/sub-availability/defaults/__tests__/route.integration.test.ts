/** @jest-environment node */

import { GET, PUT } from '@/app/api/reports/sub-availability/defaults/route'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))

describe('Sub availability defaults route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
  })

  it('GET returns defaults from schedule settings', async () => {
    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            sub_availability_top_header_html: '<div>Header</div>',
            sub_availability_footer_notes_html: '<div>Footer</div>',
          },
          error: null,
        }),
      })),
    })

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({
      top_header_html: '<div>Header</div>',
      footer_notes_html: '<div>Footer</div>',
    })
  })

  it('PUT upserts schedule settings row', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null })
    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table !== 'schedule_settings') throw new Error('Unexpected table')
        return {
          upsert,
        }
      }),
    })

    const response = await PUT(
      new Request('http://localhost/api/reports/sub-availability/defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          top_header_html: '<div>A</div>',
          footer_notes_html: '<div>B</div>',
        }),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({
      top_header_html: '<div>A</div>',
      footer_notes_html: '<div>B</div>',
    })
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        school_id: 'school-1',
        sub_availability_top_header_html: '<div>A</div>',
        sub_availability_footer_notes_html: '<div>B</div>',
      }),
      { onConflict: 'school_id' }
    )
  })

  it('PUT upserts when schedule settings row does not exist', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null })
    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table !== 'schedule_settings') throw new Error('Unexpected table')
        return {
          upsert,
        }
      }),
    })

    const response = await PUT(
      new Request('http://localhost/api/reports/sub-availability/defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          top_header_html: '<div>A</div>',
          footer_notes_html: '<div>B</div>',
        }),
      }) as any
    )

    expect(response.status).toBe(200)
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        school_id: 'school-1',
        sub_availability_top_header_html: '<div>A</div>',
        sub_availability_footer_notes_html: '<div>B</div>',
      }),
      { onConflict: 'school_id' }
    )
  })

  it('PUT supports saving top header only without overwriting footer', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null })
    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table !== 'schedule_settings') throw new Error('Unexpected table')
        return {
          upsert,
        }
      }),
    })

    const response = await PUT(
      new Request('http://localhost/api/reports/sub-availability/defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          top_header_html: '<div>Top only</div>',
        }),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({
      top_header_html: '<div>Top only</div>',
    })
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        school_id: 'school-1',
        sub_availability_top_header_html: '<div>Top only</div>',
      }),
      { onConflict: 'school_id' }
    )
    const [payload] = upsert.mock.calls[0]
    expect(payload).not.toHaveProperty('sub_availability_footer_notes_html')
  })

  it('PUT sanitizes unsafe html before persistence', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null })
    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table !== 'schedule_settings') throw new Error('Unexpected table')
        return { upsert }
      }),
    })

    const response = await PUT(
      new Request('http://localhost/api/reports/sub-availability/defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          footer_notes_html:
            '<div style="position:absolute"><script>alert(1)</script><span>Footer</span></div>',
        }),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.footer_notes_html).toContain('Footer')
    expect(json.footer_notes_html).not.toContain('<script')
    expect(json.footer_notes_html).not.toContain('position:absolute')

    const [payload] = upsert.mock.calls[0]
    expect(String(payload.sub_availability_footer_notes_html)).toContain('Footer')
    expect(String(payload.sub_availability_footer_notes_html)).not.toContain('<script')
    expect(String(payload.sub_availability_footer_notes_html)).not.toContain('position:absolute')
  })
})
