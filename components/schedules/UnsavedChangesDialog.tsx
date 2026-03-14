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
import { AlertTriangle } from 'lucide-react'

interface UnsavedChangesDialogProps {
  isOpen: boolean
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
  /** When true, Save is in progress; show "Saving..." on Save button and disable actions */
  saving?: boolean
  /** When set, save failed (e.g. apply conflict or server rejection); show in dialog so user sees it without closing */
  saveError?: string | null
  /** When set, Save is blocked (e.g. unresolved scheduling conflicts); show warning and disable Save */
  blockSaveReason?: string | null
}

export default function UnsavedChangesDialog({
  isOpen,
  onSave,
  onDiscard,
  onCancel,
  saving = false,
  saveError = null,
  blockSaveReason = null,
}: UnsavedChangesDialogProps) {
  const saveDisabled = saving || !!saveError || !!blockSaveReason

  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unsaved Changes</DialogTitle>
          <DialogDescription>
            You have unsaved changes. What would you like to do?
          </DialogDescription>
        </DialogHeader>
        {saveError && (
          <div
            className="flex gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            <p className="break-words">{saveError}</p>
          </div>
        )}
        {blockSaveReason && !saveError && (
          <div
            className="flex gap-2 rounded-lg border border-amber-500/50 bg-amber-50 p-3 text-sm text-amber-800"
            role="alert"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            <p className="break-words">{blockSaveReason}</p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button variant="outline" onClick={onDiscard} disabled={saving}>
            Discard
          </Button>
          <Button onClick={onSave} disabled={saveDisabled}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
