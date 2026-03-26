import { NextResponse } from 'next/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getSubAvailabilityReportData } from '@/lib/api/sub-availability'
import {
  buildSubAvailabilityFilename,
  buildSubAvailabilityPdfHtml,
  buildSubAvailabilityReportModel,
  formatGeneratedAt,
} from '@/lib/reports/sub-availability-pdf'
import {
  MAX_FOOTER_NOTES_HTML,
  MAX_TOP_HEADER_HTML,
  truncateRichText,
} from '@/lib/reports/rich-text'
import { launchPdfBrowser } from '@/lib/reports/puppeteer-launch'
import { runPdfStep, type PdfTraceStep } from '@/lib/reports/pdf-trace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const parseBoolean = (value: string | null, fallback: boolean) => {
  if (value === null) return fallback
  return value === 'true' || value === '1'
}
const parseNameFormat = (value: string | null): 'display' | 'full' =>
  value === 'full' ? 'full' : 'display'
const parsePaperSize = (value: string | null): 'letter' | 'legal' =>
  value === 'legal' ? 'legal' : 'letter'
const parseFooterNotesHtml = (value: string | null) =>
  truncateRichText(value, MAX_FOOTER_NOTES_HTML)
const parseTopHeaderHtml = (value: string | null) => truncateRichText(value, MAX_TOP_HEADER_HTML)
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
    try {
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 })
    } catch (fallbackError) {
      const fallbackMessage =
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      const fallbackIsTimeout =
        /Timed out after waiting/i.test(fallbackMessage) ||
        /Navigation timeout/i.test(fallbackMessage)
      if (!fallbackIsTimeout) throw fallbackError
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
    const colorFriendly = parseBoolean(searchParams.get('colorFriendly'), true)
    const nameFormat = parseNameFormat(searchParams.get('nameFormat'))
    const paperSize = parsePaperSize(searchParams.get('paperSize'))
    const footerNotesHtml = parseFooterNotesHtml(searchParams.get('footerNotesHtml'))
    const topHeaderHtml = parseTopHeaderHtml(searchParams.get('topHeaderHtml'))
    debugPdf = parseDebugPdf(searchParams.get('debugPdf'))

    const { timeZone, days, timeSlots, classGroups, subs, availabilityRows, preferences } =
      await getSubAvailabilityReportData(schoolId)

    const model = buildSubAvailabilityReportModel(
      {
        subs,
        days,
        timeSlots,
        availabilityRows,
        classGroups,
        preferences,
      },
      { nameFormat }
    )

    const now = new Date()
    const html = buildSubAvailabilityPdfHtml({
      generatedAt: formatGeneratedAt(now, timeZone),
      reportContext: model,
      colorFriendly,
      footerNotesHtml,
      topHeaderHtml,
      paperSize,
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
              top: '0.2in',
              right: '0.2in',
              bottom: '0.2in',
              left: '0.2in',
            },
          }),
        120000
      )

      const pdfBytes = new Uint8Array(pdf)
      return new NextResponse(pdfBytes, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${buildSubAvailabilityFilename(now)}"`,
        },
      })
    } finally {
      await browser.close()
    }
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error generating sub availability PDF:', error)
    }
    const payload: Record<string, unknown> = {
      error: error?.message || 'Failed to generate sub availability PDF.',
    }
    if (debugPdf) {
      payload.pdf_trace = pdfTrace
    }
    return NextResponse.json(payload, { status: 500 })
  }
}
