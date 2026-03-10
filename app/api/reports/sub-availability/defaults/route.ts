import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'

const MAX_TOP_HEADER_HTML = 2000
const MAX_FOOTER_NOTES_HTML = 4000

const truncateRichText = (value: unknown, maxLength: number) => {
  if (typeof value !== 'string') return ''
  return value.slice(0, maxLength)
}

export async function GET() {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json(
        { error: 'User profile not found or missing school_id.' },
        { status: 403 }
      )
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('schedule_settings')
      .select('sub_availability_top_header_html, sub_availability_footer_notes_html')
      .eq('school_id', schoolId)
      .limit(1)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Failed to load report defaults.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      top_header_html: data?.sub_availability_top_header_html || '',
      footer_notes_html: data?.sub_availability_footer_notes_html || '',
    })
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

    const topHeaderHtml = hasTopHeader
      ? truncateRichText(body?.top_header_html, MAX_TOP_HEADER_HTML)
      : undefined
    const footerNotesHtml = hasFooterNotes
      ? truncateRichText(body?.footer_notes_html, MAX_FOOTER_NOTES_HTML)
      : undefined
    const supabase = await createClient()

    const { data: existing, error: existingError } = await supabase
      .from('schedule_settings')
      .select('id')
      .eq('school_id', schoolId)
      .limit(1)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message || 'Failed to load schedule settings.' },
        { status: 500 }
      )
    }

    if (existing?.id) {
      const updatePayload: Record<string, string | null> = {}
      if (hasTopHeader) {
        updatePayload.sub_availability_top_header_html = topHeaderHtml || null
      }
      if (hasFooterNotes) {
        updatePayload.sub_availability_footer_notes_html = footerNotesHtml || null
      }

      const { error: updateError } = await supabase
        .from('schedule_settings')
        .update({ ...updatePayload, updated_at: new Date().toISOString() })
        .eq('id', existing.id)

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message || 'Failed to save report defaults.' },
          { status: 500 }
        )
      }
    } else {
      const { error: insertError } = await supabase.from('schedule_settings').insert({
        school_id: schoolId,
        selected_day_ids: [],
        ...(hasTopHeader ? { sub_availability_top_header_html: topHeaderHtml || null } : {}),
        ...(hasFooterNotes ? { sub_availability_footer_notes_html: footerNotesHtml || null } : {}),
      })

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message || 'Failed to save report defaults.' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      top_header_html: hasTopHeader ? topHeaderHtml : undefined,
      footer_notes_html: hasFooterNotes ? footerNotesHtml : undefined,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to save report defaults.' },
      { status: 500 }
    )
  }
}
