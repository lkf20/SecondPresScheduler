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
import TimeOffCard from '@/components/shared/TimeOffCard'

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
  partial_shifts: number
  remaining_shifts: number
  status: 'needs_coverage' | 'partially_covered' | 'covered'
  shift_details?: Array<{ label: string; status: 'covered' | 'partial' | 'uncovered' }>
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

const formatSlotLabel = (dayName: string, timeSlotCode: string) =>
  `${dayName || '—'} - ${timeSlotCode}`

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
  const [coverageSectionCollapsed, setCoverageSectionCollapsed] = useState(false)
  const [scheduledSubsSectionCollapsed, setScheduledSubsSectionCollapsed] = useState(false)
  const [staffingTargetSectionCollapsed, setStaffingTargetSectionCollapsed] = useState(false)

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
        tone: 'text-orange-600',
        cardStyle: 'border-slate-200 bg-white text-slate-700',
        icon: AlertTriangle,
        iconStyle: 'bg-orange-100 text-orange-600',
      },
      {
        key: 'partial' as const,
        label: 'Partially Covered Shifts',
        count: overview.summary.partially_covered_shifts,
        tone: 'text-yellow-600',
        cardStyle: 'border-slate-200 bg-white text-slate-700',
        icon: PieChart,
        iconStyle: 'bg-amber-100 text-yellow-600',
      },
      {
        key: 'absences' as const,
        label: 'Upcoming Absences',
        count: overview.summary.absences,
        tone: 'text-blue-600',
        cardStyle: 'border-slate-200 bg-white text-slate-700',
        icon: Calendar,
        iconStyle: 'bg-blue-100 text-blue-600',
      },
      {
        key: 'scheduled' as const,
        label: 'Scheduled Sub Shifts',
        count: overview.summary.scheduled_subs,
        tone: 'text-teal-600',
        cardStyle: 'border-slate-200 bg-white text-slate-700',
        icon: Users,
        iconStyle: 'bg-teal-100 text-teal-600',
      },
      {
        key: 'staffing' as const,
        label: 'Understaffed Classrooms',
        cardStyle: 'border-slate-200 bg-white text-slate-700',
        secondaryCount: belowPreferredClassrooms,
        secondaryIcon: AlertTriangle,
        secondaryStyle: 'text-purple-800',
        secondaryIconStyle: 'bg-purple-100 text-purple-800',
        secondaryRightCount: belowRequiredClassrooms,
        secondaryRightIcon: AlertCircle,
        secondaryRightStyle: 'text-purple-800',
        secondaryRightIconStyle: 'bg-purple-100 text-purple-800',
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

      <section className="space-y-3 pb-1">
        <div className="grid gap-x-4 gap-y-6 justify-items-start grid-cols-[repeat(auto-fill,minmax(250px,250px))]">
          {summaryItems.map((item) => (
            <div key={item.key} className="text-left min-w-[250px] max-w-[250px]">
              <Card
                className={cn(
                  'w-full border-2 shadow-sm',
                  'sm:justify-self-start',
                  item.cardStyle
                )}
              >
                <CardContent className="p-4">
                  <div
                    className="text-base font-normal"
                    style={item.key === 'partial' ? { backgroundClip: 'unset', WebkitBackgroundClip: 'unset' } : undefined}
                  >
                    {item.label}
                  </div>
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

      <div className="grid grid-cols-1 gap-6 pt-1 xl:grid-cols-[minmax(550px,1.4fr)_minmax(400px,0.9fr)_minmax(400px,0.9fr)]">
        <section className="min-w-[550px] space-y-4 rounded-xl border-2 border-slate-200 bg-white p-5 shadow-sm xl:col-span-1">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setCoverageSectionCollapsed(!coverageSectionCollapsed)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setCoverageSectionCollapsed(!coverageSectionCollapsed)
              }
            }}
            className="flex w-full items-center justify-between gap-3 xl:pointer-events-none xl:cursor-default"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 xl:flex-1">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-slate-900" />
                <h2 className="text-lg font-semibold text-slate-900">
                  Upcoming Time Off & Coverage
                </h2>
              </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setCoverageFilter('needs')
                }}
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
                onClick={(e) => {
                  e.stopPropagation()
                  setCoverageFilter('covered')
                }}
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
                onClick={(e) => {
                  e.stopPropagation()
                  setCoverageFilter('all')
                }}
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
            <div className="xl:hidden">
              {coverageSectionCollapsed ? (
                <ChevronDown className="h-5 w-5 text-slate-500" />
              ) : (
                <ChevronUp className="h-5 w-5 text-slate-500" />
              )}
            </div>
          </div>

          <div className={cn('space-y-4', coverageSectionCollapsed && 'hidden xl:block')}>
              {filteredCoverageRequests.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              No upcoming time off in the next 14 days
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCoverageRequests.map((request) => {
                // Calculate coverage counts from API data
                // assigned_shifts includes both full and partial coverage
                // partial_shifts = shifts with only partial coverage
                // covered = assigned_shifts - partial_shifts (fully covered shifts)
                let covered = 0
                let uncovered = request.uncovered_shifts
                let partial = request.partial_shifts || 0
                
                if (request.status === 'covered') {
                  covered = request.total_shifts
                  uncovered = 0
                  partial = 0
                } else if (request.status === 'needs_coverage') {
                  covered = 0
                  uncovered = request.uncovered_shifts
                  partial = 0
                } else if (request.status === 'partially_covered') {
                  // assigned_shifts includes both full and partial
                  // partial_shifts = shifts with only partial coverage
                  // covered = assigned_shifts - partial_shifts
                  partial = request.partial_shifts || 0
                  covered = request.assigned_shifts - partial
                  uncovered = request.uncovered_shifts
                }

                return (
                  <TimeOffCard
                    key={request.id}
                    id={request.id}
                    teacherName={request.teacher_name}
                    startDate={request.start_date}
                    endDate={request.end_date}
                    reason={request.reason}
                    classrooms={request.classrooms}
                    variant="dashboard"
                    covered={covered}
                    uncovered={uncovered}
                    partial={partial}
                    totalShifts={request.total_shifts}
                    shiftDetails={request.shift_details}
                    notes={request.notes}
                  />
                )
              })}
            </div>
          )}
          </div>

        </section>

        <section className="min-w-[400px] space-y-4 rounded-xl border-2 border-slate-200 bg-white p-5 shadow-sm xl:col-span-1">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setScheduledSubsSectionCollapsed(!scheduledSubsSectionCollapsed)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setScheduledSubsSectionCollapsed(!scheduledSubsSectionCollapsed)
              }
            }}
            className="flex w-full items-center justify-between gap-3 xl:pointer-events-none xl:cursor-default"
          >
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-slate-900" />
              <h2 className="text-lg font-semibold text-slate-900">Scheduled Subs</h2>
            </div>
            <div className="xl:hidden">
              {scheduledSubsSectionCollapsed ? (
                <ChevronDown className="h-5 w-5 text-slate-500" />
              ) : (
                <ChevronUp className="h-5 w-5 text-slate-500" />
              )}
            </div>
          </div>

          <div className={cn('space-y-4', scheduledSubsSectionCollapsed && 'hidden xl:block')}>
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
          </div>
        </section>

        <section className="min-w-[400px] space-y-4 rounded-xl border-2 border-slate-200 bg-white p-5 shadow-sm xl:col-span-1">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setStaffingTargetSectionCollapsed(!staffingTargetSectionCollapsed)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setStaffingTargetSectionCollapsed(!staffingTargetSectionCollapsed)
              }
            }}
            className="flex w-full items-center justify-between gap-3 xl:pointer-events-none xl:cursor-default"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-slate-900" />
              <h2 className="text-lg font-semibold text-slate-900">Below Staffing Target</h2>
            </div>
            <div className="xl:hidden">
              {staffingTargetSectionCollapsed ? (
                <ChevronDown className="h-5 w-5 text-slate-500" />
              ) : (
                <ChevronUp className="h-5 w-5 text-slate-500" />
              )}
            </div>
          </div>

          <div className={cn('space-y-4', staffingTargetSectionCollapsed && 'hidden xl:block')}>

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
          </div>
        </section>
      </div>
    </div>
  )
}
