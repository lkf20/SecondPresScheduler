import { NextResponse } from 'next/server'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import puppeteer from 'puppeteer'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getScheduleSettings } from '@/lib/api/schedule-settings'
import {
  buildSubAvailabilityFilename,
  buildSubAvailabilityPdfHtml,
  buildSubAvailabilityReportModel,
} from '@/lib/reports/sub-availability-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const parseBoolean = (value: string | null, fallback: boolean) => {
  if (value === null) return fallback
  return value === 'true' || value === '1'
}
const parseNameFormat = (value: string | null): 'display' | 'full' =>
  value === 'full' ? 'full' : 'display'
const parseFooterNotes = (value: string | null) => (value ? value.slice(0, 1500) : '')
const parseFooterNotesHtml = (value: string | null) => (value ? value.slice(0, 4000) : '')
const parseTopHeaderHtml = (value: string | null) => (value ? value.slice(0, 2000) : '')

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
    const footerNotes = parseFooterNotes(searchParams.get('footerNotes'))
    const footerNotesHtml = parseFooterNotesHtml(searchParams.get('footerNotesHtml'))
    const topHeaderHtml = parseTopHeaderHtml(searchParams.get('topHeaderHtml'))

    const supabase = await createClient()
    const scheduleSettings = await getScheduleSettings(schoolId)
    const selectedDayIds = scheduleSettings?.selected_day_ids ?? []
    const timeZone = scheduleSettings?.time_zone || 'UTC'

    let days: Array<{ id: string; name: string; display_order: number | null }> = []
    if (selectedDayIds.length > 0) {
      const { data: daysData, error: daysError } = await supabase
        .from('days_of_week')
        .select('id, name, display_order')
        .in('id', selectedDayIds)
        .order('display_order', { ascending: true })

      if (daysError) throw daysError
      days = daysData || []
    }

    const { data: timeSlots, error: timeSlotsError } = await supabase
      .from('time_slots')
      .select('id, code, name, display_order')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (timeSlotsError) throw timeSlotsError

    const { data: classGroups, error: classGroupsError } = await supabase
      .from('class_groups')
      .select('id, name, "order", min_age')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('min_age', { ascending: true })

    if (classGroupsError) throw classGroupsError

    const { data: subs, error: subsError } = await supabase
      .from('staff')
      .select('id, first_name, last_name, display_name, phone, capabilities_notes')
      .eq('school_id', schoolId)
      .eq('is_sub', true)
      .eq('active', true)
      .order('last_name', { ascending: true })

    if (subsError) throw subsError

    const subIds = (subs || []).map(sub => sub.id)

    let availabilityRows: Array<{
      sub_id: string
      day_of_week_id: string
      time_slot_id: string
      available: boolean | null
    }> = []

    let preferences: Array<{
      sub_id: string
      class_group_id: string | null
      can_teach: boolean | null
    }> = []

    if (subIds.length > 0) {
      const { data: availabilityData, error: availabilityError } = await supabase
        .from('sub_availability')
        .select('sub_id, day_of_week_id, time_slot_id, available')
        .eq('school_id', schoolId)
        .in('sub_id', subIds)
        .order('sub_id', { ascending: true })

      if (availabilityError) throw availabilityError
      availabilityRows = availabilityData || []

      const { data: preferenceData, error: preferencesError } = await supabase
        .from('sub_class_preferences')
        .select('sub_id, class_group_id, can_teach')
        .eq('school_id', schoolId)
        .eq('can_teach', true)
        .in('sub_id', subIds)
        .order('sub_id', { ascending: true })

      if (preferencesError) throw preferencesError
      preferences = preferenceData || []
    }

    const model = buildSubAvailabilityReportModel(
      {
        subs: subs || [],
        days,
        timeSlots: timeSlots || [],
        availabilityRows,
        classGroups: (classGroups || []).map(group => ({
          ...group,
          order: group.order,
          min_age: group.min_age,
        })),
        preferences,
      },
      { nameFormat }
    )

    const now = new Date()
    const html = buildSubAvailabilityPdfHtml({
      generatedAt: formatGeneratedAt(now, timeZone),
      reportContext: model,
      colorFriendly,
      footerNotes,
      footerNotesHtml,
      topHeaderHtml,
    })

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: resolveExecutablePath(),
    })
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
