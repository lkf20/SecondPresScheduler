'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
import TimeOffForm from '@/components/time-off/TimeOffForm'
import AssignSubPanel from '@/components/assign-sub/AssignSubPanel'
import { getPanelBackgroundClasses, coverageColorValues } from '@/lib/utils/colors'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import DatePickerInput from '@/components/ui/date-picker-input'
import { Database } from '@/types/database'
import type { TimeOffCardData } from '@/lib/utils/time-off-card-data'
import { getTodayISO, getTomorrowISO } from '@/lib/utils/date'
import { formatAbsenceDateRange } from '@/lib/utils/date-format'
import { useDisplayNameFormat } from '@/lib/hooks/use-display-name-format'
import { getStaffDisplayName } from '@/lib/utils/staff-display-name'
import { ActivityFeed } from '@/components/activity/ActivityFeed'

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
  const [isActivitySheetOpen, setIsActivitySheetOpen] = useState(false)
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('')
  const [teachers, setTeachers] = useState<Staff[]>([])
  const [teacherSearch, setTeacherSearch] = useState('')
  const { format: displayNameFormat } = useDisplayNameFormat()
  const [isTeacherDropdownOpen, setIsTeacherDropdownOpen] = useState(false)
  const teacherSearchRef = useRef<HTMLDivElement | null>(null)
  // Find Sub: upcoming time off and date choice
  const [upcomingTimeOff, setUpcomingTimeOff] = useState<TimeOffCardData[] | null>(null)
  const [timeOffLoading, setTimeOffLoading] = useState(false)
  const [timeOffError, setTimeOffError] = useState(false)
  const [findSubDateChoice, setFindSubDateChoice] = useState<
    '' | 'today' | 'tomorrow' | 'custom' | 'existing'
  >('')
  const [findSubExistingAbsenceId, setFindSubExistingAbsenceId] = useState<string | null>(null)
  const [findSubCustomStart, setFindSubCustomStart] = useState('')
  const [findSubCustomEnd, setFindSubCustomEnd] = useState('')
  const findSubFetchedTeacherIdRef = useRef<string | null>(null)
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
    const today = getTodayISO()
    const tomorrow = getTomorrowISO()
    let startDate = today
    let endDate = today
    if (findSubDateChoice === 'existing' && findSubExistingAbsenceId) {
      setIsFindSubPopoverOpen(false)
      setTeacherSearch('')
      setSelectedTeacherId('')
      router.push(`/sub-finder?absence_id=${findSubExistingAbsenceId}`)
      return
    }
    if (findSubDateChoice === 'tomorrow') {
      startDate = tomorrow
      endDate = tomorrow
    } else if (findSubDateChoice === 'custom') {
      if (!findSubCustomStart) {
        toast.error('Please select a start date')
        return
      }
      startDate = findSubCustomStart
      endDate = findSubCustomEnd || findSubCustomStart
    }
    setIsFindSubPopoverOpen(false)
    setTeacherSearch('')
    setSelectedTeacherId('')
    router.push(
      `/sub-finder?mode=manual&teacher_id=${selectedTeacherId}&start_date=${startDate}&end_date=${endDate}`
    )
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

  const sortedUpcomingTimeOff = useMemo(() => {
    if (!upcomingTimeOff || upcomingTimeOff.length === 0) return []
    return [...upcomingTimeOff].sort((a, b) => a.start_date.localeCompare(b.start_date))
  }, [upcomingTimeOff])

  const hasValidFindSubDateChoice = useMemo(() => {
    if (findSubDateChoice === 'existing') return Boolean(findSubExistingAbsenceId)
    if (findSubDateChoice === 'today' || findSubDateChoice === 'tomorrow') return true
    if (findSubDateChoice === 'custom') return Boolean(findSubCustomStart)
    return false
  }, [findSubDateChoice, findSubExistingAbsenceId, findSubCustomStart])

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
      setUpcomingTimeOff(null)
      setTimeOffLoading(false)
      setTimeOffError(false)
      findSubFetchedTeacherIdRef.current = null
    }
  }, [isFindSubPopoverOpen])

  // Fetch upcoming time off when a teacher is selected in Find Sub popover
  useEffect(() => {
    if (!selectedTeacherId || !isFindSubPopoverOpen) return
    if (findSubFetchedTeacherIdRef.current === selectedTeacherId) return

    findSubFetchedTeacherIdRef.current = selectedTeacherId
    setFindSubDateChoice('')
    setFindSubExistingAbsenceId(null)
    setFindSubCustomStart('')
    setFindSubCustomEnd('')
    setTimeOffError(false)
    setTimeOffLoading(true)
    const todayISO = getTodayISO()
    const oneYearLater = new Date()
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)
    const endISO = oneYearLater.toISOString().slice(0, 10)

    fetch(
      `/api/time-off-requests?teacher_id=${selectedTeacherId}&start_date=${todayISO}&end_date=${endISO}&status=active`
    )
      .then(r => r.json())
      .then((body: { data?: TimeOffCardData[] }) => {
        const list = Array.isArray(body?.data) ? body.data : []
        const today = todayISO
        const upcoming = list.filter(item => {
          const end = item.end_date || item.start_date
          return end >= today
        })
        setUpcomingTimeOff(upcoming)
      })
      .catch(() => {
        setTimeOffError(true)
        setUpcomingTimeOff(null)
      })
      .finally(() => setTimeOffLoading(false))
  }, [selectedTeacherId, isFindSubPopoverOpen])

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
              <>
                {isFindSubPopoverOpen &&
                  createPortal(
                    <div
                      className="fixed top-16 left-0 right-0 bottom-0 z-40 bg-black/20"
                      aria-hidden
                      onClick={() => setIsFindSubPopoverOpen(false)}
                    />,
                    document.body
                  )}
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
                  <PopoverContent
                    className="w-[28rem] min-w-80 max-w-[calc(100vw-2rem)]"
                    align="start"
                  >
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
                              selectedTeacher
                                ? getTeacherDisplayName(selectedTeacher)
                                : teacherSearch
                            }
                            onChange={event => {
                              const value = event.target.value
                              setTeacherSearch(value)
                              setIsTeacherDropdownOpen(true)
                              if (selectedTeacherId) setSelectedTeacherId('')
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

                      {selectedTeacherId && (
                        <>
                          {timeOffLoading && (
                            <p className="text-sm text-muted-foreground">Checking time off…</p>
                          )}
                          {!timeOffLoading && selectedTeacher && (
                            <>
                              <div
                                className="rounded-md border border-slate-200 bg-slate-100 px-3 py-2"
                                role="status"
                              >
                                <p className="text-sm text-slate-700" aria-live="polite">
                                  {timeOffError
                                    ? "Couldn't load time off. You can still find subs for today."
                                    : upcomingTimeOff && upcomingTimeOff.length > 0
                                      ? `${getTeacherDisplayName(selectedTeacher)} has existing upcoming time off`
                                      : `${getTeacherDisplayName(selectedTeacher)} has no upcoming time off`}
                                </p>
                              </div>
                              <p className="font-semibold text-sm text-slate-800">
                                Select dates for sub
                              </p>
                              <RadioGroup
                                value={
                                  findSubDateChoice === 'existing'
                                    ? (findSubExistingAbsenceId ?? '')
                                    : findSubDateChoice === ''
                                      ? ''
                                      : findSubDateChoice
                                }
                                onValueChange={value => {
                                  if (
                                    value === 'today' ||
                                    value === 'tomorrow' ||
                                    value === 'custom'
                                  ) {
                                    setFindSubDateChoice(value)
                                    setFindSubExistingAbsenceId(null)
                                    if (value === 'today' || value === 'tomorrow') {
                                      setFindSubCustomStart('')
                                      setFindSubCustomEnd('')
                                    }
                                    if (value === 'custom' && !findSubCustomStart) {
                                      setFindSubCustomStart(getTodayISO())
                                      setFindSubCustomEnd(getTodayISO())
                                    }
                                  } else {
                                    setFindSubDateChoice('existing')
                                    setFindSubExistingAbsenceId(value)
                                  }
                                }}
                                className="space-y-2"
                                aria-label="Find sub for"
                              >
                                {upcomingTimeOff && upcomingTimeOff.length > 0 && (
                                  <>
                                    <p className="text-xs font-medium text-slate-500 pt-1 pb-0.5">
                                      Existing time off
                                    </p>
                                    {sortedUpcomingTimeOff.slice(0, 5).map(absence => (
                                      <div
                                        key={absence.id}
                                        className="flex items-center gap-2 space-y-0 flex-wrap"
                                      >
                                        <RadioGroupItem
                                          value={absence.id}
                                          id={`find-sub-absence-${absence.id}`}
                                        />
                                        <Label
                                          htmlFor={`find-sub-absence-${absence.id}`}
                                          className="cursor-pointer text-sm font-normal flex-1 min-w-0"
                                        >
                                          {formatAbsenceDateRange(
                                            absence.start_date,
                                            absence.end_date
                                          )}
                                        </Label>
                                        {absence.uncovered === 0 ? (
                                          <span
                                            className="shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
                                            style={{
                                              backgroundColor: coverageColorValues.covered.bg,
                                              color: coverageColorValues.covered.text,
                                              borderColor: coverageColorValues.covered.border,
                                              borderWidth: 1,
                                              borderStyle: 'solid',
                                            }}
                                          >
                                            Covered
                                          </span>
                                        ) : (
                                          <span
                                            className="shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
                                            style={{
                                              backgroundColor: coverageColorValues.uncovered.bg,
                                              color: coverageColorValues.uncovered.text,
                                              borderColor: coverageColorValues.uncovered.border,
                                              borderWidth: 1,
                                              borderStyle: 'solid',
                                            }}
                                          >
                                            {absence.uncovered}/{absence.total} uncovered
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                    {sortedUpcomingTimeOff.length > 5 && (
                                      <p className="text-xs text-muted-foreground pl-6">
                                        +{sortedUpcomingTimeOff.length - 5} more
                                      </p>
                                    )}
                                    <p className="text-xs font-medium text-slate-500 pt-1 pb-0.5">
                                      Different dates
                                    </p>
                                  </>
                                )}
                                <div className="flex items-center gap-2 space-y-0">
                                  <RadioGroupItem value="today" id="find-sub-today" />
                                  <Label
                                    htmlFor="find-sub-today"
                                    className="cursor-pointer text-sm font-normal"
                                  >
                                    Today
                                  </Label>
                                </div>
                                <div className="flex items-center gap-2 space-y-0">
                                  <RadioGroupItem value="tomorrow" id="find-sub-tomorrow" />
                                  <Label
                                    htmlFor="find-sub-tomorrow"
                                    className="cursor-pointer text-sm font-normal"
                                  >
                                    Tomorrow
                                  </Label>
                                </div>
                                <div className="flex items-center gap-2 space-y-0">
                                  <RadioGroupItem value="custom" id="find-sub-custom" />
                                  <Label
                                    htmlFor="find-sub-custom"
                                    className="cursor-pointer text-sm font-normal"
                                  >
                                    Custom date range
                                  </Label>
                                </div>
                                {findSubDateChoice === 'custom' && (
                                  <div className="pl-6 space-y-2 border-l-2 border-slate-200 ml-1">
                                    <div>
                                      <Label className="text-xs">Start date</Label>
                                      <DatePickerInput
                                        value={findSubCustomStart}
                                        onChange={v => {
                                          setFindSubCustomStart(v)
                                          if (findSubCustomEnd && v > findSubCustomEnd) {
                                            setFindSubCustomEnd(v)
                                          }
                                        }}
                                        placeholder="Select start date"
                                        className="mt-1 h-8 text-sm"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs">End date</Label>
                                      <DatePickerInput
                                        value={findSubCustomEnd}
                                        onChange={setFindSubCustomEnd}
                                        placeholder="Select end date"
                                        className="mt-1 h-8 text-sm"
                                      />
                                    </div>
                                  </div>
                                )}
                              </RadioGroup>
                            </>
                          )}
                          <Button
                            onClick={handleFindSubGo}
                            disabled={
                              !selectedTeacherId || timeOffLoading || !hasValidFindSubDateChoice
                            }
                            className="w-full"
                          >
                            Go
                          </Button>
                        </>
                      )}

                      {!selectedTeacherId && (
                        <Button disabled className="w-full">
                          Go
                        </Button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </>
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
            <ActivityFeed className="min-h-[calc(100vh-170px)]" />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
