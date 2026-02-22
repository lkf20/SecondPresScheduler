/** @jest-environment node */

import { GET, PUT } from '@/app/api/schedule-settings/route'
import { getScheduleSettings, updateScheduleSettings } from '@/lib/api/schedule-settings'
import { getUserSchoolId } from '@/lib/utils/auth'

jest.mock('@/lib/api/schedule-settings', () => ({
  getScheduleSettings: jest.fn(),
  updateScheduleSettings: jest.fn(),
}))

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))

describe('schedule settings route integration', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('GET returns 403 when school context is missing', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue(null)

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error).toMatch(/missing school_id/i)
  })

  it('GET returns defaults when settings are not found', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue(null)

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({
      selected_day_ids: [],
      default_display_name_format: 'first_last_initial',
      time_zone: 'UTC',
    })
  })

  it('GET returns fetched settings', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({
      selected_day_ids: ['day-mon'],
      default_display_name_format: 'first_name',
      time_zone: 'America/New_York',
    })

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(getScheduleSettings).toHaveBeenCalledWith('school-1')
    expect(json.selected_day_ids).toEqual(['day-mon'])
  })

  it('PUT validates selected_day_ids type', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')

    const response = await PUT(
      new Request('http://localhost/api/schedule-settings', {
        method: 'PUT',
        body: JSON.stringify({ selected_day_ids: 'day-mon' }),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/must be an array/i)
  })

  it('PUT returns 403 when school context is missing', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue(null)

    const response = await PUT(
      new Request('http://localhost/api/schedule-settings', {
        method: 'PUT',
        body: JSON.stringify({ selected_day_ids: [] }),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error).toMatch(/missing school_id/i)
  })

  it('PUT validates display name format values', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')

    const response = await PUT(
      new Request('http://localhost/api/schedule-settings', {
        method: 'PUT',
        body: JSON.stringify({
          selected_day_ids: [],
          default_display_name_format: 'invalid',
        }),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/Invalid display name format/i)
  })

  it('PUT updates settings for valid payload', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(updateScheduleSettings as jest.Mock).mockResolvedValue({
      selected_day_ids: ['day-mon', 'day-tue'],
      default_display_name_format: 'first_last',
      time_zone: 'UTC',
    })

    const response = await PUT(
      new Request('http://localhost/api/schedule-settings', {
        method: 'PUT',
        body: JSON.stringify({
          selected_day_ids: ['day-mon', 'day-tue'],
          default_display_name_format: 'first_last',
          time_zone: 'UTC',
        }),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(updateScheduleSettings).toHaveBeenCalledWith(
      'school-1',
      ['day-mon', 'day-tue'],
      'first_last',
      'UTC'
    )
    expect(json.selected_day_ids).toEqual(['day-mon', 'day-tue'])
  })

  it('GET returns 500 when fetch throws', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockRejectedValue(new Error('fetch failed'))

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe('fetch failed')
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('PUT returns 500 when update throws', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(updateScheduleSettings as jest.Mock).mockRejectedValue(new Error('update failed'))

    const response = await PUT(
      new Request('http://localhost/api/schedule-settings', {
        method: 'PUT',
        body: JSON.stringify({
          selected_day_ids: ['day-mon'],
          default_display_name_format: 'first_name',
          time_zone: 'UTC',
        }),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe('update failed')
  })
})
