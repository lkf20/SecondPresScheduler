import { NextRequest, NextResponse } from 'next/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getReportDefaults, upsertReportDefaults } from '@/lib/api/report-defaults'

const DAILY_SCHEDULE_DEFAULT_COLUMNS = {
  topHeaderColumn: 'daily_schedule_top_header_html',
  footerNotesColumn: 'daily_schedule_footer_notes_html',
} as const

export async function GET() {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json(
        { error: 'User profile not found or missing school_id.' },
        { status: 403 }
      )
    }

    const defaults = await getReportDefaults({
      schoolId,
      columns: DAILY_SCHEDULE_DEFAULT_COLUMNS,
    })
    return NextResponse.json(defaults)
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load report defaults.' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json(
        { error: 'User profile not found or missing school_id.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const hasTopHeader = Object.prototype.hasOwnProperty.call(body ?? {}, 'top_header_html')
    const hasFooterNotes = Object.prototype.hasOwnProperty.call(body ?? {}, 'footer_notes_html')
    if (!hasTopHeader && !hasFooterNotes) {
      return NextResponse.json(
        { error: 'Provide at least one of top_header_html or footer_notes_html.' },
        { status: 400 }
      )
    }

    const saved = await upsertReportDefaults({
      schoolId,
      topHeaderHtml: body?.top_header_html,
      footerNotesHtml: body?.footer_notes_html,
      hasTopHeader,
      hasFooterNotes,
      columns: DAILY_SCHEDULE_DEFAULT_COLUMNS,
    })
    return NextResponse.json(saved)
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to save report defaults.' },
      { status: 500 }
    )
  }
}
