/** @jest-environment node */

import { NextResponse } from 'next/server'
import { GET, POST } from '@/app/api/class-groups/route'
import { getClassGroups, createClassGroup } from '@/lib/api/class-groups'
import { createErrorResponse } from '@/lib/utils/errors'
import { revalidatePath } from 'next/cache'
import { NextRequest } from 'next/server'

jest.mock('@/lib/api/class-groups', () => ({
  getClassGroups: jest.fn(),
  createClassGroup: jest.fn(),
}))

jest.mock('@/lib/utils/errors', () => ({
  createErrorResponse: jest.fn(),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

describe('class groups collection route integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createErrorResponse as jest.Mock).mockImplementation(
      (_error: unknown, message: string, status: number) =>
        NextResponse.json({ error: message }, { status })
    )
  })

  it('GET returns class groups', async () => {
    ;(getClassGroups as jest.Mock).mockResolvedValue([{ id: 'cg-1', name: 'Infant A' }])

    const response = await GET(new NextRequest('http://localhost/api/class-groups') as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual([{ id: 'cg-1', name: 'Infant A' }])
  })

  it('GET routes failures through createErrorResponse', async () => {
    ;(getClassGroups as jest.Mock).mockRejectedValue(new Error('read failed'))

    const response = await GET(new NextRequest('http://localhost/api/class-groups') as any)
    const json = await response.json()

    expect(createErrorResponse).toHaveBeenCalled()
    expect(response.status).toBe(500)
    expect(json.error).toBe('Failed to fetch class groups')
  })

  it('POST creates class group', async () => {
    ;(createClassGroup as jest.Mock).mockResolvedValue({ id: 'cg-2', name: 'Toddler B' })

    const response = await POST(
      new Request('http://localhost/api/class-groups', {
        method: 'POST',
        body: JSON.stringify({ name: 'Toddler B' }),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(createClassGroup).toHaveBeenCalledWith({ name: 'Toddler B' })
    expect(revalidatePath).toHaveBeenCalled()
    expect(json.id).toBe('cg-2')
  })

  it('POST routes failures through createErrorResponse', async () => {
    ;(createClassGroup as jest.Mock).mockRejectedValue(new Error('insert failed'))

    const response = await POST(
      new Request('http://localhost/api/class-groups', {
        method: 'POST',
        body: JSON.stringify({ name: 'Toddler B' }),
      }) as any
    )
    const json = await response.json()

    expect(createErrorResponse).toHaveBeenCalled()
    expect(response.status).toBe(500)
    expect(json.error).toBe('Failed to create class group')
  })
})
