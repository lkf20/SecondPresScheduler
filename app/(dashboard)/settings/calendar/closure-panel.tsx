'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import DatePickerInput from '@/components/ui/date-picker-input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  ClosureReasonNotesFields,
  ClosureAppliesToRadios,
  ClosureTimeSlotCheckboxes,
} from './closure-form-fields'
import { buildEditClosurePayload } from '@/lib/settings/build-edit-closure-payload'

/** Group of closures on one date (from calendar page groupedClosures). Used to open panel in edit mode. */
export interface ClosureEditGroup {
  date: string
  closures: Array<{ id: string; time_slot_id: string | null }>
  reason: string | null
  notes: string | null
}

/** Per-date existing closures info, used to warn when adding whole-day over existing slot-specific closures */
export interface ExistingClosuresForDate {
  closureIds: string[]
  slotCodes: string[]
}

export interface ClosurePanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  mode: 'add' | 'edit'
  editGroup: ClosureEditGroup | null
  activeTimeSlots: Array<{ id: string; code: string | null; name: string | null }>
  formatDate: (iso: string) => string
  /** Map of date (YYYY-MM-DD) to existing closures on that date; used to warn before replacing with whole-day */
  existingClosuresByDate?: Record<string, ExistingClosuresForDate>
}

function dateRange(startISO: string, endISO: string): string[] {
  const start = new Date(startISO + 'T12:00:00')
  const end = new Date(endISO + 'T12:00:00')
  if (start > end) return []
  const out: string[] = []
  const current = new Date(start)
  while (current <= end) {
    const y = current.getFullYear()
    const m = String(current.getMonth() + 1).padStart(2, '0')
    const d = String(current.getDate()).padStart(2, '0')
    out.push(`${y}-${m}-${d}`)
    current.setDate(current.getDate() + 1)
  }
  return out
}

export default function ClosurePanel({
  open,
  onOpenChange,
  onSuccess,
  mode,
  editGroup,
  activeTimeSlots,
  formatDate,
  existingClosuresByDate = {},
}: ClosurePanelProps) {
  const isEdit = mode === 'edit' && editGroup

  // Add-specific state
  const [addMode, setAddMode] = useState<'single' | 'range'>('single')
  const [addDate, setAddDate] = useState('')
  const [addStartDate, setAddStartDate] = useState('')
  const [addEndDate, setAddEndDate] = useState('')
  const [addStartPickerOpen, setAddStartPickerOpen] = useState(false)
  const [addEndPickerOpen, setAddEndPickerOpen] = useState(false)
  const addEndDateRef = useRef<HTMLButtonElement>(null)

  // Shared form state (used in both add and edit)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [appliesTo, setAppliesTo] = useState<'all' | 'specific'>('all')
  const [timeSlotIds, setTimeSlotIds] = useState<string[]>([])

  const [saving, setSaving] = useState(false)
  /** When adding whole-day over dates that already have closures, show replace confirmation */
  const [replaceConfirm, setReplaceConfirm] = useState<{
    closureIds: string[]
    datesWithSlots: Array<{ date: string; slotCodes: string[] }>
    /** Full date range to add (so we add whole-day for every date, not just those with existing closures) */
    allDatesInRange: string[]
  } | null>(null)
  /** When add fails because a closure already exists (409), show modal so user can't miss it */
  const [duplicateError, setDuplicateError] = useState<string | null>(null)

  // Sync from editGroup when opening in edit mode
  useEffect(() => {
    if (!open || !isEdit || !editGroup) return
    const hasAll = editGroup.closures.some(c => !c.time_slot_id)
    const slotIds = hasAll
      ? []
      : editGroup.closures.map(c => c.time_slot_id).filter((id): id is string => id != null)
    setReason(editGroup.reason ?? '')
    setNotes(editGroup.notes ?? '')
    setAppliesTo(hasAll ? 'all' : 'specific')
    setTimeSlotIds(slotIds)
  }, [open, isEdit, editGroup])

  // Reset add state when opening in add mode
  useEffect(() => {
    if (!open || mode !== 'add') return
    setAddMode('single')
    setAddDate('')
    setAddStartDate('')
    setAddEndDate('')
    setAddStartPickerOpen(false)
    setAddEndPickerOpen(false)
    setReason('')
    setNotes('')
    setAppliesTo('all')
    setTimeSlotIds([])
  }, [open, mode])

  // Range mode creates whole-day closures; keep appliesTo in sync so form state matches behavior
  useEffect(() => {
    if (addMode === 'range') setAppliesTo('all')
  }, [addMode])

  const handleClose = () => {
    if (!open) return
    setAddStartPickerOpen(false)
    setAddEndPickerOpen(false)
    setReplaceConfirm(null)
    setDuplicateError(null)
    onOpenChange(false)
  }

  const handleSubmit = async () => {
    if (isEdit && editGroup) {
      if (appliesTo === 'specific' && timeSlotIds.length === 0) {
        toast.error('Please select at least one time slot.')
        return
      }
      setSaving(true)
      try {
        const reasonVal = reason.trim() || null
        const notesVal = notes.trim() || null
        const body = buildEditClosurePayload(editGroup, appliesTo, timeSlotIds, reasonVal, notesVal)

        const res = await fetch('/api/settings/calendar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'Failed to update')
        }
        toast.success('Closure updated.')
        handleClose()
        onSuccess()
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to update')
      } finally {
        setSaving(false)
      }
      return
    }

    // Add mode
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
    if (addMode !== 'range' && appliesTo === 'specific' && timeSlotIds.length === 0) {
      toast.error('Please select at least one time slot.')
      return
    }

    // When adding whole-day (single or range), check if any selected date already has closures
    const datesToAdd: string[] =
      addMode === 'range'
        ? dateRange(addStartDate, addEndDate)
        : appliesTo === 'all'
          ? [addDate]
          : []
    if (datesToAdd.length > 0) {
      const datesWithExisting: Array<{ date: string; slotCodes: string[] }> = []
      const allClosureIds: string[] = []
      for (const date of datesToAdd) {
        const existing = existingClosuresByDate[date]
        if (existing && existing.closureIds.length > 0) {
          datesWithExisting.push({ date, slotCodes: existing.slotCodes })
          allClosureIds.push(...existing.closureIds)
        }
      }
      if (datesWithExisting.length > 0) {
        setReplaceConfirm({
          closureIds: allClosureIds,
          datesWithSlots: datesWithExisting,
          allDatesInRange: datesToAdd,
        })
        return
      }
    }

    setSaving(true)
    try {
      if (addMode === 'range') {
        const res = await fetch('/api/settings/calendar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            add_closures: [
              {
                start_date: addStartDate,
                end_date: addEndDate,
                reason: reason.trim() || null,
                notes: notes.trim() || null,
              },
            ],
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          const message = err.error || 'Failed to add closure'
          if (res.status === 409) {
            setDuplicateError(message)
            return
          }
          throw new Error(message)
        }
        toast.success('Closures added.')
        handleClose()
        onSuccess()
      } else if (appliesTo === 'all') {
        const res = await fetch('/api/settings/calendar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            add_closures: [
              {
                date: addDate,
                time_slot_id: null,
                reason: reason.trim() || null,
                notes: notes.trim() || null,
              },
            ],
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          const message = err.error || 'Failed to add closure'
          if (res.status === 409) {
            setDuplicateError(message)
            return
          }
          throw new Error(message)
        }
        toast.success('Closure added.')
        handleClose()
        onSuccess()
      } else {
        const res = await fetch('/api/settings/calendar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            add_closures: timeSlotIds.map(time_slot_id => ({
              date: addDate,
              time_slot_id,
              reason: reason.trim() || null,
              notes: notes.trim() || null,
            })),
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          const message = err.error || 'Failed to add closure'
          if (res.status === 409) {
            setDuplicateError(message)
            return
          }
          throw new Error(message)
        }
        toast.success('Closure added.')
        handleClose()
        onSuccess()
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add closure')
    } finally {
      setSaving(false)
    }
  }

  const idPrefix = isEdit ? 'edit' : 'add'

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          className="w-full overflow-y-auto bg-gray-50 p-0"
          style={{ maxWidth: '34rem' }}
        >
          <SheetHeader className="px-6 pt-6 pb-4">
            <SheetTitle>{isEdit ? 'Edit Closure' : 'Add Closure'}</SheetTitle>
            <SheetDescription>
              {isEdit
                ? `Update the closure for ${editGroup ? formatDate(editGroup.date) : 'this date'}`
                : 'Add a day or time slot closure to the school calendar'}
            </SheetDescription>
          </SheetHeader>
          <div className="px-6 pb-6 space-y-6">
            {isEdit ? (
              <>
                <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-4">
                  <Label className="text-base font-medium">Date</Label>
                  <p className="text-sm text-muted-foreground">
                    {editGroup ? formatDate(editGroup.date) : '—'}
                  </p>
                </div>
                <ClosureAppliesToRadios
                  name={`${idPrefix}-applies-to`}
                  appliesTo={appliesTo}
                  onAppliesToChange={setAppliesTo}
                  hasTimeSlots={activeTimeSlots.length > 0}
                />
                {appliesTo === 'specific' && (
                  <ClosureTimeSlotCheckboxes
                    idPrefix={idPrefix}
                    timeSlots={activeTimeSlots}
                    selectedIds={timeSlotIds}
                    onSelectionChange={setTimeSlotIds}
                  />
                )}
              </>
            ) : (
              <>
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
                      <ClosureAppliesToRadios
                        name="applies-to"
                        appliesTo={appliesTo}
                        onAppliesToChange={setAppliesTo}
                        hasTimeSlots={activeTimeSlots.length > 0}
                        embedded
                      />
                    </div>
                    {appliesTo === 'specific' && (
                      <ClosureTimeSlotCheckboxes
                        idPrefix="add"
                        timeSlots={activeTimeSlots}
                        selectedIds={timeSlotIds}
                        onSelectionChange={setTimeSlotIds}
                      />
                    )}
                  </>
                )}
              </>
            )}

            <ClosureReasonNotesFields
              idPrefix={idPrefix}
              reason={reason}
              onReasonChange={setReason}
              notes={notes}
              onNotesChange={setNotes}
            />

            <SheetFooter className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleClose} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? (isEdit ? 'Saving...' : 'Adding...') : isEdit ? 'Save' : 'Add'}
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      {/* Replace existing closures with whole-day: confirm before replacing */}
      <Dialog
        open={replaceConfirm !== null}
        onOpenChange={open => {
          if (!open) setReplaceConfirm(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Date(s) already have closures</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                {replaceConfirm && (
                  <>
                    <p>
                      The following date(s) already have time-slot closures. Adding a whole-day
                      closure will close the entire day. Do you want to replace the existing
                      closures with one whole-day closure for each date?
                    </p>
                    <ul className="list-disc list-inside text-left space-y-1">
                      {replaceConfirm.datesWithSlots.map(({ date, slotCodes }) => (
                        <li key={date}>
                          <span className="font-medium">{formatDate(date)}</span>
                          {slotCodes.length > 0 && (
                            <span className="text-muted-foreground">
                              {' '}
                              — currently {slotCodes.join(', ')}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReplaceConfirm(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!replaceConfirm) return
                setSaving(true)
                try {
                  const reasonVal = reason.trim() || null
                  const notesVal = notes.trim() || null
                  const res = await fetch('/api/settings/calendar', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      delete_closure_ids: replaceConfirm.closureIds,
                      add_closures: replaceConfirm.allDatesInRange.map(date => ({
                        date,
                        time_slot_id: null,
                        reason: reasonVal,
                        notes: notesVal,
                      })),
                    }),
                  })
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}))
                    throw new Error(err.error || 'Failed to update')
                  }
                  toast.success(
                    replaceConfirm.allDatesInRange.length > 1
                      ? 'Closures replaced with whole-day closures.'
                      : 'Closure replaced with whole-day closure.'
                  )
                  setReplaceConfirm(null)
                  handleClose()
                  onSuccess()
                } catch (err: unknown) {
                  toast.error(err instanceof Error ? err.message : 'Failed to update')
                } finally {
                  setSaving(false)
                }
              }}
              disabled={saving}
            >
              {saving ? 'Replacing...' : 'Replace with whole day'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate closure (409): modal so user can't miss it */}
      <Dialog
        open={duplicateError !== null}
        onOpenChange={open => {
          if (!open) setDuplicateError(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Closure already exists</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                <p>{duplicateError ?? 'A closure already exists for this date and time slot.'}</p>
                <p className="text-muted-foreground">
                  Edit the existing closure from the Closed Days list, or choose a different date or
                  time slot.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setDuplicateError(null)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
