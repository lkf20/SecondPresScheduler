/** @jest-environment node */

import { NextResponse } from 'next/server'
import { POST } from '@/app/api/teacher-schedules/check-conflicts/route'
import { createClient } from '@/lib/supabase/server'
import { createErrorResponse } from '@/lib/utils/errors'
import { validateRequest } from '@/lib/utils/validation'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/utils/validation', () => ({
  validateRequest: jest.fn(),
}))

jest.mock('@/lib/utils/errors', () => ({
  createErrorResponse: jest.fn(),
}))

const createSupabaseForChecks = (results: Array<{ data: any[] | null; error: Error | null }>) => {
  let resultIndex = 0

  return {
    from: jest.fn(() => {
      const currentResult = results[resultIndex] ?? { data: [], error: null }
      resultIndex += 1
      let eqCount = 0
      const queryBuilder = {
        select: jest.fn(() => queryBuilder),
        neq: jest.fn(() => queryBuilder),
        eq: jest.fn(() => {
          eqCount += 1
          if (eqCount === 4) {
            return Promise.resolve(currentResult)
          }
          return queryBuilder
        }),
      }
      return queryBuilder
    }),
  }
}

describe('POST /api/teacher-schedules/check-conflicts integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createErrorResponse as jest.Mock).mockImplementation(
      (_error: unknown, message: string, status: number) =>
        NextResponse.json({ error: message }, { status })
    )
  })

  it('returns validation error when request body is invalid', async () => {
    ;(validateRequest as jest.Mock).mockReturnValue({
      success: false,
      error: NextResponse.json({ error: 'Invalid request' }, { status: 400 }),
    })

    const response = await POST(
      new Request('http://localhost/api/teacher-schedules/check-conflicts', {
        method: 'POST',
        body: JSON.stringify({}),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Invalid request')
    expect(createClient).not.toHaveBeenCalled()
  })

  it('returns transformed conflicts with teacher and slot metadata', async () => {
    ;(validateRequest as jest.Mock).mockReturnValue({
      success: true,
      data: {
        checks: [
          {
            teacher_id: 'teacher-1',
            day_of_week_id: 'day-mon',
            time_slot_id: 'slot-em',
            classroom_id: 'class-target',
          },
        ],
      },
    })
    ;(createClient as jest.Mock).mockResolvedValue(
      createSupabaseForChecks([
        {
          data: [
            {
              id: 'schedule-1',
              classroom_id: 'class-other',
              classroom: { name: 'Toddler Room' },
              day_of_week: { name: 'Monday' },
              time_slot: { code: 'EM' },
              teacher: {
                first_name: 'Bella',
                last_name: 'Wilbanks',
                display_name: 'Bella W.',
              },
            },
          ],
          error: null,
        },
      ])
    )

    const response = await POST(
      new Request('http://localhost/api/teacher-schedules/check-conflicts', {
        method: 'POST',
        body: JSON.stringify({}),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.conflicts).toEqual([
      {
        teacher_id: 'teacher-1',
        teacher_name: 'Bella W.',
        conflicting_schedule_id: 'schedule-1',
        conflicting_classroom_id: 'class-other',
        conflicting_classroom_name: 'Toddler Room',
        day_of_week_id: 'day-mon',
        day_of_week_name: 'Monday',
        time_slot_id: 'slot-em',
        time_slot_code: 'EM',
        target_classroom_id: 'class-target',
      },
    ])
  })

  it('falls back to first+last teacher name when display name is missing', async () => {
    ;(validateRequest as jest.Mock).mockReturnValue({
      success: true,
      data: {
        checks: [
          {
            teacher_id: 'teacher-1',
            day_of_week_id: 'day-mon',
            time_slot_id: 'slot-em',
            classroom_id: 'class-target',
          },
        ],
      },
    })
    ;(createClient as jest.Mock).mockResolvedValue(
      createSupabaseForChecks([
        {
          data: [
            {
              id: 'schedule-2',
              classroom_id: 'class-other',
              classroom: { name: 'Toddler Room' },
              day_of_week: { name: 'Monday' },
              time_slot: { code: 'EM' },
              teacher: {
                first_name: 'Amy',
                last_name: 'Parks',
                display_name: null,
              },
            },
          ],
          error: null,
        },
      ])
    )

    const response = await POST(
      new Request('http://localhost/api/teacher-schedules/check-conflicts', {
        method: 'POST',
        body: JSON.stringify({}),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.conflicts[0].teacher_name).toBe('Amy Parks')
  })

  it('falls back to Unknown values when joined metadata is missing', async () => {
    ;(validateRequest as jest.Mock).mockReturnValue({
      success: true,
      data: {
        checks: [
          {
            teacher_id: 'teacher-1',
            day_of_week_id: 'day-mon',
            time_slot_id: 'slot-em',
            classroom_id: 'class-target',
          },
        ],
      },
    })
    ;(createClient as jest.Mock).mockResolvedValue(
      createSupabaseForChecks([
        {
          data: [
            {
              id: 'schedule-3',
              classroom_id: 'class-other',
              classroom: null,
              day_of_week: null,
              time_slot: null,
              teacher: null,
            },
          ],
          error: null,
        },
      ])
    )

    const response = await POST(
      new Request('http://localhost/api/teacher-schedules/check-conflicts', {
        method: 'POST',
        body: JSON.stringify({}),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.conflicts[0]).toMatchObject({
      teacher_name: 'Unknown',
      conflicting_classroom_name: 'Unknown',
      day_of_week_name: 'Unknown',
      time_slot_code: 'Unknown',
    })
  })

  it('returns empty conflicts when no conflicts are found', async () => {
    ;(validateRequest as jest.Mock).mockReturnValue({
      success: true,
      data: {
        checks: [
          {
            teacher_id: 'teacher-1',
            day_of_week_id: 'day-mon',
            time_slot_id: 'slot-em',
            classroom_id: 'class-target',
          },
        ],
      },
    })
    ;(createClient as jest.Mock).mockResolvedValue(
      createSupabaseForChecks([{ data: [], error: null }])
    )

    const response = await POST(
      new Request('http://localhost/api/teacher-schedules/check-conflicts', {
        method: 'POST',
        body: JSON.stringify({}),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.conflicts).toEqual([])
  })

  it('applies non-floater conflict filter when checking double bookings', async () => {
    ;(validateRequest as jest.Mock).mockReturnValue({
      success: true,
      data: {
        checks: [
          {
            teacher_id: 'teacher-1',
            day_of_week_id: 'day-mon',
            time_slot_id: 'slot-em',
            classroom_id: 'class-target',
          },
        ],
      },
    })

    const eqSpy = jest.fn()
    const queryBuilder: any = {
      select: jest.fn(() => queryBuilder),
      neq: jest.fn(() => queryBuilder),
      eq: eqSpy,
    }

    eqSpy.mockImplementation((field: string) => {
      if (field === 'is_floater') {
        return Promise.resolve({ data: [], error: null })
      }
      return queryBuilder
    })
    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn(() => queryBuilder),
    })

    const response = await POST(
      new Request('http://localhost/api/teacher-schedules/check-conflicts', {
        method: 'POST',
        body: JSON.stringify({}),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.conflicts).toEqual([])
    expect(eqSpy).toHaveBeenCalledWith('is_floater', false)
  })

  it('returns error response when supabase query fails', async () => {
    ;(validateRequest as jest.Mock).mockReturnValue({
      success: true,
      data: {
        checks: [
          {
            teacher_id: 'teacher-1',
            day_of_week_id: 'day-mon',
            time_slot_id: 'slot-em',
            classroom_id: 'class-target',
          },
        ],
      },
    })
    ;(createClient as jest.Mock).mockResolvedValue(
      createSupabaseForChecks([{ data: null, error: new Error('db query failed') }])
    )

    const response = await POST(
      new Request('http://localhost/api/teacher-schedules/check-conflicts', {
        method: 'POST',
        body: JSON.stringify({}),
      }) as any
    )
    const json = await response.json()

    expect(createErrorResponse).toHaveBeenCalled()
    expect(response.status).toBe(500)
    expect(json.error).toBe('Failed to check conflicts')
  })
})
