'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { CalendarPlus, LogOut, Printer, UserPlus, UserSearch } from 'lucide-react'
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
import AssignSubPanel from '@/components/assign-sub/AssignSubPanel'
import { getPanelBackgroundClasses } from '@/lib/utils/colors'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Database } from '@/types/database'
import { useDisplayNameFormat } from '@/lib/hooks/use-display-name-format'
import { getStaffDisplayName } from '@/lib/utils/staff-display-name'

type Staff = Database['public']['Tables']['staff']['Row']

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
  const timeOffFormRef = useRef<{ reset: () => void }>(null)
  const {
    activePanel,
    savePreviousPanel,
    restorePreviousPanel,
    setActivePanel,
    requestPanelClose,
  } = usePanelManager()
  const [isFindSubPopoverOpen, setIsFindSubPopoverOpen] = useState(false)
  const [isAssignSubPanelOpen, setIsAssignSubPanelOpen] = useState(false)
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('')
  const [teachers, setTeachers] = useState<Staff[]>([])
  const [teacherSearch, setTeacherSearch] = useState('')
  const { format: displayNameFormat } = useDisplayNameFormat()
  const [isTeacherDropdownOpen, setIsTeacherDropdownOpen] = useState(false)
  const teacherSearchRef = useRef<HTMLDivElement | null>(null)
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

  // Fetch teachers for Find Sub popover
  useEffect(() => {
    fetch('/api/teachers')
      .then(r => r.json())
      .then(data => {
        const sorted = (data as Staff[]).sort((a, b) => {
          const nameA = getStaffDisplayName(
            {
              first_name: a.first_name ?? '',
              last_name: a.last_name ?? '',
              display_name: a.display_name ?? null,
            },
            displayNameFormat
          )
          const nameB = getStaffDisplayName(
            {
              first_name: b.first_name ?? '',
              last_name: b.last_name ?? '',
              display_name: b.display_name ?? null,
            },
            displayNameFormat
          )
          return nameA.localeCompare(nameB)
        })
        setTeachers(sorted)
      })
      .catch(console.error)
  }, [displayNameFormat])

  const handleFindSubGo = () => {
    if (!selectedTeacherId) {
      toast.error('Please select a teacher')
      return
    }
    setIsFindSubPopoverOpen(false)
    setTeacherSearch('')
    setSelectedTeacherId('')
    router.push(`/sub-finder?teacher_id=${selectedTeacherId}`)
  }

  const getTeacherDisplayName = useCallback(
    (teacher: Staff) => {
      return (
        getStaffDisplayName(
          {
            first_name: teacher.first_name ?? '',
            last_name: teacher.last_name ?? '',
            display_name: teacher.display_name ?? null,
          },
          displayNameFormat
        ) || 'Unknown'
      )
    },
    [displayNameFormat]
  )

  const filteredTeachers = useMemo(() => {
    const query = teacherSearch.trim().toLowerCase()
    if (!query) return teachers
    return teachers.filter(teacher => {
      const name = getTeacherDisplayName(teacher)
      return name.toLowerCase().includes(query)
    })
  }, [teachers, teacherSearch, getTeacherDisplayName])

  const selectedTeacher = useMemo(() => {
    return teachers.find(t => t.id === selectedTeacherId)
  }, [teachers, selectedTeacherId])

  // Handle click outside to close dropdown
  useEffect(() => {
    if (!isTeacherDropdownOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (teacherSearchRef.current && !teacherSearchRef.current.contains(event.target as Node)) {
        setIsTeacherDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isTeacherDropdownOpen])

  // Reset search when popover closes
  useEffect(() => {
    if (!isFindSubPopoverOpen) {
      setTeacherSearch('')
      setIsTeacherDropdownOpen(false)
    }
  }, [isFindSubPopoverOpen])

  // Set mounted state after component mounts to prevent hydration errors with Radix UI
  useEffect(() => {
    setIsMounted(true)
  }, [])

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
                // Clear draft when opening fresh (not restoring from previous session)
                setClearDraftOnMount(true)
                setActivePanel('time-off')
                setIsTimeOffSheetOpen(true)
              }}
            >
              <CalendarPlus className="h-4 w-4 mr-2" />
              Add Time Off
            </Button>
            {isMounted ? (
              <Popover open={isFindSubPopoverOpen} onOpenChange={setIsFindSubPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-300 text-slate-700 hover:bg-slate-100"
                  >
                    <UserSearch className="h-4 w-4 mr-2" />
                    Find Sub
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="start">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm">Find sub for:</h3>
                    <div
                      ref={teacherSearchRef}
                      className="rounded-md border border-slate-200 bg-white"
                    >
                      <div className="border-b border-slate-100 px-2 py-1">
                        <Input
                          placeholder="Search or select a teacher..."
                          value={
                            selectedTeacher ? getTeacherDisplayName(selectedTeacher) : teacherSearch
                          }
                          onChange={event => {
                            const value = event.target.value
                            setTeacherSearch(value)
                            setIsTeacherDropdownOpen(true)
                            // Clear selection if user is typing
                            if (selectedTeacherId) {
                              setSelectedTeacherId('')
                            }
                          }}
                          onFocus={() => setIsTeacherDropdownOpen(true)}
                          onBlur={() => {
                            setTimeout(() => setIsTeacherDropdownOpen(false), 150)
                          }}
                          className="h-8 border-0 bg-slate-50 text-sm focus-visible:ring-0"
                        />
                      </div>
                      {isTeacherDropdownOpen && (
                        <div className="max-h-52 overflow-y-auto p-2">
                          {filteredTeachers.length === 0 ? (
                            <div className="p-2 text-xs text-muted-foreground">No matches</div>
                          ) : (
                            <div className="space-y-1">
                              {filteredTeachers.map(teacher => {
                                const name = getTeacherDisplayName(teacher)
                                return (
                                  <button
                                    key={teacher.id}
                                    type="button"
                                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-100"
                                    onClick={() => {
                                      setSelectedTeacherId(teacher.id)
                                      setTeacherSearch('')
                                      setIsTeacherDropdownOpen(false)
                                    }}
                                  >
                                    {name}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={handleFindSubGo}
                      disabled={!selectedTeacherId}
                      className="w-full"
                    >
                      Go
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="border-slate-300 text-slate-700 hover:bg-slate-100"
                disabled
              >
                <UserSearch className="h-4 w-4 mr-2" />
                Find Sub
              </Button>
            )}
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
              ref={timeOffFormRef}
              onSuccess={handleTimeOffSuccess}
              onCancel={() => handleCloseSheet(false)}
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
      <AssignSubPanel
        isOpen={isAssignSubPanelOpen}
        onClose={() => {
          setIsAssignSubPanelOpen(false)
          setActivePanel(null)
          setTimeout(() => {
            restorePreviousPanel()
          }, 100)
        }}
      />
    </header>
  )
}
