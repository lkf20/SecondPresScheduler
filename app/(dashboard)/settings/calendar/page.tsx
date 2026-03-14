'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import ErrorMessage from '@/components/shared/ErrorMessage'
import DatePickerInput from '@/components/ui/date-picker-input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { Database } from '@/types/database'
import { useSchool } from '@/lib/contexts/SchoolContext'
import { clearDataHealthCache } from '@/lib/dashboard/data-health-cache'
import { invalidateDashboard, invalidateWeeklySchedule } from '@/lib/utils/invalidation'
import ClosurePanel, { type ClosureEditGroup } from './closure-panel'

type TimeSlot = Database['public']['Tables']['time_slots']['Row']

interface SchoolClosure {
  id: string
  date: string
  time_slot_id: string | null
  reason: string | null
  notes?: string | null
}

interface CalendarData {
  first_day_of_school: string | null
  last_day_of_school: string | null
  school_closures: SchoolClosure[]
}

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso + 'T12:00:00'))

export default function SchoolCalendarPage() {
  const queryClient = useQueryClient()
  const schoolId = useSchool()
  const [data, setData] = useState<CalendarData | null>(null)
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [closurePanel, setClosurePanel] = useState<{
    open: boolean
    mode: 'add' | 'edit'
    editGroup: ClosureEditGroup | null
  }>({ open: false, mode: 'add', editGroup: null })
  const [savedSchoolYear, setSavedSchoolYear] = useState<{
    first_day_of_school: string | null
    last_day_of_school: string | null
  } | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [deleteDialogGroup, setDeleteDialogGroup] = useState<{
    date: string
    reason: string | null
    hasAllSlots: boolean
    slotCodes: string[]
    closureIds: string[]
  } | null>(null)
  const [deleteDeleting, setDeleteDeleting] = useState(false)
  const [closureScope, setClosureScope] = useState<'school_year' | 'all'>('school_year')
  const [includePastDates, setIncludePastDates] = useState(true)

  const hasUnsavedSchoolYearChanges =
    data &&
    savedSchoolYear &&
    ((data.first_day_of_school ?? '') !== (savedSchoolYear.first_day_of_school ?? '') ||
      (data.last_day_of_school ?? '') !== (savedSchoolYear.last_day_of_school ?? ''))

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      setLoading(true)
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const oneYearLater = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)
      const res = await fetch(
        `/api/settings/calendar?startDate=${oneYearAgo}&endDate=${oneYearLater}`
      )
      if (!res.ok) throw new Error('Failed to load calendar settings')
      const json = await res.json()
      const loaded = {
        first_day_of_school: json.first_day_of_school ?? null,
        last_day_of_school: json.last_day_of_school ?? null,
        school_closures: json.school_closures ?? [],
      }
      setData(loaded)
      setSavedSchoolYear({
        first_day_of_school: loaded.first_day_of_school,
        last_day_of_school: loaded.last_day_of_school,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar settings')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchTimeSlots = useCallback(async () => {
    try {
      const res = await fetch('/api/timeslots?includeInactive=true')
      if (!res.ok) return
      const slots = await res.json()
      const valid = Array.isArray(slots)
        ? slots.filter(
            (s: unknown): s is TimeSlot =>
              s != null && typeof s === 'object' && 'id' in s && 'code' in s
          )
        : []
      setTimeSlots(valid)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchData()
    fetchTimeSlots()
  }, [fetchData, fetchTimeSlots])

  const handleSaveSchoolYear = async () => {
    if (!data) return
    setSaving(true)
    try {
      const res = await fetch('/api/settings/calendar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_day_of_school: data.first_day_of_school || null,
          last_day_of_school: data.last_day_of_school || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save')
      }
      toast.success('School year updated.')
      setSavedSchoolYear({
        first_day_of_school: data.first_day_of_school || null,
        last_day_of_school: data.last_day_of_school || null,
      })
      setLastSavedAt(new Date())
      await fetchData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const sortedTimeSlots = [...timeSlots].sort(
    (a, b) => (a.display_order ?? 999) - (b.display_order ?? 999)
  )
  const activeTimeSlots = sortedTimeSlots.filter(ts => ts.is_active !== false)

  const todayISO = new Date().toISOString().slice(0, 10)
  const filteredClosures = (() => {
    const list = data?.school_closures ?? []
    if (!list.length) return []
    const firstDay = data?.first_day_of_school ?? null
    const lastDay = data?.last_day_of_school ?? null
    let scopeFiltered = list
    if (closureScope === 'school_year' && firstDay && lastDay) {
      scopeFiltered = list.filter(c => c.date >= firstDay && c.date <= lastDay)
    }
    if (!includePastDates) {
      scopeFiltered = scopeFiltered.filter(c => c.date >= todayISO)
    }
    return scopeFiltered
  })()

  const groupedClosures = (() => {
    if (!filteredClosures.length) return []
    const byDate = new Map<string, SchoolClosure[]>()
    for (const c of filteredClosures) {
      const list = byDate.get(c.date) ?? []
      list.push(c)
      byDate.set(c.date, list)
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, closures]) => {
        const hasAllSlots = closures.some(c => !c.time_slot_id) || closures.length === 0
        const closureSlotIds = new Set(
          closures.map(c => c.time_slot_id).filter((id): id is string => id != null)
        )
        const slotCodes = hasAllSlots
          ? []
          : sortedTimeSlots.filter(ts => closureSlotIds.has(ts.id)).map(ts => ts.code ?? '?')
        return {
          date,
          closures,
          hasAllSlots,
          slotCodes,
          reason: closures[0]?.reason ?? null,
          notes: closures[0]?.notes ?? null,
        }
      })
  })()

  /** All closures by date (from full list), for add-panel "replace existing?" check regardless of view filters */
  const existingClosuresByDate = (() => {
    const list = data?.school_closures ?? []
    if (!list.length) return {} as Record<string, { closureIds: string[]; slotCodes: string[] }>
    const byDate = new Map<string, SchoolClosure[]>()
    for (const c of list) {
      const arr = byDate.get(c.date) ?? []
      arr.push(c)
      byDate.set(c.date, arr)
    }
    return Object.fromEntries(
      Array.from(byDate.entries()).map(([date, closures]) => {
        const closureSlotIds = new Set(
          closures.map(c => c.time_slot_id).filter((id): id is string => id != null)
        )
        const slotCodes = sortedTimeSlots
          .filter(ts => closureSlotIds.has(ts.id))
          .map(ts => ts.code ?? '?')
        return [
          date,
          {
            closureIds: closures.map(c => c.id),
            slotCodes,
          },
        ]
      })
    )
  })()

  const handleDeleteClosures = async (ids: string[]) => {
    if (ids.length === 0) return
    setDeleteDeleting(true)
    try {
      const res = await fetch('/api/settings/calendar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delete_closure_ids: ids }),
      })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success(ids.length > 1 ? 'Closures removed.' : 'Closure removed.')
      setDeleteDialogGroup(null)
      clearDataHealthCache()
      await Promise.all([
        invalidateDashboard(queryClient, schoolId),
        invalidateWeeklySchedule(queryClient, schoolId),
      ])
      await fetchData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeleteDeleting(false)
    }
  }

  const handleOpenEdit = (group: (typeof groupedClosures)[number]) => {
    setClosurePanel({
      open: true,
      mode: 'edit',
      editGroup: {
        date: group.date,
        closures: group.closures.map(c => ({ id: c.id, time_slot_id: c.time_slot_id })),
        reason: group.reason,
        notes: group.notes ?? null,
      },
    })
  }

  if (loading) {
    return (
      <div>
        <div className="mb-4">
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Link>
        </div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
      </div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">School Calendar</h1>
        <p className="text-muted-foreground mt-2">
          Set first and last day of school and manage closed days (holidays, snow days)
        </p>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      {/* School Year */}
      <div className="mb-8 max-w-5xl rounded-lg border bg-white p-6">
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">School Year</h2>
            {hasUnsavedSchoolYearChanges && (
              <>
                <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Unsaved changes
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-teal-700 hover:bg-transparent hover:text-teal-800"
                  onClick={handleSaveSchoolYear}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </>
            )}
          </div>
          {lastSavedAt && !hasUnsavedSchoolYearChanges && (
            <p className="mt-1 text-sm text-muted-foreground">
              Last saved{' '}
              {new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              }).format(lastSavedAt)}
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
          <div>
            <Label htmlFor="first-day">First day of school</Label>
            <DatePickerInput
              id="first-day"
              value={data?.first_day_of_school ?? ''}
              onChange={v =>
                setData(prev => (prev ? { ...prev, first_day_of_school: v || null } : null))
              }
              placeholder="Select date"
            />
          </div>
          <div>
            <Label htmlFor="last-day">Last day of school</Label>
            <DatePickerInput
              id="last-day"
              value={data?.last_day_of_school ?? ''}
              onChange={v =>
                setData(prev => (prev ? { ...prev, last_day_of_school: v || null } : null))
              }
              placeholder="Select date"
            />
          </div>
        </div>
        {(!hasUnsavedSchoolYearChanges || saving) && (
          <Button className="mt-4" onClick={handleSaveSchoolYear} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        )}
      </div>

      {/* Closed Days */}
      <div className="max-w-5xl rounded-lg border bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Closed Days</h2>
          <Button onClick={() => setClosurePanel({ open: true, mode: 'add', editGroup: null })}>
            <Plus className="h-4 w-4 mr-2" />
            Add Closure
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Days or time slots when school is closed. These will appear as &quot;School Closed&quot;
          on the weekly schedule.
        </p>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="text-sm font-medium text-slate-700">Show:</span>
          <div
            className="inline-flex items-center rounded-full border p-1"
            style={{
              borderColor: '#e2e8f0',
              backgroundColor: '#ffffff',
            }}
            role="group"
            aria-label="Show scope"
          >
            <button
              type="button"
              onClick={() => setClosureScope('school_year')}
              className={
                closureScope === 'school_year'
                  ? 'rounded-full py-1.5 px-4 text-sm font-medium bg-[#172554] text-white transition-[color,background-color] duration-150'
                  : 'rounded-full py-1.5 px-4 text-sm font-medium bg-transparent text-[#475569] hover:bg-slate-100/80 transition-[color,background-color] duration-150'
              }
            >
              This school year
            </button>
            <button
              type="button"
              onClick={() => setClosureScope('all')}
              className={
                closureScope === 'all'
                  ? 'rounded-full py-1.5 px-4 text-sm font-medium bg-[#172554] text-white transition-[color,background-color] duration-150'
                  : 'rounded-full py-1.5 px-4 text-sm font-medium bg-transparent text-[#475569] hover:bg-slate-100/80 transition-[color,background-color] duration-150'
              }
            >
              All
            </button>
          </div>
          {closureScope === 'school_year' &&
            (!data?.first_day_of_school || !data?.last_day_of_school) && (
              <span className="text-sm text-amber-700">
                Set school year above to filter by school year.
              </span>
            )}
          <div className="flex items-center gap-2 ml-2 sm:ml-0">
            <Checkbox
              id="include-past-dates"
              checked={includePastDates}
              onCheckedChange={checked => setIncludePastDates(checked === true)}
            />
            <Label htmlFor="include-past-dates" className="text-sm font-normal cursor-pointer">
              Include past dates
            </Label>
          </div>
        </div>

        {!data?.school_closures?.length ? (
          <p className="text-muted-foreground">No closures scheduled.</p>
        ) : !groupedClosures.length ? (
          <p className="text-muted-foreground">
            No closures match the current filters. Try &quot;All&quot; or turn on &quot;Include past
            dates&quot;.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse table-fixed" style={{ minWidth: 768 }}>
              <colgroup>
                <col style={{ width: 140 }} />
                <col style={{ width: 190 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 210 }} />
                <col style={{ width: 88 }} />
              </colgroup>
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">Date</th>
                  <th className="text-left py-2 px-3 font-medium">Applies to</th>
                  <th className="text-left py-2 px-3 font-medium">Reason</th>
                  <th className="text-left py-2 px-3 font-medium">Notes</th>
                  <th className="text-left py-2 pl-3 pr-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {groupedClosures.map(group => (
                  <tr key={group.date} className="border-b last:border-0">
                    <td className="py-2 px-3 align-middle">{formatDate(group.date)}</td>
                    <td className="py-2 px-3 align-middle overflow-hidden">
                      <div className="flex flex-wrap gap-1.5">
                        {group.hasAllSlots ? (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                            All time slots
                          </span>
                        ) : (
                          group.slotCodes.map(code => (
                            <span
                              key={code}
                              className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600"
                            >
                              {code}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 align-middle text-muted-foreground overflow-hidden">
                      <span className="block truncate" title={group.reason ?? undefined}>
                        {group.reason || '—'}
                      </span>
                    </td>
                    <td className="py-2 px-3 align-middle text-muted-foreground overflow-hidden">
                      {group.notes ? (
                        <span className="break-words block line-clamp-2" title={group.notes}>
                          {group.notes}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2 pl-3 pr-2 align-middle">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-600 hover:text-slate-800 hover:bg-slate-100"
                          onClick={() => handleOpenEdit(group)}
                          aria-label="Edit closure"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() =>
                            setDeleteDialogGroup({
                              date: group.date,
                              reason: group.reason,
                              hasAllSlots: group.hasAllSlots,
                              slotCodes: group.slotCodes,
                              closureIds: group.closures.map(c => c.id),
                            })
                          }
                          aria-label="Remove closure"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ClosurePanel
        open={closurePanel.open}
        onOpenChange={open =>
          setClosurePanel(prev => ({
            ...prev,
            open,
            editGroup: open ? prev.editGroup : null,
          }))
        }
        onSuccess={() => {
          clearDataHealthCache()
          Promise.all([
            invalidateDashboard(queryClient, schoolId),
            invalidateWeeklySchedule(queryClient, schoolId),
          ]).then(() => fetchData())
        }}
        mode={closurePanel.mode}
        editGroup={closurePanel.editGroup}
        activeTimeSlots={activeTimeSlots}
        formatDate={formatDate}
        existingClosuresByDate={existingClosuresByDate}
      />

      {/* Delete Closure Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteDialogGroup)}
        onOpenChange={open => {
          if (!open && !deleteDeleting) setDeleteDialogGroup(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove closure?</DialogTitle>
            <DialogDescription>
              {deleteDialogGroup && (
                <>
                  Remove closure for{' '}
                  <span className="font-medium underline">
                    {formatDate(deleteDialogGroup.date)}
                  </span>
                  {deleteDialogGroup.reason && <> ({deleteDialogGroup.reason})</>}?{' '}
                  {deleteDialogGroup.hasAllSlots
                    ? 'All time slots will be reopened for this day.'
                    : `Time slots ${deleteDialogGroup.slotCodes.join(', ')} will be reopened.`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogGroup(null)}
              disabled={deleteDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() =>
                deleteDialogGroup && handleDeleteClosures(deleteDialogGroup.closureIds)
              }
              disabled={deleteDeleting}
            >
              {deleteDeleting ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
