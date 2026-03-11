/** @jest-environment node */

import { GET, PUT } from '@/app/api/reports/daily-schedule/defaults/route'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))

describe('Daily schedule defaults route', () => {
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
            daily_schedule_top_header_html: '<div>Header</div>',
            daily_schedule_footer_notes_html: '<div>Footer</div>',
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

  it('PUT upserts settings row', async () => {
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
      new Request('http://localhost/api/reports/daily-schedule/defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ top_header_html: '<div>A</div>' }),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ top_header_html: '<div>A</div>' })
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        school_id: 'school-1',
        daily_schedule_top_header_html: '<div>A</div>',
      }),
      { onConflict: 'school_id' }
    )
  })

  it('PUT upserts footer defaults', async () => {
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
      new Request('http://localhost/api/reports/daily-schedule/defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ footer_notes_html: '<div>Footer</div>' }),
      }) as any
    )

    expect(response.status).toBe(200)
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        school_id: 'school-1',
        daily_schedule_footer_notes_html: '<div>Footer</div>',
      }),
      { onConflict: 'school_id' }
    )
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
      new Request('http://localhost/api/reports/daily-schedule/defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          top_header_html: '<div onclick="alert(1)"><script>alert(1)</script>Safe</div>',
        }),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.top_header_html).toContain('Safe')
    expect(json.top_header_html).not.toContain('<script')
    expect(json.top_header_html).not.toContain('onclick=')

    const [payload] = upsert.mock.calls[0]
    expect(String(payload.daily_schedule_top_header_html)).toContain('Safe')
    expect(String(payload.daily_schedule_top_header_html)).not.toContain('<script')
    expect(String(payload.daily_schedule_top_header_html)).not.toContain('onclick=')
  })
})
