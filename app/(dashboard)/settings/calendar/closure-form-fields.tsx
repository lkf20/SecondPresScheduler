'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'

export interface ClosureReasonNotesFieldsProps {
  idPrefix: string
  reason: string
  onReasonChange: (value: string) => void
  notes: string
  onNotesChange: (value: string) => void
}

export function ClosureReasonNotesFields({
  idPrefix,
  reason,
  onReasonChange,
  notes,
  onNotesChange,
}: ClosureReasonNotesFieldsProps) {
  return (
    <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-4">
      <div>
        <Label htmlFor={`${idPrefix}-reason`}>Reason</Label>
        <Input
          id={`${idPrefix}-reason`}
          value={reason}
          onChange={e => onReasonChange(e.target.value)}
          placeholder="e.g. Holiday, Snow Day"
          className="mt-2"
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-notes`}>Notes</Label>
        <Textarea
          id={`${idPrefix}-notes`}
          value={notes}
          onChange={e => onNotesChange(e.target.value)}
          placeholder="e.g. Early dismissal at 2pm"
          className="mt-2 min-h-[80px] resize-y"
          rows={3}
        />
      </div>
    </div>
  )
}

export interface ClosureAppliesToRadiosProps {
  name: string
  appliesTo: 'all' | 'specific'
  onAppliesToChange: (value: 'all' | 'specific') => void
  hasTimeSlots: boolean
  /** When true, omit the outer card wrapper (use inside another card). */
  embedded?: boolean
}

export function ClosureAppliesToRadios({
  name,
  appliesTo,
  onAppliesToChange,
  hasTimeSlots,
  embedded = false,
}: ClosureAppliesToRadiosProps) {
  const content = (
    <>
      <Label className="mb-2 block">Applies to</Label>
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={name}
            checked={appliesTo === 'all'}
            onChange={() => onAppliesToChange('all')}
            className="h-4 w-4 rounded-full accent-teal-600"
          />
          <span>All time slots (whole day closed)</span>
        </label>
        <label
          className={`flex items-center gap-2 ${!hasTimeSlots ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
        >
          <input
            type="radio"
            name={name}
            checked={appliesTo === 'specific'}
            onChange={() => hasTimeSlots && onAppliesToChange('specific')}
            disabled={!hasTimeSlots}
            className="h-4 w-4 rounded-full accent-teal-600"
          />
          <span>Specific time slots</span>
        </label>
      </div>
    </>
  )
  if (embedded) return content
  return <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-4">{content}</div>
}

export interface TimeSlotOption {
  id: string
  code: string | null
  name: string | null
}

export interface ClosureTimeSlotCheckboxesProps {
  idPrefix: string
  timeSlots: TimeSlotOption[]
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
}

export function ClosureTimeSlotCheckboxes({
  idPrefix,
  timeSlots,
  selectedIds,
  onSelectionChange,
}: ClosureTimeSlotCheckboxesProps) {
  return (
    <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-3">
      <Label className="text-base font-medium">Select time slots to close</Label>
      {timeSlots.length === 0 ? (
        <p className="text-sm text-muted-foreground">No time slots configured.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {timeSlots.map(ts => (
            <label
              key={ts.id}
              className="flex items-center space-x-2 cursor-pointer rounded px-1 py-0.5 -mx-1 -my-0.5 hover:bg-slate-50"
            >
              <Checkbox
                id={`${idPrefix}-closure-slot-${ts.id}`}
                checked={selectedIds.includes(ts.id)}
                onCheckedChange={checked =>
                  onSelectionChange(
                    checked === true
                      ? selectedIds.includes(ts.id)
                        ? selectedIds
                        : [...selectedIds, ts.id]
                      : selectedIds.filter(x => x !== ts.id)
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
  )
}
