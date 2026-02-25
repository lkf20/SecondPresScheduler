/** @jest-environment node */

import { NextResponse } from 'next/server'
import { GET, POST } from '@/app/api/teacher-schedules/route'
import { NextRequest } from 'next/server'
import {
  getAllTeacherSchedules,
  createTeacherSchedule,
  getTeacherScheduleById,
} from '@/lib/api/schedules'
import { createErrorResponse } from '@/lib/utils/errors'
import { validateQueryParams, validateRequest } from '@/lib/utils/validation'

jest.mock('@/lib/api/schedules', () => ({
  getAllTeacherSchedules: jest.fn(),
  createTeacherSchedule: jest.fn(),
  getTeacherScheduleById: jest.fn(),
}))

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn().mockResolvedValue('school-1'),
}))

jest.mock('@/lib/audit/logAuditEvent', () => ({
  getAuditActorContext: jest.fn().mockResolvedValue({
    actorUserId: 'user-1',
    actorDisplayName: 'Test User',
  }),
  logAuditEvent: jest.fn().mockResolvedValue(true),
}))

jest.mock('@/lib/utils/errors', () => ({
  createErrorResponse: jest.fn(),
}))

jest.mock('@/lib/utils/validation', () => ({
  validateQueryParams: jest.fn(),
  validateRequest: jest.fn(),
}))

describe('teacher schedules collection route integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createErrorResponse as jest.Mock).mockImplementation(
      (_error: unknown, message: string, status: number) =>
        NextResponse.json({ error: message }, { status })
    )
  })

  it('GET returns validation error when query params are invalid', async () => {
    ;(validateQueryParams as jest.Mock).mockReturnValue({
      success: false,
      error: NextResponse.json({ error: 'Bad query' }, { status: 400 }),
    })

    const response = await GET(
      new NextRequest('http://localhost/api/teacher-schedules?day_of_week_id=') as any
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Bad query')
    expect(getAllTeacherSchedules).not.toHaveBeenCalled()
  })

  it('GET returns schedules for valid query', async () => {
    ;(validateQueryParams as jest.Mock).mockReturnValue({
      success: true,
      data: { day_of_week_id: 'day-mon' },
    })
    ;(getAllTeacherSchedules as jest.Mock).mockResolvedValue([
      { id: 'schedule-1', teacher_id: 'teacher-1' },
    ])

    const response = await GET(
      new NextRequest('http://localhost/api/teacher-schedules?day_of_week_id=day-mon') as any
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(getAllTeacherSchedules).toHaveBeenCalledWith({ day_of_week_id: 'day-mon' })
    expect(json).toEqual([{ id: 'schedule-1', teacher_id: 'teacher-1' }])
  })

  it('GET routes unexpected failures through createErrorResponse', async () => {
    ;(validateQueryParams as jest.Mock).mockReturnValue({
      success: true,
      data: {},
    })
    ;(getAllTeacherSchedules as jest.Mock).mockRejectedValue(new Error('read failed'))

    const response = await GET(new NextRequest('http://localhost/api/teacher-schedules') as any)
    const json = await response.json()

    expect(createErrorResponse).toHaveBeenCalled()
    expect(response.status).toBe(500)
    expect(json.error).toBe('Failed to fetch teacher schedules')
  })

  it('POST returns validation error when body is invalid', async () => {
    ;(validateRequest as jest.Mock).mockReturnValue({
      success: false,
      error: NextResponse.json({ error: 'Invalid payload' }, { status: 400 }),
    })

    const response = await POST(
      new Request('http://localhost/api/teacher-schedules', {
        method: 'POST',
        body: JSON.stringify({}),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Invalid payload')
    expect(createTeacherSchedule).not.toHaveBeenCalled()
  })

  it('POST creates schedule for valid body', async () => {
    const payload = {
      teacher_id: 'teacher-1',
      day_of_week_id: 'day-mon',
      time_slot_id: 'slot-em',
      classroom_id: 'class-1',
      is_floater: false,
    }
    ;(validateRequest as jest.Mock).mockReturnValue({
      success: true,
      data: payload,
    })
    ;(createTeacherSchedule as jest.Mock).mockResolvedValue({
      id: 'schedule-new',
      school_id: 'school-1',
      ...payload,
    })
    ;(getTeacherScheduleById as jest.Mock).mockResolvedValue({
      id: 'schedule-new',
      school_id: 'school-1',
      ...payload,
      teacher: { first_name: 'Test', last_name: 'Teacher', display_name: null },
      classroom: { name: 'Class 1' },
      day_of_week: { name: 'Monday' },
      time_slot: { code: 'AM' },
    })

    const response = await POST(
      new Request('http://localhost/api/teacher-schedules', {
        method: 'POST',
        body: JSON.stringify(payload),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(createTeacherSchedule).toHaveBeenCalledWith(payload)
    expect(json.id).toBe('schedule-new')
  })

  it('POST routes unexpected failures through createErrorResponse', async () => {
    ;(validateRequest as jest.Mock).mockReturnValue({
      success: true,
      data: {
        teacher_id: 'teacher-1',
        day_of_week_id: 'day-mon',
        time_slot_id: 'slot-em',
        classroom_id: 'class-1',
      },
    })
    ;(createTeacherSchedule as jest.Mock).mockRejectedValue(new Error('insert failed'))

    const response = await POST(
      new Request('http://localhost/api/teacher-schedules', {
        method: 'POST',
        body: JSON.stringify({}),
      }) as any
    )
    const json = await response.json()

    expect(createErrorResponse).toHaveBeenCalled()
    expect(response.status).toBe(500)
    expect(json.error).toBe('Failed to create teacher schedule')
  })
})
