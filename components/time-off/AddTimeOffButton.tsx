'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from '@/components/ui/sheet'
import { X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { usePanelManager } from '@/lib/contexts/PanelManagerContext'
import TimeOffForm from '@/components/time-off/TimeOffForm'
import { getPanelBackgroundClasses } from '@/lib/utils/colors'

interface AddTimeOffButtonProps {
  timeOffRequestId?: string | null
  onClose?: () => void
  initialTeacherId?: string
  initialStartDate?: string
  initialEndDate?: string
  initialSelectedShifts?: Array<{ date: string; day_of_week_id: string; time_slot_id: string }>
  renderTrigger?: (props: { onClick: () => void }) => React.ReactNode
}

export default function AddTimeOffButton({
  timeOffRequestId = null,
  onClose,
  initialTeacherId,
  initialStartDate,
  initialEndDate,
  initialSelectedShifts,
  renderTrigger,
}: AddTimeOffButtonProps = {}) {
  const router = useRouter()
  // Initialize sheet as open if timeOffRequestId is provided (edit mode)
  const [isTimeOffSheetOpen, setIsTimeOffSheetOpen] = useState(!!timeOffRequestId)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [clearDraftOnMount, setClearDraftOnMount] = useState(!timeOffRequestId)
  const [editingRequestId, setEditingRequestId] = useState<string | null>(timeOffRequestId || null)
  const timeOffFormRef = useRef<{ reset: () => void }>(null)
  const {
    activePanel,
    savePreviousPanel,
    restorePreviousPanel,
    setActivePanel,
    requestPanelClose,
  } = usePanelManager()

  // Update editingRequestId when prop changes (only for edit mode)
  useEffect(() => {
    if (timeOffRequestId) {
      setEditingRequestId(timeOffRequestId)
      setIsTimeOffSheetOpen(true)
      setClearDraftOnMount(false) // Don't clear draft when editing
    } else {
      // Reset to add mode when timeOffRequestId is cleared
      setEditingRequestId(null)
      setIsTimeOffSheetOpen(false)
    }
  }, [timeOffRequestId])

  const handleTimeOffSuccess = (teacherName: string, startDate: string, endDate: string) => {
    // Format date range for toast
    const formatDateForToast = (dateStr: string) => {
      const [year, month, day] = dateStr.split('-').map(Number)
      const date = new Date(year, month - 1, day)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    const startDateFormatted = formatDateForToast(startDate)
    const endDateFormatted = formatDateForToast(endDate)
    const dateRange =
      startDateFormatted === endDateFormatted
        ? startDateFormatted
        : `${startDateFormatted}-${endDateFormatted}`

    // Reset unsaved changes flag
    setHasUnsavedChanges(false)

    // Reset editing state
    setEditingRequestId(null)

    // Close the sheet
    setIsTimeOffSheetOpen(false)

    // Show toast
    const action = editingRequestId ? 'updated' : 'added'
    toast.success(`Time off ${action} for ${teacherName} (${dateRange})`)

    // Refresh the current page to update data
    router.refresh()

    // Call onClose callback if provided
    if (onClose) {
      onClose()
    }
  }

  const handleCloseSheet = (open: boolean) => {
    if (!open && hasUnsavedChanges) {
      // Prevent closing and show warning dialog
      setShowUnsavedDialog(true)
      // Keep sheet open
      setIsTimeOffSheetOpen(true)
    } else if (!open) {
      // No unsaved changes, close normally
      setIsTimeOffSheetOpen(false)
      setClearDraftOnMount(false) // Reset flag for next open
      setEditingRequestId(null) // Reset editing state
      setActivePanel(null)
      setTimeout(() => {
        restorePreviousPanel()
      }, 100)
      if (onClose) {
        onClose()
      }
    } else {
      setIsTimeOffSheetOpen(open)
    }
  }

  const handleDiscard = () => {
    // Reset form
    if (timeOffFormRef.current) {
      timeOffFormRef.current.reset()
    }
    setHasUnsavedChanges(false)
    setShowUnsavedDialog(false)
    // Close the sheet
    setIsTimeOffSheetOpen(false)
    setEditingRequestId(null) // Reset editing state
    setActivePanel(null)
    setTimeout(() => {
      restorePreviousPanel()
    }, 100)
    if (onClose) {
      onClose()
    }
  }

  const handleKeepEditing = () => {
    setShowUnsavedDialog(false)
    // Keep sheet open (already open)
  }

  const handleOpenSheet = () => {
    // Only open in add mode if we're not already in edit mode
    if (timeOffRequestId) {
      // This is edit mode, don't open from button click
      return
    }
    // If another panel is open, save it and close it before opening Add Time Off
    if (activePanel && activePanel !== 'time-off') {
      savePreviousPanel(activePanel)
      requestPanelClose(activePanel)
    }
    // Clear draft when opening fresh (not restoring from previous session)
    setClearDraftOnMount(true)
    setEditingRequestId(null) // Ensure we're in add mode
    setActivePanel('time-off')
    setIsTimeOffSheetOpen(true)
  }

  // Don't render the button if we're in edit mode (timeOffRequestId provided)
  // The button is only for adding new time off requests
  if (timeOffRequestId) {
    // This instance is for editing - render only the sheet, no button
    return (
      <>
        <Sheet open={isTimeOffSheetOpen} onOpenChange={handleCloseSheet}>
          <SheetContent
            side="right"
            showCloseButton={false}
            className={`w-full sm:max-w-2xl h-screen flex flex-col p-0 ${getPanelBackgroundClasses()}`}
          >
            <div className={`flex-1 overflow-y-auto px-6 py-6 ${getPanelBackgroundClasses()}`}>
              <SheetHeader className="mb-6 pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <SheetTitle className="text-3xl font-bold tracking-tight text-slate-900">
                      Edit Time Off Request
                    </SheetTitle>
                    <SheetDescription>Update the time off request</SheetDescription>
                  </div>
                  <SheetClose asChild>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 focus:outline-none ml-4"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </SheetClose>
                </div>
              </SheetHeader>
              <TimeOffForm
                key={timeOffRequestId || 'new'}
                ref={timeOffFormRef}
                onSuccess={handleTimeOffSuccess}
                onCancel={() => handleCloseSheet(false)}
                onHasUnsavedChanges={setHasUnsavedChanges}
                clearDraftOnMount={clearDraftOnMount}
                timeOffRequestId={timeOffRequestId}
              />
            </div>
          </SheetContent>
        </Sheet>

        <Dialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Unsaved Changes</DialogTitle>
              <DialogDescription>
                You have unsaved changes. What would you like to do?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={handleKeepEditing}>
                Keep Editing
              </Button>
              <Button variant="destructive" onClick={handleDiscard}>
                {editingRequestId ? 'Discard changes' : 'Discard'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  // Normal "Add Time Off" button behavior
  return (
    <>
      {renderTrigger ? (
        renderTrigger({ onClick: handleOpenSheet })
      ) : (
        <Button onClick={handleOpenSheet}>
          <Plus className="h-4 w-4 mr-2" />
          Add Time Off
        </Button>
      )}

      <Sheet open={isTimeOffSheetOpen} onOpenChange={handleCloseSheet}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className={`w-full sm:max-w-2xl h-screen flex flex-col p-0 ${getPanelBackgroundClasses()}`}
        >
          <div className={`flex-1 overflow-y-auto px-6 py-6 ${getPanelBackgroundClasses()}`}>
            <SheetHeader className="mb-6 pt-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <SheetTitle className="text-3xl font-bold tracking-tight text-slate-900">
                    {editingRequestId ? 'Edit Time Off Request' : 'Add Time Off Request'}
                  </SheetTitle>
                  <SheetDescription>
                    {editingRequestId
                      ? 'Update the time off request'
                      : 'Create a new time off request'}
                  </SheetDescription>
                </div>
                <SheetClose asChild>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ml-4"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </SheetClose>
              </div>
            </SheetHeader>
            <TimeOffForm
              key={timeOffRequestId || 'new'}
              ref={timeOffFormRef}
              onSuccess={handleTimeOffSuccess}
              onCancel={() => handleCloseSheet(false)}
              onHasUnsavedChanges={setHasUnsavedChanges}
              clearDraftOnMount={clearDraftOnMount}
              timeOffRequestId={timeOffRequestId}
              initialTeacherId={initialTeacherId}
              initialStartDate={initialStartDate}
              initialEndDate={initialEndDate}
              initialSelectedShifts={initialSelectedShifts}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
            <DialogDescription>
              You have unsaved changes. What would you like to do?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleKeepEditing}>
              Keep Editing
            </Button>
            <Button variant="destructive" onClick={handleDiscard}>
              {editingRequestId ? 'Discard changes' : 'Discard'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
