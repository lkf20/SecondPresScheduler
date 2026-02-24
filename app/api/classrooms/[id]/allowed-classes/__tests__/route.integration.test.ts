/** @jest-environment node */

import { GET, PUT } from '@/app/api/classrooms/[id]/allowed-classes/route'
import { getClassroomAllowedClasses, setClassroomAllowedClasses } from '@/lib/api/classrooms'

jest.mock('@/lib/api/classrooms', () => ({
  getClassroomAllowedClasses: jest.fn(),
  setClassroomAllowedClasses: jest.fn(),
}))

describe('classrooms allowed-classes route integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('GET returns class group ids for classroom', async () => {
    ;(getClassroomAllowedClasses as jest.Mock).mockResolvedValue(['cg-1', 'cg-2'])

    const response = await GET(
      new Request('http://localhost/api/classrooms/class-1/allowed-classes') as any,
      {
        params: Promise.resolve({ id: 'class-1' }),
      }
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(getClassroomAllowedClasses).toHaveBeenCalledWith('class-1')
    expect(json).toEqual(['cg-1', 'cg-2'])
  })

  it('PUT validates class_group_ids is an array', async () => {
    const response = await PUT(
      new Request('http://localhost/api/classrooms/class-1/allowed-classes', {
        method: 'PUT',
        body: JSON.stringify({ class_group_ids: 'invalid' }),
      }) as any,
      {
        params: Promise.resolve({ id: 'class-1' }),
      }
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/must be an array/i)
  })

  it('PUT updates class group ids for classroom', async () => {
    ;(setClassroomAllowedClasses as jest.Mock).mockResolvedValue(undefined)

    const response = await PUT(
      new Request('http://localhost/api/classrooms/class-1/allowed-classes', {
        method: 'PUT',
        body: JSON.stringify({ class_group_ids: ['cg-1'] }),
      }) as any,
      {
        params: Promise.resolve({ id: 'class-1' }),
      }
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(setClassroomAllowedClasses).toHaveBeenCalledWith('class-1', ['cg-1'])
    expect(json).toEqual({ success: true })
  })
})
