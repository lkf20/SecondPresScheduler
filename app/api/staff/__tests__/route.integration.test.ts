/** @jest-environment node */

import { GET, POST } from '@/app/api/staff/route'
import { getStaff, createStaff } from '@/lib/api/staff'
import { getUserSchoolId } from '@/lib/utils/auth'

jest.mock('@/lib/api/staff', () => ({
  getStaff: jest.fn(),
  createStaff: jest.fn(),
}))

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))

describe('staff collection route integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('GET returns staff list', async () => {
    ;(getStaff as jest.Mock).mockResolvedValue([{ id: 'staff-1', first_name: 'Amy' }])

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(getStaff).toHaveBeenCalled()
    expect(json).toEqual([{ id: 'staff-1', first_name: 'Amy' }])
  })

  it('GET maps not-found errors to 404', async () => {
    ;(getStaff as jest.Mock).mockRejectedValue({ code: 'P0002', message: 'not found' })

    const response = await GET()

    expect(response.status).toBe(404)
  })

  it('POST returns 403 when school id is missing', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue(null)

    const response = await POST(
      new Request('http://localhost/api/staff', {
        method: 'POST',
        body: JSON.stringify({ first_name: 'Amy' }),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(createStaff).not.toHaveBeenCalled()
    expect(json.error).toContain('missing school_id')
  })

  it('POST creates staff with school id', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(createStaff as jest.Mock).mockResolvedValue({ id: 'staff-1', first_name: 'Amy' })

    const response = await POST(
      new Request('http://localhost/api/staff', {
        method: 'POST',
        body: JSON.stringify({ first_name: 'Amy', last_name: 'P', is_teacher: true }),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(createStaff).toHaveBeenCalledWith({
      first_name: 'Amy',
      last_name: 'P',
      is_teacher: true,
      school_id: 'school-1',
    })
    expect(json.id).toBe('staff-1')
  })

  it('POST maps constraint errors to 409', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(createStaff as jest.Mock).mockRejectedValue({ code: '23505', message: 'duplicate key' })

    const response = await POST(
      new Request('http://localhost/api/staff', {
        method: 'POST',
        body: JSON.stringify({ first_name: 'Amy', last_name: 'P', is_teacher: true }),
      }) as any
    )

    expect(response.status).toBe(409)
  })
})
