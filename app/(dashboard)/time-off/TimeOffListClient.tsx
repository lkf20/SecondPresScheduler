'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Settings2, RefreshCw } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import TimeOffCard, { type ClassroomBadge } from '@/components/shared/TimeOffCard'
import AddTimeOffButton from '@/components/time-off/AddTimeOffButton'
import { useTimeOffRequests } from '@/lib/hooks/use-time-off-requests'
import { parseLocalDate } from '@/lib/utils/date'

type CoverageStatus = 'draft' | 'completed' | 'covered' | 'partially_covered' | 'needs_coverage'

type TimeOffRow = {
  id: string
  teacher_name: string
  start_date: string
  end_date: string | null
  status: 'draft' | 'active' | 'deleted'
  coverage_status: CoverageStatus
  coverage_covered: number
  coverage_total: number
  coverage_partial?: number
  coverage_uncovered?: number
  shifts_display: string
  shift_details?: string[] | Array<{ label: string; status: 'covered' | 'partial' | 'uncovered' }>
  classrooms?: ClassroomBadge[]
  reason?: string | null
  notes?: string | null
}

export default function TimeOffListClient({
  view: initialView,
}: {
  view: string
}) {
  const router = useRouter()
  const [view, setView] = useState(initialView ?? 'active')
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null)
  // Default to all coverage filters selected
  const [coverageFilters, setCoverageFilters] = useState<Set<string>>(
    new Set(['covered', 'needs_coverage', 'partially_covered'])
  )
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  
  // Use React Query to fetch time off requests
  const { data: timeOffData, isLoading, error, refetch, isFetching } = useTimeOffRequests({
    statuses: ['active', 'draft'],
  })
  
  // Manual refresh handler
  const handleRefresh = async () => {
    await refetch()
  }
  
  // Transform API response to match component's expected format
  const allRequests: TimeOffRow[] = useMemo(() => {
    const apiData = timeOffData?.data || []
    return apiData.map((item: any) => {
      // Calculate shifts_display from total
      const total = item.total || 0
      const shifts_display = `${total} shift${total !== 1 ? 's' : ''}`
      
      // Map coverage status - API uses 'covered' | 'partially_covered' | 'needs_coverage'
      // Component expects 'draft' | 'completed' | 'covered' | 'partially_covered' | 'needs_coverage'
      let coverage_status: CoverageStatus = item.status || 'needs_coverage'
      
      // Check if it's a draft or completed (past) request
      const requestEndDate = item.end_date || item.start_date
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const isPast = parseLocalDate(requestEndDate) < today
      
      // The API should include status, but we need to check for draft/completed
      // For now, assume the API handles this, but we can add logic here if needed
      
      return {
        id: item.id,
        teacher_name: item.teacher_name,
        start_date: item.start_date,
        end_date: item.end_date,
        status: item.status === 'draft' ? 'draft' : 'active', // Map from API status
        coverage_status: coverage_status as CoverageStatus,
        coverage_covered: item.covered || 0,
        coverage_total: item.total || 0,
        coverage_partial: item.partial || 0,
        coverage_uncovered: item.uncovered || 0,
        shifts_display,
        shift_details: item.shift_details,
        classrooms: item.classrooms,
        reason: item.reason,
        notes: item.notes,
      }
    })
  }, [timeOffData])
  
  // Transform and categorize requests
  const { draftRequests, upcomingRequests, pastRequests } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const ninetyDaysAgo = new Date(today)
    ninetyDaysAgo.setDate(today.getDate() - 90)
    
    const getStartDate = (request: TimeOffRow) => parseLocalDate(request.start_date)
    const getEndDate = (request: TimeOffRow) =>
      parseLocalDate(request.end_date || request.start_date)
    
    const drafts = allRequests.filter((r: TimeOffRow) => r.status === 'draft')
    const active = allRequests.filter((r: TimeOffRow) => r.status === 'active')
    
    const past = active
      .filter((r: TimeOffRow) => {
        const endDate = getEndDate(r)
        return endDate < today && endDate >= ninetyDaysAgo
      })
      .sort((a, b) => getEndDate(b).getTime() - getEndDate(a).getTime())
    
    const upcoming = active
      .filter((r: TimeOffRow) => getEndDate(r) >= today)
      .sort((a, b) => getStartDate(a).getTime() - getStartDate(b).getTime())
    
    return { draftRequests: drafts, upcomingRequests: upcoming, pastRequests: past }
  }, [allRequests])

  const handleEdit = (id: string) => {
    setEditingRequestId(id)
  }

  const handleEditClose = () => {
    setEditingRequestId(null)
  }

  useEffect(() => {
    setView(initialView ?? 'active')
  }, [initialView])
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading time off requests...</p>
        </div>
      </div>
    )
  }
  
  // Show error state
  if (error) {
    return (
      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-center py-12">
          <p className="text-destructive">Failed to load time off requests. Please try again.</p>
        </div>
      </div>
    )
  }

  const updateView = (nextView: string) => {
    setView(nextView)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('view', nextView)
      window.history.replaceState({}, '', url)
    }
  }

  const toggleCoverageFilter = (filter: string) => {
    setCoverageFilters((prev) => {
      const next = new Set(prev)
      if (next.has(filter)) {
        next.delete(filter)
      } else {
        next.add(filter)
      }
      return next
    })
  }

  // Filter requests based on status view and coverage filters
  const getFilteredRequests = (requests: TimeOffRow[]): TimeOffRow[] => {
    // If all filters are selected, show all requests
    if (coverageFilters.size === 3) {
      return requests
    }

    // If no filters are selected, show nothing (or all - let's show all for better UX)
    if (coverageFilters.size === 0) {
      return requests
    }

    // Filter by selected coverage statuses
    return requests.filter((request) => {
      return coverageFilters.has(request.coverage_status)
    })
  }

  // Calculate coverage filter counts based on current status view
  const getCoverageCounts = () => {
    let requestsToCount: TimeOffRow[] = []
    
    if (view === 'active') {
      requestsToCount = upcomingRequests
    } else if (view === 'drafts') {
      requestsToCount = draftRequests
    } else if (view === 'past') {
      requestsToCount = pastRequests
    } else {
      requestsToCount = [...draftRequests, ...upcomingRequests, ...pastRequests]
    }

    const covered = requestsToCount.filter(r => r.coverage_status === 'covered').length
    const needsCoverage = requestsToCount.filter(r => r.coverage_status === 'needs_coverage').length
    const partiallyCovered = requestsToCount.filter(r => r.coverage_status === 'partially_covered').length

    return { covered, needsCoverage, partiallyCovered }
  }

  const handleDeleteDraft = async (id: string) => {
    if (!confirm('Delete this draft?')) return
    try {
      const response = await fetch(`/api/time-off/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete draft.' }))
        throw new Error(errorData.error || 'Failed to delete draft.')
      }
      // React Query will automatically refetch when mutations invalidate the cache
      // But we can also manually trigger a refetch if needed
      router.refresh()
    } catch (error) {
      console.error('Failed to delete draft:', error)
    }
  }
  const renderRowCard = (row: TimeOffRow) => {
    // Use provided coverage counts if available, otherwise calculate from status
    let covered = row.coverage_covered || 0
    let uncovered = row.coverage_uncovered ?? (row.coverage_total - row.coverage_covered)
    let partial = row.coverage_partial || 0

    // If we have exact counts, use them; otherwise infer from status
    if (row.coverage_status === 'covered') {
      covered = row.coverage_total
      uncovered = 0
      partial = 0
    } else if (row.coverage_status === 'needs_coverage') {
      covered = 0
      uncovered = row.coverage_total
      partial = 0
    } else if (row.coverage_status === 'partially_covered') {
      // If we have partial count, use it; otherwise estimate
      if (row.coverage_partial !== undefined) {
        partial = row.coverage_partial
        uncovered = row.coverage_uncovered ?? (row.coverage_total - row.coverage_covered - row.coverage_partial)
      } else {
        // Estimate: covered is known, rest is split between uncovered and partial
        uncovered = row.coverage_total - row.coverage_covered
        partial = 0
      }
    }

    // Extract total shifts from shifts_display (e.g., "12 shifts" -> 12)
    const totalShiftsMatch = row.shifts_display.match(/(\d+)/)
    const totalShifts = totalShiftsMatch ? parseInt(totalShiftsMatch[1], 10) : undefined

    // Handle draft status with delete button
    if (row.status === 'draft') {
      return (
        <div key={row.id} className="rounded-lg border border-slate-200 bg-white px-5 pt-2 pb-4 shadow-sm">
          <TimeOffCard
            id={row.id}
            teacherName={row.teacher_name}
            startDate={row.start_date}
            endDate={row.end_date}
            reason={row.reason || null}
            classrooms={row.classrooms}
            variant="time-off"
            covered={covered}
            uncovered={uncovered}
            partial={partial}
            totalShifts={totalShifts}
            shiftDetails={row.shift_details}
            className="border-0 shadow-none px-0 py-0"
          />
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => handleEdit(row.id)}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => handleDeleteDraft(row.id)}>
              Delete
            </Button>
          </div>
        </div>
      )
    }

    return (
      <TimeOffCard
        key={row.id}
        id={row.id}
        teacherName={row.teacher_name}
        startDate={row.start_date}
        endDate={row.end_date}
        reason={row.reason || null}
        classrooms={row.classrooms}
        variant="time-off"
        covered={covered}
        uncovered={uncovered}
        partial={partial}
        totalShifts={totalShifts}
        shiftDetails={row.shift_details}
        notes={row.notes || null}
        onEdit={() => handleEdit(row.id)}
      />
    )
  }

  const renderSection = (rows: TimeOffRow[], emptyMessage: string) => {
    if (rows.length === 0) {
      return <div className="rounded-lg border border-slate-200 bg-white px-5 py-6 text-sm text-muted-foreground">{emptyMessage}</div>
    }
    return <div className="space-y-3">{rows.map(renderRowCard)}</div>
  }

  const coverageCounts = getCoverageCounts()
  const filteredDraftRequests = getFilteredRequests(draftRequests)
  const filteredUpcomingRequests = getFilteredRequests(upcomingRequests)
  const filteredPastRequests = getFilteredRequests(pastRequests)

  return (
    <>
      <div className="flex justify-between items-start mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Time Off Requests</h1>
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
                  <p>Refresh list</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-muted-foreground mt-2">Manage teacher time off requests</p>
        </div>
        <AddTimeOffButton />
      </div>
      
      {/* Separate instance for editing - hidden, only used to control the panel */}
      {editingRequestId && (
        <AddTimeOffButton timeOffRequestId={editingRequestId} onClose={handleEditClose} />
      )}
      
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[
          { value: 'active', label: `Active (${upcomingRequests.length})` },
          { value: 'drafts', label: `Drafts (${draftRequests.length})` },
          { value: 'past', label: `Past (${pastRequests.length})` },
          { value: 'all', label: `All (${draftRequests.length + upcomingRequests.length + pastRequests.length})` },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => updateView(option.value)}
            className={
              view === option.value
                ? 'rounded-full border border-button-fill bg-button-fill px-3 py-1 text-xs font-medium text-button-fill-foreground'
                : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-300'
            }
          >
            {option.label}
          </button>
        ))}

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="relative">
              <Settings2 className="h-4 w-4 mr-2" />
              Filter
              {coverageFilters.size < 3 && (
                <Badge
                  variant="secondary"
                  className="ml-2 h-5 min-w-[20px] px-1.5 text-xs"
                >
                  {3 - coverageFilters.size}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-80"
            align="start"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-3">Coverage Status</h4>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="filter-covered"
                      checked={coverageFilters.has('covered')}
                      onCheckedChange={() => toggleCoverageFilter('covered')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor="filter-covered"
                        className="text-sm font-normal cursor-pointer"
                      >
                        Fully Covered
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {coverageCounts.covered} request{coverageCounts.covered !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="filter-needs-coverage"
                      checked={coverageFilters.has('needs_coverage')}
                      onCheckedChange={() => toggleCoverageFilter('needs_coverage')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor="filter-needs-coverage"
                        className="text-sm font-normal cursor-pointer"
                      >
                        Needs Coverage
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {coverageCounts.needsCoverage} request{coverageCounts.needsCoverage !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="filter-partially-covered"
                      checked={coverageFilters.has('partially_covered')}
                      onCheckedChange={() => toggleCoverageFilter('partially_covered')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor="filter-partially-covered"
                        className="text-sm font-normal cursor-pointer"
                      >
                        Partially Covered
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {coverageCounts.partiallyCovered} request{coverageCounts.partiallyCovered !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {filteredDraftRequests.length > 0 && (view === 'drafts' || view === 'all') && (
        <details open={view === 'drafts'} className="mb-6 rounded-lg bg-gray-50 border border-gray-200 p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            Drafts ({filteredDraftRequests.length})
          </summary>
          <div className="mt-4">
            {renderSection(filteredDraftRequests, 'No drafts available.')}
          </div>
        </details>
      )}

      {(view === 'active' || view === 'all') && (
        <div className="space-y-3">
          {renderSection(filteredUpcomingRequests, 'No active time off requests found.')}
        </div>
      )}

      {filteredPastRequests.length > 0 && (view === 'past' || view === 'active' || view === 'all') && (
        <details className="mt-6 rounded-lg bg-gray-50 border border-gray-200 p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-700 flex items-center justify-between">
            <span>Past Time Off (last 90 days)</span>
            <span className="text-muted-foreground">{filteredPastRequests.length}</span>
          </summary>
          <div className="mt-4">
            {renderSection(filteredPastRequests, 'No past time off requests in the last 90 days.')}
          </div>
        </details>
      )}
    </>
  )
}
