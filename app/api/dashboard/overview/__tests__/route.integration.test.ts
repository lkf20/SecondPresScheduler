/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/dashboard/overview/route'
import { getUserSchoolId } from '@/lib/utils/auth'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))
jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))
jest.mock('@/lib/api/school-calendar', () => ({
  getCalendarSettings: jest.fn().mockResolvedValue({ last_day_of_school: null }),
  getSchoolClosuresForDateRange: jest.fn().mockResolvedValue([]),
}))

describe('GET /api/dashboard/overview', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
  })

  it('returns 403 when user has no school context', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValueOnce(null)
    const request = new NextRequest(
      'http://localhost:3000/api/dashboard/overview?start_date=2026-02-01&end_date=2026-02-14'
    )
    const response = await GET(request)
    const json = await response.json()
    expect(response.status).toBe(403)
    expect(json.error).toMatch(/school/i)
  })

  it('returns 400 when start_date or end_date missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/dashboard/overview')
    const response = await GET(request)
    const json = await response.json()
    expect(response.status).toBe(400)
    expect(json.error).toMatch(/start_date|end_date/i)
  })
})
