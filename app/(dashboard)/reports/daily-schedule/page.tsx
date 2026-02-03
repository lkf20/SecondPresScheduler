'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DatePickerInput from '@/components/ui/date-picker-input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useDailySchedule } from '@/lib/hooks/use-daily-schedule'
import { getHeaderClasses } from '@/lib/utils/colors'
import type { WeeklyScheduleDataByClassroom } from '@/lib/api/weekly-schedule'

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
  const initialDate = useMemo(() => {
    const paramDate = searchParams.get('date')
    if (isValidDateString(paramDate)) return paramDate as string
    return formatISO(new Date())
  }, [searchParams])

  const [selectedDate, setSelectedDate] = useState(initialDate)
  const { data, isLoading, error } = useDailySchedule(selectedDate)
  const generatedAt = useMemo(() => formatGeneratedAt(new Date()), [])

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
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="w-full max-w-xs">
            <label className="mb-2 block text-sm font-medium text-slate-700">Select date</label>
            <DatePickerInput value={selectedDate} onChange={setSelectedDate} closeOnSelect />
          </div>
          <Button type="button" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>

      <Card className="print:shadow-none print:border-none">
        <CardContent className="p-6 print:p-0">
          <div className="mb-4 flex flex-col gap-1">
            <h2 className="text-2xl font-semibold text-slate-900">
              {formatLongDate(selectedDate)}
            </h2>
            <p className="text-sm text-slate-500">
              Generated by Scheduler * {generatedAt} * Changes after this time may not be reflected.
            </p>
          </div>

          {isLoading && <p className="text-sm text-slate-500">Loading schedule...</p>}
          {error && (
            <p className="text-sm text-red-600">
              {error instanceof Error ? error.message : 'Failed to load schedule.'}
            </p>
          )}

          {!isLoading && !error && (
            <div className="overflow-auto border rounded-md print:border-none print:overflow-visible">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border bg-slate-100 px-3 py-2 text-left font-medium text-slate-700 print:bg-slate-200">
                      Time
                    </th>
                    {scheduleData.map(classroom => (
                      <th
                        key={classroom.classroom_id}
                        className="border bg-slate-100 px-3 py-2 text-left font-medium text-slate-700 print:bg-slate-200"
                      >
                        {classroom.classroom_name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.map(slot => (
                    <tr key={slot.id} className="align-top">
                      <td className="border px-3 py-2 text-xs font-medium text-slate-600">
                        <div className="text-sm text-slate-800">{slot.code}</div>
                        {slot.name && <div className="text-xs text-slate-500">{slot.name}</div>}
                        {slot.start_time && slot.end_time && (
                          <div className="text-[11px] text-slate-400">
                            {formatSlotRange(slot.start_time, slot.end_time)}
                          </div>
                        )}
                      </td>
                      {scheduleData.map(classroom => {
                        const slotData = getSlotForClassroom(classroom, slot.id)
                        const assignments = slotData?.assignments ?? []
                        const absences = slotData?.absences ?? []
                        const absencesByTeacher = new Map(
                          absences.map(absence => [absence.teacher_id, absence])
                        )
                        const teachers = assignments.filter(a => !a.is_substitute)
                        const subs = assignments.filter(a => a.is_substitute)

                        return (
                          <td key={classroom.classroom_id} className="border px-3 py-2">
                            <div className="space-y-2">
                              {teachers.length > 0 && (
                                <div>
                                  <div className="text-[11px] uppercase tracking-wide text-slate-400">
                                    Teachers
                                  </div>
                                  <ul className="mt-1 space-y-1 text-sm text-slate-700">
                                    {teachers.map(teacher => (
                                      <li key={teacher.id}>{teacher.teacher_name}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {subs.length > 0 && (
                                <div>
                                  <div className="text-[11px] uppercase tracking-wide text-slate-400">
                                    Subs
                                  </div>
                                  <ul className="mt-1 space-y-1 text-sm text-slate-700">
                                    {subs.map(sub => {
                                      const absent =
                                        sub.absent_teacher_id &&
                                        absencesByTeacher.get(sub.absent_teacher_id)
                                      const absentLabel = absent
                                        ? ` (for ${absent.teacher_name})`
                                        : ''
                                      return (
                                        <li key={sub.id}>
                                          {sub.teacher_name}
                                          <span className="text-slate-500">{absentLabel}</span>
                                        </li>
                                      )
                                    })}
                                  </ul>
                                </div>
                              )}

                              {absences.length > 0 && (
                                <div>
                                  <div className="text-[11px] uppercase tracking-wide text-slate-400">
                                    Absences
                                  </div>
                                  <ul className="mt-1 space-y-1 text-sm text-slate-700">
                                    {absences.map(absence => (
                                      <li key={absence.teacher_id}>
                                        {absence.teacher_name}
                                        {!absence.has_sub && (
                                          <span className="text-rose-600"> (no sub)</span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {teachers.length === 0 &&
                                subs.length === 0 &&
                                absences.length === 0 && (
                                  <div className="text-xs text-slate-400">No assignments</div>
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
