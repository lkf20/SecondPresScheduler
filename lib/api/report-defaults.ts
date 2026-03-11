import { createClient } from '@/lib/supabase/server'
import {
  MAX_FOOTER_NOTES_HTML,
  MAX_TOP_HEADER_HTML,
  truncateRichText,
} from '@/lib/reports/rich-text'

type DefaultsColumnConfig = {
  topHeaderColumn: string
  footerNotesColumn: string
}

type UpsertDefaultsInput = {
  schoolId: string
  topHeaderHtml?: unknown
  footerNotesHtml?: unknown
  hasTopHeader: boolean
  hasFooterNotes: boolean
  columns: DefaultsColumnConfig
}

export const getReportDefaults = async ({
  schoolId,
  columns,
}: {
  schoolId: string
  columns: DefaultsColumnConfig
}) => {
  const supabase = await createClient()
  const selectColumns = `${columns.topHeaderColumn}, ${columns.footerNotesColumn}`

  const { data, error } = await supabase
    .from('schedule_settings')
    .select(selectColumns)
    .eq('school_id', schoolId)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to load report defaults.')
  }

  const record = (data ?? {}) as Record<string, string | null | undefined>
  return {
    top_header_html: record[columns.topHeaderColumn] || '',
    footer_notes_html: record[columns.footerNotesColumn] || '',
  }
}

export const upsertReportDefaults = async ({
  schoolId,
  topHeaderHtml,
  footerNotesHtml,
  hasTopHeader,
  hasFooterNotes,
  columns,
}: UpsertDefaultsInput) => {
  const topHeader = hasTopHeader ? truncateRichText(topHeaderHtml, MAX_TOP_HEADER_HTML) : undefined
  const footerNotes = hasFooterNotes
    ? truncateRichText(footerNotesHtml, MAX_FOOTER_NOTES_HTML)
    : undefined

  const supabase = await createClient()
  const { data: existing, error: existingError } = await supabase
    .from('schedule_settings')
    .select('id')
    .eq('school_id', schoolId)
    .limit(1)
    .maybeSingle()

  if (existingError) {
    throw new Error(existingError.message || 'Failed to load schedule settings.')
  }

  if (existing?.id) {
    const updatePayload: Record<string, string | null> = {}
    if (hasTopHeader) {
      updatePayload[columns.topHeaderColumn] = topHeader || null
    }
    if (hasFooterNotes) {
      updatePayload[columns.footerNotesColumn] = footerNotes || null
    }

    const { error: updateError } = await supabase
      .from('schedule_settings')
      .update({ ...updatePayload, updated_at: new Date().toISOString() })
      .eq('id', existing.id)

    if (updateError) {
      throw new Error(updateError.message || 'Failed to save report defaults.')
    }
  } else {
    const insertPayload: Record<string, unknown> = {
      school_id: schoolId,
      selected_day_ids: [],
    }
    if (hasTopHeader) {
      insertPayload[columns.topHeaderColumn] = topHeader || null
    }
    if (hasFooterNotes) {
      insertPayload[columns.footerNotesColumn] = footerNotes || null
    }

    const { error: insertError } = await supabase.from('schedule_settings').insert(insertPayload)

    if (insertError) {
      throw new Error(insertError.message || 'Failed to save report defaults.')
    }
  }

  return {
    ...(hasTopHeader ? { top_header_html: topHeader } : {}),
    ...(hasFooterNotes ? { footer_notes_html: footerNotes } : {}),
  }
}
