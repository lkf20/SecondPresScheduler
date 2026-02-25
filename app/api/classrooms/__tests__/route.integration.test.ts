/** @jest-environment node */

import { NextResponse } from 'next/server'
import { GET, POST } from '@/app/api/classrooms/route'
import { getClassrooms, createClassroom, setClassroomAllowedClasses } from '@/lib/api/classrooms'
import { createErrorResponse } from '@/lib/utils/errors'
import { NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'

jest.mock('@/lib/api/classrooms', () => ({
  getClassrooms: jest.fn(),
  createClassroom: jest.fn(),
  setClassroomAllowedClasses: jest.fn(),
}))

jest.mock('@/lib/utils/errors', () => ({
  createErrorResponse: jest.fn(),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

describe('classrooms collection route integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createErrorResponse as jest.Mock).mockImplementation(
      (_error: unknown, message: string, status: number) =>
        NextResponse.json({ error: message }, { status })
    )
  })

  it('GET returns classrooms', async () => {
    ;(getClassrooms as jest.Mock).mockResolvedValue([{ id: 'class-1', name: 'Infant Room' }])

    const response = await GET(new NextRequest('http://localhost/api/classrooms') as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual([{ id: 'class-1', name: 'Infant Room' }])
  })

  it('GET passes includeInactive=true when requested', async () => {
    ;(getClassrooms as jest.Mock).mockResolvedValue([{ id: 'class-2', name: 'Toddler Room' }])

    const response = await GET(
      new NextRequest('http://localhost/api/classrooms?includeInactive=true') as any
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(getClassrooms).toHaveBeenCalledWith(true)
    expect(json).toEqual([{ id: 'class-2', name: 'Toddler Room' }])
  })

  it('GET routes failures through createErrorResponse', async () => {
    ;(getClassrooms as jest.Mock).mockRejectedValue(new Error('read failed'))

    const response = await GET(new NextRequest('http://localhost/api/classrooms') as any)
    const json = await response.json()

    expect(createErrorResponse).toHaveBeenCalled()
    expect(response.status).toBe(500)
    expect(json.error).toBe('Failed to fetch classrooms')
  })

  it('POST creates classroom and sets allowed classes from allowed_class_group_ids', async () => {
    ;(createClassroom as jest.Mock).mockResolvedValue({ id: 'class-1', name: 'Infant Room' })
    ;(setClassroomAllowedClasses as jest.Mock).mockResolvedValue(undefined)

    const response = await POST(
      new Request('http://localhost/api/classrooms', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Infant Room',
          allowed_class_group_ids: ['cg-1', 'cg-2'],
        }),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(createClassroom).toHaveBeenCalledWith({ name: 'Infant Room' })
    expect(setClassroomAllowedClasses).toHaveBeenCalledWith('class-1', ['cg-1', 'cg-2'])
    expect(revalidatePath).toHaveBeenCalled()
    expect(json.id).toBe('class-1')
  })

  it('POST creates classroom and sets allowed classes from allowed_classes fallback', async () => {
    ;(createClassroom as jest.Mock).mockResolvedValue({ id: 'class-2', name: 'Toddler Room' })
    ;(setClassroomAllowedClasses as jest.Mock).mockResolvedValue(undefined)

    const response = await POST(
      new Request('http://localhost/api/classrooms', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Toddler Room',
          allowed_classes: ['cg-3'],
        }),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(setClassroomAllowedClasses).toHaveBeenCalledWith('class-2', ['cg-3'])
    expect(json.id).toBe('class-2')
  })

  it('POST routes failures through createErrorResponse', async () => {
    ;(createClassroom as jest.Mock).mockRejectedValue(new Error('insert failed'))

    const response = await POST(
      new Request('http://localhost/api/classrooms', {
        method: 'POST',
        body: JSON.stringify({ name: 'Infant Room' }),
      }) as any
    )
    const json = await response.json()

    expect(createErrorResponse).toHaveBeenCalled()
    expect(response.status).toBe(500)
    expect(json.error).toBe('Failed to create classroom')
  })
})
