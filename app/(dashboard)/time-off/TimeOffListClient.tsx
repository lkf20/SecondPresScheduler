'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import CoverageStatusPill from '@/components/ui/coverage-status-pill'
import { parseLocalDate } from '@/lib/utils/date'
import { getClassroomPillStyle } from '@/lib/utils/classroom-style'

type ClassroomBadge = {
  id: string
  name: string
  color: string | null
}

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
  shifts_display: string
  shift_details?: string[]
  classrooms?: ClassroomBadge[]
}

export default function TimeOffListClient({
  view: initialView,
  draftRequests,
  upcomingRequests,
  pastRequests,
}: {
  view: string
  draftRequests: TimeOffRow[]
  upcomingRequests: TimeOffRow[]
  pastRequests: TimeOffRow[]
}) {
  const router = useRouter()
  const [view, setView] = useState(initialView ?? 'active')

  useEffect(() => {
    setView(initialView ?? 'active')
  }, [initialView])

  const updateView = (nextView: string) => {
    setView(nextView)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('view', nextView)
      window.history.replaceState({}, '', url)
    }
  }
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const formatDateRange = (start: string, end?: string | null) => {
    const startDate = parseLocalDate(start)
    const endDate = parseLocalDate(end || start)
    const shortDate = (date: Date) =>
      new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
    const weekday = (date: Date) =>
      new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date)
    const normalizeWeekday = (label: string) => (label === 'Tue' ? 'Tues' : label)
    const startLabel = shortDate(startDate)
    const endLabel = shortDate(endDate)
    const startDay = normalizeWeekday(weekday(startDate))
    const endDay = normalizeWeekday(weekday(endDate))

    if (startLabel === endLabel) {
      return `${startLabel} (${startDay})`
    }
    return `${startLabel} - ${endLabel} (${startDay} - ${endDay})`
  }

  const formatClassroomStyle = (color: string | null) => getClassroomPillStyle(color)

  const handleDeleteDraft = async (id: string) => {
    if (!confirm('Delete this draft?')) return
    try {
      const response = await fetch(`/api/time-off/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete draft.' }))
        throw new Error(errorData.error || 'Failed to delete draft.')
      }
      router.refresh()
    } catch (error) {
      console.error('Failed to delete draft:', error)
    }
  }
  const renderCoverageBadge = (row: TimeOffRow) => {
    return (
      <CoverageStatusPill
        status={row.coverage_status}
        coveredCount={row.coverage_covered}
        totalCount={row.coverage_total}
      />
    )
  }

  const renderActions = (row: TimeOffRow) => {
    if (row.status === 'draft') {
      return (
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/time-off/${row.id}`}>Edit</Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleDeleteDraft(row.id)}>
            Delete
          </Button>
        </div>
      )
    }

    if (row.coverage_status === 'needs_coverage' || row.coverage_status === 'partially_covered') {
      return (
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="ghost">
            <Link href={`/time-off/${row.id}`}>View</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="border-black text-slate-900 font-medium hover:bg-slate-50">
            <Link href={`/sub-finder?absence_id=${row.id}`}>Find Sub</Link>
          </Button>
        </div>
      )
    }

    return (
      <Button asChild size="sm" variant="ghost">
        <Link href={`/time-off/${row.id}`}>View</Link>
      </Button>
    )
  }

  const renderRowCard = (row: TimeOffRow) => (
    <div
      key={row.id}
      className="rounded-lg border border-slate-200 bg-white px-5 pt-2 pb-4 shadow-sm"
    >
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="grid gap-1">
          <div className="text-lg font-semibold text-slate-900">{row.teacher_name}</div>
          <div className="text-sm font-medium text-slate-700 pb-3">{formatDateRange(row.start_date, row.end_date)}</div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => {
                if (!row.shift_details || row.shift_details.length === 0) return
                const next = new Set(expandedIds)
                if (next.has(row.id)) {
                  next.delete(row.id)
                } else {
                  next.add(row.id)
                }
                setExpandedIds(next)
              }}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
              aria-expanded={expandedIds.has(row.id)}
              aria-label={expandedIds.has(row.id) ? 'Hide shift details' : 'Show shift details'}
            >
              {row.shifts_display}
              {row.shift_details && row.shift_details.length > 0 && (
                expandedIds.has(row.id) ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )
              )}
            </button>
            {row.classrooms && row.classrooms.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {row.classrooms.map((classroom) => (
                  <span
                    key={classroom.id}
                    className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium"
                    style={formatClassroomStyle(classroom.color)}
                  >
                    {classroom.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-rows-[auto_1fr] items-end justify-items-end">
          <div className="flex items-center gap-2 pt-1">
            {renderCoverageBadge(row)}
          </div>
          <div className="flex items-center gap-2">
            {renderActions(row)}
          </div>
        </div>
      </div>
      {expandedIds.has(row.id) && row.shift_details && row.shift_details.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-600">
          {row.shift_details.join(' • ')}
        </div>
      )}
    </div>
  )

  const renderSection = (rows: TimeOffRow[], emptyMessage: string) => {
    if (rows.length === 0) {
      return <div className="rounded-lg border border-slate-200 bg-white px-5 py-6 text-sm text-muted-foreground">{emptyMessage}</div>
    }
    return <div className="space-y-3">{rows.map(renderRowCard)}</div>
  }

  return (
    <>
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
                ? 'rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-xs font-medium text-white'
                : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-300'
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      {draftRequests.length > 0 && (view === 'drafts' || view === 'all') && (
        <details open={view === 'drafts'} className="mb-6 rounded-lg bg-gray-50 border border-gray-200 p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            Drafts ({draftRequests.length})
          </summary>
          <div className="mt-4">
            {renderSection(draftRequests, 'No drafts available.')}
          </div>
        </details>
      )}

      {(view === 'active' || view === 'all') && (
        <div className="space-y-3">
          {renderSection(upcomingRequests, 'No active time off requests found.')}
        </div>
      )}

      {pastRequests.length > 0 && (view === 'past' || view === 'active' || view === 'all') && (
        <details className="mt-6 rounded-lg bg-gray-50 border border-gray-200 p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-700 flex items-center justify-between">
            <span>Past Time Off (last 90 days)</span>
            <span className="text-muted-foreground">{pastRequests.length}</span>
          </summary>
          <div className="mt-4">
            {renderSection(pastRequests, 'No past time off requests in the last 90 days.')}
          </div>
        </details>
      )}
    </>
  )
}
