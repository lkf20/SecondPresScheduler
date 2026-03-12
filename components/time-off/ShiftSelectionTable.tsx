'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface ScheduledShift {
  date: string
  day_of_week_id: string
  day_name: string
  day_number: number
  time_slot_id: string
  time_slot_code: string
  time_slot_name: string | null
}

export interface SelectedShift {
  date: string
  day_of_week_id: string
  time_slot_id: string
}

interface ExistingTimeOffShift {
  date: string
  time_slot_id: string
  time_off_request_id: string
  time_off_requests: {
    id: string
    start_date: string
    end_date: string | null
    reason: string | null
    teacher_id: string
  }
}

interface ShiftSelectionTableProps {
  teacherId: string | null
  startDate: string
  endDate: string | null // End date can be null/optional
  selectedShifts: SelectedShift[]
  onShiftsChange: (shifts: SelectedShift[]) => void
  onConflictSummaryChange?: (summary: { conflictCount: number; totalScheduled: number }) => void
  onConflictRequestsChange?: (
    requests: Array<{
      id: string
      start_date: string
      end_date: string | null
      reason: string | null
    }>
  ) => void
  onConflictShiftsChange?: (shifts: SelectedShift[]) => void
  /** Called when the conflict check (scheduled + existing time off when validateConflicts) has finished. Use to avoid showing "no time off" UI or enabling Find Subs until ready. */
  onConflictCheckReady?: (ready: boolean) => void
  excludeRequestId?: string
  validateConflicts?: boolean
  disabled?: boolean
  tableClassName?: string
  autoSelectScheduled?: boolean
}

export default function ShiftSelectionTable({
  teacherId,
  startDate,
  endDate,
  selectedShifts,
  onShiftsChange,
  onConflictSummaryChange,
  onConflictRequestsChange,
  onConflictShiftsChange,
  onConflictCheckReady,
  excludeRequestId,
  validateConflicts = false,
  disabled = false,
  tableClassName,
  autoSelectScheduled = false,
}: ShiftSelectionTableProps) {
  const [scheduledShifts, setScheduledShifts] = useState<ScheduledShift[]>([])
  const [existingTimeOffShifts, setExistingTimeOffShifts] = useState<ExistingTimeOffShift[]>([])
  const [conflictingRequests, setConflictingRequests] = useState<
    Array<{ id: string; start_date: string; end_date: string | null; reason: string | null }>
  >([])
  const [loading, setLoading] = useState(true)
  const [existingTimeOffLoading, setExistingTimeOffLoading] = useState(false)
  const [timeSlots, setTimeSlots] = useState<
    Array<{ id: string; code: string; name: string | null }>
  >([])
  const hasSetDefaultRecordedRef = useRef(false)

  // Fetch time slots
  useEffect(() => {
    fetch('/api/timeslots')
      .then(r => r.json())
      .then(data => {
        const typedData = data as Array<{
          id: string
          code: string
          name: string | null
          display_order?: number | null
        }>
        setTimeSlots(typedData.sort((a, b) => (a.display_order || 0) - (b.display_order || 0)))
      })
      .catch(console.error)
  }, [])

  // Helper function to normalize dates to YYYY-MM-DD format
  const normalizeDate = useCallback((d: string) => {
    if (!d) return ''
    if (d.match(/^\d{4}-\d{2}-\d{2}$/)) return d
    try {
      const parsed = new Date(d)
      return parsed.toISOString().split('T')[0]
    } catch {
      return d
    }
  }, [])

  const buildShiftKey = useCallback(
    (date: string, timeSlotId: string) => `${normalizeDate(date)}::${timeSlotId}`,
    [normalizeDate]
  )

  // Fetch scheduled shifts when teacher and dates change (NOT when disabled changes)
  useEffect(() => {
    if (!teacherId) {
      queueMicrotask(() => {
        setScheduledShifts([])
        setLoading(false)
      })
      return
    }

    // If no start date, don't fetch
    if (!startDate) {
      queueMicrotask(() => {
        setScheduledShifts([])
        setLoading(false)
      })
      return
    }

    // If endDate is not provided, use startDate (single day)
    const effectiveEndDate = endDate || startDate

    setLoading(true)
    fetch(
      `/api/teachers/${teacherId}/scheduled-shifts?start_date=${startDate}&end_date=${effectiveEndDate}`,
      { cache: 'no-store' }
    )
      .then(r => r.json())
      .then(data => {
        const shifts = data || []
        setScheduledShifts(shifts)
      })
      .catch(error => {
        console.error('[ShiftSelectionTable] Error fetching scheduled shifts:', error)
        setScheduledShifts([])
      })
      .finally(() => setLoading(false))
  }, [teacherId, startDate, endDate]) // Remove 'disabled' and 'onShiftsChange' from dependencies

  useEffect(() => {
    if (!validateConflicts) {
      queueMicrotask(() => {
        setExistingTimeOffShifts([])
        setConflictingRequests([])
        setExistingTimeOffLoading(false)
      })
      return
    }

    if (!teacherId || !startDate) {
      queueMicrotask(() => {
        setExistingTimeOffShifts([])
        setConflictingRequests([])
        setExistingTimeOffLoading(false)
      })
      return
    }

    setExistingTimeOffLoading(true)
    const effectiveEndDate = endDate || startDate
    const params = new URLSearchParams({
      teacher_id: teacherId,
      start_date: startDate,
      end_date: effectiveEndDate,
    })
    if (excludeRequestId) {
      params.set('exclude_request_id', excludeRequestId)
    }
    // Cache-bust so we always get fresh data after time off edits (e.g. on Time Off page)
    params.set('_', String(Date.now()))

    fetch(`/api/time-off/existing-shifts?${params.toString()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        const shifts = Array.isArray(data.shifts) ? data.shifts : []
        setExistingTimeOffShifts(shifts)
        const requestMap = new Map<
          string,
          { id: string; start_date: string; end_date: string | null; reason: string | null }
        >()
        shifts.forEach((shift: ExistingTimeOffShift) => {
          const request = shift.time_off_requests
          if (request) {
            requestMap.set(request.id, {
              id: request.id,
              start_date: request.start_date,
              end_date: request.end_date,
              reason: request.reason,
            })
          }
        })
        const requests = Array.from(requestMap.values()).sort((a, b) =>
          a.start_date.localeCompare(b.start_date)
        )
        setConflictingRequests(requests)
      })
      .catch(error => {
        console.error('Error fetching existing time off shifts:', error)
        setExistingTimeOffShifts([])
        setConflictingRequests([])
      })
      .finally(() => setExistingTimeOffLoading(false))
  }, [teacherId, startDate, endDate, excludeRequestId, validateConflicts])

  const conflictShiftKeys = useMemo(() => {
    if (!validateConflicts) {
      return new Set<string>()
    }
    return new Set(
      existingTimeOffShifts.map(shift => buildShiftKey(shift.date, shift.time_slot_id))
    )
  }, [buildShiftKey, existingTimeOffShifts, validateConflicts])

  // When selection is empty and we have recorded time-off shifts, select them by default (once per mount).
  useEffect(() => {
    if (
      !validateConflicts ||
      selectedShifts.length > 0 ||
      conflictShiftKeys.size === 0 ||
      scheduledShifts.length === 0 ||
      hasSetDefaultRecordedRef.current
    ) {
      return
    }
    const defaultRecorded = scheduledShifts
      .filter(shift => conflictShiftKeys.has(buildShiftKey(shift.date, shift.time_slot_id)))
      .map(shift => ({
        date: normalizeDate(shift.date),
        day_of_week_id: shift.day_of_week_id,
        time_slot_id: shift.time_slot_id,
      }))
    if (defaultRecorded.length > 0) {
      onShiftsChange(defaultRecorded)
      hasSetDefaultRecordedRef.current = true
    }
  }, [
    validateConflicts,
    selectedShifts.length,
    conflictShiftKeys,
    scheduledShifts,
    onShiftsChange,
    buildShiftKey,
    normalizeDate,
  ])

  // Auto-select all scheduled shifts for read-only or "select all" modes (including recorded).
  useEffect(() => {
    if ((disabled || autoSelectScheduled) && scheduledShifts.length > 0) {
      const allShifts = scheduledShifts.map((shift: ScheduledShift) => ({
        date: normalizeDate(shift.date),
        day_of_week_id: shift.day_of_week_id,
        time_slot_id: shift.time_slot_id,
      }))
      onShiftsChange(allShifts)
    }
    // Note: When switching to "select_shifts" mode (disabled=false), we keep the current selectedShifts
    // so no action needed here
  }, [autoSelectScheduled, disabled, scheduledShifts, onShiftsChange, buildShiftKey, normalizeDate])

  const conflictCount = scheduledShifts.filter(shift =>
    conflictShiftKeys.has(buildShiftKey(shift.date, shift.time_slot_id))
  ).length

  const conflictCheckReady = !loading && (!validateConflicts || !existingTimeOffLoading)

  useEffect(() => {
    onConflictCheckReady?.(conflictCheckReady)
  }, [conflictCheckReady, onConflictCheckReady])

  useEffect(() => {
    if (onConflictSummaryChange) {
      onConflictSummaryChange({ conflictCount, totalScheduled: scheduledShifts.length })
    }
  }, [conflictCount, scheduledShifts.length, onConflictSummaryChange])

  useEffect(() => {
    if (onConflictRequestsChange) {
      onConflictRequestsChange(conflictingRequests)
    }
  }, [conflictingRequests, onConflictRequestsChange])

  useEffect(() => {
    if (onConflictShiftsChange && scheduledShifts.length > 0) {
      const conflictShifts = scheduledShifts
        .filter(shift => conflictShiftKeys.has(buildShiftKey(shift.date, shift.time_slot_id)))
        .map(shift => ({
          date: normalizeDate(shift.date),
          day_of_week_id: shift.day_of_week_id,
          time_slot_id: shift.time_slot_id,
        }))
      onConflictShiftsChange(conflictShifts)
    }
  }, [scheduledShifts, conflictShiftKeys, buildShiftKey, normalizeDate, onConflictShiftsChange])

  // Group shifts by date
  const shiftsByDate = scheduledShifts.reduce(
    (acc, shift) => {
      if (!acc[shift.date]) {
        acc[shift.date] = {
          date: shift.date,
          day_name: shift.day_name,
          shifts: [],
        }
      }
      acc[shift.date].shifts.push(shift)
      return acc
    },
    {} as Record<string, { date: string; day_name: string; shifts: ScheduledShift[] }>
  )

  const formatDate = (dateStr: string, dayName?: string) => {
    // Parse date string directly to avoid timezone issues
    // dateStr is in YYYY-MM-DD format
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    const monthName = date.toLocaleString('default', { month: 'short' })
    // If dayName is provided, show "Mon Jan 26" format, otherwise just "Jan 26"
    if (dayName) {
      return `${dayName.slice(0, 3)} ${monthName} ${day}`
    }
    return `${monthName} ${day}`
  }

  /** Two-line date for narrow columns: "Wed" / "Apr 29" */
  const formatDateTwoLines = (dateStr: string, dayName?: string) => {
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    const monthName = date.toLocaleString('default', { month: 'short' })
    const line1 = dayName
      ? dayName.slice(0, 3)
      : date.toLocaleString('default', { weekday: 'short' })
    const line2 = `${monthName} ${day}`
    return { line1, line2 }
  }

  const isShiftSelected = (date: string, timeSlotId: string) => {
    // Normalize dates to YYYY-MM-DD format for comparison
    const normalizeDate = (d: string) => {
      if (!d) return ''
      // If date is already in YYYY-MM-DD format, return as is
      if (d.match(/^\d{4}-\d{2}-\d{2}$/)) return d
      // Otherwise, try to parse and format
      try {
        const parsed = new Date(d)
        return parsed.toISOString().split('T')[0]
      } catch {
        return d
      }
    }

    const normalizedDate = normalizeDate(date)
    return selectedShifts.some(
      s => normalizeDate(s.date) === normalizedDate && s.time_slot_id === timeSlotId
    )
  }

  const isShiftScheduled = (date: string, timeSlotId: string) => {
    // Normalize dates for comparison (same logic as isShiftSelected)
    const normalizeDate = (d: string) => {
      if (!d) return ''
      if (d.match(/^\d{4}-\d{2}-\d{2}$/)) return d
      try {
        const parsed = new Date(d)
        return parsed.toISOString().split('T')[0]
      } catch {
        return d
      }
    }

    const normalizedDate = normalizeDate(date)
    return scheduledShifts.some(
      s => normalizeDate(s.date) === normalizedDate && s.time_slot_id === timeSlotId
    )
  }

  const handleShiftToggle = (date: string, dayOfWeekId: string, timeSlotId: string) => {
    if (disabled) return

    const isSelected = isShiftSelected(date, timeSlotId)
    let newShifts: SelectedShift[]

    if (isSelected) {
      newShifts = selectedShifts.filter(s => !(s.date === date && s.time_slot_id === timeSlotId))
    } else {
      newShifts = [
        ...selectedShifts,
        { date, day_of_week_id: dayOfWeekId, time_slot_id: timeSlotId },
      ]
    }

    onShiftsChange(newShifts)
  }

  // Show placeholder when teacher or start date is missing
  if (!teacherId || !startDate) {
    let message = ''
    if (!teacherId && !startDate) {
      message = 'Select a teacher and start date to preview scheduled shifts.'
    } else if (!teacherId) {
      message = 'Select a teacher to preview scheduled shifts.'
    } else {
      message = 'Select a start date to preview scheduled shifts.'
    }

    return (
      <div className="rounded-md border">
        <Table className={tableClassName}>
          <TableHeader>
            <TableRow>
              <TableHead>Day</TableHead>
              {timeSlots.map(slot => (
                <TableHead key={slot.id} className="text-center px-2">
                  {slot.code}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell
                colSpan={timeSlots.length + 1}
                className="text-center py-8 text-muted-foreground"
              >
                {message}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="rounded-md border">
        <Table className={tableClassName}>
          <TableHeader>
            <TableRow>
              <TableHead>Day</TableHead>
              {timeSlots.map(slot => (
                <TableHead key={slot.id} className="text-center px-2">
                  {slot.code}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell
                colSpan={timeSlots.length + 1}
                className="text-center py-8 text-muted-foreground"
              >
                Loading shifts...
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    )
  }

  if (Object.keys(shiftsByDate).length === 0) {
    return (
      <div className="rounded-md border">
        <Table className={tableClassName}>
          <TableHeader>
            <TableRow>
              <TableHead>Day</TableHead>
              {timeSlots.map(slot => (
                <TableHead key={slot.id} className="text-center px-2">
                  {slot.code}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell
                colSpan={timeSlots.length + 1}
                className="text-center py-8 text-muted-foreground"
              >
                <div>No scheduled shifts found for this teacher in the selected date range.</div>
                <div className="text-xs text-muted-foreground mt-2">
                  Try expanding the date range or check the teacher’s schedule settings.
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table className={cn(tableClassName, 'min-w-[min-content]')}>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Day</TableHead>
            {timeSlots.map(slot => (
              <TableHead key={slot.id} className="text-center px-2 whitespace-nowrap">
                {slot.code}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.values(shiftsByDate)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(dayGroup => {
              const { line1, line2 } = formatDateTwoLines(dayGroup.date, dayGroup.day_name)
              return (
                <TableRow key={dayGroup.date}>
                  <TableCell className="font-medium align-middle py-2 whitespace-nowrap">
                    <span className="inline-block leading-tight text-center">{line1}</span>
                    <span className="block text-muted-foreground text-xs leading-tight">
                      {line2}
                    </span>
                  </TableCell>
                  {timeSlots.map(slot => {
                    const isScheduled = isShiftScheduled(dayGroup.date, slot.id)
                    const isRecorded = conflictShiftKeys.has(buildShiftKey(dayGroup.date, slot.id))
                    const isSelected = isShiftSelected(dayGroup.date, slot.id)
                    const shift = dayGroup.shifts.find(s => s.time_slot_id === slot.id)
                    const dayOfWeekId = shift?.day_of_week_id || ''

                    return (
                      <TableCell
                        key={slot.id}
                        className="text-center px-2 min-w-[2.25rem] [&:has([role=checkbox])]:pr-2 [&:has([role=checkbox])]:pl-2"
                      >
                        {isScheduled ? (
                          <div
                            className={cn(
                              'relative h-full w-full min-h-[36px]',
                              isRecorded && 'min-h-[40px]'
                            )}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() =>
                                handleShiftToggle(dayGroup.date, dayOfWeekId, slot.id)
                              }
                              disabled={disabled}
                              tabIndex={-1}
                              className={cn(
                                'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
                                isRecorded &&
                                  'border-yellow-600 data-[state=checked]:bg-yellow-600 data-[state=checked]:text-white'
                              )}
                            />
                            <span
                              title="Already recorded"
                              className={cn(
                                'absolute left-1/2 top-[calc(50%+10px)] -translate-x-1/2 text-[10px] text-yellow-600 italic leading-tight text-center whitespace-nowrap',
                                !isRecorded && 'opacity-0'
                              )}
                            >
                              Recorded
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center">
                            <Checkbox
                              checked={false}
                              disabled
                              className="opacity-30"
                              tabIndex={-1}
                            />
                          </div>
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              )
            })}
        </TableBody>
      </Table>
    </div>
  )
}
