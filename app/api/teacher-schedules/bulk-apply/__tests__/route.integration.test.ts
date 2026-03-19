/** @jest-environment node */

import { NextResponse } from 'next/server'
import { PUT } from '@/app/api/teacher-schedules/bulk-apply/route'
import {
  createTeacherSchedule,
  deleteTeacherSchedule,
  TeacherScheduleConflictError,
  updateTeacherSchedule,
} from '@/lib/api/schedules'
import { createErrorResponse } from '@/lib/utils/errors'
import { validateRequest } from '@/lib/utils/validation'
import { createClient } from '@/lib/supabase/server'

jest.mock('@/lib/api/schedules', () => {
  const actual = jest.requireActual<typeof import('@/lib/api/schedules')>('@/lib/api/schedules')
  return {
    ...actual,
    createTeacherSchedule: jest.fn(),
    deleteTeacherSchedule: jest.fn(),
    updateTeacherSchedule: jest.fn(),
  }
})

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn().mockResolvedValue('school-1'),
}))

jest.mock('@/lib/utils/validation', () => ({
  validateRequest: jest.fn(),
}))

jest.mock('@/lib/utils/errors', () => ({
  createErrorResponse: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

describe('PUT /api/teacher-schedules/bulk-apply integration', () => {
  const eqMock = jest.fn()
  const inFirstMock = jest.fn()
  const inSecondMock = jest.fn()
  const inThirdMock = jest.fn()
  const selectMock = jest.fn()
  const fromMock = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(createErrorResponse as jest.Mock).mockImplementation(
      (_error: unknown, message: string, status: number) =>
        NextResponse.json({ error: message }, { status })
    )

    eqMock.mockReturnValue({ in: inFirstMock })
    inFirstMock.mockReturnValue({ in: inSecondMock })
    inSecondMock.mockReturnValue({ in: inThirdMock })
    selectMock.mockReturnValue({ eq: eqMock })
    fromMock.mockReturnValue({ select: selectMock })
    ;(createClient as jest.Mock).mockResolvedValue({ from: fromMock })
    ;(createTeacherSchedule as jest.Mock).mockImplementation(async payload => ({
      id: `created-${payload.teacher_id}-${payload.day_of_week_id}-${payload.time_slot_id}`,
      ...payload,
    }))
    ;(updateTeacherSchedule as jest.Mock).mockResolvedValue({ id: 'updated-1' })
    ;(deleteTeacherSchedule as jest.Mock).mockResolvedValue(undefined)
  })

  it('applies create/update/delete across target cells and returns summary counts', async () => {
    ;(validateRequest as jest.Mock).mockReturnValue({
      success: true,
      data: {
        target_cells: [
          { classroom_id: 'class-1', day_of_week_id: 'day-1', time_slot_id: 'slot-1' },
          { classroom_id: 'class-1', day_of_week_id: 'day-2', time_slot_id: 'slot-1' },
        ],
        teachers: [{ teacher_id: 'teacher-1', is_floater: true }],
      },
    })
    inThirdMock.mockResolvedValueOnce({
      data: [
        {
          id: 'existing-cell-1',
          teacher_id: 'teacher-1',
          classroom_id: 'class-1',
          day_of_week_id: 'day-1',
          time_slot_id: 'slot-1',
          school_id: 'school-1',
          is_floater: false,
        },
        {
          id: 'existing-cell-2-extra',
          teacher_id: 'teacher-2',
          classroom_id: 'class-1',
          day_of_week_id: 'day-2',
          time_slot_id: 'slot-1',
          school_id: 'school-1',
          is_floater: false,
        },
      ],
      error: null,
    })

    const response = await PUT(
      new Request('http://localhost/api/teacher-schedules/bulk-apply', {
        method: 'PUT',
        body: JSON.stringify({}),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(updateTeacherSchedule).toHaveBeenCalledWith(
      'existing-cell-1',
      { is_floater: true },
      'school-1'
    )
    expect(createTeacherSchedule).toHaveBeenCalledWith({
      teacher_id: 'teacher-1',
      classroom_id: 'class-1',
      day_of_week_id: 'day-2',
      time_slot_id: 'slot-1',
      is_floater: true,
      school_id: 'school-1',
    })
    expect(deleteTeacherSchedule).toHaveBeenCalledWith('existing-cell-2-extra', 'school-1')
    expect(json).toMatchObject({
      target_cell_count: 2,
      teacher_count: 1,
      created_count: 1,
      updated_count: 1,
      deleted_count: 1,
    })
  })

  it('rolls back created records when a later cell fails with conflict', async () => {
    ;(validateRequest as jest.Mock).mockReturnValue({
      success: true,
      data: {
        target_cells: [
          { classroom_id: 'class-1', day_of_week_id: 'day-1', time_slot_id: 'slot-1' },
          { classroom_id: 'class-1', day_of_week_id: 'day-2', time_slot_id: 'slot-1' },
        ],
        teachers: [{ teacher_id: 'teacher-1', is_floater: true }],
      },
    })
    inThirdMock.mockResolvedValueOnce({
      data: [],
      error: null,
    })
    ;(createTeacherSchedule as jest.Mock)
      .mockResolvedValueOnce({
        id: 'created-1',
        teacher_id: 'teacher-1',
      })
      .mockRejectedValueOnce(
        new TeacherScheduleConflictError(
          'This teacher is already scheduled in another room for Tuesday EM.'
        )
      )

    const response = await PUT(
      new Request('http://localhost/api/teacher-schedules/bulk-apply', {
        method: 'PUT',
        body: JSON.stringify({}),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(409)
    expect(json.error).toMatch(/already scheduled/i)
    expect(deleteTeacherSchedule).toHaveBeenCalledWith('created-1', 'school-1')
  })
})
