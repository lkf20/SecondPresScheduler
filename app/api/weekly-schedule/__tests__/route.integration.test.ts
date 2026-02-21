/** @jest-environment node */

import { GET } from '@/app/api/weekly-schedule/route'
import { getWeeklyScheduleData } from '@/lib/api/weekly-schedule'
import { getScheduleSettings } from '@/lib/api/schedule-settings'
import { getUserSchoolId } from '@/lib/utils/auth'

jest.mock('@/lib/api/weekly-schedule', () => ({
  getWeeklyScheduleData: jest.fn(),
}))

jest.mock('@/lib/api/schedule-settings', () => ({
  getScheduleSettings: jest.fn(),
}))

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))

describe('GET /api/weekly-schedule integration', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  it('returns 403 when school context is missing', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue(null)

    const response = await GET(new Request('http://localhost:3000/api/weekly-schedule'))
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error).toMatch(/missing school_id|profile/i)
  })

  it('loads weekly data with selected days from settings', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({
      selected_day_ids: ['day-mon', 'day-wed'],
    })
    ;(getWeeklyScheduleData as jest.Mock).mockResolvedValue([{ classroom_id: 'class-1' }])

    const response = await GET(
      new Request('http://localhost:3000/api/weekly-schedule?weekStartISO=2026-03-02')
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(getWeeklyScheduleData).toHaveBeenCalledWith(
      'school-1',
      ['day-mon', 'day-wed'],
      '2026-03-02'
    )
    expect(json).toEqual([{ classroom_id: 'class-1' }])
  })

  it('falls back to all days when settings lookup fails', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockRejectedValue(new Error('table missing'))
    ;(getWeeklyScheduleData as jest.Mock).mockResolvedValue([{ classroom_id: 'class-1' }])

    const response = await GET(
      new Request('http://localhost:3000/api/weekly-schedule?weekStartISO=2026-03-09')
    )

    expect(response.status).toBe(200)
    expect(getWeeklyScheduleData).toHaveBeenCalledWith('school-1', undefined, '2026-03-09')
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/could not load schedule settings/i),
      'table missing'
    )
  })

  it('returns 500 and includes stack details in development', async () => {
    const previousNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({ selected_day_ids: [] })
    ;(getWeeklyScheduleData as jest.Mock).mockRejectedValue(new Error('weekly query failed'))

    const response = await GET(new Request('http://localhost:3000/api/weekly-schedule'))
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toMatch(/weekly query failed/i)
    expect(json.details).toBeTruthy()
    expect(errorSpy).toHaveBeenCalledWith('Error fetching weekly schedule:', expect.any(Error))

    process.env.NODE_ENV = previousNodeEnv
  })
})
