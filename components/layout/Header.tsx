'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { CalendarPlus, LogOut, UserPlus, UserSearch } from 'lucide-react'
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
import { useRef } from 'react'
import { getPanelBackgroundClasses } from '@/lib/utils/colors'

interface HeaderProps {
  userEmail?: string
}

export default function Header({ userEmail }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isTimeOffSheetOpen, setIsTimeOffSheetOpen] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [pendingClose, setPendingClose] = useState(false)
  const [clearDraftOnMount, setClearDraftOnMount] = useState(false)
  const timeOffFormRef = useRef<{ reset: () => void }>(null)
  const { activePanel, savePreviousPanel, restorePreviousPanel, setActivePanel, requestPanelClose } = usePanelManager()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

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

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">Scheduler</h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              className="border-slate-300 text-slate-700 hover:bg-slate-100"
              onClick={() => {
                // If another panel is open, save it and close it before opening Add Time Off
                if (activePanel && activePanel !== 'time-off') {
                  savePreviousPanel(activePanel)
                  requestPanelClose(activePanel)
                }
                // Clear draft when opening fresh (not restoring from previous session)
                setClearDraftOnMount(true)
                setActivePanel('time-off')
                setIsTimeOffSheetOpen(true)
              }}
            >
              <CalendarPlus className="h-4 w-4 mr-2" />
              Add Time Off
            </Button>
            <Button asChild size="sm" variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-100">
              <Link href="/sub-finder">
                <UserSearch className="h-4 w-4 mr-2" />
                Find Sub
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-100">
              <Link href="/schedules/weekly">
                <UserPlus className="h-4 w-4 mr-2" />
                Assign Sub
              </Link>
            </Button>
          </div>
          {userEmail && (
            <span className="text-sm text-muted-foreground">{userEmail}</span>
          )}
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      <Sheet 
        open={isTimeOffSheetOpen} 
        onOpenChange={handleCloseSheet}
      >
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
                    Add Time Off Request
                  </SheetTitle>
                  <SheetDescription>
                    Create a new time off request
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
    </header>
  )
}
