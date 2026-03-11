import { NextResponse } from 'next/server'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import puppeteer from 'puppeteer'
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
    const dateParam = searchParams.get('date')
    const date = parseDateParam(dateParam)
    if (!date || !dateParam) {
      return NextResponse.json({ error: 'Missing or invalid date parameter.' }, { status: 400 })
    }

    const showAbsencesAndSubs = parseBoolean(searchParams.get('showAbsencesAndSubs'), true)
    const showEnrollment = parseBoolean(searchParams.get('showEnrollment'), false)
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

    const resolveExecutablePath = () => {
      const envPath = process.env.PUPPETEER_EXECUTABLE_PATH
      if (envPath && fs.existsSync(envPath)) return envPath

      const defaultPath = puppeteer.executablePath()
      if (defaultPath && fs.existsSync(defaultPath)) return defaultPath

      const cacheBase = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome')
      if (!fs.existsSync(cacheBase)) return undefined
      const versions = fs
        .readdirSync(cacheBase, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && entry.name.startsWith('mac-'))
        .map(entry => entry.name)
        .sort()
      const latest = versions.at(-1)
      if (!latest) return undefined

      const candidates = [
        path.join(
          cacheBase,
          latest,
          'chrome-mac-arm64',
          'Google Chrome for Testing.app',
          'Contents',
          'MacOS',
          'Google Chrome for Testing'
        ),
        path.join(
          cacheBase,
          latest,
          'chrome-mac-x64',
          'Google Chrome for Testing.app',
          'Contents',
          'MacOS',
          'Google Chrome for Testing'
        ),
      ]

      return candidates.find(candidate => fs.existsSync(candidate))
    }

    const executablePath = resolveExecutablePath()

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath,
    })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({
      format: paperSize,
      landscape: true,
      printBackground: true,
      margin: {
        top: '0.25in',
        right: '0.2in',
        bottom: '0.25in',
        left: '0.2in',
      },
    })
    await browser.close()

    const pdfBytes = new Uint8Array(pdf)
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${buildDailyScheduleFilename(dateParam)}"`,
      },
    })
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error generating daily schedule PDF:', error)
    }
    return NextResponse.json(
      {
        error: error?.message || 'Failed to generate PDF.',
      },
      { status: 500 }
    )
  }
}
