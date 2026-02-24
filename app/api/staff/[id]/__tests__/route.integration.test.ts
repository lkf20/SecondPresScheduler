/** @jest-environment node */

import { GET, PUT, DELETE } from '@/app/api/staff/[id]/route'
import { getStaffById, updateStaff, deactivateStaff } from '@/lib/api/staff'

jest.mock('@/lib/api/staff', () => ({
  getStaffById: jest.fn(),
  updateStaff: jest.fn(),
  deactivateStaff: jest.fn(),
}))

describe('staff id route integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('GET returns staff by id', async () => {
    ;(getStaffById as jest.Mock).mockResolvedValue({ id: 'staff-1', first_name: 'Amy' })

    const response = await GET(new Request('http://localhost/api/staff/staff-1') as any, {
      params: Promise.resolve({ id: 'staff-1' }),
    })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(getStaffById).toHaveBeenCalledWith('staff-1')
    expect(json.id).toBe('staff-1')
  })

  it('PUT updates staff by id', async () => {
    ;(updateStaff as jest.Mock).mockResolvedValue({ id: 'staff-1', active: false })

    const response = await PUT(
      new Request('http://localhost/api/staff/staff-1', {
        method: 'PUT',
        body: JSON.stringify({ active: false }),
      }) as any,
      { params: Promise.resolve({ id: 'staff-1' }) }
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(updateStaff).toHaveBeenCalledWith('staff-1', { active: false })
    expect(json.active).toBe(false)
  })

  it('DELETE delegates to deactivateStaff', async () => {
    ;(deactivateStaff as jest.Mock).mockResolvedValue(undefined)

    const response = await DELETE(
      new Request('http://localhost/api/staff/staff-1', { method: 'DELETE' }) as any,
      { params: Promise.resolve({ id: 'staff-1' }) }
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(deactivateStaff).toHaveBeenCalledWith('staff-1')
    expect(json).toEqual({ success: true })
  })

  it('DELETE maps not-found errors to 404', async () => {
    ;(deactivateStaff as jest.Mock).mockRejectedValue({ code: 'P0002', message: 'not found' })

    const response = await DELETE(
      new Request('http://localhost/api/staff/staff-1', { method: 'DELETE' }) as any,
      { params: Promise.resolve({ id: 'staff-1' }) }
    )

    expect(response.status).toBe(404)
  })
})
