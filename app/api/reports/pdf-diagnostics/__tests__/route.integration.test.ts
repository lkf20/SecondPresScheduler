/** @jest-environment node */

import { GET } from '@/app/api/reports/pdf-diagnostics/route'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getPuppeteerLaunchDiagnostics } from '@/lib/reports/puppeteer-launch'

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))

jest.mock('@/lib/reports/puppeteer-launch', () => ({
  getPuppeteerLaunchDiagnostics: jest.fn(),
}))

describe('GET /api/reports/pdf-diagnostics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns diagnostics payload for authenticated user', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getPuppeteerLaunchDiagnostics as jest.Mock).mockReturnValue({
      runtime: { cwd: '/var/task' },
      cacheRoots: [],
    })

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.diagnostics).toEqual({
      runtime: { cwd: '/var/task' },
      cacheRoots: [],
    })
    expect(typeof json.checked_at).toBe('string')
  })

  it('returns 403 when school id is unavailable', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue(null)

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error).toMatch(/missing school_id/i)
  })
})
