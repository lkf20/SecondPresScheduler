'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, CornerDownRight, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import DatePickerInput from '@/components/ui/date-picker-input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useDailySchedule } from '@/lib/hooks/use-daily-schedule'
import { getHeaderClasses } from '@/lib/utils/colors'
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

const formatTeacherName = (
  source: TeacherNameSource,
  format: 'default' | 'first_last' | 'first_last_initial' | 'first_initial_last' | 'first'
) => {
  const { display, first, last } = deriveNameParts(source)
  if (!display) return ''
  if (format === 'default') return display
  switch (format) {
    case 'first_last':
      return last ? `${first} ${last}` : first
    case 'first_last_initial':
      return last ? `${first} ${last.charAt(0)}.` : first
    case 'first_initial_last':
      return last ? `${first.charAt(0)}. ${last}` : first
    case 'first':
      return first
    default:
      return display
  }
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
  colorFriendly,
  layout,
  teacherNameFormat,
}: {
  date: string
  showAbsencesAndSubs: boolean
  colorFriendly: boolean
  layout: 'one' | 'two'
  teacherNameFormat:
    | 'default'
    | 'first_last'
    | 'first_last_initial'
    | 'first_initial_last'
    | 'first'
}) => {
  const params = new URLSearchParams()
  params.set('date', date)
  params.set('showAbsencesAndSubs', String(showAbsencesAndSubs))
  params.set('colorFriendly', String(colorFriendly))
  params.set('layout', layout)
  params.set('teacherNameFormat', teacherNameFormat)
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
  const initialDate = useMemo(() => {
    const paramDate = searchParams.get('date')
    if (isValidDateString(paramDate)) return paramDate as string
    return formatISO(new Date())
  }, [searchParams])

  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [showEnrollment, setShowEnrollment] = useState(false)
  const [showRatios, setShowRatios] = useState(false)
  const [showAbsencesAndSubs, setShowAbsencesAndSubs] = useState(true)
  const [colorFriendly, setColorFriendly] = useState(false)
  const [pdfLayout, setPdfLayout] = useState<'one' | 'two'>('one')
  const [teacherNameFormat, setTeacherNameFormat] = useState<
    'default' | 'first_last' | 'first_last_initial' | 'first_initial_last' | 'first'
  >('default')
  const { data, isLoading, error } = useDailySchedule(selectedDate)
  const [generatedAt, setGeneratedAt] = useState('')
  const pdfEnabled = isValidDateString(selectedDate)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = window.localStorage.getItem(settingsKey)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as Partial<{
        showEnrollment: boolean
        showRatios: boolean
        showAbsencesAndSubs: boolean
        colorFriendly: boolean
        pdfLayout: 'one' | 'two'
        teacherNameFormat:
          | 'default'
          | 'first_last'
          | 'first_last_initial'
          | 'first_initial_last'
          | 'first'
      }>
      if (typeof parsed.showEnrollment === 'boolean') setShowEnrollment(parsed.showEnrollment)
      if (typeof parsed.showRatios === 'boolean') setShowRatios(parsed.showRatios)
      if (typeof parsed.showAbsencesAndSubs === 'boolean') {
        setShowAbsencesAndSubs(parsed.showAbsencesAndSubs)
      }
      if (typeof parsed.colorFriendly === 'boolean') setColorFriendly(parsed.colorFriendly)
      if (parsed.pdfLayout === 'one' || parsed.pdfLayout === 'two') {
        setPdfLayout(parsed.pdfLayout)
      }
      if (
        parsed.teacherNameFormat === 'default' ||
        parsed.teacherNameFormat === 'first_last' ||
        parsed.teacherNameFormat === 'first_last_initial' ||
        parsed.teacherNameFormat === 'first_initial_last' ||
        parsed.teacherNameFormat === 'first'
      ) {
        setTeacherNameFormat(parsed.teacherNameFormat)
      }
    } catch {
      window.localStorage.removeItem(settingsKey)
    }
  }, [settingsKey])

  useEffect(() => {
    setGeneratedAt(formatGeneratedAt(new Date()))
  }, [selectedDate])

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
  const timeSlots = useMemo(() => buildTimeSlots(scheduleData), [scheduleData])
  const displayShowAbsencesAndSubs = true
  const displayColorFriendly = colorFriendly
  const displayCondensedLayout = false

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @media print {
          @page {
            size: letter landscape;
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
              <Popover>
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
                        Show enrollment
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-teal-600"
                          checked={showRatios}
                          onChange={event => setShowRatios(event.target.checked)}
                        />
                        Show ratios
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
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-teal-600"
                          checked={colorFriendly}
                          onChange={event => setColorFriendly(event.target.checked)}
                        />
                        Color-friendly layout
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
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="teacherNameFormat"
                          className="h-4 w-4 accent-teal-600"
                          checked={teacherNameFormat === 'first_last_initial'}
                          onChange={() => setTeacherNameFormat('first_last_initial')}
                        />
                        First name Last initial
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="teacherNameFormat"
                          className="h-4 w-4 accent-teal-600"
                          checked={teacherNameFormat === 'first_initial_last'}
                          onChange={() => setTeacherNameFormat('first_initial_last')}
                        />
                        First initial Last name
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="teacherNameFormat"
                          className="h-4 w-4 accent-teal-600"
                          checked={teacherNameFormat === 'first'}
                          onChange={() => setTeacherNameFormat('first')}
                        />
                        First name only
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
                          showRatios,
                          showAbsencesAndSubs,
                          colorFriendly,
                          pdfLayout,
                          teacherNameFormat,
                        }
                        window.localStorage.setItem(settingsKey, JSON.stringify(payload))
                      }}
                    >
                      Save as default
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="outline"
                disabled={!pdfEnabled}
                onClick={() => {
                  if (!pdfEnabled) return
                  toast('Generating PDF...')
                  const url = buildPdfUrl({
                    date: selectedDate,
                    showAbsencesAndSubs,
                    colorFriendly,
                    layout: pdfLayout,
                    teacherNameFormat,
                  })
                  const popup = window.open(url, '_blank', 'noopener,noreferrer')
                  if (!popup) {
                    toast.error('Popup blocked. Please allow popups to download the PDF.')
                  }
                }}
              >
                Download PDF
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (!pdfEnabled) return
                  toast('Opening PDF for print...')
                  const url = buildPdfUrl({
                    date: selectedDate,
                    showAbsencesAndSubs,
                    colorFriendly,
                    layout: pdfLayout,
                    teacherNameFormat,
                  })
                  const popup = window.open(url, '_blank', 'noopener,noreferrer')
                  if (!popup) {
                    toast.error('Popup blocked. Please allow popups to print the PDF.')
                  }
                }}
              >
                Print
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Card className="daily-report-print-area print:shadow-none print:border-none">
        <CardContent className={displayCondensedLayout ? 'p-4 print:p-0' : 'p-6 print:p-0'}>
          <div className="mb-4 flex flex-col gap-1">
            <h2 className="text-[16px] font-semibold text-slate-900">
              {formatLongDate(selectedDate)}
            </h2>
            <p className="text-xs italic text-slate-500">
              Generated by Scheduler · {generatedAt || '—'} · Changes after this time may not be
              reflected.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="text-slate-800">Permanent</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(displayColorFriendly ? 'text-purple-700' : 'text-slate-600')}>
                  ◇
                </span>
                <span>Floater</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(displayColorFriendly ? 'text-teal-600' : 'text-slate-600')}>
                  →
                </span>
                <span>Sub</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(displayColorFriendly ? 'text-slate-500' : 'text-slate-600')}>
                  ×
                </span>
                <span>Absent</span>
              </div>
            </div>
          </div>

          {isLoading && <p className="text-sm text-slate-500">Loading schedule...</p>}
          {error && (
            <p className="text-sm text-red-600">
              {error instanceof Error ? error.message : 'Failed to load schedule.'}
            </p>
          )}

          {!isLoading && !error && (
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
                        'border px-3 py-2 text-left text-[12px] font-medium text-slate-700 bg-white print:bg-white',
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
                            'border px-3 py-2 text-center text-[10px] font-semibold tracking-[0.04em] uppercase text-slate-700 bg-white print:bg-white border-b-2 border-b-slate-400',
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
                  {timeSlots.map(slot => (
                    <tr key={slot.id} className="align-top">
                      <td
                        className={cn(
                          'border px-3 py-2 align-middle text-xs font-medium text-slate-600',
                          displayCondensedLayout && 'px-2 py-1'
                        )}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="text-sm text-slate-800">{slot.code}</div>
                          {slot.start_time && slot.end_time && (
                            <div className="text-[11px] text-slate-400 whitespace-pre-line">
                              {formatSlotRange(slot.start_time, slot.end_time)}
                            </div>
                          )}
                        </div>
                      </td>
                      {scheduleData.map(classroom => {
                        const slotData = getSlotForClassroom(classroom, slot.id)
                        const assignments = slotData?.assignments ?? []
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

                        return (
                          <td
                            key={classroom.classroom_id}
                            className={cn(
                              'border px-3 py-2',
                              displayCondensedLayout && 'px-2 py-1'
                            )}
                          >
                            <div className={cn('space-y-2', displayCondensedLayout && 'space-y-1')}>
                              {regularTeachers.length > 0 && (
                                <div>
                                  <ul className="mt-1 space-y-1 text-[12px] font-medium text-slate-700">
                                    {regularTeachers.map(teacher => (
                                      <li key={teacher.id} className={cn('text-slate-900')}>
                                        {formatTeacherName(
                                          {
                                            teacher_name: teacher.teacher_name,
                                            teacher_first_name: teacher.teacher_first_name,
                                            teacher_last_name: teacher.teacher_last_name,
                                            teacher_display_name: teacher.teacher_display_name,
                                          },
                                          teacherNameFormat
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {floaters.length > 0 && (
                                <div>
                                  <ul className="mt-1 space-y-1 text-[12px] font-medium text-slate-700">
                                    {floaters.map(floater => (
                                      <li
                                        key={floater.id}
                                        className={cn(
                                          displayColorFriendly
                                            ? 'text-purple-700'
                                            : 'text-slate-700'
                                        )}
                                      >
                                        <span
                                          className={cn(
                                            displayColorFriendly
                                              ? 'text-purple-700'
                                              : 'text-slate-500'
                                          )}
                                        >
                                          ◇
                                        </span>{' '}
                                        {formatTeacherName(
                                          {
                                            teacher_name: floater.teacher_name,
                                            teacher_first_name: floater.teacher_first_name,
                                            teacher_last_name: floater.teacher_last_name,
                                            teacher_display_name: floater.teacher_display_name,
                                          },
                                          teacherNameFormat
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {displayShowAbsencesAndSubs && sortedAbsences.length > 0 && (
                                <div>
                                  <ul className="mt-1 space-y-1 text-[12px] font-medium text-slate-700">
                                    {sortedAbsences.map(absence => {
                                      const subsForAbsence =
                                        substitutesByAbsentTeacher.get(absence.teacher_id) || []
                                      return (
                                        <li key={absence.teacher_id} className="space-y-1">
                                          <div className={cn('text-slate-400')}>
                                            <span className="mr-1">×</span>
                                            {formatTeacherName(
                                              {
                                                teacher_name: absence.teacher_name,
                                                teacher_first_name: absence.teacher_first_name,
                                                teacher_last_name: absence.teacher_last_name,
                                                teacher_display_name: absence.teacher_display_name,
                                              },
                                              teacherNameFormat
                                            )}
                                            {!absence.has_sub && subsForAbsence.length === 0 && (
                                              <span className="text-slate-400"> (no sub)</span>
                                            )}
                                          </div>
                                          {subsForAbsence.map(sub => (
                                            <div
                                              key={sub.id}
                                              className={cn(
                                                'ml-3 flex items-center gap-1',
                                                displayColorFriendly
                                                  ? 'text-teal-600'
                                                  : 'text-slate-700'
                                              )}
                                            >
                                              <CornerDownRight
                                                className={cn(
                                                  'h-3 w-3',
                                                  displayColorFriendly
                                                    ? 'text-slate-400'
                                                    : 'text-slate-500'
                                                )}
                                              />
                                              <span>
                                                →{' '}
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
                                            </div>
                                          ))}
                                        </li>
                                      )
                                    })}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
