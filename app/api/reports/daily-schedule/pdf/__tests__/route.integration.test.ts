/** @jest-environment node */

import { GET } from '@/app/api/reports/daily-schedule/pdf/route'
import { getUserSchoolId } from '@/lib/utils/auth'
import { filterActiveDailyScheduleData, resolveDailyScheduleDay } from '@/lib/api/daily-schedule'
import { getScheduleSnapshotData } from '@/lib/api/weekly-schedule'
import { getSchoolClosuresForDateRange } from '@/lib/api/school-calendar'
import {
  buildDailyScheduleFilename,
  buildDailySchedulePdfHtml,
} from '@/lib/reports/daily-schedule-pdf'
import { formatGeneratedAt, truncateRichText } from '@/lib/reports/rich-text'
import { launchPdfBrowser } from '@/lib/reports/puppeteer-launch'

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))

jest.mock('@/lib/api/daily-schedule', () => ({
  resolveDailyScheduleDay: jest.fn(),
  filterActiveDailyScheduleData: jest.fn((rows: unknown[]) => rows),
}))

jest.mock('@/lib/api/weekly-schedule', () => ({
  getScheduleSnapshotData: jest.fn(),
}))

jest.mock('@/lib/api/school-calendar', () => ({
  getSchoolClosuresForDateRange: jest.fn(),
}))

jest.mock('@/lib/reports/daily-schedule-pdf', () => ({
  buildDailyScheduleFilename: jest.fn(() => 'daily-schedule-2026-03-09.pdf'),
  buildDailySchedulePdfHtml: jest.fn(() => '<html><body>PDF</body></html>'),
}))

jest.mock('@/lib/reports/rich-text', () => ({
  MAX_FOOTER_NOTES_HTML: 1000,
  MAX_TOP_HEADER_HTML: 1000,
  formatGeneratedAt: jest.fn(() => 'Mar 9, 2026'),
  truncateRichText: jest.fn((value: string | null) => value),
}))

jest.mock('@/lib/reports/puppeteer-launch', () => ({
  launchPdfBrowser: jest.fn(),
}))

describe('GET /api/reports/daily-schedule/pdf', () => {
  const setContentMock = jest.fn()
  const pdfMock = jest.fn()
  const closeMock = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(resolveDailyScheduleDay as jest.Mock).mockResolvedValue({
      noSchedule: false,
      dayId: 'day-mon',
      timeZone: 'America/New_York',
    })
    ;(getScheduleSnapshotData as jest.Mock).mockResolvedValue([])
    ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([])
    ;(filterActiveDailyScheduleData as jest.Mock).mockImplementation((rows: unknown[]) => rows)
    ;(buildDailySchedulePdfHtml as jest.Mock).mockReturnValue('<html><body>PDF</body></html>')
    ;(formatGeneratedAt as jest.Mock).mockReturnValue('Mar 9, 2026')
    ;(truncateRichText as jest.Mock).mockImplementation((value: string | null) => value)

    setContentMock.mockResolvedValue(undefined)
    pdfMock.mockResolvedValue(Buffer.from('fake-pdf'))
    closeMock.mockResolvedValue(undefined)
    ;(launchPdfBrowser as jest.Mock).mockResolvedValue({
      newPage: jest.fn().mockResolvedValue({
        setContent: setContentMock,
        pdf: pdfMock,
      }),
      close: closeMock,
    })
  })

  it('returns a PDF response on success', async () => {
    const response = await GET(
      new Request('http://localhost/api/reports/daily-schedule/pdf?date=2026-03-09')
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(launchPdfBrowser).toHaveBeenCalled()
    expect(setContentMock).toHaveBeenCalled()
    expect(pdfMock).toHaveBeenCalled()
    expect(buildDailyScheduleFilename).toHaveBeenCalledWith('2026-03-09')
  })

  it('returns 403 when school id is unavailable', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue(null)

    const response = await GET(
      new Request('http://localhost/api/reports/daily-schedule/pdf?date=2026-03-09')
    )
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error).toMatch(/missing school_id/i)
  })

  it('returns 400 when date is missing', async () => {
    const response = await GET(new Request('http://localhost/api/reports/daily-schedule/pdf'))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/invalid date parameter/i)
    expect(launchPdfBrowser).not.toHaveBeenCalled()
  })

  it('returns 500 when browser launch fails', async () => {
    ;(launchPdfBrowser as jest.Mock).mockRejectedValue(new Error('browser failed'))

    const response = await GET(
      new Request('http://localhost/api/reports/daily-schedule/pdf?date=2026-03-09')
    )
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toMatch(/failed/i)
  })

  it('falls back to domcontentloaded when networkidle0 times out', async () => {
    setContentMock
      .mockRejectedValueOnce(new Error('Timed out after waiting 30000ms'))
      .mockResolvedValueOnce(undefined)

    const response = await GET(
      new Request('http://localhost/api/reports/daily-schedule/pdf?date=2026-03-09')
    )

    expect(response.status).toBe(200)
    expect(setContentMock).toHaveBeenCalledTimes(2)
    expect(setContentMock).toHaveBeenNthCalledWith(
      1,
      '<html><body>PDF</body></html>',
      expect.objectContaining({ waitUntil: 'networkidle0' })
    )
    expect(setContentMock).toHaveBeenNthCalledWith(
      2,
      '<html><body>PDF</body></html>',
      expect.objectContaining({ waitUntil: 'domcontentloaded' })
    )
  })
})
