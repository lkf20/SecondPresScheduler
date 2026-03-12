'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import ReportRichTextEditors from '@/components/reports/ReportRichTextEditors'
import { hasRichTextContent, sanitizeRichTextHtml } from '@/lib/reports/rich-text'
import { useReportDefaults } from '@/lib/hooks/use-report-defaults'
import { getHeaderClasses } from '@/lib/utils/colors'
import { cn } from '@/lib/utils'

const SUB_AVAILABILITY_PDF_URL = '/api/reports/sub-availability/pdf'
const SUB_AVAILABILITY_DATA_URL = '/api/reports/sub-availability'
const SUB_AVAILABILITY_DEFAULTS_URL = '/api/reports/sub-availability/defaults'

type ReportData = {
  generated_at: string
  sub_count: number
  report_context: {
    columns: Array<{
      dayId: string
      dayName: string
      timeSlotId: string
      timeSlotCode: string
      timeSlotName: string | null
    }>
    dayHeaders: Array<{ dayId: string; dayName: string; colSpan: number }>
    rows: Array<{
      id: string
      subName: string
      phone: string
      canTeach: string[]
      matrix: Array<{ key: string; available: boolean }>
    }>
  }
}

export default function SubAvailabilityReportPage() {
  const [colorFriendly, setColorFriendly] = useState(true)
  const [nameFormat, setNameFormat] = useState<'display' | 'full'>('display')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const {
    topHeaderHtml,
    footerNotesHtml,
    onTopHtmlChange,
    onFooterHtmlChange,
    isTopHeaderSaved,
    isFooterSaved,
    isSavingTopDefault,
    isSavingFooterDefault,
    saveTopDefault: handleSaveTopHeaderDefault,
    saveFooterDefault: handleSaveFooterDefault,
  } = useReportDefaults({ defaultsUrl: SUB_AVAILABILITY_DEFAULTS_URL })

  useEffect(() => {
    let mounted = true
    const run = async () => {
      try {
        setLoading(true)
        setError(null)
        const params = new URLSearchParams()
        params.set('nameFormat', nameFormat)
        const response = await fetch(`${SUB_AVAILABILITY_DATA_URL}?${params.toString()}`, {
          cache: 'no-store',
        })
        const payload = await response.json()
        if (!response.ok)
          throw new Error(payload?.error || 'Failed to load sub availability report')
        if (!mounted) return
        setReportData(payload)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Failed to load sub availability report')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void run()
    return () => {
      mounted = false
    }
  }, [nameFormat])

  const pdfUrl = useMemo(() => {
    const params = new URLSearchParams()
    params.set('colorFriendly', String(colorFriendly))
    params.set('nameFormat', nameFormat)
    if (hasRichTextContent(topHeaderHtml)) params.set('topHeaderHtml', topHeaderHtml)
    if (hasRichTextContent(footerNotesHtml)) params.set('footerNotesHtml', footerNotesHtml)
    return `${SUB_AVAILABILITY_PDF_URL}?${params.toString()}`
  }, [colorFriendly, nameFormat, topHeaderHtml, footerNotesHtml])

  const dayStartIndexes = useMemo(() => {
    if (!reportData?.report_context.columns?.length) return new Set<number>()
    const starts = new Set<number>()
    reportData.report_context.columns.forEach((column, index, columns) => {
      if (index === 0) return
      if (columns[index - 1]?.dayId !== column.dayId) starts.add(index)
    })
    return starts
  }, [reportData])
  const headerStyle = colorFriendly
    ? { backgroundColor: '#5f97a3', color: '#ffffff' }
    : { backgroundColor: '#e2e8f0', color: '#0f172a' }
  const oddRowStyle = colorFriendly
    ? { backgroundColor: '#d6e6ea' }
    : { backgroundColor: '#f8fafc' }
  const evenRowStyle = colorFriendly
    ? { backgroundColor: '#ffffff' }
    : { backgroundColor: '#ffffff' }
  const previewTopHeaderHtml = useMemo(
    () => sanitizeRichTextHtml(topHeaderHtml, 2000),
    [topHeaderHtml]
  )
  const previewFooterNotesHtml = useMemo(
    () => sanitizeRichTextHtml(footerNotesHtml, 4000),
    [footerNotesHtml]
  )

  const openPdf = () => {
    const popup = window.open(pdfUrl, '_blank', 'noopener,noreferrer')
    if (!popup) {
      toast.error('Popup blocked. Please allow popups to print the PDF.')
      return
    }
    toast.success('Opening PDF...')
  }

  const renderCanTeachCell = (values: string[]) => {
    const text = values.length > 0 ? values.join(', ') : '—'
    const prefix = 'All except '
    if (!text.startsWith(prefix)) return text
    const exceptText = text.slice(prefix.length)
    return (
      <>
        <span className="font-semibold underline">All except</span>{' '}
        <span className="italic">{exceptText}</span>
      </>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className={getHeaderClasses('3xl')}>Sub Availability</h1>
        <p className="text-muted-foreground mt-2">
          Printable one-page matrix of substitute weekly availability.
        </p>
      </div>

      <div className="mb-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setColorFriendly(true)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  colorFriendly ? 'bg-[#172554] text-white' : 'text-slate-600'
                )}
              >
                Color
              </button>
              <button
                type="button"
                onClick={() => setColorFriendly(false)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  !colorFriendly ? 'bg-[#172554] text-white' : 'text-slate-600'
                )}
              >
                Black &amp; White
              </button>
            </div>
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setNameFormat('display')}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  nameFormat === 'display' ? 'bg-[#172554] text-white' : 'text-slate-600'
                )}
              >
                Display Name
              </button>
              <button
                type="button"
                onClick={() => setNameFormat('full')}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  nameFormat === 'full' ? 'bg-[#172554] text-white' : 'text-slate-600'
                )}
              >
                Full Name
              </button>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" onClick={openPdf}>
              Print PDF
            </Button>
          </div>
        </div>
        <ReportRichTextEditors
          topLabel="Top header (optional)"
          footerLabel="Bottom footer (optional)"
          topPlaceholder="Optional centered header shown above the report title."
          footerPlaceholder="Add optional instructions to appear at the bottom of the printed report."
          topHtml={topHeaderHtml}
          footerHtml={footerNotesHtml}
          onTopHtmlChange={onTopHtmlChange}
          onFooterHtmlChange={onFooterHtmlChange}
          topIsSaved={isTopHeaderSaved}
          footerIsSaved={isFooterSaved}
          onSaveTopDefault={handleSaveTopHeaderDefault}
          onSaveFooterDefault={handleSaveFooterDefault}
          isSavingTopDefault={isSavingTopDefault}
          isSavingFooterDefault={isSavingFooterDefault}
        />
      </div>

      <Card className="mt-3">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {loading ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Loading sub availability report...
              </div>
            ) : error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : reportData ? (
              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
                  <div className="justify-self-start">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h2 className="text-xl font-bold text-slate-900">Sub Availability</h2>
                      <div className="text-sm text-slate-600">
                        Generated {reportData.generated_at}
                      </div>
                    </div>
                  </div>
                  <div className="mx-auto w-[650px] max-w-full justify-self-center rounded-md bg-white px-3 py-2 text-center text-sm text-slate-700">
                    {previewTopHeaderHtml
                      .replace(/<[^>]*>/g, ' ')
                      .replace(/&nbsp;/g, ' ')
                      .trim() ? (
                      <div dangerouslySetInnerHTML={{ __html: previewTopHeaderHtml }} />
                    ) : (
                      <span className="text-slate-400">Optional top header</span>
                    )}
                  </div>
                  <div className="justify-self-end text-sm text-slate-700">
                    {reportData.sub_count} subs
                  </div>
                </div>
                <div className="overflow-auto rounded-md border border-slate-200">
                  <table className="w-full border-collapse table-fixed text-sm">
                    <thead>
                      <tr>
                        <th
                          rowSpan={2}
                          className={cn(
                            'sticky left-0 z-20 border border-slate-200 px-2 py-2 text-left'
                          )}
                          style={{ ...headerStyle, width: '11rem' }}
                        >
                          SUB
                        </th>
                        <th
                          rowSpan={2}
                          className={cn('border border-slate-200 px-2 py-2 text-left')}
                          style={{ ...headerStyle, width: '9rem' }}
                        >
                          PHONE
                        </th>
                        {(reportData.report_context.columns.length === 0
                          ? [{ dayName: 'Weekly availability', colSpan: 1, dayId: 'none' }]
                          : reportData.report_context.dayHeaders
                        ).map(header => (
                          <th
                            key={header.dayId}
                            colSpan={header.colSpan}
                            className={cn(
                              'border border-slate-200 px-2 py-2 text-center text-xs font-semibold uppercase'
                            )}
                            style={{
                              ...headerStyle,
                              borderLeft: `2px solid ${colorFriendly ? '#ffffff' : '#64748b'}`,
                            }}
                          >
                            {header.dayName}
                          </th>
                        ))}
                        <th
                          rowSpan={2}
                          className={cn('border border-slate-200 px-2 py-2 text-center')}
                          style={{
                            ...headerStyle,
                            width: '15rem',
                            borderLeft: `2px solid ${colorFriendly ? '#ffffff' : '#64748b'}`,
                          }}
                        >
                          Available to teach
                        </th>
                      </tr>
                      <tr>
                        {reportData.report_context.columns.length === 0 ? (
                          <th className="border border-slate-200 px-2 py-1 text-center text-xs">
                            —
                          </th>
                        ) : (
                          reportData.report_context.columns.map((column, columnIndex) => (
                            <th
                              key={`${column.dayId}-${column.timeSlotId}`}
                              className={cn(
                                'border border-slate-200 px-1 py-1 text-center text-xs'
                              )}
                              style={{
                                ...headerStyle,
                                borderLeft:
                                  dayStartIndexes.has(columnIndex) || columnIndex === 0
                                    ? `2px solid ${colorFriendly ? '#ffffff' : '#64748b'}`
                                    : undefined,
                              }}
                            >
                              {column.timeSlotCode}
                            </th>
                          ))
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.report_context.rows.map((row, rowIndex) => (
                        <tr key={row.id} style={rowIndex % 2 === 0 ? evenRowStyle : oddRowStyle}>
                          <td
                            className="sticky left-0 z-10 border border-slate-200 px-2 py-1.5 text-base font-bold text-slate-800"
                            style={rowIndex % 2 === 0 ? evenRowStyle : oddRowStyle}
                          >
                            {row.subName}
                          </td>
                          <td className="border border-slate-200 px-2 py-1.5 text-slate-700">
                            {row.phone || '—'}
                          </td>
                          {reportData.report_context.columns.length === 0 ? (
                            <td className="border border-slate-200 px-2 py-1 text-center text-slate-400">
                              —
                            </td>
                          ) : (
                            row.matrix.map((cell, matrixIndex) => (
                              <td
                                key={cell.key}
                                className={cn(
                                  'border border-slate-200 px-1 py-1 text-center',
                                  dayStartIndexes.has(matrixIndex)
                                    ? 'border-l-2 border-l-slate-400'
                                    : null
                                )}
                                style={
                                  matrixIndex === 0
                                    ? { borderLeft: '2px solid #64748b' }
                                    : undefined
                                }
                              >
                                {cell.available ? (
                                  <span
                                    className={cn(
                                      'inline-block text-base font-bold leading-none',
                                      colorFriendly ? 'text-teal-700' : 'text-slate-700'
                                    )}
                                  >
                                    ✓
                                  </span>
                                ) : null}
                              </td>
                            ))
                          )}
                          <td
                            className="border border-slate-200 px-2 py-1.5 text-slate-700"
                            style={{ borderLeft: '2px solid #64748b' }}
                          >
                            {renderCanTeachCell(row.canTeach)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {reportData.report_context.dayHeaders.length === 0 ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    No schedule days are selected in settings. Availability matrix is empty.
                  </div>
                ) : reportData.report_context.columns.length === 0 ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    No active time slots found. Availability matrix is empty.
                  </div>
                ) : null}
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>
                      <strong>✓</strong> = Available
                    </span>
                    {reportData.report_context.columns
                      .reduce<Array<{ code: string; name: string }>>((acc, column) => {
                        if (acc.find(item => item.code === column.timeSlotCode)) return acc
                        acc.push({
                          code: column.timeSlotCode,
                          name: column.timeSlotName?.trim() || 'Time slot',
                        })
                        return acc
                      }, [])
                      .map(item => (
                        <span key={item.code}>
                          <strong>{item.code}</strong> = {item.name}
                        </span>
                      ))}
                  </div>
                </div>
                {previewFooterNotesHtml
                  .replace(/<[^>]*>/g, ' ')
                  .replace(/&nbsp;/g, ' ')
                  .trim() ? (
                  <div
                    className="rounded-md bg-white px-3 py-2 text-sm text-slate-700"
                    dangerouslySetInnerHTML={{ __html: previewFooterNotesHtml }}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
