'use client'

import { XCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { UnassignContext, UnassignScope } from '@/lib/hooks/use-unassign-sub'

export interface RemoveSubDialogContext extends UnassignContext {
  teacherName?: string
  /** When true, show "All shifts" option */
  hasMultiple: boolean
  /** When true, show confirmed warning */
  isConfirmed?: boolean
}

export interface RemoveSubDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  context: RemoveSubDialogContext | null
  onConfirm: (scope: UnassignScope) => void | Promise<void>
  isPending: boolean
}

/**
 * Shared Remove Sub confirmation dialog. Matches Sub Finder pattern:
 * destructive (rose/red) styling, single vs all shifts options when hasMultiple.
 */
export function RemoveSubDialog({
  open,
  onOpenChange,
  context,
  onConfirm,
  isPending,
}: RemoveSubDialogProps) {
  const handleClose = () => {
    if (!isPending) onOpenChange(false)
  }

  const subName = context?.subName ?? 'the sub'
  const teacherName = context?.teacherName ?? 'the teacher'
  const hasMultiple = context?.hasMultiple ?? false
  const isConfirmed = context?.isConfirmed ?? false

  return (
    <Dialog open={open} onOpenChange={open => !isPending && onOpenChange(open)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove sub assignment?</DialogTitle>
          <DialogDescription>
            {hasMultiple
              ? `Would you like to remove ${subName} from only this shift, or from all shifts for ${teacherName} on this request?`
              : `Are you sure you want to remove ${subName} from this shift?`}
          </DialogDescription>
          {isConfirmed && (
            <p className="text-sm text-amber-700 mt-2">
              This sub is marked confirmed. Removing will reopen this shift.
            </p>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          {hasMultiple && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onConfirm('all_for_absence')}
              disabled={isPending}
            >
              {isPending ? 'Removing...' : 'All shifts'}
            </Button>
          )}
          <Button
            type="button"
            variant="destructive"
            onClick={() => onConfirm('single')}
            disabled={isPending}
            className="gap-1.5"
          >
            {isPending ? (
              'Removing...'
            ) : (
              <>
                <XCircle className="h-4 w-4" />
                {hasMultiple ? 'This shift only' : 'Remove'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
