/** @jest-environment node */

import { GET, PUT, DELETE } from '@/app/api/classrooms/[id]/route'
import {
  getClassroomById,
  updateClassroom,
  deleteClassroom,
  setClassroomAllowedClasses,
} from '@/lib/api/classrooms'
import { revalidatePath } from 'next/cache'

jest.mock('@/lib/api/classrooms', () => ({
  getClassroomById: jest.fn(),
  updateClassroom: jest.fn(),
  deleteClassroom: jest.fn(),
  setClassroomAllowedClasses: jest.fn(),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

describe('classrooms id route integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('GET returns classroom by id', async () => {
    ;(getClassroomById as jest.Mock).mockResolvedValue({ id: 'class-1', name: 'Infant Room' })

    const response = await GET(new Request('http://localhost/api/classrooms/class-1') as any, {
      params: Promise.resolve({ id: 'class-1' }),
    })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(getClassroomById).toHaveBeenCalledWith('class-1')
    expect(json.id).toBe('class-1')
  })

  it('GET returns 500 when fetch fails', async () => {
    ;(getClassroomById as jest.Mock).mockRejectedValue(new Error('fetch failed'))

    const response = await GET(new Request('http://localhost/api/classrooms/class-1') as any, {
      params: Promise.resolve({ id: 'class-1' }),
    })
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe('fetch failed')
  })

  it('PUT updates classroom and allowed classes via allowed_class_group_ids', async () => {
    ;(updateClassroom as jest.Mock).mockResolvedValue({ id: 'class-1', name: 'Updated Room' })
    ;(setClassroomAllowedClasses as jest.Mock).mockResolvedValue(undefined)

    const response = await PUT(
      new Request('http://localhost/api/classrooms/class-1', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Room',
          allowed_class_group_ids: ['cg-1', 'cg-2'],
        }),
      }) as any,
      {
        params: Promise.resolve({ id: 'class-1' }),
      }
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(updateClassroom).toHaveBeenCalledWith('class-1', { name: 'Updated Room' })
    expect(setClassroomAllowedClasses).toHaveBeenCalledWith('class-1', ['cg-1', 'cg-2'])
    expect(revalidatePath).toHaveBeenCalled()
    expect(json.name).toBe('Updated Room')
  })

  it('PUT updates classroom and allowed classes via allowed_classes fallback', async () => {
    ;(updateClassroom as jest.Mock).mockResolvedValue({ id: 'class-1', name: 'Updated Room' })
    ;(setClassroomAllowedClasses as jest.Mock).mockResolvedValue(undefined)

    const response = await PUT(
      new Request('http://localhost/api/classrooms/class-1', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Room',
          allowed_classes: ['cg-3'],
        }),
      }) as any,
      {
        params: Promise.resolve({ id: 'class-1' }),
      }
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(setClassroomAllowedClasses).toHaveBeenCalledWith('class-1', ['cg-3'])
    expect(json.name).toBe('Updated Room')
  })

  it('PUT sets empty allowed classes when invalid allowed class payload is provided', async () => {
    ;(updateClassroom as jest.Mock).mockResolvedValue({ id: 'class-1', name: 'Updated Room' })
    ;(setClassroomAllowedClasses as jest.Mock).mockResolvedValue(undefined)

    await PUT(
      new Request('http://localhost/api/classrooms/class-1', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Room',
          allowed_class_group_ids: 'invalid',
        }),
      }) as any,
      {
        params: Promise.resolve({ id: 'class-1' }),
      }
    )

    expect(setClassroomAllowedClasses).toHaveBeenCalledWith('class-1', [])
  })

  it('DELETE removes classroom by id', async () => {
    ;(deleteClassroom as jest.Mock).mockResolvedValue(undefined)

    const response = await DELETE(
      new Request('http://localhost/api/classrooms/class-1', { method: 'DELETE' }) as any,
      {
        params: Promise.resolve({ id: 'class-1' }),
      }
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(deleteClassroom).toHaveBeenCalledWith('class-1')
    expect(revalidatePath).toHaveBeenCalled()
    expect(json).toEqual({ success: true })
  })

  it('PUT returns 500 when update throws', async () => {
    ;(updateClassroom as jest.Mock).mockRejectedValue(new Error('update failed'))

    const response = await PUT(
      new Request('http://localhost/api/classrooms/class-1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Room' }),
      }) as any,
      {
        params: Promise.resolve({ id: 'class-1' }),
      }
    )
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe('update failed')
  })

  it('DELETE returns 500 when delete throws', async () => {
    ;(deleteClassroom as jest.Mock).mockRejectedValue(new Error('delete failed'))

    const response = await DELETE(
      new Request('http://localhost/api/classrooms/class-1', { method: 'DELETE' }) as any,
      {
        params: Promise.resolve({ id: 'class-1' }),
      }
    )
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe('delete failed')
  })
})
