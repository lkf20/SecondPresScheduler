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
}

export default function StaffUnsavedChangesDialog({
  open,
  onOpenChange,
  onKeepEditing,
  onDiscardAndLeave,
}: StaffUnsavedChangesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unsaved Changes</DialogTitle>
          <DialogDescription>
            You have unsaved changes. Leave this page and discard them?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onKeepEditing}>
            Keep Editing
          </Button>
          <Button variant="destructive" onClick={onDiscardAndLeave}>
            Discard & Leave
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
