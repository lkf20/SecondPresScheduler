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
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { getClassroomPillStyle } from '@/lib/utils/classroom-style'
import { getCoverageColors, getStaffingColorClasses, getStaffingColors, neutralColors, coverageColorValues, getButtonColors, staffingColorValues } from '@/lib/utils/colors'
import TimeOffCard from '@/components/shared/TimeOffCard'
import { Loader2 } from 'lucide-react'
import { useDashboard } from '@/lib/hooks/use-dashboard'
import { useProfile } from '@/lib/hooks/use-profile'
import AddTimeOffButton from '@/components/time-off/AddTimeOffButton'

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
      return getStaffingColorClasses('below_required')
    case 'below_preferred':
      return getStaffingColorClasses('below_preferred')
    default:
      return getStaffingColorClasses('adequate')
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
  const [greetingTime, setGreetingTime] = useState('Good Morning')
  const gridRef = useRef<HTMLDivElement>(null)
  const [isXlScreen, setIsXlScreen] = useState(false)
  
  // Use React Query to cache the profile/name
  const { data: profile } = useProfile()
  const greetingName = profile?.first_name?.trim() || null
  const [belowRequiredCollapsed, setBelowRequiredCollapsed] = useState(false)
  const [belowPreferredCollapsed, setBelowPreferredCollapsed] = useState(false)
  const [coverageFilter, setCoverageFilter] = useState<'needs' | 'covered' | 'all'>(
    'needs'
  )
  const [coverageSectionCollapsed, setCoverageSectionCollapsed] = useState(false)
  const [scheduledSubsSectionCollapsed, setScheduledSubsSectionCollapsed] = useState(false)
  const [staffingTargetSectionCollapsed, setStaffingTargetSectionCollapsed] = useState(false)
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null)
  
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
    return coverageRange === '2 weeks' && currentStartDate === initialStartDate && currentEndDate === initialEndDate
  }, [coverageRange, currentStartDate, currentEndDate, initialStartDate, initialEndDate])
  
  // Use React Query for dashboard data
  const { data: overview = initialOverview, isLoading: isLoadingOverview, isFetching } = useDashboard(
    {
      preset: coverageRange,
      startDate: currentStartDate,
      endDate: currentEndDate,
    },
    shouldUseInitialData ? initialOverview : undefined
  )
  
  // Save to localStorage when range changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboard_coverage_range', coverageRange)
    }
  }, [coverageRange])

  useEffect(() => {
    const hour = new Date().getHours()
    const greeting =
      hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'
    setGreetingTime(greeting)
  }, [])

  // Track xl screen size for responsive min-width
  useEffect(() => {
    const checkScreenSize = () => {
      setIsXlScreen(window.innerWidth >= 1280)
    }
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // Debug grid layout on xl screens
  useEffect(() => {
    if (typeof window === 'undefined' || !gridRef.current) return
    
    const checkLayout = () => {
      const el = gridRef.current
      if (!el) return
      
      const isXl = window.innerWidth >= 1280
      if (!isXl) return
      
      const styles = window.getComputedStyle(el)
      const sections = el.querySelectorAll('section')
      
      console.log('[Dashboard Grid Debug]', {
        windowWidth: window.innerWidth,
        gridWidth: el.offsetWidth,
        gridTemplateColumns: styles.gridTemplateColumns,
        gridTemplateColumnsComputed: styles.getPropertyValue('grid-template-columns'),
        parentWidth: el.parentElement?.offsetWidth,
        parentMaxWidth: window.getComputedStyle(el.parentElement!).maxWidth,
        sections: Array.from(sections).map((section, i) => ({
          index: i,
          width: section.offsetWidth,
          minWidth: window.getComputedStyle(section).minWidth,
          maxWidth: window.getComputedStyle(section).maxWidth,
          computedWidth: window.getComputedStyle(section).width,
        })),
      })
    }
    
    // Check on mount and resize
    checkLayout()
    window.addEventListener('resize', checkLayout)
    return () => window.removeEventListener('resize', checkLayout)
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

  const summaryItems = useMemo(() => {
    const uncoveredColors = getCoverageColors('uncovered')
    const partialColors = getCoverageColors('partial')
    const infoColors = { text: 'text-blue-600', bg: 'bg-blue-100', icon: 'text-blue-600' }
    const tealColors = { text: 'text-teal-700', bg: 'bg-teal-100', icon: 'text-teal-600' }
    const purpleColors = { text: 'text-purple-800', bg: 'bg-blue-100', icon: 'text-purple-800' }
    
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
        secondaryStyle: purpleColors.text,
        secondaryIconStyle: `${purpleColors.bg} ${purpleColors.icon}`,
        secondaryRightCount: belowRequiredClassrooms,
        secondaryRightIcon: AlertCircle,
        secondaryRightStyle: purpleColors.text,
        secondaryRightIconStyle: `${purpleColors.bg} ${purpleColors.icon}`,
      },
    ]
  }, [overview.summary, belowRequiredClassrooms, belowPreferredClassrooms])

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
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {greetingTime}
            <span className="inline-block min-w-[120px]">
              {greetingName ? `, ${greetingName}!` : ''}
            </span>
          </h1>
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
              <PopoverContent className="w-64 shadow-lg border-slate-200" align="start" sideOffset={8}>
                <div className="space-y-3">
                  <Label className="text-base font-semibold text-slate-900">Time Range</Label>
                  <RadioGroup
                    value={coverageRange}
                    onValueChange={(value) => setCoverageRange(value as CoverageRange)}
                    className="space-y-2.5"
                  >
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="1 week" id="range-1week" className="focus:outline-none focus-visible:ring-0" />
                      <Label htmlFor="range-1week" className="text-base font-normal cursor-pointer text-slate-700">
                        1 week
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="2 weeks" id="range-2weeks" className="focus:outline-none focus-visible:ring-0" />
                      <Label htmlFor="range-2weeks" className="text-base font-normal cursor-pointer text-slate-700">
                        2 weeks
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="1 month" id="range-1month" className="focus:outline-none focus-visible:ring-0" />
                      <Label htmlFor="range-1month" className="text-base font-normal cursor-pointer text-slate-700">
                        1 month
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="2 months" id="range-2months" className="focus:outline-none focus-visible:ring-0" />
                      <Label htmlFor="range-2months" className="text-base font-normal cursor-pointer text-slate-700">
                        2 months
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </PopoverContent>
            </Popover>
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
                      <div 
                        className="text-3xl font-semibold"
                        style={
                          item.key === 'uncovered' 
                            ? { color: coverageColorValues.uncovered.icon } as React.CSSProperties
                            : item.key === 'partial'
                            ? { color: coverageColorValues.partial.text } as React.CSSProperties
                            : item.key === 'scheduled'
                            ? { color: '#0D9488' } as React.CSSProperties // teal-600
                            : item.key === 'absences'
                            ? { color: 'rgba(55, 65, 81, 1)' } as React.CSSProperties // gray-700
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
                              ? {
                                  backgroundColor: coverageColorValues.uncovered.bg,
                                  color: coverageColorValues.uncovered.icon,
                                } as React.CSSProperties
                              : item.key === 'partial'
                              ? {
                                  backgroundColor: coverageColorValues.partial.bg,
                                  color: coverageColorValues.partial.icon,
                                } as React.CSSProperties
                            : item.key === 'scheduled'
                            ? {
                                backgroundColor: 'rgba(236, 253, 245, 1)', // emerald-50
                                color: '#0D9488', // teal-600
                                borderWidth: '0px',
                                borderStyle: 'none',
                                borderColor: 'rgba(0, 0, 0, 0)',
                                borderImage: 'none',
                              } as React.CSSProperties
                              : item.key === 'absences'
                              ? {
                                  backgroundColor: 'rgba(243, 244, 246, 1)', // gray-100
                                  color: 'rgba(55, 65, 81, 1)', // gray-700
                                  borderWidth: '0px',
                                  borderStyle: 'none',
                                  borderColor: 'rgba(0, 0, 0, 0)',
                                  borderImage: 'none',
                                } as React.CSSProperties
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
                              className={cn('flex items-center gap-2 text-3xl font-semibold', item.secondaryStyle)}
                              style={{ color: 'rgba(37, 99, 235, 1)' } as React.CSSProperties}
                            >
                              <span style={{ color: 'rgba(37, 99, 235, 1)' } as React.CSSProperties}>{item.secondaryCount}</span>
                              <span
                                className={cn(
                                  'inline-flex h-9 w-9 items-center justify-center rounded-full',
                                  item.secondaryIconStyle
                                )}
                                style={{ 
                                  backgroundColor: 'rgba(219, 234, 254, 1)', // blue-100
                                  color: 'rgba(37, 99, 235, 1)' // blue-600
                                } as React.CSSProperties}
                              >
                                <item.secondaryIcon className="h-5 w-5" />
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Classrooms below <em>preferred</em> staffing ratio</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={cn('flex items-center gap-2 text-3xl font-semibold', item.secondaryRightStyle)}
                              style={{ color: 'rgba(37, 99, 235, 1)' } as React.CSSProperties}
                            >
                              <span style={{ color: 'rgba(37, 99, 235, 1)' } as React.CSSProperties}>{item.secondaryRightCount}</span>
                              <span
                                className={cn(
                                  'inline-flex h-9 w-9 items-center justify-center rounded-full',
                                  item.secondaryRightIconStyle
                                )}
                                style={{ 
                                  backgroundColor: 'rgba(219, 234, 254, 1)', // blue-100
                                  color: 'rgba(37, 99, 235, 1)' // blue-600
                                } as React.CSSProperties}
                              >
                                <item.secondaryRightIcon className="h-5 w-5" />
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Classrooms below <em>required</em> staffing ratio</p>
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
            onKeyDown={(e) => {
              if (e?.key === 'Enter' || e?.key === ' ') {
                e?.preventDefault?.()
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
                onClick={(e) => {
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
              <button
                type="button"
                onClick={(e) => {
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
              No upcoming time off in the next {getRangeDaysText(coverageRange)}
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
            onKeyDown={(e) => {
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
                          className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
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
                        className={getButtonColors('teal').base}
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

        <section 
          className="xl:w-full xl:max-w-full overflow-hidden space-y-4 rounded-xl border-2 border-slate-200 bg-white p-5 shadow-sm xl:col-span-1"
          style={{ minWidth: isXlScreen ? '0' : '450px' }}
        >
          <div
            role="button"
            tabIndex={0}
            onClick={() => setStaffingTargetSectionCollapsed(!staffingTargetSectionCollapsed)}
            onKeyDown={(e) => {
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

          {overview.staffing_targets.length === 0 ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              ✅ All classrooms meet staffing targets.
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
                            className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
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
                          <div className="flex flex-wrap items-center gap-4 min-w-0">
                            <div className="min-w-[160px] space-y-3 flex-shrink-0">
                              <div className="text-sm font-semibold text-slate-900">
                                {formatSlotLabel(slot.day_name, slot.time_slot_code)}
                              </div>
                              <div className="flex flex-col items-start gap-2">
                                <span
                                  className="inline-flex items-center rounded-full px-3.5 py-1 text-xs font-medium"
                                  style={
                                    slot.status === 'below_required'
                                      ? {
                                          backgroundColor: staffingColorValues.below_required.bg,
                                          borderStyle: 'solid',
                                          borderWidth: '1px',
                                          borderColor: staffingColorValues.below_required.border,
                                          color: staffingColorValues.below_required.text,
                                        } as React.CSSProperties
                                      : slot.status === 'below_preferred'
                                      ? {
                                          backgroundColor: staffingColorValues.below_preferred.bg,
                                          borderStyle: 'solid',
                                          borderWidth: '1px',
                                          borderColor: staffingColorValues.below_preferred.border,
                                          color: staffingColorValues.below_preferred.text,
                                        } as React.CSSProperties
                                      : undefined
                                  }
                                >
                                  Below Required {formatShortfallLabel(formatShortfallValue(slot.required_staff, slot.scheduled_staff))}
                                </span>
                                <div className="text-xs text-slate-600 whitespace-nowrap">
                                  Required: {slot.required_staff} · Scheduled: {slot.scheduled_staff}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-end self-center flex-shrink-0">
                            <Button
                              asChild
                              size="sm"
                              variant="outline"
                              className={getButtonColors('teal').base}
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
                            className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
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
                          <div className="flex flex-wrap items-center gap-4 min-w-0">
                            <div className="min-w-[160px] space-y-3 flex-shrink-0">
                              <div className="text-sm font-semibold text-slate-900">
                                {formatSlotLabel(slot.day_name, slot.time_slot_code)}
                              </div>
                              <div className="flex flex-col items-start gap-2">
                                <span
                                  className="inline-flex items-center rounded-full px-3.5 py-1 text-xs font-medium"
                                  style={
                                    slot.status === 'below_preferred'
                                      ? {
                                          backgroundColor: staffingColorValues.below_preferred.bg,
                                          borderStyle: 'solid',
                                          borderWidth: '1px',
                                          borderColor: staffingColorValues.below_preferred.border,
                                          color: staffingColorValues.below_preferred.text,
                                        } as React.CSSProperties
                                      : slot.status === 'below_required'
                                      ? {
                                          backgroundColor: staffingColorValues.below_required.bg,
                                          borderStyle: 'solid',
                                          borderWidth: '1px',
                                          borderColor: staffingColorValues.below_required.border,
                                          color: staffingColorValues.below_required.text,
                                        } as React.CSSProperties
                                      : undefined
                                  }
                                >
                                  Below Preferred by{' '}
                                  {formatShortfallValue(
                                    slot.preferred_staff ?? slot.required_staff,
                                    slot.scheduled_staff
                                  )}
                                </span>
                                <div className="text-xs text-slate-600 whitespace-nowrap">
                                  Preferred: {slot.preferred_staff ?? slot.required_staff} · Scheduled:{' '}
                                  {slot.scheduled_staff}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-end self-center flex-shrink-0">
                            <Button
                              asChild
                              size="sm"
                              variant="outline"
                              className={getButtonColors('teal').base}
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
