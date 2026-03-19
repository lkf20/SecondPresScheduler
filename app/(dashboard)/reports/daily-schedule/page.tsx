'use client'

import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, CornerDownRight, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import DatePickerInput from '@/components/ui/date-picker-input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import ReportRichTextEditors from '@/components/reports/ReportRichTextEditors'
import { useDailySchedule } from '@/lib/hooks/use-daily-schedule'
import {
  formatRatioSummary,
  getEnrollmentSummary,
  getYoungestRatioGroup,
} from '@/lib/reports/daily-schedule-metrics'
import { hasRichTextContent, sanitizeRichTextHtml } from '@/lib/reports/rich-text'
import { useReportDefaults } from '@/lib/hooks/use-report-defaults'
import { getHeaderClasses } from '@/lib/utils/colors'
import { getSlotClosureOnDate } from '@/lib/utils/school-closures'
import { cn } from '@/lib/utils'
import type { WeeklyScheduleDataByClassroom } from '@/lib/api/weekly-schedule'

const splitClassroomName = (name: string) => {
  const match = name.match(/\sRoom$/)
  if (!match) return { line1: name, line2: null }
  const trimmed = name.replace(/\sRoom$/, '')
  return { line1: trimmed, line2: 'Room' }
}

const sortByName = <T extends { teacher_name?: string | null; teacherName?: string | null }>(
  a: T,
  b: T
) => {
  const nameA = (a.teacher_name ?? a.teacherName ?? '').toLowerCase()
  const nameB = (b.teacher_name ?? b.teacherName ?? '').toLowerCase()
  return nameA.localeCompare(nameB)
}

type TeacherNameSource = {
  teacher_name?: string | null
  teacher_first_name?: string | null
  teacher_last_name?: string | null
  teacher_display_name?: string | null
}

const deriveNameParts = (source: TeacherNameSource) => {
  const display =
    source.teacher_display_name ||
    source.teacher_name ||
    `${source.teacher_first_name || ''} ${source.teacher_last_name || ''}`.trim() ||
    ''
  const first = source.teacher_first_name || ''
  const last = source.teacher_last_name || ''
  if (first || last) {
    return { display, first, last }
  }
  const parts = display.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { display, first: '', last: '' }
  if (parts.length === 1) return { display, first: parts[0], last: '' }
  return { display, first: parts[0], last: parts[parts.length - 1] }
}

const formatTeacherName = (source: TeacherNameSource, format: 'default' | 'first_last') => {
  const { display, first, last } = deriveNameParts(source)
  if (!display) return ''
  if (format === 'default') return display
  return last ? `${first} ${last}` : first
}
const parseISODate = (value: string) => {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

const addDays = (value: string, delta: number) => {
  const parsed = parseISODate(value)
  if (!parsed) return value
  const next = new Date(parsed)
  next.setDate(next.getDate() + delta)
  return formatISO(next)
}

const formatISO = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const isValidDateString = (value: string | null) =>
  Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))

const formatLongDate = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value + 'T00:00:00'))

const formatGeneratedAt = (date: Date) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)

const formatSlotTime = (value: string) => {
  const [rawHour, rawMinute] = value.split(':')
  const hour = Number(rawHour)
  const minute = Number(rawMinute)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return minute === 0 ? `${displayHour}` : `${displayHour}:${String(minute).padStart(2, '0')}`
}

const formatSlotRange = (start: string | null, end: string | null) => {
  if (!start || !end) return null
  const [startHour] = start.split(':')
  const [endHour] = end.split(':')
  const startHourNum = Number(startHour)
  const endHourNum = Number(endHour)
  if (!Number.isFinite(startHourNum) || !Number.isFinite(endHourNum)) {
    return `${start} - ${end}`
  }
  const startSuffix = startHourNum >= 12 ? 'pm' : 'am'
  const endSuffix = endHourNum >= 12 ? 'pm' : 'am'
  return `${formatSlotTime(start)} ${startSuffix}\n${formatSlotTime(end)} ${endSuffix}`
}

const buildPdfUrl = ({
  date,
  showAbsencesAndSubs,
  showEnrollment,
  showNotes,
  showPreferredRatios,
  showRequiredRatios,
  colorFriendly,
  layout,
  teacherNameFormat,
  paperSize,
  topHeaderHtml,
  footerNotesHtml,
}: {
  date: string
  showAbsencesAndSubs: boolean
  showEnrollment: boolean
  showNotes: boolean
  showPreferredRatios: boolean
  showRequiredRatios: boolean
  colorFriendly: boolean
  layout: 'one' | 'two'
  teacherNameFormat: 'default' | 'first_last'
  paperSize: 'letter' | 'legal'
  topHeaderHtml: string
  footerNotesHtml: string
}) => {
  const params = new URLSearchParams()
  params.set('date', date)
  params.set('showAbsencesAndSubs', String(showAbsencesAndSubs))
  params.set('showEnrollment', String(showEnrollment))
  params.set('showNotes', String(showNotes))
  params.set('showPreferredRatios', String(showPreferredRatios))
  params.set('showRequiredRatios', String(showRequiredRatios))
  params.set('colorFriendly', String(colorFriendly))
  params.set('layout', layout)
  params.set('teacherNameFormat', teacherNameFormat)
  params.set('paperSize', paperSize)
  if (hasRichTextContent(topHeaderHtml)) params.set('topHeaderHtml', topHeaderHtml)
  if (hasRichTextContent(footerNotesHtml)) params.set('footerNotesHtml', footerNotesHtml)
  return `/api/reports/daily-schedule/pdf?${params.toString()}`
}

const buildTimeSlots = (data: WeeklyScheduleDataByClassroom[]) => {
  const slots = new Map<
    string,
    {
      id: string
      code: string
      name: string | null
      display_order: number | null
      start_time: string | null
      end_time: string | null
    }
  >()

  data.forEach(classroom => {
    classroom.days.forEach(day => {
      day.time_slots.forEach(slot => {
        if (!slots.has(slot.time_slot_id)) {
          slots.set(slot.time_slot_id, {
            id: slot.time_slot_id,
            code: slot.time_slot_code,
            name: slot.time_slot_name,
            display_order: slot.time_slot_display_order,
            start_time: slot.time_slot_start_time,
            end_time: slot.time_slot_end_time,
          })
        }
      })
    })
  })

  return Array.from(slots.values()).sort(
    (a, b) => (a.display_order ?? 999) - (b.display_order ?? 999)
  )
}

const getSlotForClassroom = (classroom: WeeklyScheduleDataByClassroom, timeSlotId: string) => {
  const day = classroom.days[0]
  if (!day) return null
  return day.time_slots.find(slot => slot.time_slot_id === timeSlotId) ?? null
}

export default function DailyScheduleReportPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const settingsKey = 'dailyScheduleReportSettings'
  const dailyDefaultsUrl = '/api/reports/daily-schedule/defaults'
  const initialDate = useMemo(() => {
    const paramDate = searchParams.get('date')
    if (isValidDateString(paramDate)) return paramDate as string
    return formatISO(new Date())
  }, [searchParams])

  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [showEnrollment, setShowEnrollment] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [showPreferredRatios, setShowPreferredRatios] = useState(false)
  const [showRequiredRatios, setShowRequiredRatios] = useState(false)
  const [showAbsencesAndSubs, setShowAbsencesAndSubs] = useState(true)
  const [colorFriendly, setColorFriendly] = useState(true)
  const [pdfLayout, setPdfLayout] = useState<'one' | 'two'>('one')
  const [teacherNameFormat, setTeacherNameFormat] = useState<'default' | 'first_last'>('default')
  const [paperSize, setPaperSize] = useState<'letter' | 'legal'>('letter')
  const [isPdfSettingsOpen, setIsPdfSettingsOpen] = useState(false)
  const { data, isLoading, error } = useDailySchedule(selectedDate)
  const [generatedAt, setGeneratedAt] = useState('')
  const pdfEnabled = isValidDateString(selectedDate)
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
  } = useReportDefaults({ defaultsUrl: dailyDefaultsUrl })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = window.localStorage.getItem(settingsKey)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as Partial<{
        showEnrollment: boolean
        showNotes: boolean
        showPreferredRatios: boolean
        showRequiredRatios: boolean
        showRatios: boolean
        showAbsencesAndSubs: boolean
        colorFriendly: boolean
        pdfLayout: 'one' | 'two'
        teacherNameFormat: 'default' | 'first_last'
        paperSize: 'letter' | 'legal'
      }>
      if (typeof parsed.showEnrollment === 'boolean') setShowEnrollment(parsed.showEnrollment)
      if (typeof parsed.showNotes === 'boolean') setShowNotes(parsed.showNotes)
      if (typeof parsed.showPreferredRatios === 'boolean') {
        setShowPreferredRatios(parsed.showPreferredRatios)
      } else if (typeof parsed.showRatios === 'boolean') {
        setShowPreferredRatios(parsed.showRatios)
      }
      if (typeof parsed.showRequiredRatios === 'boolean') {
        setShowRequiredRatios(parsed.showRequiredRatios)
      } else if (typeof parsed.showRatios === 'boolean') {
        setShowRequiredRatios(parsed.showRatios)
      }
      if (typeof parsed.showAbsencesAndSubs === 'boolean') {
        setShowAbsencesAndSubs(parsed.showAbsencesAndSubs)
      }
      if (typeof parsed.colorFriendly === 'boolean') setColorFriendly(parsed.colorFriendly)
      if (parsed.pdfLayout === 'one' || parsed.pdfLayout === 'two') {
        setPdfLayout(parsed.pdfLayout)
      }
      if (parsed.teacherNameFormat === 'default' || parsed.teacherNameFormat === 'first_last') {
        setTeacherNameFormat(parsed.teacherNameFormat)
      }
      if (parsed.paperSize === 'letter' || parsed.paperSize === 'legal') {
        setPaperSize(parsed.paperSize)
      }
    } catch {
      window.localStorage.removeItem(settingsKey)
    }
  }, [settingsKey])

  useEffect(() => {
    setGeneratedAt(formatGeneratedAt(new Date()))
  }, [selectedDate])

  const previewTopHeaderHtml = useMemo(
    () => sanitizeRichTextHtml(topHeaderHtml, 2000),
    [topHeaderHtml]
  )
  const previewFooterNotesHtml = useMemo(
    () => sanitizeRichTextHtml(footerNotesHtml, 4000),
    [footerNotesHtml]
  )
  useEffect(() => {
    const next = isValidDateString(selectedDate) ? selectedDate : ''
    const url = new URL(window.location.href)
    if (next) {
      url.searchParams.set('date', next)
    } else {
      url.searchParams.delete('date')
    }
    router.replace(`${url.pathname}?${url.searchParams.toString()}`)
  }, [router, selectedDate])

  const scheduleData = useMemo(() => data?.data ?? [], [data])
  const schoolClosures = useMemo(() => data?.school_closures ?? [], [data])
  const timeSlots = useMemo(() => buildTimeSlots(scheduleData), [scheduleData])
  const noSchedule = data?.no_schedule === true
  const noScheduleMessage =
    data?.no_schedule_message ||
    "No schedule is configured for this date. This day isn't included in your school's schedule."
  const nextScheduledDate = data?.next_scheduled_date ?? null
  const nextScheduledDayName = data?.next_scheduled_day_name ?? null
  const displayShowAbsencesAndSubs = showAbsencesAndSubs
  const displayColorFriendly = colorFriendly
  const displayCondensedLayout = false

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @media print {
          @page {
            size: ${paperSize} landscape;
            margin: 0.5in;
          }
          html,
          body {
            height: 100%;
          }
          body * {
            visibility: hidden;
          }
          body {
            print-color-adjust: exact;
            margin: 0 !important;
          }
          .daily-report-print-area {
            position: fixed;
            inset: 0;
            width: 100%;
            height: 100%;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box;
            visibility: visible;
            page-break-after: avoid;
          }
          .daily-report-print-area table {
            page-break-inside: avoid;
          }
          .daily-report-print-area {
            display: block;
          }
          .daily-report-print-area * {
            visibility: visible;
          }
          .daily-report-no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="daily-report-no-print flex flex-col gap-4 print:hidden">
        <div>
          <h1 className={getHeaderClasses('3xl')}>Today&apos;s Schedule</h1>
          <p className="text-muted-foreground mt-2">
            Printable daily schedule snapshot for all classrooms and time slots.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="w-full max-w-xs">
              <label className="mb-2 block text-sm font-medium text-slate-700">Select date</label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Previous day"
                  onClick={() => setSelectedDate(addDays(selectedDate, -1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <DatePickerInput value={selectedDate} onChange={setSelectedDate} closeOnSelect />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Next day"
                  onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
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
              <Popover open={isPdfSettingsOpen} onOpenChange={setIsPdfSettingsOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="icon" aria-label="PDF settings">
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72" align="start">
                  <div className="space-y-4 text-sm text-slate-700">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      PDF Options
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-teal-600"
                          checked={showEnrollment}
                          onChange={event => setShowEnrollment(event.target.checked)}
                        />
                        Show enrollments
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-teal-600"
                          checked={showNotes}
                          onChange={event => setShowNotes(event.target.checked)}
                        />
                        Show notes
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-teal-600"
                          checked={showPreferredRatios}
                          onChange={event => setShowPreferredRatios(event.target.checked)}
                        />
                        Show preferred ratios
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-teal-600"
                          checked={showRequiredRatios}
                          onChange={event => setShowRequiredRatios(event.target.checked)}
                        />
                        Show required ratios
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-teal-600"
                          checked={showAbsencesAndSubs}
                          onChange={event => setShowAbsencesAndSubs(event.target.checked)}
                        />
                        Show absences and subs
                      </label>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Teacher Name Format
                      </div>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="teacherNameFormat"
                          className="h-4 w-4 accent-teal-600"
                          checked={teacherNameFormat === 'default'}
                          onChange={() => setTeacherNameFormat('default')}
                        />
                        Default display name
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="teacherNameFormat"
                          className="h-4 w-4 accent-teal-600"
                          checked={teacherNameFormat === 'first_last'}
                          onChange={() => setTeacherNameFormat('first_last')}
                        />
                        First name Last name
                      </label>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Paper Size
                      </div>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="paperSize"
                          className="h-4 w-4 accent-teal-600"
                          checked={paperSize === 'letter'}
                          onChange={() => setPaperSize('letter')}
                        />
                        Letter
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="paperSize"
                          className="h-4 w-4 accent-teal-600"
                          checked={paperSize === 'legal'}
                          onChange={() => setPaperSize('legal')}
                        />
                        Legal
                      </label>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Layout
                      </div>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="pdfLayout"
                          className="h-4 w-4 accent-teal-600"
                          checked={pdfLayout === 'one'}
                          onChange={() => setPdfLayout('one')}
                        />
                        1 page
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="pdfLayout"
                          className="h-4 w-4 accent-teal-600"
                          checked={pdfLayout === 'two'}
                          onChange={() => setPdfLayout('two')}
                        />
                        2 pages
                      </label>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (typeof window === 'undefined') return
                        const payload = {
                          showEnrollment,
                          showNotes,
                          showPreferredRatios,
                          showRequiredRatios,
                          showAbsencesAndSubs,
                          colorFriendly,
                          pdfLayout,
                          teacherNameFormat,
                          paperSize,
                        }
                        window.localStorage.setItem(settingsKey, JSON.stringify(payload))
                        setIsPdfSettingsOpen(false)
                      }}
                    >
                      Save as default
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                disabled={!pdfEnabled || noSchedule}
                onClick={() => {
                  if (!pdfEnabled || noSchedule) return
                  toast('Opening PDF for print...')
                  const url = buildPdfUrl({
                    date: selectedDate,
                    showAbsencesAndSubs,
                    showEnrollment,
                    showNotes,
                    showPreferredRatios,
                    showRequiredRatios,
                    colorFriendly,
                    layout: pdfLayout,
                    teacherNameFormat,
                    paperSize,
                    topHeaderHtml,
                    footerNotesHtml,
                  })
                  const popup = window.open(url, '_blank', 'noopener,noreferrer')
                  if (!popup) {
                    toast.error('Popup blocked. Please allow popups to print the PDF.')
                  }
                }}
              >
                Print PDF
              </Button>
            </div>
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

      <Card className="daily-report-print-area print:shadow-none print:border-none">
        <CardContent className={displayCondensedLayout ? 'p-4 print:p-0' : 'p-6 print:p-0'}>
          <div className="mb-4 flex flex-col gap-1">
            <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-3">
              <div className="min-w-0">
                <h2 className="text-[16px] font-semibold text-slate-900">
                  {formatLongDate(selectedDate)}
                </h2>
                <p className="whitespace-nowrap text-xs italic text-slate-500">
                  Generated by Scheduler · {generatedAt || '—'}
                </p>
                <p className="whitespace-nowrap text-xs italic text-slate-500">
                  Changes after this time may not be reflected.
                </p>
              </div>
              <div className="mx-auto flex h-full w-[650px] max-w-full items-center justify-center px-2 py-1 text-center text-sm text-slate-700">
                {hasRichTextContent(previewTopHeaderHtml) ? (
                  <div dangerouslySetInnerHTML={{ __html: previewTopHeaderHtml }} />
                ) : null}
              </div>
              <div />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="text-slate-800">Permanent</span>
              </div>
              <div className="flex items-center gap-2">
                {!displayColorFriendly && <span className="text-slate-600">◦</span>}
                <span className={cn(displayColorFriendly ? 'text-blue-800' : 'text-slate-600')}>
                  Flex
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!displayColorFriendly && <span className="text-slate-600">◇</span>}
                <span className={cn(displayColorFriendly ? 'text-rose-700' : 'text-slate-600')}>
                  Temporary Coverage
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!displayColorFriendly && <span className="text-slate-600">↔</span>}
                <span className={cn(displayColorFriendly ? 'text-purple-700' : 'text-slate-600')}>
                  Floater
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CornerDownRight
                  className={cn(
                    'h-3 w-3',
                    displayColorFriendly ? 'text-teal-600' : 'text-slate-500'
                  )}
                />
                <span className={cn(displayColorFriendly ? 'text-teal-600' : 'text-slate-600')}>
                  Sub
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'line-through',
                    displayColorFriendly ? 'text-slate-500' : 'text-slate-600'
                  )}
                >
                  Absent
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(displayColorFriendly ? 'text-slate-600' : 'text-slate-700')}>
                  <span className="line-through">Reassigned</span> *
                </span>
              </div>
              {showRequiredRatios && showPreferredRatios && (
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span>(R) Required ratio · (P) Preferred ratio</span>
                </div>
              )}
            </div>
            {!showRequiredRatios && showPreferredRatios && (
              <div className="mt-2 text-xs text-slate-600">(P) Preferred ratio</div>
            )}
            {showRequiredRatios && !showPreferredRatios && (
              <div className="mt-2 text-xs text-slate-600">(R) Required ratio</div>
            )}
          </div>

          {isLoading && <p className="text-sm text-slate-500">Loading schedule...</p>}
          {error && (
            <p className="text-sm text-red-600">
              {error instanceof Error ? error.message : 'Failed to load schedule.'}
            </p>
          )}

          {!isLoading && !error && noSchedule && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-700">{noScheduleMessage}</p>
              {nextScheduledDate && (
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setSelectedDate(nextScheduledDate)}
                  >
                    Go to next scheduled day
                  </Button>
                  <span className="text-xs text-slate-500">
                    {nextScheduledDayName ? `${nextScheduledDayName} · ` : ''}
                    {formatLongDate(nextScheduledDate)}
                  </span>
                </div>
              )}
            </div>
          )}

          {!isLoading && !error && !noSchedule && (
            <div className="space-y-3">
              <div className="overflow-auto border rounded-md print:border-none print:overflow-visible">
                <table className="w-full table-fixed border-collapse">
                  <colgroup>
                    <col className={displayCondensedLayout ? 'w-[70px]' : 'w-[80px]'} />
                    {scheduleData.map(classroom => (
                      <col key={classroom.classroom_id} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      <th
                        className={cn(
                          'border bg-slate-50 px-3 py-2 text-left text-[12px] font-medium text-slate-700 print:bg-slate-50',
                          displayCondensedLayout && 'px-2 py-1'
                        )}
                      >
                        Time
                      </th>
                      {scheduleData.map(classroom => {
                        const split = splitClassroomName(classroom.classroom_name)
                        return (
                          <th
                            key={classroom.classroom_id}
                            className={cn(
                              'border px-3 py-2 text-center text-[9px] font-semibold tracking-[0.04em] uppercase text-slate-700 bg-white print:bg-white border-b-2 border-b-slate-400',
                              displayCondensedLayout && 'px-2 py-1'
                            )}
                            style={
                              displayColorFriendly && classroom.classroom_color
                                ? { color: classroom.classroom_color }
                                : undefined
                            }
                          >
                            <div className="flex flex-col items-center leading-tight text-center">
                              <div>{split.line1}</div>
                              {split.line2 && <div>{split.line2}</div>}
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {timeSlots.map(slot => {
                      const slotClosure = getSlotClosureOnDate(
                        selectedDate,
                        slot.id,
                        schoolClosures
                      )
                      const isSlotClosed = Boolean(slotClosure)
                      return (
                        <tr key={slot.id} className="align-top">
                          <td
                            className={cn(
                              'border bg-slate-50 px-3 py-2 align-middle text-xs font-medium text-slate-600',
                              displayCondensedLayout && 'px-2 py-1'
                            )}
                          >
                            <div className="flex flex-col gap-1">
                              <div className="text-sm text-slate-800">{slot.code}</div>
                              {slot.start_time && slot.end_time && (
                                <div className="text-[11px] font-medium text-slate-400 whitespace-pre-line">
                                  {formatSlotRange(slot.start_time, slot.end_time)}
                                </div>
                              )}
                            </div>
                          </td>
                          {isSlotClosed ? (
                            <td
                              colSpan={Math.max(scheduleData.length, 1)}
                              className={cn(
                                'border bg-slate-100 px-3 py-2 align-middle text-center text-sm font-medium text-slate-500',
                                displayCondensedLayout && 'px-2 py-1'
                              )}
                            >
                              <div className="flex flex-col items-center justify-center">
                                <span>School Closed</span>
                                {slotClosure?.reason?.trim() ? (
                                  <span className="mt-1 text-xs font-normal text-slate-500">
                                    {slotClosure.reason.trim()}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                          ) : (
                            scheduleData.map(classroom => {
                              const slotData = getSlotForClassroom(classroom, slot.id)
                              const assignments = slotData?.assignments ?? []
                              const enrollmentSummary = showEnrollment
                                ? getEnrollmentSummary(slotData)
                                : null
                              const youngestRatioGroup = getYoungestRatioGroup(slotData)
                              const slotNotes =
                                showNotes && slotData?.schedule_cell?.is_active
                                  ? (slotData?.schedule_cell?.notes?.trim() ?? '')
                                  : ''
                              const ratioSummary = formatRatioSummary({
                                showRequiredRatios,
                                showPreferredRatios,
                                requiredRatio: youngestRatioGroup?.required_ratio,
                                preferredRatio: youngestRatioGroup?.preferred_ratio,
                              })
                              const hasMetrics = Boolean(enrollmentSummary || ratioSummary)
                              const absences = slotData?.absences ?? []
                              const absentTeacherIds = new Set(
                                absences.map(absence => absence.teacher_id)
                              )
                              const subs = assignments.filter(a => a.is_substitute)
                              const substitutesByAbsentTeacher = new Map<string, typeof subs>()
                              subs.forEach(sub => {
                                if (!sub.absent_teacher_id) return
                                if (!substitutesByAbsentTeacher.has(sub.absent_teacher_id)) {
                                  substitutesByAbsentTeacher.set(sub.absent_teacher_id, [])
                                }
                                substitutesByAbsentTeacher.get(sub.absent_teacher_id)!.push(sub)
                              })
                              const regularTeachers = assignments
                                .filter(
                                  a =>
                                    !a.is_substitute &&
                                    !a.is_floater &&
                                    !absentTeacherIds.has(a.teacher_id) &&
                                    !a.is_flexible
                                )
                                .sort(sortByName)
                              const flexTeachers = assignments
                                .filter(
                                  a =>
                                    !a.is_substitute &&
                                    !a.is_floater &&
                                    a.is_flexible &&
                                    !a.staffing_event_id &&
                                    !absentTeacherIds.has(a.teacher_id)
                                )
                                .sort(sortByName)
                              const temporaryCoverageTeachers = assignments
                                .filter(
                                  a =>
                                    !a.is_substitute &&
                                    !a.is_floater &&
                                    a.is_flexible &&
                                    Boolean(a.staffing_event_id) &&
                                    !absentTeacherIds.has(a.teacher_id)
                                )
                                .sort(sortByName)
                              const floaters = assignments
                                .filter(
                                  a =>
                                    !a.is_substitute &&
                                    a.is_floater &&
                                    !absentTeacherIds.has(a.teacher_id)
                                )
                                .sort(sortByName)
                              const sortedAbsences = [...absences].sort(sortByName)
                              const teacherRows: Array<{
                                key: string
                                className: string
                                content: ReactNode
                              }> = []

                              regularTeachers.forEach(teacher => {
                                teacherRows.push({
                                  key: `regular-${teacher.id}`,
                                  className: 'text-slate-900',
                                  content: formatTeacherName(
                                    {
                                      teacher_name: teacher.teacher_name,
                                      teacher_first_name: teacher.teacher_first_name,
                                      teacher_last_name: teacher.teacher_last_name,
                                      teacher_display_name: teacher.teacher_display_name,
                                    },
                                    teacherNameFormat
                                  ),
                                })
                              })

                              flexTeachers.forEach(flexTeacher => {
                                teacherRows.push({
                                  key: `flex-${flexTeacher.id}`,
                                  className: displayColorFriendly
                                    ? 'text-blue-800'
                                    : 'text-slate-700',
                                  content: (
                                    <>
                                      {!displayColorFriendly && (
                                        <span className="text-slate-500">◦</span>
                                      )}{' '}
                                      {formatTeacherName(
                                        {
                                          teacher_name: flexTeacher.teacher_name,
                                          teacher_first_name: flexTeacher.teacher_first_name,
                                          teacher_last_name: flexTeacher.teacher_last_name,
                                          teacher_display_name: flexTeacher.teacher_display_name,
                                        },
                                        teacherNameFormat
                                      )}
                                    </>
                                  ),
                                })
                              })

                              temporaryCoverageTeachers.forEach(temporaryCoverageTeacher => {
                                teacherRows.push({
                                  key: `temporary-coverage-${temporaryCoverageTeacher.id}`,
                                  className: displayColorFriendly
                                    ? 'text-rose-700'
                                    : 'text-slate-700',
                                  content: (
                                    <>
                                      {!displayColorFriendly && (
                                        <span className="text-slate-500">◇</span>
                                      )}{' '}
                                      {formatTeacherName(
                                        {
                                          teacher_name: temporaryCoverageTeacher.teacher_name,
                                          teacher_first_name:
                                            temporaryCoverageTeacher.teacher_first_name,
                                          teacher_last_name:
                                            temporaryCoverageTeacher.teacher_last_name,
                                          teacher_display_name:
                                            temporaryCoverageTeacher.teacher_display_name,
                                        },
                                        teacherNameFormat
                                      )}
                                    </>
                                  ),
                                })
                              })

                              floaters.forEach(floater => {
                                teacherRows.push({
                                  key: `floater-${floater.id}`,
                                  className: displayColorFriendly
                                    ? 'text-purple-700'
                                    : 'text-slate-700',
                                  content: (
                                    <>
                                      {!displayColorFriendly && (
                                        <span className="text-slate-500">↔</span>
                                      )}{' '}
                                      {formatTeacherName(
                                        {
                                          teacher_name: floater.teacher_name,
                                          teacher_first_name: floater.teacher_first_name,
                                          teacher_last_name: floater.teacher_last_name,
                                          teacher_display_name: floater.teacher_display_name,
                                        },
                                        teacherNameFormat
                                      )}
                                    </>
                                  ),
                                })
                              })

                              if (displayShowAbsencesAndSubs) {
                                sortedAbsences.forEach(absence => {
                                  const subsForAbsence =
                                    substitutesByAbsentTeacher.get(absence.teacher_id) || []
                                  const isNoSub = !absence.has_sub && subsForAbsence.length === 0
                                  const isReassigned = absence.is_reassigned === true
                                  teacherRows.push({
                                    key: `absence-${absence.teacher_id}`,
                                    className: isReassigned ? 'text-slate-600' : 'text-slate-400',
                                    content: (
                                      <>
                                        {isReassigned ? (
                                          <span>
                                            <span className="line-through">
                                              {formatTeacherName(
                                                {
                                                  teacher_name: absence.teacher_name,
                                                  teacher_first_name: absence.teacher_first_name,
                                                  teacher_last_name: absence.teacher_last_name,
                                                  teacher_display_name:
                                                    absence.teacher_display_name,
                                                },
                                                teacherNameFormat
                                              )}
                                            </span>{' '}
                                            *
                                          </span>
                                        ) : (
                                          <span className="line-through">
                                            {formatTeacherName(
                                              {
                                                teacher_name: absence.teacher_name,
                                                teacher_first_name: absence.teacher_first_name,
                                                teacher_last_name: absence.teacher_last_name,
                                                teacher_display_name: absence.teacher_display_name,
                                              },
                                              teacherNameFormat
                                            )}
                                          </span>
                                        )}
                                      </>
                                    ),
                                  })

                                  if (isNoSub && !isReassigned) {
                                    const noSubArrowClass = displayColorFriendly
                                      ? 'text-amber-700'
                                      : 'text-slate-500'
                                    const noSubBadgeClass = displayColorFriendly
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-slate-100 text-slate-600'
                                    teacherRows.push({
                                      key: `no-sub-${absence.teacher_id}`,
                                      className: displayColorFriendly
                                        ? 'text-amber-700'
                                        : 'text-slate-600',
                                      content: (
                                        <span className="inline-flex items-center gap-1">
                                          <CornerDownRight
                                            className={cn('h-3 w-3', noSubArrowClass)}
                                          />
                                          <span
                                            className={cn(
                                              'rounded-[2px] px-1 py-0.5 text-[11px] font-medium leading-4',
                                              noSubBadgeClass
                                            )}
                                          >
                                            No sub
                                          </span>
                                        </span>
                                      ),
                                    })
                                  }

                                  subsForAbsence.forEach(sub => {
                                    teacherRows.push({
                                      key: `sub-${sub.id}`,
                                      className: displayColorFriendly
                                        ? 'text-teal-600'
                                        : 'text-slate-700',
                                      content: (
                                        <span className="inline-flex items-center gap-1">
                                          <CornerDownRight
                                            className={cn(
                                              'h-3 w-3',
                                              displayColorFriendly
                                                ? 'text-teal-600'
                                                : 'text-slate-500'
                                            )}
                                          />
                                          <span>
                                            {formatTeacherName(
                                              {
                                                teacher_name: sub.teacher_name,
                                                teacher_first_name: sub.teacher_first_name,
                                                teacher_last_name: sub.teacher_last_name,
                                                teacher_display_name: sub.teacher_display_name,
                                              },
                                              teacherNameFormat
                                            )}
                                          </span>
                                        </span>
                                      ),
                                    })
                                  })
                                })
                              }

                              return (
                                <td
                                  key={classroom.classroom_id}
                                  className={cn(
                                    'border px-2.5 py-2',
                                    displayCondensedLayout && 'px-2 py-1'
                                  )}
                                >
                                  <div
                                    className={cn(
                                      'space-y-1.5',
                                      displayCondensedLayout && 'space-y-1'
                                    )}
                                  >
                                    {hasMetrics && (
                                      <div className="-mx-0.5 mb-2 rounded-[2px] bg-slate-50 px-1.5 py-1 text-[10px] font-medium leading-4 text-slate-500">
                                        <div className="space-y-0">
                                          {enrollmentSummary && <div>{enrollmentSummary}</div>}
                                          {ratioSummary && <div>{ratioSummary}</div>}
                                        </div>
                                      </div>
                                    )}
                                    {teacherRows.length > 0 && (
                                      <ul className="space-y-0 text-[12px] font-medium leading-4 text-slate-700">
                                        {teacherRows.map(row => (
                                          <li
                                            key={row.key}
                                            className={cn('leading-4', row.className)}
                                          >
                                            {row.content}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                    {slotNotes ? (
                                      <div className="mt-2 border-t border-slate-200 pt-1 text-[11px] leading-4 text-slate-600">
                                        {slotNotes}
                                      </div>
                                    ) : null}
                                  </div>
                                </td>
                              )
                            })
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {hasRichTextContent(previewFooterNotesHtml) ? (
                <div
                  className="w-full rounded-md bg-white px-3 py-2 text-sm text-slate-700"
                  dangerouslySetInnerHTML={{ __html: previewFooterNotesHtml }}
                />
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
