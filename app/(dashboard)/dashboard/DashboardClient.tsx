'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
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
  Settings,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { getWeekStartISOFromDate } from '@/lib/utils/date'
import { getClassroomPillStyle } from '@/lib/utils/classroom-style'
import {
  getCoverageColors,
  neutralColors,
  coverageColorValues,
  staffingColors,
  staffingColorValues,
} from '@/lib/utils/colors'
import { StaffingStatusBadge } from '@/components/ui/staffing-status-badge'
import TimeOffCard from '@/components/shared/TimeOffCard'
import { Loader2 } from 'lucide-react'
import { useDashboard } from '@/lib/hooks/use-dashboard'
import { useProfile } from '@/lib/hooks/use-profile'
import { useDisplayNameFormat } from '@/lib/hooks/use-display-name-format'
import AddTimeOffButton from '@/components/time-off/AddTimeOffButton'
import ScheduleSidePanel from '@/components/schedules/ScheduleSidePanel'
import { getDataHealthCache, setDataHealthCache } from '@/lib/dashboard/data-health-cache'

type Summary = {
  absences: number
  uncovered_shifts: number
  partially_covered_shifts: number
  scheduled_subs: number
}

type CoverageRequestItem = {
  id: string
  source_request_id: string | null
  request_type: string
  teacher_name: string
  start_date: string
  end_date: string
  reason: string | null
  notes: string | null
  classrooms: Array<{ id: string; name: string; color: string | null }>
  classroom_label: string
  total_shifts: number
  assigned_shifts: number
  covered_shifts: number
  uncovered_shifts: number
  partial_shifts: number
  remaining_shifts: number
  status: 'needs_coverage' | 'partially_covered' | 'covered'
  shift_details?: Array<{ label: string; status: 'covered' | 'partial' | 'uncovered' }>
}

export type ScheduledSubItem = {
  id: string
  date: string
  day_name: string
  time_slot_code: string
  classroom_name: string
  classroom_color: string | null
  notes: string | null
  sub_name: string
  sub_id?: string
  teacher_name: string
  coverage_request_id?: string | null
}

type StaffingTargetItem = {
  id: string
  date?: string
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

/** One card: same classroom + time slot + day and same required/scheduled/preferred across dates */
export type StaffingTargetGroup = {
  dateStart: string
  dateEnd: string
  slots: StaffingTargetItem[]
  /** First slot for rep fields (classroom, time_slot, day, required, scheduled, status) */
  rep: StaffingTargetItem
}

const formatShortDateLabel = (value: string) => {
  const date = new Date(`${value}T00:00:00`)
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

/** Label for a grouped slot: "Mar 9 - 23 • Mon LB" or single "Mon Mar 9 • LB" */
const formatGroupSlotLabel = (group: StaffingTargetGroup) => {
  const { rep } = group
  if (group.dateStart === group.dateEnd) {
    return `${formatFullDateLabel(group.dateStart)} • ${rep.time_slot_code}`
  }
  return `${formatShortDateLabel(group.dateStart)} - ${formatShortDateLabel(group.dateEnd)} • ${rep.day_name || '—'} ${rep.time_slot_code}`
}

const formatFullDateLabel = (value: string) => {
  const date = new Date(`${value}T00:00:00`)
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date)
  const dateLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
    date
  )
  return `${weekday} ${dateLabel}`
}

const formatShortfallValue = (required: number, scheduled: number) =>
  Math.max(0, required - scheduled)

const VALID_DATE_ISO = /^\d{4}-\d{2}-\d{2}$/

/** Group by classroom, then by (time_slot + day + required + scheduled + preferred). Only merge slots when required, scheduled, and preferred match. */
function groupStaffingTargets(slots: StaffingTargetItem[]) {
  const classroomMap = new Map<
    string,
    {
      classroom_name: string
      classroom_color: string | null
      slotGroups: StaffingTargetGroup[]
    }
  >()

  // Group by (classroom_id, time_slot_id, day_of_week_id, required_staff, scheduled_staff, preferred_staff)
  const rawGroups = new Map<string, StaffingTargetItem[]>()
  slots.forEach(slot => {
    const preferredKey = slot.preferred_staff ?? 'n'
    const key = `${slot.classroom_id}|${slot.time_slot_id}|${slot.day_of_week_id}|${slot.required_staff}|${slot.scheduled_staff}|${preferredKey}`
    const list = rawGroups.get(key) || []
    list.push(slot)
    rawGroups.set(key, list)
  })

  // Build StaffingTargetGroup for each raw group (date range + rep)
  rawGroups.forEach(groupSlots => {
    const first = groupSlots[0]
    if (!first) return
    const dates = groupSlots.map(s => s.date).filter((d): d is string => !!d)
    const dateStart = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : (first.date ?? '')
    const dateEnd = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : (first.date ?? '')
    // Exclude groups with no valid date range so we never pass empty date to getWeekStartISOFromDate or ScheduleSidePanel
    if (
      !dateStart ||
      !VALID_DATE_ISO.test(dateStart) ||
      !dateEnd ||
      !VALID_DATE_ISO.test(dateEnd)
    ) {
      return
    }
    const group: StaffingTargetGroup = {
      dateStart,
      dateEnd,
      slots: groupSlots.sort((a, b) => {
        if (a.day_order !== b.day_order) return a.day_order - b.day_order
        return a.time_slot_order - b.time_slot_order
      }),
      rep: first,
    }
    const entry = classroomMap.get(first.classroom_id) || {
      classroom_name: first.classroom_name,
      classroom_color: first.classroom_color ?? null,
      slotGroups: [],
    }
    entry.slotGroups.push(group)
    classroomMap.set(first.classroom_id, entry)
  })

  const classrooms = Array.from(classroomMap.values()).sort((a, b) =>
    a.classroom_name.localeCompare(b.classroom_name)
  )
  return classrooms.map(c => ({
    ...c,
    slotGroups: c.slotGroups.sort((a, b) => {
      if (a.rep.day_order !== b.rep.day_order) return a.rep.day_order - b.rep.day_order
      return a.rep.time_slot_order - b.rep.time_slot_order
    }),
  }))
}

type CoverageRange = '1 week' | '2 weeks' | '1 month' | '2 months'

const getDaysFromRange = (range: CoverageRange): number => {
  switch (range) {
    case '1 week':
      return 6 // 7 days total (today + 6 more)
    case '2 weeks':
      return 13 // 14 days total (today + 13 more)
    case '1 month':
      return 29 // 30 days total (today + 29 more)
    case '2 months':
      return 59 // 60 days total (today + 59 more)
  }
}

const getRangeLabel = (range: CoverageRange): string => {
  switch (range) {
    case '1 week':
      return 'the next week'
    case '2 weeks':
      return 'the next two weeks'
    case '1 month':
      return 'the next month'
    case '2 months':
      return 'the next two months'
  }
}

const getRangeDaysText = (range: CoverageRange): string => {
  switch (range) {
    case '1 week':
      return '7 days'
    case '2 weeks':
      return '14 days'
    case '1 month':
      return '30 days'
    case '2 months':
      return '60 days'
  }
}

const toDateString = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export default function DashboardClient({
  overview: initialOverview,
  startDate: initialStartDate,
  endDate: initialEndDate,
}: {
  overview: DashboardOverview
  startDate: string
  endDate: string
}) {
  const gridRef = useRef<HTMLDivElement>(null)
  const [isXlScreen, setIsXlScreen] = useState(false)

  // Use React Query to cache the profile/name
  const { data: profile, isLoading: isLoadingProfile } = useProfile()
  const greetingName = profile?.first_name?.trim() || null
  const { format: displayNameFormat, isLoaded: isDisplayNameLoaded } = useDisplayNameFormat()

  // Calculate greeting on client side only to avoid hydration mismatch
  const [greetingTime, setGreetingTime] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'
    setGreetingTime(greeting)
  }, [])

  // Only show greeting when both client-side calculation and profile are ready
  const isGreetingReady = isClient && greetingTime !== null && !isLoadingProfile
  const [belowRequiredCollapsed, setBelowRequiredCollapsed] = useState(false)
  const [belowPreferredCollapsed, setBelowPreferredCollapsed] = useState(false)
  const [coverageFilter, setCoverageFilter] = useState<'needs' | 'covered' | 'all'>('all')
  const [coverageSectionCollapsed, setCoverageSectionCollapsed] = useState(false)
  const [scheduledSubsSectionCollapsed, setScheduledSubsSectionCollapsed] = useState(false)
  const [staffingTargetSectionCollapsed, setStaffingTargetSectionCollapsed] = useState(false)
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null)
  const [assignCoverageSlot, setAssignCoverageSlot] = useState<StaffingTargetGroup | null>(null)

  const handleEdit = (id: string) => {
    setEditingRequestId(id)
  }

  const handleEditClose = () => {
    setEditingRequestId(null)
  }

  // Coverage range state - always start with default to avoid hydration mismatch
  const [coverageRange, setCoverageRange] = useState<CoverageRange>('2 weeks')
  const [hasHydratedRange, setHasHydratedRange] = useState(false)

  // Hydrate from localStorage after mount (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined' && !hasHydratedRange) {
      const stored = localStorage.getItem('dashboard_coverage_range') as CoverageRange | null
      if (stored && ['1 week', '2 weeks', '1 month', '2 months'].includes(stored)) {
        setCoverageRange(stored)
      }
      setHasHydratedRange(true)
    }
  }, [hasHydratedRange])

  // Calculate dates based on selected range
  const calculateDates = (range: CoverageRange) => {
    const today = new Date()
    const start = toDateString(today)
    const end = toDateString(addDays(today, getDaysFromRange(range)))
    return { start, end }
  }

  const { start: currentStartDate, end: currentEndDate } = useMemo(
    () => calculateDates(coverageRange),
    [coverageRange]
  )

  // Determine if we should use initial data (only if it matches the current range)
  const shouldUseInitialData = useMemo(() => {
    return (
      coverageRange === '2 weeks' &&
      currentStartDate === initialStartDate &&
      currentEndDate === initialEndDate
    )
  }, [coverageRange, currentStartDate, currentEndDate, initialStartDate, initialEndDate])

  // Use React Query for dashboard data
  const {
    data: overview = initialOverview,
    isLoading: isLoadingOverview,
    isFetching,
    refetch,
  } = useDashboard(
    {
      preset: coverageRange,
      startDate: currentStartDate,
      endDate: currentEndDate,
      displayNameFormat,
    },
    shouldUseInitialData ? initialOverview : undefined
  )

  const [orphanedShiftsCount, setOrphanedShiftsCount] = useState<number>(0)
  const [dataHealthFetchKey, setDataHealthFetchKey] = useState(0)

  // Refetch when tab becomes visible so we pick up cross-tab invalidation (e.g. calendar cleared in another tab)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') setDataHealthFetchKey(k => k + 1)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  useEffect(() => {
    const cached = getDataHealthCache()
    if (cached) {
      if (cached.data.orphanedShifts) {
        setOrphanedShiftsCount(cached.data.orphanedShifts.length)
      }
      return
    }
    fetch('/api/dashboard/data-health')
      .then(res => {
        if (!res.ok) return res.json().then(() => null)
        return res.json()
      })
      .then(data => {
        if (data == null) return
        setDataHealthCache(data)
        if (data.orphanedShifts) {
          setOrphanedShiftsCount(data.orphanedShifts.length)
        }
      })
      .catch(console.error)
  }, [dataHealthFetchKey])

  const router = useRouter()

  useEffect(() => {
    if (!isDisplayNameLoaded) return
    refetch()
  }, [displayNameFormat, isDisplayNameLoaded, refetch])

  // Manual refresh handler
  const handleRefresh = async () => {
    await refetch()
    router.refresh()
  }

  // Save to localStorage when range changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboard_coverage_range', coverageRange)
    }
  }, [coverageRange])

  // Track xl screen size for responsive min-width
  useEffect(() => {
    const checkScreenSize = () => {
      setIsXlScreen(window.innerWidth >= 1280)
    }
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  const belowRequiredClassrooms = useMemo(() => {
    const classrooms = new Set<string>()
    overview.staffing_targets
      .filter(slot => slot.status === 'below_required')
      .forEach(slot => classrooms.add(slot.classroom_id))
    return classrooms.size
  }, [overview.staffing_targets])

  const belowPreferredClassrooms = useMemo(() => {
    const classrooms = new Set<string>()
    overview.staffing_targets
      .filter(slot => slot.status === 'below_preferred')
      .forEach(slot => classrooms.add(slot.classroom_id))
    return classrooms.size
  }, [overview.staffing_targets])

  const summaryItems = useMemo(() => {
    const uncoveredColors = getCoverageColors('uncovered')
    const partialColors = getCoverageColors('partial')
    const infoColors = { text: 'text-blue-600', bg: 'bg-blue-100', icon: 'text-blue-600' }
    const tealColors = { text: 'text-teal-700', bg: 'bg-teal-100', icon: 'text-teal-600' }

    return [
      {
        key: 'uncovered' as const,
        label: 'Uncovered Shifts',
        count: overview.summary.uncovered_shifts,
        tone: uncoveredColors.text,
        cardStyle: `${neutralColors.border} bg-white ${neutralColors.textMedium}`,
        icon: AlertTriangle,
        iconStyle: `${uncoveredColors.bg} ${uncoveredColors.icon}`,
      },
      {
        key: 'partial' as const,
        label: 'Partially Covered Shifts',
        count: overview.summary.partially_covered_shifts,
        tone: partialColors.text,
        cardStyle: `${neutralColors.border} bg-white ${neutralColors.textMedium}`,
        icon: PieChart,
        iconStyle: `${partialColors.bg} ${partialColors.icon}`,
      },
      {
        key: 'absences' as const,
        label: 'Upcoming Absences',
        count: overview.summary.absences,
        tone: tealColors.text,
        cardStyle: `${neutralColors.border} bg-white ${neutralColors.textMedium}`,
        icon: Calendar,
        iconStyle: `${tealColors.bg} ${tealColors.icon}`,
      },
      {
        key: 'scheduled' as const,
        label: 'Scheduled Sub Shifts',
        count: overview.summary.scheduled_subs,
        tone: infoColors.text,
        cardStyle: `${neutralColors.border} bg-white ${neutralColors.textMedium}`,
        icon: Users,
        iconStyle: `${infoColors.bg} ${infoColors.icon}`,
      },
      {
        key: 'staffing' as const,
        label: 'Understaffed Classrooms',
        cardStyle: `${neutralColors.border} bg-white ${neutralColors.textMedium}`,
        secondaryCount: belowPreferredClassrooms,
        secondaryIcon: AlertTriangle,
        secondaryStyle: staffingColors.below_preferred.text,
        secondaryIconStyle: `${staffingColors.below_preferred.bg} ${staffingColors.below_preferred.text}`,
        secondaryColorValues: staffingColorValues.below_preferred,
        secondaryRightCount: belowRequiredClassrooms,
        secondaryRightIcon: AlertCircle,
        secondaryRightStyle: staffingColors.below_required.text,
        secondaryRightIconStyle: `${staffingColors.below_required.bg} ${staffingColors.below_required.text}`,
        secondaryRightColorValues: staffingColorValues.below_required,
      },
    ]
  }, [overview.summary, belowRequiredClassrooms, belowPreferredClassrooms])

  const coverageCounts = useMemo(() => {
    const needs = overview.coverage_requests.filter(request => request.status !== 'covered').length
    const covered = overview.coverage_requests.filter(
      request => request.status === 'covered'
    ).length
    return {
      needs,
      covered,
      all: overview.coverage_requests.length,
    }
  }, [overview.coverage_requests])

  const filteredCoverageRequests = useMemo(() => {
    if (coverageFilter === 'needs') {
      return overview.coverage_requests.filter(request => request.status !== 'covered')
    }
    if (coverageFilter === 'covered') {
      return overview.coverage_requests.filter(request => request.status === 'covered')
    }
    return overview.coverage_requests
  }, [coverageFilter, overview.coverage_requests])

  const belowRequiredGroups = useMemo(
    () =>
      groupStaffingTargets(
        overview.staffing_targets.filter(slot => slot.status === 'below_required')
      ),
    [overview.staffing_targets]
  )

  const belowPreferredGroups = useMemo(
    () =>
      groupStaffingTargets(
        overview.staffing_targets.filter(slot => slot.status === 'below_preferred')
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
          <div className="flex items-center gap-2">
            {isGreetingReady ? (
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                {greetingTime}
                {greetingName ? `, ${greetingName}!` : ''}
              </h1>
            ) : (
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                <span className="invisible">{greetingTime}</span>
              </h1>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRefresh}
                    disabled={isFetching}
                    className="h-10 w-10 p-0 text-slate-500 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                  >
                    <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh dashboard</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <p className="text-xl text-slate-600 mt-1 flex items-center gap-2">
          Here is your coverage outlook for {getRangeLabel(coverageRange)} (
          {formatFullDateLabel(currentStartDate)} - {formatFullDateLabel(currentEndDate)}).
          {(isLoadingOverview || (isFetching && !isLoadingOverview)) && (
            <Loader2 className="h-4 w-4 animate-spin text-slate-500 ml-1" />
          )}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none transition-colors"
                aria-label="Change coverage outlook time range"
                suppressHydrationWarning
              >
                <Settings className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-64 shadow-lg border-slate-200"
              align="start"
              sideOffset={8}
            >
              <div className="space-y-3">
                <Label className="text-base font-semibold text-slate-900">Time Range</Label>
                <RadioGroup
                  value={coverageRange}
                  onValueChange={value => setCoverageRange(value as CoverageRange)}
                  className="space-y-2.5"
                >
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem
                      value="1 week"
                      id="range-1week"
                      className="focus:outline-none focus-visible:ring-0"
                    />
                    <Label
                      htmlFor="range-1week"
                      className="text-base font-normal cursor-pointer text-slate-700"
                    >
                      1 week
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem
                      value="2 weeks"
                      id="range-2weeks"
                      className="focus:outline-none focus-visible:ring-0"
                    />
                    <Label
                      htmlFor="range-2weeks"
                      className="text-base font-normal cursor-pointer text-slate-700"
                    >
                      2 weeks
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem
                      value="1 month"
                      id="range-1month"
                      className="focus:outline-none focus-visible:ring-0"
                    />
                    <Label
                      htmlFor="range-1month"
                      className="text-base font-normal cursor-pointer text-slate-700"
                    >
                      1 month
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem
                      value="2 months"
                      id="range-2months"
                      className="focus:outline-none focus-visible:ring-0"
                    />
                    <Label
                      htmlFor="range-2months"
                      className="text-base font-normal cursor-pointer text-slate-700"
                    >
                      2 months
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </PopoverContent>
          </Popover>
        </p>
      </section>

      {orphanedShiftsCount > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Action Required:</span> {orphanedShiftsCount} future
            time-off shift{orphanedShiftsCount !== 1 ? 's' : ''}{' '}
            {orphanedShiftsCount !== 1 ? 'are' : 'is'} missing a scheduled classroom or fall
            {orphanedShiftsCount !== 1 ? '' : 's'} on a closed day. Please review the baseline
            schedule or school calendar to resolve this conflict.
          </div>
        </section>
      )}

      <section className="space-y-3 pb-1">
        <div className="grid gap-x-4 gap-y-6 justify-items-start items-stretch grid-cols-[repeat(auto-fill,minmax(250px,250px))]">
          {summaryItems.map(item => (
            <div key={item.key} className="text-left min-w-[250px] max-w-[250px] h-full flex">
              <Card
                className={cn(
                  'w-full border-2 shadow-sm flex flex-col flex-1',
                  'sm:justify-self-start',
                  item.cardStyle
                )}
              >
                <CardContent className="p-4 flex flex-col flex-1">
                  <div
                    className="text-base font-normal"
                    style={
                      item.key === 'partial'
                        ? { backgroundClip: 'unset', WebkitBackgroundClip: 'unset' }
                        : undefined
                    }
                  >
                    {item.label}
                  </div>
                  <div className="mt-3 h-px w-full bg-black/10" />
                  {'count' in item ? (
                    <div className="mt-3 flex items-center justify-between">
                      <div
                        className="text-3xl font-semibold"
                        style={
                          item.key === 'uncovered'
                            ? ({ color: coverageColorValues.uncovered.icon } as React.CSSProperties)
                            : item.key === 'partial'
                              ? ({ color: coverageColorValues.partial.text } as React.CSSProperties)
                              : item.key === 'scheduled'
                                ? ({ color: '#0D9488' } as React.CSSProperties) // teal-600
                                : item.key === 'absences'
                                  ? ({ color: 'rgba(55, 65, 81, 1)' } as React.CSSProperties) // gray-700
                                  : undefined
                        }
                      >
                        {item.count}
                      </div>
                      {item.icon ? (
                        <span
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full"
                          style={
                            item.key === 'uncovered'
                              ? ({
                                  backgroundColor: coverageColorValues.uncovered.bg,
                                  color: coverageColorValues.uncovered.icon,
                                } as React.CSSProperties)
                              : item.key === 'partial'
                                ? ({
                                    backgroundColor: coverageColorValues.partial.bg,
                                    color: coverageColorValues.partial.icon,
                                  } as React.CSSProperties)
                                : item.key === 'scheduled'
                                  ? ({
                                      backgroundColor: 'rgba(236, 253, 245, 1)', // emerald-50
                                      color: '#0D9488', // teal-600
                                      borderWidth: '0px',
                                      borderStyle: 'none',
                                      borderColor: 'rgba(0, 0, 0, 0)',
                                      borderImage: 'none',
                                    } as React.CSSProperties)
                                  : item.key === 'absences'
                                    ? ({
                                        backgroundColor: 'rgba(243, 244, 246, 1)', // gray-100
                                        color: 'rgba(55, 65, 81, 1)', // gray-700
                                        borderWidth: '0px',
                                        borderStyle: 'none',
                                        borderColor: 'rgba(0, 0, 0, 0)',
                                        borderImage: 'none',
                                      } as React.CSSProperties)
                                    : undefined
                          }
                        >
                          <item.icon className="h-5 w-5" />
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {'secondaryCount' in item &&
                  item.secondaryCount !== undefined &&
                  item.secondaryIcon !== undefined &&
                  item.secondaryStyle !== undefined &&
                  item.secondaryIconStyle !== undefined &&
                  item.secondaryRightCount !== undefined &&
                  item.secondaryRightIcon !== undefined &&
                  item.secondaryRightStyle !== undefined &&
                  item.secondaryRightIconStyle !== undefined ? (
                    <div className="mt-3 flex items-center justify-between">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                'flex items-center gap-2 text-3xl font-semibold',
                                item.secondaryStyle
                              )}
                              style={
                                'secondaryColorValues' in item && item.secondaryColorValues
                                  ? { color: item.secondaryColorValues.text }
                                  : undefined
                              }
                            >
                              <span
                                style={
                                  'secondaryColorValues' in item && item.secondaryColorValues
                                    ? { color: item.secondaryColorValues.text }
                                    : undefined
                                }
                              >
                                {item.secondaryCount}
                              </span>
                              <span
                                className={cn(
                                  'inline-flex h-9 w-9 items-center justify-center rounded-full',
                                  item.secondaryIconStyle
                                )}
                                style={
                                  'secondaryColorValues' in item && item.secondaryColorValues
                                    ? {
                                        backgroundColor: item.secondaryColorValues.bg,
                                        color: item.secondaryColorValues.text,
                                      }
                                    : undefined
                                }
                              >
                                <item.secondaryIcon className="h-5 w-5" />
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              Classrooms below <em>preferred</em> staffing ratio
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                'flex items-center gap-2 text-3xl font-semibold',
                                item.secondaryRightStyle
                              )}
                              style={
                                'secondaryRightColorValues' in item &&
                                item.secondaryRightColorValues
                                  ? { color: item.secondaryRightColorValues.text }
                                  : undefined
                              }
                            >
                              <span
                                style={
                                  'secondaryRightColorValues' in item &&
                                  item.secondaryRightColorValues
                                    ? { color: item.secondaryRightColorValues.text }
                                    : undefined
                                }
                              >
                                {item.secondaryRightCount}
                              </span>
                              <span
                                className={cn(
                                  'inline-flex h-9 w-9 items-center justify-center rounded-full',
                                  item.secondaryRightIconStyle
                                )}
                                style={
                                  'secondaryRightColorValues' in item &&
                                  item.secondaryRightColorValues
                                    ? {
                                        backgroundColor: item.secondaryRightColorValues.bg,
                                        color: item.secondaryRightColorValues.text,
                                      }
                                    : undefined
                                }
                              >
                                <item.secondaryRightIcon className="h-5 w-5" />
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              Classrooms below <em>required</em> staffing ratio
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </section>

      <div
        ref={gridRef}
        className="grid grid-cols-1 gap-6 pt-1 w-full xl:grid-cols-[minmax(550px,1.4fr)_minmax(400px,0.9fr)_minmax(400px,0.9fr)]"
      >
        <section
          className="xl:w-full xl:max-w-full overflow-hidden space-y-4 rounded-xl border-2 border-slate-200 bg-white p-5 shadow-sm xl:col-span-1"
          style={{ minWidth: isXlScreen ? '0' : '550px' }}
        >
          <div
            role="button"
            tabIndex={0}
            onClick={() => setCoverageSectionCollapsed(!coverageSectionCollapsed)}
            onKeyDown={e => {
              if (e?.key === 'Enter' || e?.key === ' ') {
                e?.preventDefault?.()
                setCoverageSectionCollapsed(!coverageSectionCollapsed)
              }
            }}
            className="flex w-full items-center justify-between gap-3"
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
                  onClick={e => {
                    e?.stopPropagation?.()
                    setCoverageFilter('all')
                  }}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition',
                    coverageFilter === 'all'
                      ? 'border-button-fill bg-button-fill text-button-fill-foreground'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  )}
                >
                  All ({coverageCounts.all})
                </button>
                <button
                  type="button"
                  onClick={e => {
                    e?.stopPropagation?.()
                    setCoverageFilter('needs')
                  }}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition',
                    coverageFilter === 'needs'
                      ? 'border-button-fill bg-button-fill text-button-fill-foreground'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  )}
                >
                  Needs a Sub ({coverageCounts.needs})
                </button>
                <button
                  type="button"
                  onClick={e => {
                    e?.stopPropagation?.()
                    setCoverageFilter('covered')
                  }}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition',
                    coverageFilter === 'covered'
                      ? 'border-button-fill bg-button-fill text-button-fill-foreground'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  )}
                >
                  Covered ({coverageCounts.covered})
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
                No upcoming{' '}
                {coverageFilter === 'needs'
                  ? 'time off needing a sub'
                  : coverageFilter === 'covered'
                    ? 'covered time off'
                    : 'time off'}{' '}
                in the next {getRangeDaysText(coverageRange)}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCoverageRequests.map(request => {
                  // Use API coverage counts directly (covered_shifts, uncovered_shifts, partial_shifts)
                  const covered = request.covered_shifts ?? 0
                  const uncovered = request.uncovered_shifts ?? 0
                  const partial = request.partial_shifts ?? 0

                  // For time_off requests, use source_request_id (time_off_request.id) for sub-finder
                  // For other request types, use the coverage_request.id
                  const absenceId =
                    request.request_type === 'time_off' && request.source_request_id
                      ? request.source_request_id
                      : request.id

                  return (
                    <TimeOffCard
                      key={request.id}
                      id={absenceId}
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
                      onEdit={() => {
                        // Use source_request_id (time_off_request.id) for editing if it's a time_off request
                        if (request.request_type === 'time_off' && request.source_request_id) {
                          handleEdit(request.source_request_id)
                        }
                        // For non-time_off requests, we can't edit them from here
                      }}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <section
          className="xl:w-full xl:max-w-full overflow-hidden space-y-4 rounded-xl border-2 border-slate-200 bg-white p-5 shadow-sm xl:col-span-1"
          style={{ minWidth: isXlScreen ? '0' : '450px' }}
        >
          <div
            role="button"
            tabIndex={0}
            onClick={() => setScheduledSubsSectionCollapsed(!scheduledSubsSectionCollapsed)}
            onKeyDown={e => {
              if (e?.key === 'Enter' || e?.key === ' ') {
                e?.preventDefault?.()
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
                No subs scheduled in the next {getRangeDaysText(coverageRange)}
              </div>
            ) : (
              <div className="space-y-3">
                {overview.scheduled_subs.map(assignment => (
                  <div
                    key={assignment.id}
                    className="group relative flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-md transition-shadow hover:shadow-lg"
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
                          className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                          style={getClassroomPillStyle(assignment.classroom_color)}
                        >
                          {assignment.classroom_name}
                        </span>
                      </div>
                    </div>
                    <div className="flex w-full justify-end self-end sm:w-auto">
                      <Button asChild size="sm" variant="teal">
                        <Link
                          href={
                            assignment.coverage_request_id
                              ? `/sub-finder?absence_id=${assignment.coverage_request_id}&sub_id=${assignment.sub_id || ''}`
                              : '/sub-finder'
                          }
                        >
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

        <section
          className="xl:w-full xl:max-w-full overflow-hidden space-y-4 rounded-xl border-2 border-slate-200 bg-white p-5 shadow-sm xl:col-span-1"
          style={{ minWidth: isXlScreen ? '0' : '450px' }}
        >
          <div
            role="button"
            tabIndex={0}
            onClick={() => setStaffingTargetSectionCollapsed(!staffingTargetSectionCollapsed)}
            onKeyDown={e => {
              if (e?.key === 'Enter' || e?.key === ' ') {
                e?.preventDefault?.()
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
            <p className="text-xs text-slate-500">
              Counts permanent staff, flex staff, floaters (0.5), and temporary coverage. Subs and
              absences are excluded from the calculation.
            </p>
            {overview.staffing_targets.length === 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                ✅ All classrooms meet staffing targets.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setBelowRequiredCollapsed(prev => !prev)}
                    className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    <span>
                      Below Required (
                      {belowRequiredGroups.reduce(
                        (total, classroom) =>
                          total + classroom.slotGroups.reduce((s, g) => s + g.slots.length, 0),
                        0
                      )}
                      )
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
                      belowRequiredGroups.map(classroom => (
                        <div key={classroom.classroom_name} className="space-y-2">
                          <div>
                            <span
                              className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                              style={getClassroomPillStyle(classroom.classroom_color)}
                            >
                              {classroom.classroom_name} (
                              {classroom.slotGroups.reduce((s, g) => s + g.slots.length, 0)})
                            </span>
                          </div>
                          {classroom.slotGroups.map(group => (
                            <div
                              key={`${group.rep.classroom_id}-${group.rep.time_slot_id}-${group.rep.day_of_week_id}-${group.dateStart}-${group.dateEnd}`}
                              className="grid gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-md transition-shadow hover:shadow-lg md:grid-cols-[1fr_auto]"
                            >
                              <div className="flex flex-wrap items-center gap-4 min-w-0">
                                <div className="min-w-[160px] space-y-3 flex-shrink-0">
                                  <div className="text-sm font-semibold text-slate-900">
                                    {formatGroupSlotLabel(group)}
                                  </div>
                                  <div className="flex flex-col items-start gap-2">
                                    <StaffingStatusBadge
                                      status={group.rep.status}
                                      label={`Below Required by ${formatShortfallValue(
                                        group.rep.required_staff,
                                        group.rep.scheduled_staff
                                      )}`}
                                      size="md"
                                    />
                                    <div className="text-xs text-slate-600 whitespace-nowrap">
                                      Required: {group.rep.required_staff} · Scheduled:{' '}
                                      {group.rep.scheduled_staff}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center justify-end self-end flex-shrink-0">
                                <Button
                                  size="sm"
                                  variant="teal"
                                  onClick={() => setAssignCoverageSlot(group)}
                                >
                                  Add Coverage
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
                    onClick={() => setBelowPreferredCollapsed(prev => !prev)}
                    className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    <span>
                      Below Preferred (
                      {belowPreferredGroups.reduce(
                        (total, classroom) =>
                          total + classroom.slotGroups.reduce((s, g) => s + g.slots.length, 0),
                        0
                      )}
                      )
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
                      belowPreferredGroups.map(classroom => (
                        <div key={classroom.classroom_name} className="space-y-2">
                          <div>
                            <span
                              className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                              style={getClassroomPillStyle(classroom.classroom_color)}
                            >
                              {classroom.classroom_name} (
                              {classroom.slotGroups.reduce((s, g) => s + g.slots.length, 0)})
                            </span>
                          </div>
                          {classroom.slotGroups.map(group => (
                            <div
                              key={`${group.rep.classroom_id}-${group.rep.time_slot_id}-${group.rep.day_of_week_id}-${group.dateStart}-${group.dateEnd}`}
                              className="grid gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-md transition-shadow hover:shadow-lg md:grid-cols-[1fr_auto]"
                            >
                              <div className="flex flex-wrap items-center gap-4 min-w-0">
                                <div className="min-w-[160px] space-y-3 flex-shrink-0">
                                  <div className="text-sm font-semibold text-slate-900">
                                    {formatGroupSlotLabel(group)}
                                  </div>
                                  <div className="flex flex-col items-start gap-2">
                                    <StaffingStatusBadge
                                      status={group.rep.status}
                                      label={`Below Preferred by ${formatShortfallValue(
                                        group.rep.preferred_staff ?? group.rep.required_staff,
                                        group.rep.scheduled_staff
                                      )}`}
                                      size="md"
                                    />
                                    <div className="text-xs text-slate-600 whitespace-nowrap">
                                      Preferred:{' '}
                                      {group.rep.preferred_staff ?? group.rep.required_staff} ·
                                      Scheduled: {group.rep.scheduled_staff}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center justify-end self-end flex-shrink-0">
                                <Button
                                  size="sm"
                                  variant="teal"
                                  onClick={() => setAssignCoverageSlot(group)}
                                >
                                  Add Coverage
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

      {/* Add Temporary Coverage (reuses ScheduleSidePanel from weekly schedule) */}
      {assignCoverageSlot &&
        VALID_DATE_ISO.test(assignCoverageSlot.dateStart) &&
        VALID_DATE_ISO.test(assignCoverageSlot.dateEnd) && (
          <ScheduleSidePanel
            isOpen
            onClose={() => {
              setAssignCoverageSlot(null)
              refetch()
            }}
            dayId={assignCoverageSlot.rep.day_of_week_id}
            dayName={assignCoverageSlot.rep.day_name}
            timeSlotId={assignCoverageSlot.rep.time_slot_id}
            timeSlotName={assignCoverageSlot.rep.time_slot_code}
            timeSlotCode={assignCoverageSlot.rep.time_slot_code}
            timeSlotStartTime={null}
            timeSlotEndTime={null}
            classroomId={assignCoverageSlot.rep.classroom_id}
            classroomName={assignCoverageSlot.rep.classroom_name}
            classroomColor={assignCoverageSlot.rep.classroom_color ?? null}
            selectedDayIds={[]}
            onSave={() => void refetch()}
            weekStartISO={getWeekStartISOFromDate(assignCoverageSlot.dateStart)}
            readOnly
            initialPanelMode="flex"
            initialFlexStartDate={assignCoverageSlot.dateStart}
            initialFlexEndDate={assignCoverageSlot.dateEnd}
            initialFlexTargetType={
              assignCoverageSlot.rep.status === 'below_preferred' ? 'preferred' : 'required'
            }
            initialFlexRequiredStaff={assignCoverageSlot.rep.required_staff}
            initialFlexPreferredStaff={assignCoverageSlot.rep.preferred_staff}
            initialFlexScheduledStaff={assignCoverageSlot.rep.scheduled_staff}
          />
        )}

      {/* Edit Time Off Panel */}
      {editingRequestId && (
        <AddTimeOffButton
          key={editingRequestId}
          timeOffRequestId={editingRequestId}
          onClose={handleEditClose}
        />
      )}
    </div>
  )
}
