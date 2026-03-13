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
import { toast } from 'sonner'
import {
  ClosureReasonNotesFields,
  ClosureAppliesToRadios,
  ClosureTimeSlotCheckboxes,
} from './closure-form-fields'

/** Group of closures on one date (from calendar page groupedClosures). Used to open panel in edit mode. */
export interface ClosureEditGroup {
  date: string
  closures: Array<{ id: string; time_slot_id: string | null }>
  reason: string | null
  notes: string | null
}

export interface ClosurePanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  mode: 'add' | 'edit'
  editGroup: ClosureEditGroup | null
  activeTimeSlots: Array<{ id: string; code: string | null; name: string | null }>
  formatDate: (iso: string) => string
}

export default function ClosurePanel({
  open,
  onOpenChange,
  onSuccess,
  mode,
  editGroup,
  activeTimeSlots,
  formatDate,
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

        const existingIsAll =
          editGroup.closures.length === 1 && editGroup.closures[0].time_slot_id === null
        const existingSlotIds = editGroup.closures
          .map(c => c.time_slot_id)
          .filter((id): id is string => id != null)
          .sort()
        const newIsAll = appliesTo === 'all'
        const newSlotIds = newIsAll ? [] : [...timeSlotIds].sort()
        const sameShape =
          (existingIsAll && newIsAll) ||
          (!existingIsAll &&
            !newIsAll &&
            existingSlotIds.length === newSlotIds.length &&
            existingSlotIds.every((id, i) => id === newSlotIds[i]))

        const body: {
          update_closures?: Array<{ id: string; reason: string | null; notes: string | null }>
          delete_closure_ids?: string[]
          add_closures?: Array<{
            date: string
            time_slot_id: string | null
            reason: string | null
            notes: string | null
          }>
        } = sameShape
          ? {
              update_closures: editGroup.closures.map(c => ({
                id: c.id,
                reason: reasonVal,
                notes: notesVal,
              })),
            }
          : {
              delete_closure_ids: editGroup.closures.map(c => c.id),
              add_closures:
                appliesTo === 'all'
                  ? [
                      {
                        date: editGroup.date,
                        time_slot_id: null,
                        reason: reasonVal,
                        notes: notesVal,
                      },
                    ]
                  : timeSlotIds.map(time_slot_id => ({
                      date: editGroup.date,
                      time_slot_id,
                      reason: reasonVal,
                      notes: notesVal,
                    })),
            }

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
    setSaving(true)
    try {
      if (addMode === 'range') {
        const res = await fetch('/api/settings/calendar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            add_closure: {
              start_date: addStartDate,
              end_date: addEndDate,
              reason: reason.trim() || null,
              notes: notes.trim() || null,
            },
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'Failed to add closure')
        }
        toast.success('Closures added.')
        handleClose()
        onSuccess()
      } else if (appliesTo === 'all') {
        const res = await fetch('/api/settings/calendar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            add_closure: {
              date: addDate,
              time_slot_id: null,
              reason: reason.trim() || null,
              notes: notes.trim() || null,
            },
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'Failed to add closure')
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
          throw new Error(err.error || 'Failed to add closure')
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto bg-gray-50 p-0" style={{ maxWidth: '34rem' }}>
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
  )
}
