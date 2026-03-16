'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { CalendarPlus, History, LogOut, Printer, UserPlus, UserSearch } from 'lucide-react'
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
import { useAssignSubPanel } from '@/lib/contexts/AssignSubPanelContext'
import TimeOffForm from '@/components/time-off/TimeOffForm'
import AssignSubPanel from '@/components/assign-sub/AssignSubPanel'
import { getPanelBackgroundClasses } from '@/lib/utils/colors'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { getTodayISO } from '@/lib/utils/date'
import { ActivityFeed } from '@/components/activity/ActivityFeed'

interface HeaderProps {
  userEmail?: string
}

export default function Header({ userEmail }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isTimeOffSheetOpen, setIsTimeOffSheetOpen] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [clearDraftOnMount, setClearDraftOnMount] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [timeOffInitialTeacherId, setTimeOffInitialTeacherId] = useState<string | undefined>()
  const [timeOffInitialStartDate, setTimeOffInitialStartDate] = useState<string | undefined>()
  const [timeOffInitialEndDate, setTimeOffInitialEndDate] = useState<string | undefined>()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const timeOffFormRef = useRef<{ reset: () => void; saveDraft: () => Promise<boolean> }>(null)
  const {
    activePanel,
    savePreviousPanel,
    restorePreviousPanel,
    setActivePanel,
    requestPanelClose,
  } = usePanelManager()
  const [isAssignSubPanelOpen, setIsAssignSubPanelOpen] = useState(false)
  const { assignSubInitials, clearAssignSubRequest } = useAssignSubPanel()
  const [isActivitySheetOpen, setIsActivitySheetOpen] = useState(false)

  // Open Assign Sub panel when requested from e.g. Dashboard Scheduled Subs
  useEffect(() => {
    if (assignSubInitials) {
      setIsAssignSubPanelOpen(true)
    }
  }, [assignSubInitials])
  const formatISODate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleTimeOffSuccess = (
    teacherName: string,
    startDate: string,
    endDate: string,
    requestId?: string
  ) => {
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

    // Close the sheet
    setIsTimeOffSheetOpen(false)

    // Show toast
    toast.success(`Time off added for ${teacherName} (${dateRange})`)

    // If we have the new request id, go to Sub Finder with it selected so the left panel
    // refetches, selects the new absence, and main content shows it (no longer in preview).
    if (requestId) {
      router.push(`/sub-finder?absence_id=${requestId}`)
    } else {
      router.refresh()
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
      setTimeOffInitialTeacherId(undefined)
      setTimeOffInitialStartDate(undefined)
      setTimeOffInitialEndDate(undefined)
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
    // Close the sheet
    setIsTimeOffSheetOpen(false)
    setActivePanel(null)
    setTimeout(() => {
      restorePreviousPanel()
    }, 100)
  }

  const handleKeepEditing = () => {
    setShowUnsavedDialog(false)
    // Keep sheet open (already open)
  }

  // Set mounted state after component mounts to prevent hydration errors with Radix UI
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Open Add Time Off panel when URL has open_time_off=1 (e.g. from sub-finder "Create time off request")
  useEffect(() => {
    if (searchParams.get('open_time_off') !== '1') return
    const teacherId = searchParams.get('teacher_id') || undefined
    const startDate = searchParams.get('start_date') || undefined
    const endDate = searchParams.get('end_date') || undefined
    if (activePanel && activePanel !== 'time-off') {
      savePreviousPanel(activePanel)
      requestPanelClose(activePanel)
    }
    setTimeOffInitialTeacherId(teacherId)
    setTimeOffInitialStartDate(startDate)
    setTimeOffInitialEndDate(endDate)
    setClearDraftOnMount(false)
    setActivePanel('time-off')
    setIsTimeOffSheetOpen(true)
    const next = new URLSearchParams(searchParams.toString())
    next.delete('open_time_off')
    next.delete('teacher_id')
    next.delete('start_date')
    next.delete('end_date')
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }, [
    searchParams,
    pathname,
    router,
    activePanel,
    savePreviousPanel,
    requestPanelClose,
    setActivePanel,
  ])

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">Scheduler</h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
              <Button
                size="sm"
                variant="outline"
                className="border-slate-300 text-slate-700 hover:bg-slate-100"
                onClick={() => {
                  const today = formatISODate(new Date())
                  router.push(`/reports/daily-schedule?date=${today}`)
                }}
              >
                <Printer className="h-4 w-4 mr-2" />
                Print Daily Schedule
              </Button>
            </div>
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
                setTimeOffInitialTeacherId(undefined)
                setTimeOffInitialStartDate(undefined)
                setTimeOffInitialEndDate(undefined)
                setClearDraftOnMount(true)
                setActivePanel('time-off')
                setIsTimeOffSheetOpen(true)
              }}
            >
              <CalendarPlus className="h-4 w-4 mr-2" />
              Add Time Off
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-slate-100"
              onClick={() => router.push('/sub-finder?open_teacher=1')}
            >
              <UserSearch className="h-4 w-4 mr-2" />
              Find Sub
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-slate-100"
              onClick={() => {
                if (activePanel) {
                  savePreviousPanel(activePanel)
                }
                // Note: 'assign-sub' is not a PanelType, so we just open the panel directly
                setIsAssignSubPanelOpen(true)
              }}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Assign Sub
            </Button>
          </div>
          {userEmail && <span className="text-sm text-muted-foreground">{userEmail}</span>}
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={() => setIsActivitySheetOpen(true)}
            aria-label="Open activity"
            title="Activity"
            className="rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900"
          >
            <History className="h-4 w-4" />
          </Button>
        </div>
      </div>

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
                    Add Time Off Request
                  </SheetTitle>
                  <SheetDescription>Create a new time off request</SheetDescription>
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
              key={`time-off-${timeOffInitialTeacherId ?? ''}-${timeOffInitialStartDate ?? ''}-${timeOffInitialEndDate ?? ''}`}
              ref={timeOffFormRef}
              onSuccess={handleTimeOffSuccess}
              onCancel={() => handleCloseSheet(false)}
              onHasUnsavedChanges={setHasUnsavedChanges}
              clearDraftOnMount={clearDraftOnMount}
              initialTeacherId={timeOffInitialTeacherId}
              initialStartDate={timeOffInitialStartDate}
              initialEndDate={timeOffInitialEndDate}
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
      <AssignSubPanel
        key={
          assignSubInitials
            ? `${assignSubInitials.teacherId}-${assignSubInitials.startDate}`
            : 'default'
        }
        isOpen={isAssignSubPanelOpen}
        onClose={() => {
          setIsAssignSubPanelOpen(false)
          clearAssignSubRequest()
          setActivePanel(null)
          setTimeout(() => {
            restorePreviousPanel()
          }, 100)
        }}
        initialTeacherId={assignSubInitials?.teacherId}
        initialStartDate={assignSubInitials?.startDate}
        initialEndDate={assignSubInitials?.endDate}
      />
      <Sheet open={isActivitySheetOpen} onOpenChange={setIsActivitySheetOpen}>
        <SheetContent
          side="right"
          showOverlay={false}
          showCloseButton={false}
          className={`w-full sm:max-w-2xl h-screen flex flex-col p-0 ${getPanelBackgroundClasses()}`}
        >
          <div className={`flex-1 overflow-y-auto px-6 py-6 ${getPanelBackgroundClasses()}`}>
            <SheetHeader className="mb-6 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <SheetTitle className="text-3xl font-bold tracking-tight text-slate-900">
                    Activity
                  </SheetTitle>
                  <SheetDescription>Track recent changes across your school.</SheetDescription>
                </div>
                <div className="flex items-center gap-1">
                  <SheetClose asChild>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 focus:outline-none"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </SheetClose>
                </div>
              </div>
            </SheetHeader>
            <ActivityFeed
              className="min-h-[calc(100vh-170px)]"
              onNavigateToView={() => setIsActivitySheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
