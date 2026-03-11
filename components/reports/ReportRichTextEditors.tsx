'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  Italic,
  Underline,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  topLabel: string
  footerLabel: string
  topPlaceholder: string
  footerPlaceholder: string
  topHtml: string
  footerHtml: string
  onTopHtmlChange: (html: string) => void
  onFooterHtmlChange: (html: string) => void
  topIsSaved: boolean
  footerIsSaved: boolean
  onSaveTopDefault: () => void
  onSaveFooterDefault: () => void
  isSavingTopDefault?: boolean
  isSavingFooterDefault?: boolean
}

export default function ReportRichTextEditors({
  topLabel,
  footerLabel,
  topPlaceholder,
  footerPlaceholder,
  topHtml,
  footerHtml,
  onTopHtmlChange,
  onFooterHtmlChange,
  topIsSaved,
  footerIsSaved,
  onSaveTopDefault,
  onSaveFooterDefault,
  isSavingTopDefault = false,
  isSavingFooterDefault = false,
}: Props) {
  const topEditorRef = useRef<HTMLDivElement | null>(null)
  const footerEditorRef = useRef<HTMLDivElement | null>(null)
  const [activeEditor, setActiveEditor] = useState<'top' | 'footer'>('footer')

  useEffect(() => {
    const topEditor = topEditorRef.current
    if (!topEditor) return
    if (topEditor.innerHTML !== topHtml && document.activeElement !== topEditor) {
      topEditor.innerHTML = topHtml
    }
  }, [topHtml])

  useEffect(() => {
    const footerEditor = footerEditorRef.current
    if (!footerEditor) return
    if (footerEditor.innerHTML !== footerHtml && document.activeElement !== footerEditor) {
      footerEditor.innerHTML = footerHtml
    }
  }, [footerHtml])

  const getActiveEditorRef = () => {
    const focusedElement = document.activeElement as HTMLElement | null
    const focusedTop = topEditorRef.current && focusedElement === topEditorRef.current
    const focusedFooter = footerEditorRef.current && focusedElement === footerEditorRef.current
    return focusedTop
      ? topEditorRef
      : focusedFooter
        ? footerEditorRef
        : activeEditor === 'top'
          ? topEditorRef
          : footerEditorRef
  }

  const syncEditorStateFromRef = (
    editorRef: React.RefObject<HTMLDivElement | null> | { current: HTMLDivElement | null }
  ) => {
    if (editorRef === topEditorRef) {
      onTopHtmlChange(topEditorRef.current?.innerHTML || '')
      return
    }
    onFooterHtmlChange(footerEditorRef.current?.innerHTML || '')
  }

  const runEditorCommand = (command: string, value?: string) => {
    const editorRef = getActiveEditorRef()
    editorRef.current?.focus()
    document.execCommand(command, false, value)
    syncEditorStateFromRef(editorRef)
  }

  const runHighlightCommand = () => {
    const editorRef = getActiveEditorRef()
    const editor = editorRef.current
    if (!editor) return
    editor.focus()

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      runEditorCommand('hiliteColor', '#fff59d')
      return
    }

    const range = selection.getRangeAt(0)
    const containerEl =
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as HTMLElement)
        : (range.startContainer.parentElement ?? editor)
    const currentFontSize = window.getComputedStyle(containerEl).fontSize || '14px'

    try {
      const span = document.createElement('span')
      span.style.backgroundColor = '#fff59d'
      span.style.fontSize = currentFontSize
      span.style.lineHeight = 'inherit'
      range.surroundContents(span)
      selection.removeAllRanges()
      const nextRange = document.createRange()
      nextRange.selectNodeContents(span)
      selection.addRange(nextRange)
    } catch {
      document.execCommand('hiliteColor', false, '#fff59d')
    }

    syncEditorStateFromRef(editorRef)
  }

  return (
    <div className="space-y-3">
      <div className="mb-3 mt-8 flex flex-wrap items-center gap-2">
        <button
          type="button"
          title="Bold"
          aria-label="Bold"
          className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-800 hover:bg-slate-50"
          onClick={() => runEditorCommand('bold')}
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Italic"
          aria-label="Italic"
          className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-800 hover:bg-slate-50"
          onClick={() => runEditorCommand('italic')}
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Underline"
          aria-label="Underline"
          className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-800 hover:bg-slate-50"
          onClick={() => runEditorCommand('underline')}
        >
          <Underline className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Highlight"
          aria-label="Highlight"
          className="rounded border border-amber-300 bg-amber-100 px-2 py-1 text-amber-800 hover:bg-amber-200"
          onClick={runHighlightCommand}
        >
          <Highlighter className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Align Left"
          aria-label="Align Left"
          className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-800 hover:bg-slate-50"
          onClick={() => runEditorCommand('justifyLeft')}
        >
          <AlignLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Align Center"
          aria-label="Align Center"
          className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-800 hover:bg-slate-50"
          onClick={() => runEditorCommand('justifyCenter')}
        >
          <AlignCenter className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Align Right"
          aria-label="Align Right"
          className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-800 hover:bg-slate-50"
          onClick={() => runEditorCommand('justifyRight')}
        >
          <AlignRight className="h-4 w-4" />
        </button>
        <select
          className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800"
          defaultValue=""
          onChange={e => {
            if (e.target.value) runEditorCommand('foreColor', e.target.value)
          }}
        >
          <option value="" disabled>
            Font color
          </option>
          <option value="#111827">Black</option>
          <option value="#0f766e">Teal</option>
          <option value="#1d4ed8">Blue</option>
          <option value="#b45309">Amber</option>
          <option value="#b91c1c">Red</option>
        </select>
        <select
          className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800"
          defaultValue=""
          onChange={e => {
            if (e.target.value) runEditorCommand('fontSize', e.target.value)
          }}
        >
          <option value="" disabled>
            Font size
          </option>
          <option value="1">Extra small</option>
          <option value="2">Small</option>
          <option value="3">Normal</option>
          <option value="4">Large</option>
          <option value="5">XL</option>
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-slate-700">{topLabel}</label>
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                topIsSaved
                  ? 'border-slate-200 bg-slate-100 text-slate-600'
                  : 'border-amber-200 bg-amber-100 text-amber-800'
              )}
            >
              {topIsSaved ? 'Saved' : 'Unsaved changes'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSaveTopDefault}
              disabled={isSavingTopDefault}
              className="h-7 px-2 text-slate-600 hover:text-slate-900"
            >
              {isSavingTopDefault ? 'Saving...' : 'Save as default header'}
            </Button>
          </div>
          <div
            ref={topEditorRef}
            contentEditable
            suppressContentEditableWarning
            onFocus={() => setActiveEditor('top')}
            onInput={e => onTopHtmlChange((e.currentTarget as HTMLDivElement).innerHTML)}
            className="min-h-[70px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            data-placeholder={topPlaceholder}
          />
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-slate-700">{footerLabel}</label>
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                footerIsSaved
                  ? 'border-slate-200 bg-slate-100 text-slate-600'
                  : 'border-amber-200 bg-amber-100 text-amber-800'
              )}
            >
              {footerIsSaved ? 'Saved' : 'Unsaved changes'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSaveFooterDefault}
              disabled={isSavingFooterDefault}
              className="h-7 px-2 text-slate-600 hover:text-slate-900"
            >
              {isSavingFooterDefault ? 'Saving...' : 'Save as default footer'}
            </Button>
          </div>
          <div
            ref={footerEditorRef}
            contentEditable
            suppressContentEditableWarning
            onFocus={() => setActiveEditor('footer')}
            onInput={e => onFooterHtmlChange((e.currentTarget as HTMLDivElement).innerHTML)}
            className="min-h-[70px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            data-placeholder={footerPlaceholder}
          />
        </div>
      </div>

      <style jsx>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
        }
      `}</style>
    </div>
  )
}
