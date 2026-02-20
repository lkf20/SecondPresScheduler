'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ActivityRow = {
  id: string
  created_at: string
  action: string
  category: string
  entity_type: string
  entity_id: string | null
  details: Record<string, any> | null
  actor_user_id: string | null
  actor_display_name: string
}

type ActorOption = {
  id: string
  name: string
}

const CATEGORY_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'time_off', label: 'Time Off' },
  { key: 'sub_assignment', label: 'Sub Assignments' },
  { key: 'baseline_schedule', label: 'Baseline' },
  { key: 'flex_assignment', label: 'Flex' },
  { key: 'staff', label: 'Staff' },
  { key: 'coverage', label: 'Coverage' },
]

function toRelativeTime(dateString: string) {
  const now = Date.now()
  const target = new Date(dateString).getTime()
  const diff = Math.floor((now - target) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateString).toLocaleDateString()
}

function formatDescription(row: ActivityRow) {
  const details = row.details || {}

  if (row.category === 'time_off') {
    const teacherName = details.teacher_name ? ` for ${details.teacher_name}` : ''
    if (row.action === 'create') return `Created time off request${teacherName}`
    if (row.action === 'cancel') return `Cancelled time off request${teacherName}`
    if (row.action === 'status_change') {
      const before = details.before?.status ? `from ${details.before.status} ` : ''
      const after = details.after?.status ? `to ${details.after.status}` : ''
      return `Updated time off request${teacherName} ${before}${after}`.trim()
    }
    return `Updated time off request${teacherName}`.trim()
  }

  if (row.category === 'sub_assignment') {
    const count = Array.isArray(details.assignment_ids) ? details.assignment_ids.length : null
    return count ? `Assigned sub coverage (${count} shifts)` : 'Assigned sub coverage'
  }

  if (row.category === 'coverage') {
    return 'Updated coverage details'
  }

  return `${row.action.replace('_', ' ')} ${row.entity_type.replace('_', ' ')}`
}

function getEntityHref(row: ActivityRow) {
  if (row.entity_type === 'time_off_request' && row.entity_id) {
    return `/time-off?edit=${row.entity_id}`
  }
  if (row.entity_type === 'coverage_request' && row.entity_id) {
    return `/sub-finder?coverage_request_id=${row.entity_id}`
  }
  return null
}

export function ActivityFeed({ className }: { className?: string }) {
  const makeCacheKey = (category: string, actorId: string) => `${category}::${actorId || 'all'}`
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [actors, setActors] = useState<ActorOption[]>([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedActor, setSelectedActor] = useState('')
  const [cursor, setCursor] = useState<string | null>(null)
  const [queryCache, setQueryCache] = useState<
    Record<string, { rows: ActivityRow[]; actors: ActorOption[]; cursor: string | null }>
  >({})
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const canLoadMore = Boolean(cursor) && !isLoadingMore

  const fetchRows = useCallback(
    async (append: boolean) => {
      const params = new URLSearchParams()
      params.set('limit', '25')
      if (selectedCategory !== 'all') params.set('category', selectedCategory)
      if (selectedActor) params.set('actor_user_id', selectedActor)
      if (append && cursor) params.set('cursor', cursor)

      const response = await fetch(`/api/activity?${params.toString()}`)
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        const detailText =
          payload?.details?.message || payload?.details?.hint || payload?.details?.code || null
        const message =
          payload?.error ||
          (response.status === 403
            ? 'You do not have access to Activity Log for this school.'
            : `Failed to fetch activity (${response.status})`)
        throw new Error(detailText ? `${message} (${detailText})` : message)
      }

      const payload = await response.json()
      const nextRows = (payload.rows || []) as ActivityRow[]
      const nextActors = (payload.actors || []) as ActorOption[]
      const nextCursor = (payload.nextCursor || null) as string | null

      return { nextRows, nextActors, nextCursor }
    },
    [cursor, selectedActor, selectedCategory]
  )

  useEffect(() => {
    let isActive = true
    const cacheKey = makeCacheKey(selectedCategory, selectedActor)
    const cached = queryCache[cacheKey]

    if (cached) {
      setRows(cached.rows)
      setActors(cached.actors)
      setCursor(cached.cursor)
      setErrorMessage(null)
      setIsInitialLoading(false)
      return () => {
        isActive = false
      }
    }

    setIsInitialLoading(true)

    fetchRows(false)
      .then(({ nextRows, nextActors, nextCursor }) => {
        if (!isActive) return
        setRows(nextRows)
        setActors(nextActors)
        setCursor(nextCursor)
        setErrorMessage(null)
        setQueryCache(current => ({
          ...current,
          [cacheKey]: {
            rows: nextRows,
            actors: nextActors,
            cursor: nextCursor,
          },
        }))
      })
      .catch(error => {
        console.error('[activity-ui] failed to load feed', error)
        if (isActive) {
          setRows([])
          setActors([])
          setErrorMessage(error instanceof Error ? error.message : 'Failed to fetch activity')
        }
      })
      .finally(() => {
        if (isActive) setIsInitialLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [selectedCategory, selectedActor, fetchRows, queryCache])

  const emptyStateLabel = useMemo(() => {
    if (selectedCategory !== 'all' || selectedActor) {
      return 'No activity matches the current filters.'
    }
    return 'No activity yet.'
  }, [selectedActor, selectedCategory])

  return (
    <div className={cn('flex h-full flex-col space-y-3', className)}>
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {CATEGORY_OPTIONS.map(option => (
            <button
              key={option.key}
              type="button"
              onClick={() => setSelectedCategory(option.key)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                selectedCategory === option.key
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="activity-actor-filter" className="text-xs font-medium text-slate-600">
            Actor
          </label>
          <select
            id="activity-actor-filter"
            value={selectedActor}
            onChange={event => setSelectedActor(event.target.value)}
            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800"
          >
            <option value="">All actors</option>
            {actors.map(actor => (
              <option key={actor.id} value={actor.id}>
                {actor.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {isInitialLoading ? (
          <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
            Loading activity...
          </div>
        ) : errorMessage ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-4 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
            {emptyStateLabel}
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map(row => {
              const exactTime = new Date(row.created_at).toLocaleString()
              const viewHref = getEntityHref(row)
              return (
                <article key={row.id} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-slate-900">
                      {row.actor_display_name}
                    </div>
                    <time
                      dateTime={row.created_at}
                      title={exactTime}
                      className="text-xs text-slate-500"
                    >
                      {toRelativeTime(row.created_at)}
                    </time>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{formatDescription(row)}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 uppercase">
                      {row.category}
                    </span>
                    {viewHref ? (
                      <Link href={viewHref} className="ml-auto text-slate-700 underline">
                        View
                      </Link>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <Button
          variant="outline"
          size="sm"
          disabled={!canLoadMore}
          onClick={async () => {
            if (!cursor || isLoadingMore) return
            setIsLoadingMore(true)
            try {
              const { nextRows, nextActors, nextCursor } = await fetchRows(true)
              const mergedRows = [...rows, ...nextRows]
              setRows(mergedRows)
              setActors(nextActors)
              setCursor(nextCursor)
              const cacheKey = makeCacheKey(selectedCategory, selectedActor)
              setQueryCache(current => ({
                ...current,
                [cacheKey]: {
                  rows: mergedRows,
                  actors: nextActors,
                  cursor: nextCursor,
                },
              }))
            } catch (error) {
              console.error('[activity-ui] failed to load more', error)
            } finally {
              setIsLoadingMore(false)
            }
          }}
          className="w-full"
        >
          {isLoadingMore ? 'Loading...' : cursor ? 'Load More' : 'No More Activity'}
        </Button>
      </div>
    </div>
  )
}
