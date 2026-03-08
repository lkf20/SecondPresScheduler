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
  title = 'Unsaved Changes',
  description = 'You have unsaved changes. Leave this page and discard them?',
  keepEditingLabel = 'Keep Editing',
  discardLabel = 'Discard & Leave',
  saveLabel = 'Save & Continue',
}: StaffUnsavedChangesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onKeepEditing}>
            {keepEditingLabel}
          </Button>
          {onSaveAndContinue && <Button onClick={onSaveAndContinue}>{saveLabel}</Button>}
          <Button variant="destructive" onClick={onDiscardAndLeave}>
            {discardLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
