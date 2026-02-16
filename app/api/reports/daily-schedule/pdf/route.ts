import { NextResponse } from 'next/server'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import puppeteer from 'puppeteer'
import { createClient } from '@/lib/supabase/server'
import { getScheduleSnapshotData } from '@/lib/api/weekly-schedule'
import { getUserSchoolId } from '@/lib/utils/auth'
import {
  buildDailyScheduleFilename,
  buildDailySchedulePdfHtml,
} from '@/lib/reports/daily-schedule-pdf'
import { getScheduleSettings } from '@/lib/api/schedule-settings'
import { expandDateRangeWithTimeZone } from '@/lib/utils/date'

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
  if (
    value === 'default' ||
    value === 'first_last' ||
    value === 'first_last_initial' ||
    value === 'first_initial_last' ||
    value === 'first'
  ) {
    return value
  }
  return 'default'
}

const formatGeneratedAt = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)

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
    const colorFriendly = parseBoolean(searchParams.get('colorFriendly'), false)
    const layout = parseLayout(searchParams.get('layout'))
    const teacherNameFormat = parseTeacherNameFormat(searchParams.get('teacherNameFormat'))

    const scheduleSettings = await getScheduleSettings(schoolId)
    const timeZone = scheduleSettings?.time_zone || 'UTC'
    const expanded = expandDateRangeWithTimeZone(dateParam, dateParam, timeZone)
    const dayNumber = expanded[0]?.day_number
    if (!dayNumber) {
      return NextResponse.json(
        { error: 'Unable to resolve day of week for date.' },
        { status: 500 }
      )
    }
    const supabase = await createClient()
    const dayNumberCandidates = dayNumber === 0 ? [0, 7] : [dayNumber]
    const { data: daysData, error: daysError } = await supabase
      .from('days_of_week')
      .select('id, name, day_number')
      .in('day_number', dayNumberCandidates)

    if (daysError || !daysData || daysData.length === 0) {
      return NextResponse.json(
        { error: 'Unable to resolve day of week for date.' },
        { status: 500 }
      )
    }

    const day = daysData[0]
    const data = await getScheduleSnapshotData({
      schoolId,
      selectedDayIds: [day.id],
      startDateISO: dateParam,
      endDateISO: dateParam,
    })

    const html = buildDailySchedulePdfHtml({
      dateISO: dateParam,
      generatedAt: formatGeneratedAt(new Date(), timeZone),
      data,
      options: {
        showAbsencesAndSubs,
        colorFriendly,
        layout,
        teacherNameFormat,
      },
      timeZone,
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
      format: 'letter',
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
    console.error('Error generating daily schedule PDF:', error)
    return NextResponse.json(
      {
        error: error?.message || 'Failed to generate PDF.',
      },
      { status: 500 }
    )
  }
}
