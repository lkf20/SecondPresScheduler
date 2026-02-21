/** @jest-environment node */

import { GET, PUT, DELETE } from '@/app/api/teacher-schedules/[id]/route'
import {
  getTeacherScheduleById,
  updateTeacherSchedule,
  deleteTeacherSchedule,
} from '@/lib/api/schedules'

jest.mock('@/lib/api/schedules', () => ({
  getTeacherScheduleById: jest.fn(),
  updateTeacherSchedule: jest.fn(),
  deleteTeacherSchedule: jest.fn(),
}))

describe('teacher schedules id route integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('GET returns schedule by id', async () => {
    ;(getTeacherScheduleById as jest.Mock).mockResolvedValue({
      id: 'schedule-1',
      teacher_id: 'teacher-1',
    })

    const response = await GET(new Request('http://localhost/api/teacher-schedules/schedule-1'), {
      params: Promise.resolve({ id: 'schedule-1' }),
    })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(getTeacherScheduleById).toHaveBeenCalledWith('schedule-1')
    expect(json).toEqual({ id: 'schedule-1', teacher_id: 'teacher-1' })
  })

  it('GET returns 404 when lookup fails', async () => {
    ;(getTeacherScheduleById as jest.Mock).mockRejectedValue(new Error('Not found'))

    const response = await GET(new Request('http://localhost/api/teacher-schedules/missing'), {
      params: Promise.resolve({ id: 'missing' }),
    })
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toBe('Not found')
  })

  it('PUT returns updated schedule', async () => {
    ;(updateTeacherSchedule as jest.Mock).mockResolvedValue({
      id: 'schedule-1',
      is_floater: true,
    })

    const response = await PUT(
      new Request('http://localhost/api/teacher-schedules/schedule-1', {
        method: 'PUT',
        body: JSON.stringify({ is_floater: true }),
      }),
      {
        params: Promise.resolve({ id: 'schedule-1' }),
      }
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(updateTeacherSchedule).toHaveBeenCalledWith('schedule-1', { is_floater: true })
    expect(json).toEqual({ id: 'schedule-1', is_floater: true })
  })

  it('PUT returns 404 when schedule cannot be updated', async () => {
    ;(updateTeacherSchedule as jest.Mock).mockResolvedValue(null)

    const response = await PUT(
      new Request('http://localhost/api/teacher-schedules/schedule-1', {
        method: 'PUT',
        body: JSON.stringify({ is_floater: true }),
      }),
      {
        params: Promise.resolve({ id: 'schedule-1' }),
      }
    )
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toMatch(/not found/i)
  })

  it('PUT returns 500 when update throws', async () => {
    ;(updateTeacherSchedule as jest.Mock).mockRejectedValue(new Error('update failed'))

    const response = await PUT(
      new Request('http://localhost/api/teacher-schedules/schedule-1', {
        method: 'PUT',
        body: JSON.stringify({ is_floater: true }),
      }),
      {
        params: Promise.resolve({ id: 'schedule-1' }),
      }
    )
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe('update failed')
  })

  it('DELETE returns success payload', async () => {
    ;(deleteTeacherSchedule as jest.Mock).mockResolvedValue(undefined)

    const response = await DELETE(
      new Request('http://localhost/api/teacher-schedules/schedule-1', { method: 'DELETE' }),
      {
        params: Promise.resolve({ id: 'schedule-1' }),
      }
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(deleteTeacherSchedule).toHaveBeenCalledWith('schedule-1')
    expect(json).toEqual({ success: true })
  })

  it('DELETE returns 500 when delete throws', async () => {
    ;(deleteTeacherSchedule as jest.Mock).mockRejectedValue(new Error('delete failed'))

    const response = await DELETE(
      new Request('http://localhost/api/teacher-schedules/schedule-1', { method: 'DELETE' }),
      {
        params: Promise.resolve({ id: 'schedule-1' }),
      }
    )
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe('delete failed')
  })
})
