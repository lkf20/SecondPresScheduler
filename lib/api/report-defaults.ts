import { createClient } from '@/lib/supabase/server'
import {
  MAX_FOOTER_NOTES_HTML,
  MAX_TOP_HEADER_HTML,
  sanitizeRichTextHtml,
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
  const topHeader = hasTopHeader
    ? sanitizeRichTextHtml(
        truncateRichText(topHeaderHtml, MAX_TOP_HEADER_HTML),
        MAX_TOP_HEADER_HTML
      )
    : undefined
  const footerNotes = hasFooterNotes
    ? sanitizeRichTextHtml(
        truncateRichText(footerNotesHtml, MAX_FOOTER_NOTES_HTML),
        MAX_FOOTER_NOTES_HTML
      )
    : undefined

  const supabase = await createClient()
  const upsertPayload: Record<string, unknown> = {
    school_id: schoolId,
    updated_at: new Date().toISOString(),
  }
  if (hasTopHeader) {
    upsertPayload[columns.topHeaderColumn] = topHeader || null
  }
  if (hasFooterNotes) {
    upsertPayload[columns.footerNotesColumn] = footerNotes || null
  }

  const { error: upsertError } = await supabase
    .from('schedule_settings')
    .upsert(upsertPayload, { onConflict: 'school_id' })

  if (upsertError) {
    throw new Error(upsertError.message || 'Failed to save report defaults.')
  }

  return {
    ...(hasTopHeader ? { top_header_html: topHeader } : {}),
    ...(hasFooterNotes ? { footer_notes_html: footerNotes } : {}),
  }
}
