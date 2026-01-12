'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import CoverageStatusPill from '@/components/ui/coverage-status-pill'
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

type SectionKey = 'uncovered' | 'partial' | 'absences' | 'scheduled'

const formatRangeLabel = (startLabel: string, endLabel: string) =>
  `Showing next 14 days (${startLabel} - ${endLabel})`

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
  rangeStartLabel,
  rangeEndLabel,
}: {
  overview: DashboardOverview
  rangeStartLabel: string
  rangeEndLabel: string
}) {
  const [activeSection, setActiveSection] = useState<SectionKey | null>(null)
  const [coverageCollapsed, setCoverageCollapsed] = useState(false)
  const [scheduledCollapsed, setScheduledCollapsed] = useState(false)
  const [staffingCollapsed, setStaffingCollapsed] = useState(false)
  const coverageRef = useRef<HTMLDivElement | null>(null)
  const scheduledRef = useRef<HTMLDivElement | null>(null)
  const [coverageFilter, setCoverageFilter] = useState<'needs' | 'covered' | 'all'>(
    'needs'
  )

  useEffect(() => {
    if (!activeSection) return
    const target =
      activeSection === 'uncovered' || activeSection === 'partial' || activeSection === 'absences'
        ? coverageRef.current
        : scheduledRef.current
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [activeSection])

  const summaryItems = useMemo(
    () => [
      {
        key: 'uncovered' as const,
        label: 'Uncovered Shifts',
        count: overview.summary.uncovered_shifts,
        tone: 'text-amber-900',
      },
      {
        key: 'partial' as const,
        label: 'Partially Covered',
        count: overview.summary.partially_covered_shifts,
        tone: 'text-amber-700',
      },
      {
        key: 'absences' as const,
        label: 'Absences',
        count: overview.summary.absences,
        tone: 'text-slate-900',
      },
      {
        key: 'scheduled' as const,
        label: 'Scheduled Subs',
        count: overview.summary.scheduled_subs,
        tone: 'text-emerald-700',
      },
    ],
    [overview.summary]
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

  return (
    <div className="space-y-10 rounded-2xl bg-slate-50/70 p-6">
      <section className="space-y-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Coverage outlook for the next 2 weeks
          </p>
        </div>
        <div className="text-sm text-slate-600">
          {formatRangeLabel(rangeStartLabel, rangeEndLabel)}
        </div>
      </section>

      <section className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {summaryItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setActiveSection((prev) => (prev === item.key ? null : item.key))
                if (item.key === 'uncovered' || item.key === 'partial') {
                  setCoverageFilter('needs')
                }
                if (item.key === 'absences') {
                  setCoverageFilter('all')
                }
              }}
              className="text-left"
            >
              <Card
                className={cn(
                  'transition-colors hover:bg-accent',
                  activeSection === item.key && 'ring-1 ring-slate-300'
                )}
              >
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                  <div className={cn('text-2xl font-semibold mt-1', item.tone)}>
                    {item.count}
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          ref={coverageRef}
          className={cn(
            'space-y-4 rounded-xl border border-slate-200 bg-white p-5',
            (activeSection === 'uncovered' ||
              activeSection === 'partial' ||
              activeSection === 'absences') &&
              'ring-1 ring-slate-200'
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">
                Upcoming Time Off & Coverage
              </h2>
              <button
                type="button"
                onClick={() => setCoverageCollapsed((prev) => !prev)}
                aria-label={
                  coverageCollapsed ? 'Expand coverage overview' : 'Collapse coverage overview'
                }
                className="text-slate-500 transition hover:text-slate-700"
              >
                <ChevronUp
                  className={cn('h-4 w-4 transition-transform', coverageCollapsed && 'rotate-180')}
                />
              </button>
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

          {!coverageCollapsed &&
            (filteredCoverageRequests.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                No upcoming time off in the next 14 days
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCoverageRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="min-w-[200px] space-y-1">
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
                      <div className="text-sm text-slate-600">
                        {formatDateRange(request.start_date, request.end_date)}
                      </div>
                      {request.classrooms?.length ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {request.classrooms.map((classroom) => (
                            <span
                              key={classroom.id}
                              className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold"
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
                    <div className="flex min-w-[200px] flex-col items-center gap-2 text-center">
                      <CoverageStatusPill status={request.status} />
                      <div className="text-xs text-slate-600">
                        {request.status === 'covered'
                          ? 'All shifts covered'
                          : request.status === 'needs_coverage'
                          ? `${request.total_shifts} shifts need coverage`
                          : `${request.remaining_shifts} of ${request.total_shifts} shifts need coverage`}
                      </div>
                    </div>
                    <div className="flex flex-1 items-center justify-end gap-3">
                      {request.status !== 'covered' && (
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="border-slate-500 text-slate-900 hover:bg-slate-50"
                        >
                          <Link href={`/sub-finder?absence_id=${request.id}`}>
                            Find Sub
                          </Link>
                        </Button>
                      )}
                      <Link
                        href={`/time-off/${request.id}`}
                        className="text-sm font-semibold text-slate-700 hover:text-slate-900"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ))}
        </section>

        <div className="space-y-6">
          <section
            ref={scheduledRef}
            className={cn(
              'space-y-4 rounded-xl border border-slate-200 bg-white p-5',
              activeSection === 'scheduled' && 'ring-1 ring-slate-200'
            )}
          >
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Scheduled Subs</h2>
              <button
                type="button"
                onClick={() => setScheduledCollapsed((prev) => !prev)}
                aria-label={scheduledCollapsed ? 'Expand scheduled subs' : 'Collapse scheduled subs'}
                className="text-slate-500 transition hover:text-slate-700"
              >
                <ChevronUp
                  className={cn('h-4 w-4 transition-transform', scheduledCollapsed && 'rotate-180')}
                />
              </button>
            </div>

            {!scheduledCollapsed &&
              (overview.scheduled_subs.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  No subs scheduled in the next 14 days
                </div>
              ) : (
                <div className="space-y-3">
                  {overview.scheduled_subs.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
                    >
                      <div className="space-y-1">
                        <div className="text-base font-semibold text-slate-900">
                          {assignment.sub_name}
                        </div>
                        <div className="text-sm text-slate-600">
                          {formatDayTime(
                            assignment.day_name,
                            assignment.date,
                            assignment.time_slot_code
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                          <span
                            className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                            style={getClassroomPillStyle(assignment.classroom_color)}
                          >
                            {assignment.classroom_name}
                          </span>
                          <span>Covering {assignment.teacher_name}</span>
                        </div>
                      </div>
                      <div className="flex w-full justify-end sm:w-auto">
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="border-slate-500 text-slate-900 hover:bg-slate-50"
                        >
                          <Link href={`/schedules/weekly?sub_assignment_id=${assignment.id}`}>
                            Update Sub
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
          </section>

          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Below Staffing Target</h2>
              <button
                type="button"
                onClick={() => setStaffingCollapsed((prev) => !prev)}
                aria-label={
                  staffingCollapsed ? 'Expand staffing targets' : 'Collapse staffing targets'
                }
                className="text-slate-500 transition hover:text-slate-700"
              >
                <ChevronUp
                  className={cn('h-4 w-4 transition-transform', staffingCollapsed && 'rotate-180')}
                />
              </button>
            </div>

            {!staffingCollapsed &&
              (overview.staffing_targets.length === 0 ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  ✅ All classrooms meet staffing targets for the next 14 days
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Below Required ({belowRequiredGroups.reduce((total, group) => total + group.slots.length, 0)})
                    </div>
                    {belowRequiredGroups.length === 0 ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                        All slots meet required staffing ratios.
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
                              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3"
                            >
                              <div className="min-w-[180px] space-y-1">
                                <div className="text-sm font-semibold text-slate-900">
                                  {formatSlotLabel(slot.day_name, slot.time_slot_code)}
                                </div>
                              </div>
                              <div className="flex min-w-[190px] flex-col items-start gap-2">
                              <div className="text-xs text-slate-600">
                                Required: {slot.required_staff} · Scheduled: {slot.scheduled_staff}
                              </div>
                                <span
                                  className={cn(
                                    'rounded-full border px-2.5 py-0.5 text-xs font-medium',
                                    staffingBadge(slot.status)
                                  )}
                                >
                                  Below Required
                                </span>
                              </div>
                              <div className="flex flex-1 items-center justify-end">
                                <Button asChild size="sm" variant="outline">
                                  <Link
                                    href={`/schedules/weekly?classroom_id=${slot.classroom_id}&day_of_week_id=${slot.day_of_week_id}&time_slot_id=${slot.time_slot_id}`}
                                  >
                                    Add Coverage
                                  </Link>
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Below Preferred ({belowPreferredGroups.reduce((total, group) => total + group.slots.length, 0)})
                    </div>
                    {belowPreferredGroups.length === 0 ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                        All slots meet preferred staffing ratios.
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
                              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3"
                            >
                              <div className="min-w-[180px] space-y-1">
                                <div className="text-sm font-semibold text-slate-900">
                                  {formatSlotLabel(slot.day_name, slot.time_slot_code)}
                                </div>
                              </div>
                              <div className="flex min-w-[190px] flex-col items-start gap-2">
                              <div className="text-xs text-slate-600">
                                Preferred: {slot.preferred_staff ?? slot.required_staff} · Scheduled:{' '}
                                {slot.scheduled_staff}
                              </div>
                                <span
                                  className={cn(
                                    'rounded-full border px-2.5 py-0.5 text-xs font-medium',
                                    staffingBadge(slot.status)
                                  )}
                                >
                                  Below Preferred
                                </span>
                              </div>
                              <div className="flex flex-1 items-center justify-end">
                                <Button asChild size="sm" variant="outline">
                                  <Link
                                    href={`/schedules/weekly?classroom_id=${slot.classroom_id}&day_of_week_id=${slot.day_of_week_id}&time_slot_id=${slot.time_slot_id}`}
                                  >
                                    Add Coverage
                                  </Link>
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
          </section>
        </div>
      </div>
    </div>
  )
}
