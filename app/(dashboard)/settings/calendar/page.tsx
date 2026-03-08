'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import ErrorMessage from '@/components/shared/ErrorMessage'
import DatePickerInput from '@/components/ui/date-picker-input'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { toast } from 'sonner'
import type { Database } from '@/types/database'

type TimeSlot = Database['public']['Tables']['time_slots']['Row']

interface SchoolClosure {
  id: string
  date: string
  time_slot_id: string | null
  reason: string | null
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
  const [data, setData] = useState<CalendarData | null>(null)
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [addPanelOpen, setAddPanelOpen] = useState(false)
  const [addMode, setAddMode] = useState<'single' | 'range'>('single')
  const [addDate, setAddDate] = useState('')
  const [addStartDate, setAddStartDate] = useState('')
  const [addEndDate, setAddEndDate] = useState('')
  const [addReason, setAddReason] = useState('')
  const [addAppliesTo, setAddAppliesTo] = useState<'all' | 'specific'>('all')
  const [addTimeSlotIds, setAddTimeSlotIds] = useState<string[]>([])
  const [addStartPickerOpen, setAddStartPickerOpen] = useState(false)
  const [addEndPickerOpen, setAddEndPickerOpen] = useState(false)
  const addEndDateRef = useRef<HTMLButtonElement>(null)
  const [addSaving, setAddSaving] = useState(false)
  const [savedSchoolYear, setSavedSchoolYear] = useState<{
    first_day_of_school: string | null
    last_day_of_school: string | null
  } | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [editPanelOpen, setEditPanelOpen] = useState(false)
  const [editDate, setEditDate] = useState('')
  const [editClosureIds, setEditClosureIds] = useState<string[]>([])
  const [editTimeSlotIds, setEditTimeSlotIds] = useState<string[]>([])
  const [editReason, setEditReason] = useState('')
  const [editAppliesTo, setEditAppliesTo] = useState<'all' | 'specific'>('all')
  const [editSaving, setEditSaving] = useState(false)
  const [deleteDialogGroup, setDeleteDialogGroup] = useState<{
    date: string
    reason: string | null
    hasAllSlots: boolean
    slotCodes: string[]
    closureIds: string[]
  } | null>(null)
  const [deleteDeleting, setDeleteDeleting] = useState(false)

  const hasUnsavedSchoolYearChanges =
    data &&
    savedSchoolYear &&
    ((data.first_day_of_school ?? '') !== (savedSchoolYear.first_day_of_school ?? '') ||
      (data.last_day_of_school ?? '') !== (savedSchoolYear.last_day_of_school ?? ''))

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      setLoading(true)
      const today = new Date().toISOString().slice(0, 10)
      const oneYearLater = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)
      const res = await fetch(`/api/settings/calendar?startDate=${today}&endDate=${oneYearLater}`)
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

  const handleAddClosure = async () => {
    if (addMode === 'range') {
      if (!addStartDate || !addEndDate) {
        toast.error('Please select both start and end dates.')
        return
      }
      if (addStartDate > addEndDate) {
        toast.error('Start date must be on or before end date.')
        return
      }
    } else {
      if (!addDate) {
        toast.error('Please select a date.')
        return
      }
    }
    setAddSaving(true)
    try {
      if (addMode === 'range') {
        const res = await fetch('/api/settings/calendar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            add_closure: {
              start_date: addStartDate,
              end_date: addEndDate,
              reason: addReason.trim() || null,
            },
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to add closure')
        }
        toast.success('Closures added.')
        setAddPanelOpen(false)
        setAddStartDate('')
        setAddEndDate('')
        setAddReason('')
        await fetchData()
      } else if (addAppliesTo === 'all') {
        const res = await fetch('/api/settings/calendar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            add_closure: {
              date: addDate,
              time_slot_id: null,
              reason: addReason.trim() || null,
            },
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to add closure')
        }
        toast.success('Closure added.')
        setAddPanelOpen(false)
        setAddDate('')
        setAddReason('')
        setAddAppliesTo('all')
        setAddTimeSlotIds([])
        await fetchData()
      } else {
        if (addTimeSlotIds.length === 0) {
          toast.error('Please select at least one time slot.')
          setAddSaving(false)
          return
        }
        for (const timeSlotId of addTimeSlotIds) {
          const res = await fetch('/api/settings/calendar', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              add_closure: {
                date: addDate,
                time_slot_id: timeSlotId,
                reason: addReason.trim() || null,
              },
            }),
          })
          if (!res.ok) {
            const err = await res.json()
            throw new Error(err.error || 'Failed to add closure')
          }
        }
        toast.success('Closure added.')
        setAddPanelOpen(false)
        setAddDate('')
        setAddReason('')
        setAddAppliesTo('all')
        setAddTimeSlotIds([])
        await fetchData()
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add closure')
    } finally {
      setAddSaving(false)
    }
  }

  const sortedTimeSlots = [...timeSlots].sort(
    (a, b) => (a.display_order ?? 999) - (b.display_order ?? 999)
  )
  const activeTimeSlots = sortedTimeSlots.filter(ts => ts.is_active !== false)

  const groupedClosures = (() => {
    if (!data?.school_closures?.length) return []
    const byDate = new Map<string, SchoolClosure[]>()
    for (const c of data.school_closures) {
      const list = byDate.get(c.date) ?? []
      list.push(c)
      byDate.set(c.date, list)
    }
    return Array.from(byDate.entries()).map(([date, closures]) => {
      const hasAllSlots = closures.some(c => !c.time_slot_id) || closures.length === 0
      const slotCodes = hasAllSlots
        ? []
        : [
            ...new Set(
              closures
                .map(c => {
                  const ts = c.time_slot_id
                    ? timeSlots.find(t => t.id === c.time_slot_id)
                    : undefined
                  return ts?.code ?? (c.time_slot_id ? '?' : null)
                })
                .filter((c): c is string => c != null)
            ),
          ].sort()
      return {
        date,
        closures,
        hasAllSlots,
        slotCodes,
        reason: closures[0]?.reason ?? null,
      }
    })
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
      await fetchData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeleteDeleting(false)
    }
  }

  const handleOpenEdit = (group: (typeof groupedClosures)[number]) => {
    const hasAll = group.closures.some(c => !c.time_slot_id)
    const slotIds = hasAll
      ? []
      : group.closures.map(c => c.time_slot_id).filter((id): id is string => id != null)
    setEditDate(group.date)
    setEditClosureIds(group.closures.map(c => c.id))
    setEditAppliesTo(hasAll ? 'all' : 'specific')
    setEditTimeSlotIds(slotIds)
    setEditReason(group.reason ?? '')
    setEditPanelOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editDate) return
    if (editAppliesTo === 'specific' && editTimeSlotIds.length === 0) {
      toast.error('Please select at least one time slot.')
      return
    }
    setEditSaving(true)
    try {
      const res = await fetch('/api/settings/calendar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delete_closure_ids: editClosureIds }),
      })
      if (!res.ok) throw new Error('Failed to update')
      if (editAppliesTo === 'all') {
        const addRes = await fetch('/api/settings/calendar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            add_closure: {
              date: editDate,
              time_slot_id: null,
              reason: editReason.trim() || null,
            },
          }),
        })
        if (!addRes.ok) throw new Error('Failed to update')
      } else {
        for (const timeSlotId of editTimeSlotIds) {
          const addRes = await fetch('/api/settings/calendar', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              add_closure: {
                date: editDate,
                time_slot_id: timeSlotId,
                reason: editReason.trim() || null,
              },
            }),
          })
          if (!addRes.ok) throw new Error('Failed to update')
        }
      }
      toast.success('Closure updated.')
      setEditPanelOpen(false)
      await fetchData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setEditSaving(false)
    }
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
      <div className="mb-8 max-w-3xl rounded-lg border bg-white p-6">
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

      {/* Closures */}
      <div className="max-w-3xl rounded-lg border bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Closed Days</h2>
          <Button onClick={() => setAddPanelOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Closure
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Days or time slots when school is closed. These will appear as &quot;School Closed&quot;
          on the weekly schedule.
        </p>
        {!data?.school_closures?.length ? (
          <p className="text-muted-foreground">No closures scheduled.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Date</th>
                  <th className="text-left py-2 font-medium">Applies to</th>
                  <th className="text-left py-2 font-medium">Reason</th>
                  <th className="text-left py-2 font-medium w-20" />
                </tr>
              </thead>
              <tbody>
                {groupedClosures.map(group => (
                  <tr key={group.date} className="border-b last:border-0">
                    <td className="py-2">{formatDate(group.date)}</td>
                    <td className="py-2">
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
                    <td className="py-2 text-muted-foreground">{group.reason || '—'}</td>
                    <td className="py-2">
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

      {/* Add Closure Panel */}
      <Sheet
        open={addPanelOpen}
        onOpenChange={open => {
          setAddPanelOpen(open)
          if (!open) {
            setAddStartPickerOpen(false)
            setAddEndPickerOpen(false)
            setAddMode('single')
            setAddDate('')
            setAddStartDate('')
            setAddEndDate('')
            setAddReason('')
            setAddAppliesTo('all')
            setAddTimeSlotIds([])
          }
        }}
      >
        <SheetContent
          className="w-full overflow-y-auto bg-gray-50 p-0"
          style={{ maxWidth: '34rem' }}
        >
          <SheetHeader className="px-6 pt-6 pb-4">
            <SheetTitle>Add Closure</SheetTitle>
            <SheetDescription>
              Add a day or time slot closure to the school calendar
            </SheetDescription>
          </SheetHeader>
          <div className="px-6 pb-6 space-y-6">
            <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-4">
              <Label className="text-base font-medium">Add</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="add-mode"
                    checked={addMode === 'single'}
                    onChange={() => setAddMode('single')}
                    className="h-4 w-4 rounded-full accent-teal-600"
                  />
                  <span>Single day</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="add-mode"
                    checked={addMode === 'range'}
                    onChange={() => setAddMode('range')}
                    className="h-4 w-4 rounded-full accent-teal-600"
                  />
                  <span>Date range</span>
                </label>
              </div>
            </div>

            {addMode === 'range' ? (
              <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-4">
                <div>
                  <Label htmlFor="add-start-date">Start date</Label>
                  <DatePickerInput
                    id="add-start-date"
                    value={addStartDate}
                    onChange={v => {
                      setAddStartDate(v)
                      setAddStartPickerOpen(false)
                      setTimeout(() => {
                        setAddEndPickerOpen(true)
                        addEndDateRef.current?.click()
                      }, 300)
                    }}
                    placeholder="Select start date"
                    closeOnSelect
                    open={addStartPickerOpen}
                    onOpenChange={setAddStartPickerOpen}
                  />
                </div>
                <div>
                  <Label htmlFor="add-end-date">End date</Label>
                  <DatePickerInput
                    ref={addEndDateRef}
                    id="add-end-date"
                    value={addEndDate}
                    onChange={setAddEndDate}
                    placeholder="Select end date"
                    closeOnSelect
                    open={addEndPickerOpen}
                    onOpenChange={setAddEndPickerOpen}
                    openToDate={addStartDate || undefined}
                  />
                </div>
                {addStartDate && addEndDate && addStartDate <= addEndDate && (
                  <p className="text-sm text-muted-foreground">
                    This will add whole-day closures for all{' '}
                    {Math.ceil(
                      (new Date(addEndDate + 'T12:00:00').getTime() -
                        new Date(addStartDate + 'T12:00:00').getTime()) /
                        (24 * 60 * 60 * 1000)
                    ) + 1}{' '}
                    days. All time slots will be closed for each day.
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-4">
                  <div>
                    <Label htmlFor="add-date">Date</Label>
                    <DatePickerInput
                      id="add-date"
                      value={addDate}
                      onChange={setAddDate}
                      placeholder="Select date"
                      closeOnSelect
                    />
                  </div>
                  <div>
                    <Label className="mb-2 block">Applies to</Label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="applies-to"
                          checked={addAppliesTo === 'all'}
                          onChange={() => setAddAppliesTo('all')}
                          className="h-4 w-4 rounded-full accent-teal-600"
                        />
                        <span>All time slots (whole day closed)</span>
                      </label>
                      <label
                        className={`flex items-center gap-2 ${activeTimeSlots.length === 0 ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                      >
                        <input
                          type="radio"
                          name="applies-to"
                          checked={addAppliesTo === 'specific'}
                          onChange={() => activeTimeSlots.length > 0 && setAddAppliesTo('specific')}
                          disabled={activeTimeSlots.length === 0}
                          className="h-4 w-4 rounded-full accent-teal-600"
                        />
                        <span>Specific time slots</span>
                      </label>
                    </div>
                  </div>
                </div>
                {addAppliesTo === 'specific' && (
                  <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-3">
                    <Label className="text-base font-medium">Select time slots to close</Label>
                    {activeTimeSlots.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No time slots configured.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {activeTimeSlots.map(ts => (
                          <label
                            key={ts.id}
                            className="flex items-center space-x-2 cursor-pointer rounded px-1 py-0.5 -mx-1 -my-0.5 hover:bg-slate-50"
                          >
                            <Checkbox
                              id={`closure-slot-${ts.id}`}
                              checked={addTimeSlotIds.includes(ts.id)}
                              onCheckedChange={checked =>
                                setAddTimeSlotIds(prev =>
                                  checked === true
                                    ? [...prev, ts.id]
                                    : prev.filter(x => x !== ts.id)
                                )
                              }
                              className="data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600 shrink-0"
                            />
                            <span className="text-sm font-normal">
                              {ts.code && ts.name ? `${ts.code} (${ts.name})` : ts.name || ts.code}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="rounded-lg bg-white border border-gray-200 p-6">
              <Label htmlFor="add-reason">Reason</Label>
              <Input
                id="add-reason"
                value={addReason}
                onChange={e => setAddReason(e.target.value)}
                placeholder="e.g. Holiday, Snow Day"
                className="mt-2"
              />
            </div>

            <SheetFooter className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setAddPanelOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddClosure} disabled={addSaving}>
                {addSaving ? 'Adding...' : 'Add'}
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Closure Panel */}
      <Sheet open={editPanelOpen} onOpenChange={setEditPanelOpen}>
        <SheetContent
          className="w-full overflow-y-auto bg-gray-50 p-0"
          style={{ maxWidth: '34rem' }}
        >
          <SheetHeader className="px-6 pt-6 pb-4">
            <SheetTitle>Edit Closure</SheetTitle>
            <SheetDescription>
              Update the closure for {editDate ? formatDate(editDate) : 'this date'}
            </SheetDescription>
          </SheetHeader>
          <div className="px-6 pb-6 space-y-6">
            <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-4">
              <Label className="text-base font-medium">Date</Label>
              <p className="text-sm text-muted-foreground">
                {editDate ? formatDate(editDate) : '—'}
              </p>
            </div>

            <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-4">
              <Label className="mb-2 block">Applies to</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="edit-applies-to"
                    checked={editAppliesTo === 'all'}
                    onChange={() => setEditAppliesTo('all')}
                    className="h-4 w-4 rounded-full accent-teal-600"
                  />
                  <span>All time slots (whole day closed)</span>
                </label>
                <label
                  className={`flex items-center gap-2 ${activeTimeSlots.length === 0 ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                >
                  <input
                    type="radio"
                    name="edit-applies-to"
                    checked={editAppliesTo === 'specific'}
                    onChange={() => activeTimeSlots.length > 0 && setEditAppliesTo('specific')}
                    disabled={activeTimeSlots.length === 0}
                    className="h-4 w-4 rounded-full accent-teal-600"
                  />
                  <span>Specific time slots</span>
                </label>
              </div>
            </div>

            {editAppliesTo === 'specific' && (
              <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-3">
                <Label className="text-base font-medium">Select time slots to close</Label>
                {activeTimeSlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No time slots configured.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {activeTimeSlots.map(ts => (
                      <label
                        key={ts.id}
                        className="flex items-center space-x-2 cursor-pointer rounded px-1 py-0.5 -mx-1 -my-0.5 hover:bg-slate-50"
                      >
                        <Checkbox
                          id={`edit-closure-slot-${ts.id}`}
                          checked={editTimeSlotIds.includes(ts.id)}
                          onCheckedChange={checked =>
                            setEditTimeSlotIds(prev =>
                              checked === true ? [...prev, ts.id] : prev.filter(x => x !== ts.id)
                            )
                          }
                          className="data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600 shrink-0"
                        />
                        <span className="text-sm font-normal">
                          {ts.code && ts.name ? `${ts.code} (${ts.name})` : ts.name || ts.code}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg bg-white border border-gray-200 p-6">
              <Label htmlFor="edit-reason">Reason</Label>
              <Input
                id="edit-reason"
                value={editReason}
                onChange={e => setEditReason(e.target.value)}
                placeholder="e.g. Holiday, Snow Day"
                className="mt-2"
              />
            </div>

            <SheetFooter className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditPanelOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={editSaving}>
                {editSaving ? 'Saving...' : 'Save'}
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

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
