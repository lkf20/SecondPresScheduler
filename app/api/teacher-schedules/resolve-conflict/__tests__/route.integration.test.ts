/** @jest-environment node */

import { NextResponse } from 'next/server'
import { POST } from '@/app/api/teacher-schedules/resolve-conflict/route'
import { createClient } from '@/lib/supabase/server'
import { createErrorResponse } from '@/lib/utils/errors'
import { validateRequest } from '@/lib/utils/validation'
import {
  createTeacherSchedule,
  deleteTeacherSchedule,
  updateTeacherSchedule,
} from '@/lib/api/schedules'
import { createTeacherScheduleAuditLog } from '@/lib/api/audit-logs'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/utils/errors', () => ({
  createErrorResponse: jest.fn(),
}))

jest.mock('@/lib/utils/validation', () => ({
  validateRequest: jest.fn(),
}))

jest.mock('@/lib/api/schedules', () => ({
  createTeacherSchedule: jest.fn(),
  deleteTeacherSchedule: jest.fn(),
  updateTeacherSchedule: jest.fn(),
}))

jest.mock('@/lib/api/audit-logs', () => ({
  createTeacherScheduleAuditLog: jest.fn(),
}))

const createSupabaseForResolve = (result: { data: any[] | null; error: Error | null }) => {
  let eqCount = 0
  const queryBuilder = {
    select: jest.fn(() => queryBuilder),
    neq: jest.fn(() => queryBuilder),
    eq: jest.fn(() => {
      eqCount += 1
      if (eqCount === 4) {
        return Promise.resolve(result)
      }
      return queryBuilder
    }),
  }

  return {
    from: jest.fn(() => queryBuilder),
  }
}

describe('POST /api/teacher-schedules/resolve-conflict integration', () => {
  const baseValidationData = {
    teacher_id: 'teacher-1',
    day_of_week_id: 'day-mon',
    time_slot_id: 'slot-em',
    target_classroom_id: 'class-target',
    resolution: 'remove_other' as const,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(createErrorResponse as jest.Mock).mockImplementation(
      (_error: unknown, message: string, status: number) =>
        NextResponse.json({ error: message }, { status })
    )
    ;(createTeacherScheduleAuditLog as jest.Mock).mockResolvedValue(undefined)
    ;(deleteTeacherSchedule as jest.Mock).mockResolvedValue(undefined)
    ;(createTeacherSchedule as jest.Mock).mockResolvedValue({
      id: 'new-schedule-1',
      teacher_id: 'teacher-1',
      classroom_id: 'class-target',
      is_floater: false,
    })
    ;(updateTeacherSchedule as jest.Mock).mockImplementation(async (id: string) => ({
      id,
      is_floater: true,
    }))
  })

  it('returns validation error when request body is invalid', async () => {
    ;(validateRequest as jest.Mock).mockReturnValue({
      success: false,
      error: NextResponse.json({ error: 'Invalid request' }, { status: 400 }),
    })

    const response = await POST(
      new Request('http://localhost/api/teacher-schedules/resolve-conflict', {
        method: 'POST',
        body: JSON.stringify({}),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Invalid request')
    expect(createClient).not.toHaveBeenCalled()
  })

  it('returns 400 when no conflicting schedules are found', async () => {
    ;(validateRequest as jest.Mock).mockReturnValue({
      success: true,
      data: baseValidationData,
    })
    ;(createClient as jest.Mock).mockResolvedValue(
      createSupabaseForResolve({ data: [], error: null })
    )

    const response = await POST(
      new Request('http://localhost/api/teacher-schedules/resolve-conflict', {
        method: 'POST',
        body: JSON.stringify({}),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/No conflicting schedules found/i)
  })

  it('handles remove_other by deleting conflicts and creating replacement schedule', async () => {
    ;(validateRequest as jest.Mock).mockReturnValue({
      success: true,
      data: {
        ...baseValidationData,
        resolution: 'remove_other',
      },
    })
    ;(createClient as jest.Mock).mockResolvedValue(
      createSupabaseForResolve({
        data: [
          {
            id: 'conflict-1',
            classroom_id: 'class-a',
            is_floater: false,
          },
          {
            id: 'conflict-2',
            classroom_id: 'class-b',
            is_floater: false,
          },
        ],
        error: null,
      })
    )

    const response = await POST(
      new Request('http://localhost/api/teacher-schedules/resolve-conflict', {
        method: 'POST',
        body: JSON.stringify({}),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(deleteTeacherSchedule).toHaveBeenCalledTimes(2)
    expect(createTeacherSchedule).toHaveBeenCalledWith({
      teacher_id: 'teacher-1',
      day_of_week_id: 'day-mon',
      time_slot_id: 'slot-em',
      classroom_id: 'class-target',
      is_floater: false,
    })
    expect(createTeacherScheduleAuditLog).toHaveBeenCalledTimes(3)
    expect(json.deleted).toEqual(['conflict-1', 'conflict-2'])
    expect(json.created.id).toBe('new-schedule-1')
  })

  it('handles mark_floater by updating conflicts and creating a floater assignment', async () => {
    ;(validateRequest as jest.Mock).mockReturnValue({
      success: true,
      data: {
        ...baseValidationData,
        resolution: 'mark_floater',
      },
    })
    ;(createClient as jest.Mock).mockResolvedValue(
      createSupabaseForResolve({
        data: [
          {
            id: 'conflict-1',
            classroom_id: 'class-a',
            is_floater: false,
          },
        ],
        error: null,
      })
    )
    ;(createTeacherSchedule as jest.Mock).mockResolvedValue({
      id: 'new-floater-schedule',
      teacher_id: 'teacher-1',
      classroom_id: 'class-target',
      is_floater: true,
    })

    const response = await POST(
      new Request('http://localhost/api/teacher-schedules/resolve-conflict', {
        method: 'POST',
        body: JSON.stringify({}),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(updateTeacherSchedule).toHaveBeenCalledWith('conflict-1', {
      is_floater: true,
    })
    expect(createTeacherSchedule).toHaveBeenCalledWith({
      teacher_id: 'teacher-1',
      day_of_week_id: 'day-mon',
      time_slot_id: 'slot-em',
      classroom_id: 'class-target',
      is_floater: true,
    })
    expect(json.created.id).toBe('new-floater-schedule')
    expect(json.updated).toEqual([{ id: 'conflict-1', is_floater: true }])
  })

  it('returns empty updated list when mark_floater updates return null', async () => {
    ;(validateRequest as jest.Mock).mockReturnValue({
      success: true,
      data: {
        ...baseValidationData,
        resolution: 'mark_floater',
      },
    })
    ;(createClient as jest.Mock).mockResolvedValue(
      createSupabaseForResolve({
        data: [
          {
            id: 'conflict-1',
            classroom_id: 'class-a',
            is_floater: false,
          },
        ],
        error: null,
      })
    )
    ;(updateTeacherSchedule as jest.Mock).mockResolvedValue(null)
    ;(createTeacherSchedule as jest.Mock).mockResolvedValue({
      id: 'new-floater-schedule',
      teacher_id: 'teacher-1',
      classroom_id: 'class-target',
      is_floater: true,
    })

    const response = await POST(
      new Request('http://localhost/api/teacher-schedules/resolve-conflict', {
        method: 'POST',
        body: JSON.stringify({}),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(updateTeacherSchedule).toHaveBeenCalled()
    expect(json.updated).toEqual([])
    expect(json.created.id).toBe('new-floater-schedule')
  })

  it('handles cancel resolution by logging and returning empty result', async () => {
    ;(validateRequest as jest.Mock).mockReturnValue({
      success: true,
      data: {
        ...baseValidationData,
        resolution: 'cancel',
      },
    })
    ;(createClient as jest.Mock).mockResolvedValue(
      createSupabaseForResolve({
        data: [
          {
            id: 'conflict-1',
            classroom_id: 'class-a',
            is_floater: false,
          },
        ],
        error: null,
      })
    )

    const response = await POST(
      new Request('http://localhost/api/teacher-schedules/resolve-conflict', {
        method: 'POST',
        body: JSON.stringify({}),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(deleteTeacherSchedule).not.toHaveBeenCalled()
    expect(updateTeacherSchedule).not.toHaveBeenCalled()
    expect(createTeacherSchedule).not.toHaveBeenCalled()
    expect(createTeacherScheduleAuditLog).toHaveBeenCalledTimes(1)
    expect(json).toEqual({})
  })

  it('returns error response when fetching conflicts fails', async () => {
    ;(validateRequest as jest.Mock).mockReturnValue({
      success: true,
      data: baseValidationData,
    })
    ;(createClient as jest.Mock).mockResolvedValue(
      createSupabaseForResolve({
        data: null,
        error: new Error('select failed'),
      })
    )

    const response = await POST(
      new Request('http://localhost/api/teacher-schedules/resolve-conflict', {
        method: 'POST',
        body: JSON.stringify({}),
      }) as any
    )
    const json = await response.json()

    expect(createErrorResponse).toHaveBeenCalled()
    expect(response.status).toBe(500)
    expect(json.error).toBe('Failed to resolve conflict')
  })
})
