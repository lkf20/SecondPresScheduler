/** @jest-environment node */

import { NextResponse } from 'next/server'
import { GET, PUT, DELETE } from '@/app/api/class-groups/[id]/route'
import { getClassGroupById, updateClassGroup, deleteClassGroup } from '@/lib/api/class-groups'
import { createErrorResponse } from '@/lib/utils/errors'
import { revalidatePath } from 'next/cache'

jest.mock('@/lib/api/class-groups', () => ({
  getClassGroupById: jest.fn(),
  updateClassGroup: jest.fn(),
  deleteClassGroup: jest.fn(),
}))

jest.mock('@/lib/utils/errors', () => ({
  createErrorResponse: jest.fn(),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

describe('class groups id route integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createErrorResponse as jest.Mock).mockImplementation(
      (_error: unknown, message: string, status: number) =>
        NextResponse.json({ error: message }, { status })
    )
  })

  it('GET returns class group by id', async () => {
    ;(getClassGroupById as jest.Mock).mockResolvedValue({ id: 'cg-1', name: 'Infant A' })

    const response = await GET(new Request('http://localhost/api/class-groups/cg-1') as any, {
      params: Promise.resolve({ id: 'cg-1' }),
    })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(getClassGroupById).toHaveBeenCalledWith('cg-1')
    expect(json.id).toBe('cg-1')
  })

  it('GET routes failures through createErrorResponse', async () => {
    ;(getClassGroupById as jest.Mock).mockRejectedValue(new Error('fetch failed'))

    const response = await GET(new Request('http://localhost/api/class-groups/cg-1') as any, {
      params: Promise.resolve({ id: 'cg-1' }),
    })
    const json = await response.json()

    expect(createErrorResponse).toHaveBeenCalled()
    expect(response.status).toBe(500)
    expect(json.error).toBe('Failed to fetch class group')
  })

  it('PUT updates class group by id', async () => {
    ;(updateClassGroup as jest.Mock).mockResolvedValue({ id: 'cg-1', name: 'Updated Group' })

    const response = await PUT(
      new Request('http://localhost/api/class-groups/cg-1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Group' }),
      }) as any,
      {
        params: Promise.resolve({ id: 'cg-1' }),
      }
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(updateClassGroup).toHaveBeenCalledWith('cg-1', { name: 'Updated Group' })
    expect(revalidatePath).toHaveBeenCalled()
    expect(json.name).toBe('Updated Group')
  })

  it('DELETE removes class group by id', async () => {
    ;(deleteClassGroup as jest.Mock).mockResolvedValue(undefined)

    const response = await DELETE(
      new Request('http://localhost/api/class-groups/cg-1', { method: 'DELETE' }) as any,
      {
        params: Promise.resolve({ id: 'cg-1' }),
      }
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(deleteClassGroup).toHaveBeenCalledWith('cg-1')
    expect(revalidatePath).toHaveBeenCalled()
    expect(json).toEqual({ success: true })
  })
})
