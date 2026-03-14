'use client'

import { Info } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

export interface CreateTimeOffRequestCardProps {
  /** Number of selected shifts that do not have a time off request. */
  noTimeOffCount: number
  /** Total number of selected shifts. */
  totalSelected: number
  /** Selected reason (e.g. "Sick Day"). */
  reason: string
  onReasonChange: (value: string) => void
  /** Optional notes. */
  notes: string
  onNotesChange: (value: string) => void
  /** Optional prefix for form field ids (for a11y when multiple instances on page). */
  idPrefix?: string
  /** Optional class for the container. */
  className?: string
}

const REASON_OPTIONS = ['Sick Day', 'Vacation', 'Training', 'Other'] as const

/**
 * Shared inline card for creating a time off request: amber callout with message,
 * Reason dropdown (required), and Notes (optional). Used in Assign Sub panel and
 * Sub Finder manual mode so both flows share the same UI and validation.
 */
export function CreateTimeOffRequestCard({
  noTimeOffCount,
  totalSelected,
  reason,
  onReasonChange,
  notes,
  onNotesChange,
  idPrefix = 'time-off',
  className,
}: CreateTimeOffRequestCardProps) {
  const reasonId = `${idPrefix}-reason`
  const notesId = `${idPrefix}-notes`

  return (
    <div className={className ?? 'space-y-3 rounded-lg border border-amber-200 bg-amber-50/40 p-4'}>
      <div className="flex items-start gap-2">
        <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800 mb-2">Create Time Off Request</p>
          <p className="text-sm text-amber-800 mb-4">
            {noTimeOffCount} of {totalSelected} selected shift
            {totalSelected !== 1 ? 's' : ''} {noTimeOffCount === 1 ? 'does' : 'do'} not have a time
            off request. A time off request will be created automatically.
          </p>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={reasonId} className="text-amber-900">
                Reason <span className="text-amber-700">*</span>
              </Label>
              <Select value={reason} onValueChange={onReasonChange}>
                <SelectTrigger id={reasonId} className="bg-white">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {REASON_OPTIONS.map(opt => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={notesId} className="text-amber-900">
                Notes (optional)
              </Label>
              <Textarea
                id={notesId}
                value={notes}
                onChange={e => onNotesChange(e.target.value)}
                placeholder="Add any notes about this time off..."
                className="bg-white resize-none"
                rows={2}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
