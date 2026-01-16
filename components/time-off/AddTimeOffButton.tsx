'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
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
import { usePanelManager } from '@/lib/contexts/PanelManagerContext'
import TimeOffForm from '@/components/time-off/TimeOffForm'
import { getPanelBackgroundClasses } from '@/lib/utils/colors'

export default function AddTimeOffButton() {
  const router = useRouter()
  const [isTimeOffSheetOpen, setIsTimeOffSheetOpen] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [pendingClose, setPendingClose] = useState(false)
  const [clearDraftOnMount, setClearDraftOnMount] = useState(false)
  const timeOffFormRef = useRef<{ reset: () => void }>(null)
  const { activePanel, savePreviousPanel, restorePreviousPanel, setActivePanel, requestPanelClose } = usePanelManager()

  const handleTimeOffSuccess = (teacherName: string, startDate: string, endDate: string) => {
    // Format date range for toast
    const formatDateForToast = (dateStr: string) => {
      const [year, month, day] = dateStr.split('-').map(Number)
      const date = new Date(year, month - 1, day)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    const startDateFormatted = formatDateForToast(startDate)
    const endDateFormatted = formatDateForToast(endDate)
    const dateRange = startDateFormatted === endDateFormatted 
      ? startDateFormatted 
      : `${startDateFormatted}-${endDateFormatted}`
    
    // Reset unsaved changes flag
    setHasUnsavedChanges(false)
    
    // Close the sheet
    setIsTimeOffSheetOpen(false)
    
    // Show toast
    toast.success(`Time off added for ${teacherName} (${dateRange})`)
    
    // Refresh the current page to update data
    router.refresh()
  }

  const handleCloseSheet = (open: boolean) => {
    if (!open && hasUnsavedChanges) {
      // Prevent closing and show warning dialog
      setPendingClose(true)
      setShowUnsavedDialog(true)
      // Keep sheet open
      setIsTimeOffSheetOpen(true)
    } else if (!open) {
      // No unsaved changes, close normally
      setIsTimeOffSheetOpen(false)
      setClearDraftOnMount(false) // Reset flag for next open
      setActivePanel(null)
      setTimeout(() => {
        restorePreviousPanel()
      }, 100)
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
    setPendingClose(false)
    // Close the sheet
    setIsTimeOffSheetOpen(false)
    setActivePanel(null)
    setTimeout(() => {
      restorePreviousPanel()
    }, 100)
  }

  const handleKeepEditing = () => {
    setShowUnsavedDialog(false)
    setPendingClose(false)
    // Keep sheet open (already open)
  }

  const handleOpenSheet = () => {
    // If another panel is open, save it and close it before opening Add Time Off
    if (activePanel && activePanel !== 'time-off') {
      savePreviousPanel(activePanel)
      requestPanelClose(activePanel)
    }
    // Clear draft when opening fresh (not restoring from previous session)
    setClearDraftOnMount(true)
    setActivePanel('time-off')
    setIsTimeOffSheetOpen(true)
  }

  return (
    <>
      <Button onClick={handleOpenSheet}>
        <Plus className="h-4 w-4 mr-2" />
        Add Time Off
      </Button>

      <Sheet 
        open={isTimeOffSheetOpen} 
        onOpenChange={handleCloseSheet}
      >
        <SheetContent 
          side="right" 
          className={`w-full sm:max-w-2xl h-screen flex flex-col p-0 [&>button]:top-4 [&>button]:right-4 ${getPanelBackgroundClasses()}`}
        >
          <div className={`flex-1 overflow-y-auto px-6 py-6 ${getPanelBackgroundClasses()}`}>
            <SheetHeader className="mb-6">
              <SheetTitle className="text-3xl font-bold tracking-tight text-slate-900">
                Add Time Off Request
              </SheetTitle>
              <SheetDescription>
                Create a new time off request
              </SheetDescription>
            </SheetHeader>
            <TimeOffForm 
              ref={timeOffFormRef}
              onSuccess={handleTimeOffSuccess}
              onCancel={() => handleCloseSheet(false)}
              showBackLink={false}
              onHasUnsavedChanges={setHasUnsavedChanges}
              clearDraftOnMount={clearDraftOnMount}
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
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
