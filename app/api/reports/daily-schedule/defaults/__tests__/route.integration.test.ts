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

  it('PUT updates existing settings row', async () => {
    const updateEq = jest.fn().mockResolvedValue({ error: null })
    const update = jest.fn(() => ({ eq: updateEq }))

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table !== 'schedule_settings') throw new Error('Unexpected table')
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: 'settings-1' },
            error: null,
          }),
          update,
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
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ daily_schedule_top_header_html: '<div>A</div>' })
    )
  })

  it('PUT inserts row when settings row does not exist', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null })

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table !== 'schedule_settings') throw new Error('Unexpected table')
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
          insert,
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
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        school_id: 'school-1',
        selected_day_ids: [],
        daily_schedule_footer_notes_html: '<div>Footer</div>',
      })
    )
  })
})
