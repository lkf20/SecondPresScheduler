/** @jest-environment node */

import { GET } from '@/app/api/time-off/existing-shifts/route'
import { getTeacherTimeOffShifts } from '@/lib/api/time-off-shifts'

jest.mock('@/lib/api/time-off-shifts', () => ({
  getTeacherTimeOffShifts: jest.fn(),
}))

describe('GET /api/time-off/existing-shifts integration', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns 400 when required query params are missing', async () => {
    const request = {
      nextUrl: new URL('http://localhost:3000/api/time-off/existing-shifts'),
    }

    const response = await GET(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/missing required parameters/i)
  })

  it('returns shifts payload when params are valid', async () => {
    ;(getTeacherTimeOffShifts as jest.Mock).mockResolvedValueOnce([
      {
        date: '2026-02-10',
        time_slot_id: 'slot-1',
      },
    ])

    const request = {
      nextUrl: new URL(
        'http://localhost:3000/api/time-off/existing-shifts?teacher_id=teacher-1&start_date=2026-02-10&end_date=2026-02-10'
      ),
    }

    const response = await GET(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(getTeacherTimeOffShifts).toHaveBeenCalledWith(
      'teacher-1',
      '2026-02-10',
      '2026-02-10',
      undefined
    )
    expect(json.shifts).toHaveLength(1)
  })
})
