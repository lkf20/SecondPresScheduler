'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import TimeOffCard from '@/components/shared/TimeOffCard'
import type { ClassroomBadge } from '@/components/shared/TimeOffCard'

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
            <Button asChild size="sm" variant="outline">
              <Link href={`/time-off/${row.id}`}>Edit</Link>
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
      />
    )
  }

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
