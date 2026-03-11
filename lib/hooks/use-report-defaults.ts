'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { normalizeRichTextForCompare } from '@/lib/reports/rich-text'

type UseReportDefaultsOptions = {
  defaultsUrl: string
  topSaveSuccessMessage?: string
  footerSaveSuccessMessage?: string
}

export function useReportDefaults({
  defaultsUrl,
  topSaveSuccessMessage = 'Saved default top header.',
  footerSaveSuccessMessage = 'Saved default bottom footer.',
}: UseReportDefaultsOptions) {
  const [topHeaderHtml, setTopHeaderHtml] = useState('')
  const [footerNotesHtml, setFooterNotesHtml] = useState('')
  const [defaultTopHeaderHtml, setDefaultTopHeaderHtml] = useState('')
  const [defaultFooterNotesHtml, setDefaultFooterNotesHtml] = useState('')
  const [isSavingTopDefault, setIsSavingTopDefault] = useState(false)
  const [isSavingFooterDefault, setIsSavingFooterDefault] = useState(false)
  const hasEditedTopHeaderRef = useRef(false)
  const hasEditedFooterRef = useRef(false)

  useEffect(() => {
    let mounted = true
    const loadDefaults = async () => {
      try {
        const response = await fetch(defaultsUrl, { cache: 'no-store' })
        if (!response.ok) return

        const payload = await response.json()
        if (!mounted) return

        const nextTopHeader =
          typeof payload?.top_header_html === 'string' ? payload.top_header_html : ''
        const nextFooter =
          typeof payload?.footer_notes_html === 'string' ? payload.footer_notes_html : ''
        setDefaultTopHeaderHtml(nextTopHeader)
        setDefaultFooterNotesHtml(nextFooter)

        if (!hasEditedTopHeaderRef.current) {
          setTopHeaderHtml(nextTopHeader)
        }
        if (!hasEditedFooterRef.current) {
          setFooterNotesHtml(nextFooter)
        }
      } catch {
        // Defaults are optional. Report still works if this fails.
      }
    }
    void loadDefaults()
    return () => {
      mounted = false
    }
  }, [defaultsUrl])

  const onTopHtmlChange = useCallback((html: string) => {
    hasEditedTopHeaderRef.current = true
    setTopHeaderHtml(html)
  }, [])

  const onFooterHtmlChange = useCallback((html: string) => {
    hasEditedFooterRef.current = true
    setFooterNotesHtml(html)
  }, [])

  const isTopHeaderSaved = useMemo(
    () =>
      normalizeRichTextForCompare(topHeaderHtml) ===
      normalizeRichTextForCompare(defaultTopHeaderHtml),
    [topHeaderHtml, defaultTopHeaderHtml]
  )

  const isFooterSaved = useMemo(
    () =>
      normalizeRichTextForCompare(footerNotesHtml) ===
      normalizeRichTextForCompare(defaultFooterNotesHtml),
    [footerNotesHtml, defaultFooterNotesHtml]
  )

  const saveTopDefault = useCallback(async () => {
    setIsSavingTopDefault(true)
    try {
      const response = await fetch(defaultsUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ top_header_html: topHeaderHtml }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'Failed to save defaults')
      const savedTopHeaderHtml =
        typeof payload?.top_header_html === 'string' ? payload.top_header_html : topHeaderHtml
      setTopHeaderHtml(savedTopHeaderHtml)
      setDefaultTopHeaderHtml(savedTopHeaderHtml)
      toast.success(topSaveSuccessMessage)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save defaults')
    } finally {
      setIsSavingTopDefault(false)
    }
  }, [defaultsUrl, topHeaderHtml, topSaveSuccessMessage])

  const saveFooterDefault = useCallback(async () => {
    setIsSavingFooterDefault(true)
    try {
      const response = await fetch(defaultsUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ footer_notes_html: footerNotesHtml }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'Failed to save defaults')
      const savedFooterNotesHtml =
        typeof payload?.footer_notes_html === 'string' ? payload.footer_notes_html : footerNotesHtml
      setFooterNotesHtml(savedFooterNotesHtml)
      setDefaultFooterNotesHtml(savedFooterNotesHtml)
      toast.success(footerSaveSuccessMessage)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save defaults')
    } finally {
      setIsSavingFooterDefault(false)
    }
  }, [defaultsUrl, footerNotesHtml, footerSaveSuccessMessage])

  return {
    topHeaderHtml,
    footerNotesHtml,
    onTopHtmlChange,
    onFooterHtmlChange,
    isTopHeaderSaved,
    isFooterSaved,
    isSavingTopDefault,
    isSavingFooterDefault,
    saveTopDefault,
    saveFooterDefault,
  }
}
