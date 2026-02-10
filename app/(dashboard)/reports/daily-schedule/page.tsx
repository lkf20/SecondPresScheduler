'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CornerDownRight } from 'lucide-react'
import DatePickerInput from '@/components/ui/date-picker-input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
  const isPM = endHourNum >= 12
  const suffix = isPM ? 'PM' : 'AM'
  return `${formatSlotTime(start)} - ${formatSlotTime(end)} ${suffix}`
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
  const [condensedLayout, setCondensedLayout] = useState(false)
  const { data, isLoading, error } = useDailySchedule(selectedDate)
  const [generatedAt, setGeneratedAt] = useState('')

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
        condensedLayout: boolean
      }>
      if (typeof parsed.showEnrollment === 'boolean') setShowEnrollment(parsed.showEnrollment)
      if (typeof parsed.showRatios === 'boolean') setShowRatios(parsed.showRatios)
      if (typeof parsed.showAbsencesAndSubs === 'boolean') {
        setShowAbsencesAndSubs(parsed.showAbsencesAndSubs)
      }
      if (typeof parsed.colorFriendly === 'boolean') setColorFriendly(parsed.colorFriendly)
      if (typeof parsed.condensedLayout === 'boolean') setCondensedLayout(parsed.condensedLayout)
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

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @media print {
          @page {
            size: letter landscape;
            margin: 0.5in;
          }
          body {
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="flex flex-col gap-4 print:hidden">
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
              <DatePickerInput value={selectedDate} onChange={setSelectedDate} closeOnSelect />
            </div>
            <Button type="button" onClick={() => window.print()}>
              Print
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-700">
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
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-teal-600"
                checked={condensedLayout}
                onChange={event => setCondensedLayout(event.target.checked)}
              />
              Condensed layout
            </label>
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
                  condensedLayout,
                }
                window.localStorage.setItem(settingsKey, JSON.stringify(payload))
              }}
            >
              Save as default
            </Button>
          </div>
        </div>
      </div>

      <Card className="print:shadow-none print:border-none">
        <CardContent className={condensedLayout ? 'p-4 print:p-0' : 'p-6 print:p-0'}>
          <div className="mb-4 flex flex-col gap-1">
            <h2 className="text-2xl font-semibold text-slate-900">
              {formatLongDate(selectedDate)}
            </h2>
            <p className="text-sm text-slate-500">
              Generated by Scheduler * {generatedAt || '—'} * Changes after this time may not be
              reflected.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className={cn(colorFriendly ? 'text-blue-700' : 'text-slate-600')}>
                  Permanent
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(colorFriendly ? 'text-purple-700' : 'text-slate-600')}>◇</span>
                <span>Floater</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(colorFriendly ? 'text-teal-600' : 'text-slate-600')}>→</span>
                <span>Sub</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(colorFriendly ? 'text-slate-500' : 'text-slate-600')}>×</span>
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
              <table
                className={cn(
                  'w-full table-fixed border-collapse text-sm',
                  condensedLayout && 'text-xs'
                )}
              >
                <colgroup>
                  <col className={condensedLayout ? 'w-[90px]' : 'w-[120px]'} />
                  {scheduleData.map(classroom => (
                    <col key={classroom.classroom_id} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th
                      className={cn(
                        'border px-3 py-2 text-left font-medium text-slate-700 bg-white print:bg-white',
                        condensedLayout && 'px-2 py-1'
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
                            'border px-3 py-2 text-center font-medium text-slate-700 bg-white print:bg-white border-b-2 border-b-slate-400',
                            condensedLayout && 'px-2 py-1'
                          )}
                          style={
                            colorFriendly && classroom.classroom_color
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
                          condensedLayout && 'px-2 py-1'
                        )}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="text-sm text-slate-800">{slot.code}</div>
                          {slot.name && <div className="text-xs text-slate-500">{slot.name}</div>}
                          {slot.start_time && slot.end_time && (
                            <div className="text-[11px] text-slate-400">
                              {formatSlotRange(slot.start_time, slot.end_time)}
                            </div>
                          )}
                        </div>
                      </td>
                      {scheduleData.map(classroom => {
                        const slotData = getSlotForClassroom(classroom, slot.id)
                        const assignments = slotData?.assignments ?? []
                        const absences = slotData?.absences ?? []
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
                          .filter(a => !a.is_substitute && !a.is_floater)
                          .sort(sortByName)
                        const floaters = assignments
                          .filter(a => !a.is_substitute && a.is_floater)
                          .sort(sortByName)
                        const sortedAbsences = [...absences].sort(sortByName)

                        return (
                          <td
                            key={classroom.classroom_id}
                            className={cn('border px-3 py-2', condensedLayout && 'px-2 py-1')}
                          >
                            <div className={cn('space-y-2', condensedLayout && 'space-y-1')}>
                              {regularTeachers.length > 0 && (
                                <div>
                                  <ul className="mt-1 space-y-1 text-sm font-medium text-slate-700">
                                    {regularTeachers.map(teacher => (
                                      <li
                                        key={teacher.id}
                                        className={cn(
                                          colorFriendly ? 'text-blue-700' : 'text-slate-700'
                                        )}
                                      >
                                        {teacher.teacher_name}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {floaters.length > 0 && (
                                <div>
                                  <ul className="mt-1 space-y-1 text-sm font-medium text-slate-700">
                                    {floaters.map(floater => (
                                      <li
                                        key={floater.id}
                                        className={cn(
                                          colorFriendly ? 'text-purple-700' : 'text-slate-700'
                                        )}
                                      >
                                        <span
                                          className={cn(
                                            colorFriendly ? 'text-purple-700' : 'text-slate-500'
                                          )}
                                        >
                                          ◇
                                        </span>{' '}
                                        {floater.teacher_name}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {showAbsencesAndSubs && sortedAbsences.length > 0 && (
                                <div>
                                  <ul className="mt-1 space-y-1 text-sm font-medium text-slate-700">
                                    {sortedAbsences.map(absence => {
                                      const subsForAbsence =
                                        substitutesByAbsentTeacher.get(absence.teacher_id) || []
                                      return (
                                        <li key={absence.teacher_id} className="space-y-1">
                                          <div
                                            className={cn(
                                              colorFriendly ? 'text-slate-500' : 'text-slate-700'
                                            )}
                                          >
                                            <span className="mr-1">×</span>
                                            {absence.teacher_name}
                                            {!absence.has_sub && subsForAbsence.length === 0 && (
                                              <span
                                                className={cn(
                                                  colorFriendly
                                                    ? 'text-slate-400'
                                                    : 'text-slate-600'
                                                )}
                                              >
                                                {' '}
                                                (no sub)
                                              </span>
                                            )}
                                          </div>
                                          {subsForAbsence.map(sub => (
                                            <div
                                              key={sub.id}
                                              className={cn(
                                                'ml-3 flex items-center gap-1',
                                                colorFriendly ? 'text-teal-600' : 'text-slate-700'
                                              )}
                                            >
                                              <CornerDownRight
                                                className={cn(
                                                  'h-3 w-3',
                                                  colorFriendly
                                                    ? 'text-slate-400'
                                                    : 'text-slate-500'
                                                )}
                                              />
                                              <span>→ {sub.teacher_name}</span>
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
