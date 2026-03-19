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

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const parseBoolean = (value: string | null, fallback: boolean) => {
  if (value === null) return fallback
  return value === 'true' || value === '1'
}
const parseNameFormat = (value: string | null): 'display' | 'full' =>
  value === 'full' ? 'full' : 'display'
const parseFooterNotesHtml = (value: string | null) =>
  truncateRichText(value, MAX_FOOTER_NOTES_HTML)
const parseTopHeaderHtml = (value: string | null) => truncateRichText(value, MAX_TOP_HEADER_HTML)

export async function GET(request: Request) {
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
    const footerNotesHtml = parseFooterNotesHtml(searchParams.get('footerNotesHtml'))
    const topHeaderHtml = parseTopHeaderHtml(searchParams.get('topHeaderHtml'))

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
    })

    const browser = await launchPdfBrowser()
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({
      format: 'letter',
      landscape: true,
      printBackground: true,
      margin: {
        top: '0.2in',
        right: '0.2in',
        bottom: '0.2in',
        left: '0.2in',
      },
    })
    await browser.close()

    const pdfBytes = new Uint8Array(pdf)
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${buildSubAvailabilityFilename(now)}"`,
      },
    })
  } catch (error: any) {
    console.error('Error generating sub availability PDF:', error)
    return NextResponse.json(
      {
        error: error?.message || 'Failed to generate sub availability PDF.',
      },
      { status: 500 }
    )
  }
}
