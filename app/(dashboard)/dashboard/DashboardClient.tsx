'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  CalendarDays,
  Calendar,
  PieChart,
  CheckCircle2,
  Users,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getClassroomPillStyle } from '@/lib/utils/classroom-style'

type Summary = {
  absences: number
  uncovered_shifts: number
  partially_covered_shifts: number
  scheduled_subs: number
}

type CoverageRequestItem = {
  id: string
  teacher_name: string
  start_date: string
  end_date: string
  reason: string | null
  notes: string | null
  classrooms: Array<{ id: string; name: string; color: string | null }>
  classroom_label: string
  total_shifts: number
  assigned_shifts: number
  uncovered_shifts: number
  remaining_shifts: number
  status: 'needs_coverage' | 'partially_covered' | 'covered'
}

type ScheduledSubItem = {
  id: string
  date: string
  day_name: string
  time_slot_code: string
  classroom_name: string
  classroom_color: string | null
  notes: string | null
  sub_name: string
  teacher_name: string
}

type StaffingTargetItem = {
  id: string
  day_of_week_id: string
  day_name: string
  day_number: number
  day_order: number
  time_slot_id: string
  time_slot_code: string
  time_slot_order: number
  classroom_id: string
  classroom_name: string
  classroom_color: string | null
  required_staff: number
  preferred_staff: number | null
  scheduled_staff: number
  status: 'below_required' | 'below_preferred'
}

type DashboardOverview = {
  summary: Summary
  coverage_requests: CoverageRequestItem[]
  staffing_targets: StaffingTargetItem[]
  scheduled_subs: ScheduledSubItem[]
}

const formatDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`)
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

const formatDayName = (value: string) => {
  const date = new Date(`${value}T00:00:00`)
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date)
}

const formatDayTime = (dayName: string, date: string, timeSlotCode: string) => {
  const dateLabel = formatDate(date)
  return `${dayName} ${dateLabel} · ${timeSlotCode}`
}

const formatSlotLabel = (dayName: string, timeSlotCode: string) =>
  `${dayName || '—'} - ${timeSlotCode}`

const formatDateRange = (startDate: string, endDate: string) => {
  if (!endDate || endDate === startDate) {
    return `${formatDate(startDate)} (${formatDayName(startDate)})`
  }
  return `${formatDate(startDate)} - ${formatDate(endDate)} (${formatDayName(startDate)} - ${formatDayName(endDate)})`
}

const normalizeWeekday = (label: string) => (label === 'Tue' ? 'Tues' : label)

const formatFullDateLabel = (value: string) => {
  const date = new Date(`${value}T00:00:00`)
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date)
  const dateLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
  return `${weekday} ${dateLabel}`
}

const formatShortfallLabel = (shortfall: number) =>
  `Below ${shortfall === 1 ? 'by 1' : `by ${shortfall}`}`

const formatShortfallValue = (required: number, scheduled: number) =>
  Math.max(0, required - scheduled)

  const staffingBadge = (status: StaffingTargetItem['status']) => {
  switch (status) {
    case 'below_required':
      return 'bg-amber-100 text-amber-900 border-amber-200'
    case 'below_preferred':
      return 'bg-amber-50 text-amber-800 border-amber-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

const groupStaffingTargets = (slots: StaffingTargetItem[]) => {
  const classroomMap = new Map<
    string,
    {
      classroom_name: string
      classroom_color: string | null
      slots: StaffingTargetItem[]
    }
  >()

  slots.forEach((slot) => {
    const entry = classroomMap.get(slot.classroom_id) || {
      classroom_name: slot.classroom_name,
      classroom_color: slot.classroom_color ?? null,
      slots: [],
    }
    entry.slots.push(slot)
    classroomMap.set(slot.classroom_id, entry)
  })

  const classrooms = Array.from(classroomMap.values()).sort((a, b) =>
    a.classroom_name.localeCompare(b.classroom_name)
  )

  return classrooms.map((classroom) => ({
    ...classroom,
    slots: classroom.slots.sort((a, b) => {
      if (a.day_order !== b.day_order) {
        return a.day_order - b.day_order
      }
      return a.time_slot_order - b.time_slot_order
    }),
  }))
}

export default function DashboardClient({
  overview,
  startDate,
  endDate,
}: {
  overview: DashboardOverview
  startDate: string
  endDate: string
}) {
  const [greetingName, setGreetingName] = useState<string | null>(null)
  const [greetingTime, setGreetingTime] = useState('Good Morning')
  const [belowRequiredCollapsed, setBelowRequiredCollapsed] = useState(false)
  const [belowPreferredCollapsed, setBelowPreferredCollapsed] = useState(false)
  const [coverageFilter, setCoverageFilter] = useState<'needs' | 'covered' | 'all'>(
    'needs'
  )

  useEffect(() => {
    const hour = new Date().getHours()
    const greeting =
      hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'
    setGreetingTime(greeting)

    const loadProfile = async () => {
      try {
        const response = await fetch('/api/setup/profile')
        if (!response.ok) return
        const data = await response.json()
        const firstName = data?.profile?.first_name
        if (typeof firstName === 'string' && firstName.trim()) {
          setGreetingName(firstName.trim())
        }
      } catch (error) {
        console.error('Failed to load profile name:', error)
      }
    }
    loadProfile()
  }, [])

  const belowRequiredClassrooms = useMemo(() => {
    const classrooms = new Set<string>()
    overview.staffing_targets
      .filter((slot) => slot.status === 'below_required')
      .forEach((slot) => classrooms.add(slot.classroom_id))
    return classrooms.size
  }, [overview.staffing_targets])

  const belowPreferredClassrooms = useMemo(() => {
    const classrooms = new Set<string>()
    overview.staffing_targets
      .filter((slot) => slot.status === 'below_preferred')
      .forEach((slot) => classrooms.add(slot.classroom_id))
    return classrooms.size
  }, [overview.staffing_targets])

  const summaryItems = useMemo(
    () => [
      {
        key: 'uncovered' as const,
        label: 'Uncovered Shifts',
        count: overview.summary.uncovered_shifts,
        tone: 'text-amber-900',
        cardStyle: 'border-slate-200 bg-white text-orange-900',
        icon: AlertTriangle,
        iconStyle: 'bg-orange-200 text-orange-800',
      },
      {
        key: 'partial' as const,
        label: 'Partially Covered Shifts',
        count: overview.summary.partially_covered_shifts,
        tone: 'text-amber-800',
        cardStyle: 'border-slate-200 bg-white text-amber-900',
        icon: PieChart,
        iconStyle: 'bg-amber-200 text-amber-800',
      },
      {
        key: 'absences' as const,
        label: 'Upcoming Absences',
        count: overview.summary.absences,
        tone: 'text-blue-900',
        cardStyle: 'border-slate-200 bg-white text-blue-900',
        icon: Calendar,
        iconStyle: 'bg-blue-200 text-blue-800',
      },
      {
        key: 'scheduled' as const,
        label: 'Scheduled Sub Shifts',
        count: overview.summary.scheduled_subs,
        tone: 'text-emerald-800',
        cardStyle: 'border-slate-200 bg-white text-emerald-900',
        icon: Users,
        iconStyle: 'bg-emerald-200 text-emerald-800',
      },
      {
        key: 'staffing' as const,
        label: 'Understaffed Classrooms',
        cardStyle: 'border-slate-200 bg-white text-rose-900',
        secondaryCount: belowPreferredClassrooms,
        secondaryIcon: AlertTriangle,
        secondaryStyle: 'text-amber-900',
        secondaryIconStyle: 'bg-orange-200 text-amber-800',
        secondaryRightCount: belowRequiredClassrooms,
        secondaryRightIcon: AlertCircle,
        secondaryRightStyle: 'text-rose-900',
        secondaryRightIconStyle: 'bg-rose-200 text-rose-800',
      },
    ],
    [overview.summary, belowRequiredClassrooms, belowPreferredClassrooms]
  )

  const coverageCounts = useMemo(() => {
    const needs = overview.coverage_requests.filter(
      (request) => request.status !== 'covered'
    ).length
    const covered = overview.coverage_requests.filter(
      (request) => request.status === 'covered'
    ).length
    return {
      needs,
      covered,
      all: overview.coverage_requests.length,
    }
  }, [overview.coverage_requests])

  const filteredCoverageRequests = useMemo(() => {
    if (coverageFilter === 'needs') {
      return overview.coverage_requests.filter(
        (request) => request.status !== 'covered'
      )
    }
    if (coverageFilter === 'covered') {
      return overview.coverage_requests.filter(
        (request) => request.status === 'covered'
      )
    }
    return overview.coverage_requests
  }, [coverageFilter, overview.coverage_requests])

  const belowRequiredGroups = useMemo(
    () =>
      groupStaffingTargets(
        overview.staffing_targets.filter((slot) => slot.status === 'below_required')
      ),
    [overview.staffing_targets]
  )

  const belowPreferredGroups = useMemo(
    () =>
      groupStaffingTargets(
        overview.staffing_targets.filter((slot) => slot.status === 'below_preferred')
      ),
    [overview.staffing_targets]
  )

  useEffect(() => {
    setBelowRequiredCollapsed(belowRequiredGroups.length === 0)
  }, [belowRequiredGroups.length])

  useEffect(() => {
    setBelowPreferredCollapsed(belowPreferredGroups.length === 0)
  }, [belowPreferredGroups.length])

  return (
    <div className="space-y-10">
      <section className="space-y-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {greetingTime}
            {greetingName ? `, ${greetingName}` : ''}!
          </h1>
          <p className="text-xl text-slate-600 mt-1">
            Here is your coverage outlook for the next two weeks (
            {formatFullDateLabel(startDate)} - {formatFullDateLabel(endDate)}).
          </p>
        </div>
      </section>

      <section className="space-y-3 pb-6 border-b border-slate-200">
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {summaryItems.map((item) => (
            <div key={item.key} className="text-left">
              <Card
                className={cn(
                  'w-full max-w-[260px] justify-self-start shadow-md',
                  item.cardStyle
                )}
              >
                <CardContent className="p-4">
                  <div className="text-base font-semibold">{item.label}</div>
                  <div className="mt-3 h-px w-full bg-black/10" />
                  {'count' in item ? (
                    <div className="mt-3 flex items-center justify-between">
                      <div className={cn('text-3xl font-semibold', item.tone)}>
                        {item.count}
                      </div>
                      {item.icon ? (
                        <span
                          className={cn(
                            'inline-flex h-9 w-9 items-center justify-center rounded-full',
                            item.iconStyle
                          )}
                        >
                          <item.icon className="h-5 w-5" />
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {'secondaryCount' in item &&
                  item.secondaryCount !== undefined &&
                  item.secondaryIcon &&
                  item.secondaryStyle &&
                  item.secondaryIconStyle &&
                  item.secondaryRightCount !== undefined &&
                  item.secondaryRightIcon &&
                  item.secondaryRightStyle &&
                  item.secondaryRightIconStyle ? (
                    <div className="mt-3 flex items-center justify-between">
                      <div className={cn('flex items-center gap-2 text-3xl font-semibold', item.secondaryStyle)}>
                        <span>{item.secondaryCount}</span>
                        <span
                          className={cn(
                            'inline-flex h-9 w-9 items-center justify-center rounded-full',
                            item.secondaryIconStyle
                          )}
                        >
                          <item.secondaryIcon className="h-5 w-5" />
                        </span>
                      </div>
                      <div
                        className={cn('flex items-center gap-2 text-3xl font-semibold', item.secondaryRightStyle)}
                      >
                        <span>{item.secondaryRightCount}</span>
                        <span
                          className={cn(
                            'inline-flex h-9 w-9 items-center justify-center rounded-full',
                            item.secondaryRightIconStyle
                          )}
                        >
                          <item.secondaryRightIcon className="h-5 w-5" />
                        </span>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 pt-4 lg:grid-cols-[1.4fr_0.9fr_0.9fr]">
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-slate-900" />
              <h2 className="text-lg font-semibold text-slate-900">
                Upcoming Time Off & Coverage
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
              <button
                type="button"
                onClick={() => setCoverageFilter('needs')}
                className={cn(
                  'rounded-full border px-3 py-1 transition',
                  coverageFilter === 'needs'
                    ? 'border-slate-300 bg-white text-slate-900'
                    : 'border-slate-200 bg-slate-50 hover:bg-white'
                )}
              >
                Needs a Sub ({coverageCounts.needs})
              </button>
              <button
                type="button"
                onClick={() => setCoverageFilter('covered')}
                className={cn(
                  'rounded-full border px-3 py-1 transition',
                  coverageFilter === 'covered'
                    ? 'border-slate-300 bg-white text-slate-900'
                    : 'border-slate-200 bg-slate-50 hover:bg-white'
                )}
              >
                Covered ({coverageCounts.covered})
              </button>
              <button
                type="button"
                onClick={() => setCoverageFilter('all')}
                className={cn(
                  'rounded-full border px-3 py-1 transition',
                  coverageFilter === 'all'
                    ? 'border-slate-300 bg-white text-slate-900'
                    : 'border-slate-200 bg-slate-50 hover:bg-white'
                )}
              >
                All ({coverageCounts.all})
              </button>
            </div>
          </div>

          {filteredCoverageRequests.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              No upcoming time off in the next 14 days
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCoverageRequests.map((request) => (
                  <div
                    key={request.id}
                    className="group relative rounded-lg border border-slate-200 bg-white px-4 py-4"
                  >
                    {request.notes ? (
                      <span
                        className="absolute right-0 top-0 h-4 w-4 cursor-help rounded-tr-lg bg-[linear-gradient(225deg,#fbbf24_0_50%,transparent_50%)]"
                        aria-label="Note"
                      >
                        <span className="absolute right-0 top-4 z-10 hidden w-56 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 shadow-sm group-hover:block">
                          {request.notes}
                        </span>
                      </span>
                    ) : null}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-base font-semibold text-slate-900">
                            {request.teacher_name}
                          </div>
                          {request.reason && (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                              {request.reason}
                            </span>
                          )}
                        </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <CalendarDays className="h-4 w-4 text-slate-500" />
                        <div className="text-sm font-medium text-slate-800">
                          {formatFullDateLabel(request.start_date)}
                          {!request.end_date || request.end_date === request.start_date
                            ? ''
                            : ` - ${formatFullDateLabel(request.end_date)}`}
                        </div>
                        <span className="h-4 w-px bg-slate-500" aria-hidden="true" />
                        <span className="text-sm font-medium italic text-slate-400">
                          {request.total_shifts} {request.total_shifts === 1 ? 'Shift' : 'Shifts'}
                        </span>
                      </div>
                        {request.classrooms?.length ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {request.classrooms.map((classroom) => (
                              <span
                                key={classroom.id}
                                className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
                                style={getClassroomPillStyle(classroom.color)}
                              >
                                {classroom.name}
                              </span>
                            ))}
                            {request.classrooms.length > 1 && (
                              <span className="text-[11px] text-slate-500">
                                (varies by shift)
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500">{request.classroom_label}</div>
                        )}
                    </div>
                      <div className="flex flex-col items-end gap-3">
                        <div
                          className={cn(
                            'inline-flex items-center gap-2 rounded-lg border px-2.5 py-1',
                            request.status === 'needs_coverage'
                            ? 'border-amber-200 bg-amber-100 text-amber-900'
                            : request.status === 'partially_covered'
                              ? 'border-amber-200 bg-amber-50 text-amber-800'
                              : 'border-slate-200 bg-slate-50 text-slate-700'
                          )}
                        >
                          {request.status === 'needs_coverage' ? (
                            <AlertTriangle className="h-5 w-5 text-amber-800" />
                          ) : request.status === 'partially_covered' ? (
                            <PieChart className="h-5 w-5 text-amber-700" />
                          ) : null}
                          <span className="text-sm font-semibold whitespace-nowrap">
                            {request.status === 'covered'
                              ? 'All shifts covered'
                              : `${request.remaining_shifts} uncovered ${request.remaining_shifts === 1 ? 'shift' : 'shifts'}`}
                          </span>
                        </div>
                        <div className="flex items-center justify-end gap-3 mt-4">
                          <Link
                            href={`/time-off/${request.id}`}
                            className="text-sm font-semibold text-slate-700 hover:text-slate-900"
                          >
                            View
                          </Link>
                          {request.status !== 'covered' && (
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="border-slate-500 text-slate-900 hover:bg-slate-200"
                        >
                              <Link href={`/sub-finder?absence_id=${request.id}`}>
                                Find Sub
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-900" />
            <h2 className="text-lg font-semibold text-slate-900">Scheduled Subs</h2>
          </div>

          {overview.scheduled_subs.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              No subs scheduled in the next 14 days
            </div>
          ) : (
            <div className="space-y-3">
                  {overview.scheduled_subs.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="group relative flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
                  >
                    {assignment.notes ? (
                      <span
                        className="absolute right-0 top-0 h-4 w-4 cursor-help rounded-tr-lg bg-[linear-gradient(225deg,#fbbf24_0_50%,transparent_50%)]"
                        aria-label="Note"
                      >
                        <span className="absolute right-0 top-4 z-10 hidden w-56 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 shadow-sm group-hover:block">
                          {assignment.notes}
                        </span>
                      </span>
                    ) : null}
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-base font-semibold text-slate-900">
                          {assignment.sub_name}
                        </div>
                        <div className="text-sm text-slate-600">
                          Covering {assignment.teacher_name}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <CalendarDays className="h-4 w-4 text-slate-500" />
                        <div className="text-sm font-medium text-slate-800">
                          {formatFullDateLabel(assignment.date)} · {assignment.time_slot_code}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                        <span
                          className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
                          style={getClassroomPillStyle(assignment.classroom_color)}
                        >
                          {assignment.classroom_name}
                        </span>
                      </div>
                      </div>
                      <div className="flex w-full justify-end sm:w-auto">
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="border-slate-500 text-slate-900 hover:bg-slate-200"
                      >
                        <Link href={`/schedules/weekly?sub_assignment_id=${assignment.id}`}>
                          Update Sub
                        </Link>
                      </Button>
                    </div>
                  </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-slate-900" />
            <h2 className="text-lg font-semibold text-slate-900">Below Staffing Target</h2>
          </div>

          {overview.staffing_targets.length === 0 ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              ✅ All classrooms meet staffing targets for the next 14 days
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setBelowRequiredCollapsed((prev) => !prev)}
                  className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  <span>
                    Below Required ({belowRequiredGroups.reduce((total, group) => total + group.slots.length, 0)})
                  </span>
                  {belowRequiredCollapsed ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </button>
                {!belowRequiredCollapsed &&
                  (belowRequiredGroups.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>All slots meet required staffing ratios.</span>
                    </div>
                  ) : (
                    belowRequiredGroups.map((classroom) => (
                      <div key={classroom.classroom_name} className="space-y-2">
                        <div>
                          <span
                            className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                            style={getClassroomPillStyle(classroom.classroom_color)}
                          >
                            {classroom.classroom_name} ({classroom.slots.length})
                          </span>
                        </div>
                        {classroom.slots.map((slot) => (
                        <div
                          key={slot.id}
                          className="grid gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 md:grid-cols-[1fr_auto]"
                        >
                          <div className="flex flex-wrap items-center gap-4">
                            <div className="min-w-[180px] space-y-3">
                              <div className="text-sm font-semibold text-slate-900">
                                {formatSlotLabel(slot.day_name, slot.time_slot_code)}
                              </div>
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                                  staffingBadge(slot.status)
                                )}
                              >
                                Below Required {formatShortfallLabel(formatShortfallValue(slot.required_staff, slot.scheduled_staff))}
                              </span>
                            </div>
                            <div className="flex min-w-[190px] flex-col items-start gap-3">
                              <div className="text-xs text-slate-600">
                                Required: {slot.required_staff} · Scheduled: {slot.scheduled_staff}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-end self-center">
                            <Button
                              asChild
                              size="sm"
                              variant="outline"
                              className="border-slate-500 text-slate-900 hover:bg-slate-200"
                            >
                              <Link
                                href={`/schedules/weekly?classroom_id=${slot.classroom_id}&day_of_week_id=${slot.day_of_week_id}&time_slot_id=${slot.time_slot_id}`}
                              >
                                Assign Coverage
                              </Link>
                            </Button>
                          </div>
                        </div>
                        ))}
                      </div>
                    ))
                  ))}
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setBelowPreferredCollapsed((prev) => !prev)}
                  className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  <span>
                    Below Preferred ({belowPreferredGroups.reduce((total, group) => total + group.slots.length, 0)})
                  </span>
                  {belowPreferredCollapsed ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </button>
                {!belowPreferredCollapsed &&
                  (belowPreferredGroups.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>All slots meet preferred staffing ratios.</span>
                    </div>
                  ) : (
                    belowPreferredGroups.map((classroom) => (
                      <div key={classroom.classroom_name} className="space-y-2">
                        <div>
                          <span
                            className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                            style={getClassroomPillStyle(classroom.classroom_color)}
                          >
                            {classroom.classroom_name} ({classroom.slots.length})
                          </span>
                        </div>
                        {classroom.slots.map((slot) => (
                        <div
                          key={slot.id}
                          className="grid gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 md:grid-cols-[1fr_auto]"
                        >
                          <div className="flex flex-wrap items-center gap-4">
                            <div className="min-w-[180px] space-y-3">
                              <div className="text-sm font-semibold text-slate-900">
                                {formatSlotLabel(slot.day_name, slot.time_slot_code)}
                              </div>
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                                  staffingBadge(slot.status)
                                )}
                              >
                                Below Preferred{' '}
                                {formatShortfallLabel(
                                  formatShortfallValue(
                                    slot.preferred_staff ?? slot.required_staff,
                                    slot.scheduled_staff
                                  )
                                )}
                              </span>
                            </div>
                            <div className="flex min-w-[190px] flex-col items-start gap-3">
                              <div className="text-xs text-slate-600">
                                Preferred: {slot.preferred_staff ?? slot.required_staff} · Scheduled:{' '}
                                {slot.scheduled_staff}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-end self-center">
                            <Button
                              asChild
                              size="sm"
                              variant="outline"
                              className="border-slate-500 text-slate-900 hover:bg-slate-200"
                            >
                              <Link
                                href={`/schedules/weekly?classroom_id=${slot.classroom_id}&day_of_week_id=${slot.day_of_week_id}&time_slot_id=${slot.time_slot_id}`}
                              >
                                Assign Coverage
                              </Link>
                            </Button>
                          </div>
                        </div>
                        ))}
                      </div>
                    ))
                  ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
