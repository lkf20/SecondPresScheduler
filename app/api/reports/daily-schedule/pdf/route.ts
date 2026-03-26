import { NextResponse } from 'next/server'
import { getScheduleSnapshotData } from '@/lib/api/weekly-schedule'
import { getSchoolClosuresForDateRange } from '@/lib/api/school-calendar'
import { getUserSchoolId } from '@/lib/utils/auth'
import {
  buildDailyScheduleFilename,
  buildDailySchedulePdfHtml,
} from '@/lib/reports/daily-schedule-pdf'
import {
  MAX_FOOTER_NOTES_HTML,
  MAX_TOP_HEADER_HTML,
  formatGeneratedAt,
  truncateRichText,
} from '@/lib/reports/rich-text'
import { filterActiveDailyScheduleData, resolveDailyScheduleDay } from '@/lib/api/daily-schedule'
import { launchPdfBrowser } from '@/lib/reports/puppeteer-launch'
import { runPdfStep, type PdfTraceStep } from '@/lib/reports/pdf-trace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const parseDateParam = (value: string | null) => {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(value + 'T00:00:00')
  if (Number.isNaN(date.getTime())) return null
  return date
}

const parseBoolean = (value: string | null, fallback: boolean) => {
  if (value === null) return fallback
  return value === 'true' || value === '1'
}

const parseLayout = (value: string | null) => {
  if (value === 'two') return 'two'
  return 'one'
}

const parseTeacherNameFormat = (value: string | null) => {
  if (value === 'default' || value === 'first_last') return value
  return 'default'
}

const parsePaperSize = (value: string | null): 'letter' | 'legal' => {
  if (value === 'legal') return 'legal'
  return 'letter'
}

const parseTopHeaderHtml = (value: string | null) => truncateRichText(value, MAX_TOP_HEADER_HTML)
const parseFooterNotesHtml = (value: string | null) =>
  truncateRichText(value, MAX_FOOTER_NOTES_HTML)
const parseDebugPdf = (value: string | null) => value === '1' || value === 'true'

const configurePageTimeouts = (page: {
  setDefaultNavigationTimeout?: (timeout: number) => void
  setDefaultTimeout?: (timeout: number) => void
}) => {
  if (typeof page.setDefaultNavigationTimeout === 'function') {
    page.setDefaultNavigationTimeout(0)
  }
  if (typeof page.setDefaultTimeout === 'function') {
    page.setDefaultTimeout(0)
  }
}

const setPdfContentWithFallback = async (page: { setContent: Function }, html: string) => {
  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const isTimeout =
      /Timed out after waiting/i.test(message) || /Navigation timeout/i.test(message)
    if (!isTimeout) throw error
    // Fallback for environments where networkidle can hang despite fully-inline HTML.
    try {
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 })
    } catch (fallbackError) {
      const fallbackMessage =
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      const fallbackIsTimeout =
        /Timed out after waiting/i.test(fallbackMessage) ||
        /Navigation timeout/i.test(fallbackMessage)
      if (!fallbackIsTimeout) throw fallbackError
      // Last-resort path for local/dev environments where lifecycle events can stall.
      await page.setContent(html, { timeout: 0 })
    }
  }
}

export async function GET(request: Request) {
  const pdfTrace: PdfTraceStep[] = []
  let debugPdf = false
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json(
        {
          error:
            'User profile not found or missing school_id. Please ensure your profile is set up.',
        },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const date = parseDateParam(dateParam)
    if (!date || !dateParam) {
      return NextResponse.json({ error: 'Missing or invalid date parameter.' }, { status: 400 })
    }

    const showAbsencesAndSubs = parseBoolean(searchParams.get('showAbsencesAndSubs'), true)
    const showEnrollment = parseBoolean(searchParams.get('showEnrollment'), false)
    const showNotes = parseBoolean(searchParams.get('showNotes'), false)
    const legacyShowRatios = parseBoolean(searchParams.get('showRatios'), false)
    const showPreferredRatios = parseBoolean(
      searchParams.get('showPreferredRatios'),
      legacyShowRatios
    )
    const showRequiredRatios = parseBoolean(
      searchParams.get('showRequiredRatios'),
      legacyShowRatios
    )
    const colorFriendly = parseBoolean(searchParams.get('colorFriendly'), false)
    const layout = parseLayout(searchParams.get('layout'))
    const teacherNameFormat = parseTeacherNameFormat(searchParams.get('teacherNameFormat'))
    const paperSize = parsePaperSize(searchParams.get('paperSize'))
    const topHeaderHtml = parseTopHeaderHtml(searchParams.get('topHeaderHtml'))
    const footerNotesHtml = parseFooterNotesHtml(searchParams.get('footerNotesHtml'))
    debugPdf = parseDebugPdf(searchParams.get('debugPdf'))

    const dayResolution = await resolveDailyScheduleDay(schoolId, dateParam, date)
    if (dayResolution.noSchedule) {
      return NextResponse.json(
        {
          error: dayResolution.message,
          no_schedule: true,
          next_scheduled_date: dayResolution.nextScheduledDate,
          next_scheduled_day_name: dayResolution.nextScheduledDayName,
        },
        { status: 400 }
      )
    }

    const timeZone = dayResolution.timeZone
    const [data, schoolClosures] = await Promise.all([
      getScheduleSnapshotData({
        schoolId,
        selectedDayIds: [dayResolution.dayId],
        startDateISO: dateParam,
        endDateISO: dateParam,
      }),
      getSchoolClosuresForDateRange(schoolId, dateParam, dateParam),
    ])

    const filteredData = filterActiveDailyScheduleData(data || [])

    const html = buildDailySchedulePdfHtml({
      dateISO: dateParam,
      generatedAt: formatGeneratedAt(new Date(), timeZone),
      data: filteredData,
      options: {
        showAbsencesAndSubs,
        showEnrollment,
        showNotes,
        showPreferredRatios,
        showRequiredRatios,
        colorFriendly,
        layout,
        teacherNameFormat,
        topHeaderHtml,
        footerNotesHtml,
      },
      timeZone,
      schoolClosures,
    })

    const browser = await runPdfStep(pdfTrace, 'launch', () => launchPdfBrowser(), 180000)
    try {
      const page = await runPdfStep(pdfTrace, 'newPage', () => browser.newPage(), 60000)
      configurePageTimeouts(page)
      await runPdfStep(pdfTrace, 'setContent', () => setPdfContentWithFallback(page, html), 60000)
      const pdf = await runPdfStep(
        pdfTrace,
        'pdf',
        () =>
          page.pdf({
            format: paperSize,
            landscape: true,
            printBackground: true,
            timeout: 0,
            margin: {
              top: '0.25in',
              right: '0.2in',
              bottom: '0.25in',
              left: '0.2in',
            },
          }),
        120000
      )

      const pdfBytes = new Uint8Array(pdf)
      return new NextResponse(pdfBytes, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${buildDailyScheduleFilename(dateParam)}"`,
        },
      })
    } finally {
      await browser.close()
    }
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error generating daily schedule PDF:', error)
    }
    const payload: Record<string, unknown> = {
      error: error?.message || 'Failed to generate PDF.',
    }
    if (debugPdf) {
      payload.pdf_trace = pdfTrace
    }
    return NextResponse.json(payload, { status: 500 })
  }
}
