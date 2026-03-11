'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface StaffUnsavedChangesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onKeepEditing: () => void
  onDiscardAndLeave: () => void
  onSaveAndContinue?: () => void
  /** Tab/section name for the message, e.g. "Overview", "Availability", "Preferences & Qualifications", "Notes" */
  tabName?: string
  title?: string
  description?: string
  keepEditingLabel?: string
  discardLabel?: string
  saveLabel?: string
}

export default function StaffUnsavedChangesDialog({
  open,
  onOpenChange,
  onKeepEditing,
  onDiscardAndLeave,
  onSaveAndContinue,
  tabName = 'this section',
  title = 'Unsaved Changes',
  description,
  keepEditingLabel = 'Cancel',
  discardLabel = 'Discard',
  saveLabel = 'Save',
}: StaffUnsavedChangesDialogProps) {
  const resolvedDescription =
    description ??
    `You have unsaved changes in ${tabName}. What would you like to do?`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{resolvedDescription}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onKeepEditing} className="border-slate-300">
            {keepEditingLabel}
          </Button>
          <Button variant="outline" onClick={onDiscardAndLeave} className="border-slate-300">
            {discardLabel}
          </Button>
          {onSaveAndContinue && (
            <Button onClick={onSaveAndContinue}>{saveLabel}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
