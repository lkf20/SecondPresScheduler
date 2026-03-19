'use client'

import React, { useCallback, useState, useMemo, useEffect, useRef, startTransition } from 'react'
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import ScheduleGridCellCard from './ScheduleGridCellCard'
import ScheduleSidePanel from './ScheduleSidePanel'
import type { WeeklyScheduleData, WeeklyScheduleDataByClassroom } from '@/lib/api/weekly-schedule'
import { usePanelManager } from '@/lib/contexts/PanelManagerContext'
import { getSlotCoverageTotalWeekly } from '@/lib/schedules/coverage-weights'
import { getSlotRequiredPreferred } from '@/lib/schedules/schedule-filter-data'
import { parseLocalDate } from '@/lib/utils/date'
import { isCellClosed, getMatchingClosure } from '@/lib/utils/school-closures'
import { isSlotEffectivelyInactive } from '@/lib/utils/schedule-slot-activity'
import { SCHEDULE_INACTIVE_LEGEND_DOT_CLASS } from '@/lib/ui/schedule-inactive-tokens'

interface SchoolClosureForGrid {
  date: string
  time_slot_id: string | null
}

interface WeeklyScheduleGridNewProps {
  data: WeeklyScheduleDataByClassroom[]
  selectedDayIds: string[]
  weekStartISO?: string
  layout: 'classrooms-x-days' | 'days-x-classrooms'
  onRefresh?: () => void | Promise<void>
  onFilterPanelOpenChange?: (open: boolean) => void
  filterPanelOpen?: boolean
  initialSelectedCell?: {
    classroomId: string
    dayId: string
    timeSlotId: string
  } | null
  allowCardClick?: boolean // If false, cards are not clickable (default: true)
  displayMode?:
    | 'permanent-only'
    | 'permanent-flexible'
    | 'substitutes-only'
    | 'all-scheduled-staff'
    | 'coverage-issues'
    | 'absences'
  /** When true, show cell notes at the bottom (from Views & Filters > Show notes) */
  showNotes?: boolean
  onDisplayModeChange?: (
    mode:
      | 'permanent-only'
      | 'permanent-flexible'
      | 'substitutes-only'
      | 'all-scheduled-staff'
      | 'coverage-issues'
      | 'absences'
  ) => void
  // Optional: provide counts computed from the unfiltered (base) dataset so chip counts
  // don't change when a displayMode is selected.
  displayModeCounts?: {
    all: number
    permanent: number
    coverageIssues: number
    absences: number
    subs: number
  }
  slotCounts?: { shown: number; total: number } // Slot counts for display
  showLegendSubstitutes?: boolean
  /** When false (e.g. Baseline), legend omits overlay items: Substitute, Absent, Temporary Coverage. Default true for Weekly. */
  showLegendTemporaryCoverage?: boolean
  showFilterChips?: boolean
  /** Rendered below the Key (e.g. Views & Filters + slot count on Baseline). Matches Weekly layout. */
  contentBelowLegend?: React.ReactNode
  readOnly?: boolean
  /** When true, Save button shows "Save & Return to Weekly Schedule" and parent onRefresh may navigate back */
  returnToWeekly?: boolean
  /** When false, side panel header omits calendar date (Baseline only). Default true (Weekly shows date). */
  showDateInHeader?: boolean
  /** Renders to the left of filter chips (e.g. Views & Filters button). Only used when showFilterChips is true. */
  leadingFilterContent?: React.ReactNode
  /** Renders on the right side of the filter row (e.g. Manage Calendar). Only used when showFilterChips is true. */
  trailingFilterContent?: React.ReactNode
  /** Renders immediately to the left of "Showing X of Y slots". Only used when showFilterChips is true and slotCounts is set. */
  contentBeforeSlotCount?: React.ReactNode
  /** School closures for the displayed week; used to render "School Closed" on closed cells. */
  schoolClosures?: Array<{
    id: string
    date: string
    time_slot_id: string | null
    reason?: string | null
  }>
  /** Called when user marks a closure as open (deletes it). */
  onClosureMarkOpen?: (closureId: string) => void | Promise<void>
  /** Called when user marks the whole day open (deletes whole-day closure for date). */
  onClosureMarkOpenForDay?: (date: string) => void | Promise<void>
  /** Called when user changes a closure's reason. */
  onClosureChangeReason?: (closureId: string, newReason: string) => void | Promise<void>
  /** Day IDs selected in Settings (Days & Time slots). Used for Apply Changes to day checkboxes only. */
  scheduleDayIdsFromSettings?: string[]
}

type WeeklyScheduleCellData = WeeklyScheduleData & {
  time_slot_is_active?: boolean
  schedule_cell: WeeklyScheduleDataByClassroom['days'][number]['time_slots'][number]['schedule_cell']
  absences?: Array<{
    teacher_id: string
    teacher_name: string
    has_sub: boolean
    is_partial: boolean
    is_reassigned?: boolean
  }>
}

// Helper function to convert hex color to rgba with opacity
export function hexToRgba(hex: string, opacity: number = 0.08): string {
  // Remove # if present
  const cleanHex = hex.replace('#', '')

  // Parse RGB values
  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)

  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

// Helper function to generate grid template for days-x-classrooms layout
// daysWithTimeSlots: per-day time slots so we can collapse empty time-slot rows (e.g. when filtering by teacher)
export function generateDaysXClassroomsGridTemplate(
  classroomCount: number,
  daysWithTimeSlots: Array<{
    day: { id: string; name: string; number: number }
    timeSlots: Array<{ id: string; code: string }>
  }>
): { columns: string; rows: string } {
  // Columns: Combined Day/Time (120px) + fixed classroom columns.
  // Keep columns fixed so selecting fewer classrooms makes the grid narrower
  // instead of stretching each column.
  const columns = `120px repeat(${classroomCount}, 220px)`

  // Rows: Header (auto) + (Spacer row + Day header + time slots for each day) — time slot count per day can differ
  const dayRows = daysWithTimeSlots
    .map(({ timeSlots }, dayIndex) => {
      const spacerRow = dayIndex === 0 ? '' : '16px' // Add spacer before each day except the first
      const dayHeaderRow = '36px' // Fixed small height for day headers (accommodates padding + text)
      const timeSlotRows = timeSlots.map(() => 'minmax(120px, auto)').join(' ')
      return dayIndex === 0
        ? `${dayHeaderRow} ${timeSlotRows}`
        : `${spacerRow} ${dayHeaderRow} ${timeSlotRows}`
    })
    .join(' ')

  const rows = `auto ${dayRows}`

  return { columns, rows }
}

// Helper function to generate grid template for classrooms-x-days layout
export function generateClassroomsXDaysGridTemplate(
  dayCount: number,
  timeSlotCount: number,
  classroomCount: number
): { columns: string; rows: string } {
  // Columns: Classroom (110px - reduced to fit "Kindergarten" while saving space) + (Day columns: each day has timeSlotCount columns)
  // Column width: 220px (card fills cell; columnGap on grid provides spacing).
  const dayColumns = Array(dayCount).fill(`repeat(${timeSlotCount}, 220px)`).join(' ')
  const columns = `110px ${dayColumns}`

  // Rows: 2 header rows + 1 row per classroom (must match number of data rows to avoid implicit rows and overlap)
  const rows = `auto auto repeat(${classroomCount > 0 ? classroomCount : '0'}, minmax(120px, auto))`

  return { columns, rows }
}

function ScheduleLegend({
  showLegendSubstitutes,
  showLegendTemporaryCoverage = true,
  showSchoolClosed = false,
  showPartialSub = false,
  showReassigned = false,
  noWrapper = false,
}: {
  showLegendSubstitutes: boolean
  showLegendTemporaryCoverage?: boolean
  showSchoolClosed?: boolean
  /** Show "Partial Sub Coverage" legend item when partial assignments exist in the displayed week */
  showPartialSub?: boolean
  /** Show "Reassigned" legend item when at least one reassigned source chip is present */
  showReassigned?: boolean
  noWrapper?: boolean
}) {
  const content = (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-gray-700">Key:</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300"
          style={{ borderColor: '#93c5fd' }}
        >
          Permanent Teacher
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-500 border-dashed"
          style={{ borderColor: '#3b82f6' }}
        >
          Flex Teacher
        </span>
      </div>
      {showLegendTemporaryCoverage && (
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border border-dashed"
            style={{
              borderColor: '#f9a8d4',
              backgroundColor: '#fdf2f8',
              color: '#db2777',
            }}
          >
            Temporary Coverage
          </span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300 border-dashed">
          Floater
        </span>
      </div>
      {showLegendSubstitutes && (
        <>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-600 border border-teal-200">
              Substitute
            </span>
          </div>
          {showPartialSub && (
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border border-dashed"
                style={{
                  borderColor: '#F59E0B',
                  backgroundColor: '#FEF3C7',
                  color: '#92400E',
                }}
              >
                Partial Sub Coverage
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
              Absent
            </span>
          </div>
          {showReassigned && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-700 border border-gray-400">
                Reassigned *
              </span>
            </div>
          )}
        </>
      )}
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <span className="text-gray-600">Meets preferred</span>
      </div>
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-700" />
        <span className="text-gray-600">Below preferred</span>
      </div>
      <div className="flex items-center gap-2">
        <XCircle className="h-4 w-4 text-red-600" />
        <span className="text-gray-600">Below required</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={SCHEDULE_INACTIVE_LEGEND_DOT_CLASS} />
        <span className="text-gray-600">Inactive</span>
      </div>
      {showSchoolClosed && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            School Closed
          </span>
        </div>
      )}
    </div>
  )
  if (noWrapper) return content
  return <div className="mb-6 p-3 bg-gray-100 rounded-md border border-gray-200">{content}</div>
}
export function calculateAssignmentCounts(data: WeeklyScheduleDataByClassroom[]) {
  let allCount = 0
  let permanentCount = 0
  let subsCount = 0
  let coverageIssuesCount = 0
  let absencesCount = 0

  data.forEach(classroom => {
    classroom.days.forEach(day => {
      day.time_slots.forEach(slot => {
        slot.assignments.forEach(assignment => {
          allCount++
          if (assignment.teacher_id && !assignment.is_floater) {
            permanentCount++
          }
        })

        const hasSubstitute = slot.assignments.some(a => a.is_substitute === true)
        if (hasSubstitute) {
          subsCount++
        }

        if ((slot.absences ?? []).some(absence => absence.is_reassigned !== true)) {
          absencesCount++
        }

        const scheduleCell = slot.schedule_cell
        if (scheduleCell?.is_active) {
          const thresholds = getSlotRequiredPreferred(slot)
          if (thresholds) {
            const coverageTotal = getSlotCoverageTotalWeekly(slot)
            const belowRequired =
              thresholds.required !== undefined && coverageTotal < thresholds.required
            const belowPreferred =
              thresholds.preferred !== undefined && coverageTotal < thresholds.preferred
            if (belowRequired || belowPreferred) {
              coverageIssuesCount++
            }
          }
        }
      })
    })
  })

  return {
    all: allCount,
    subs: subsCount,
    permanent: permanentCount,
    coverageIssues: coverageIssuesCount,
    absences: absencesCount,
  }
}

export type TimeSlotInfo = {
  id: string
  code: string
  name: string | null
  display_order: number | null
  default_start_time: string | null
  default_end_time: string | null
  is_active: boolean
}

export function extractDaysAndTimeSlots(
  data: WeeklyScheduleDataByClassroom[],
  selectedDayIds: string[]
) {
  const daySet = new Map<string, { id: string; name: string; number: number }>()
  const timeSlotSet = new Map<string, TimeSlotInfo>()
  /** Per-day time slots: only slots that appear in the data for that day (so empty rows can be collapsed) */
  const timeSlotsByDayMap = new Map<string, Map<string, TimeSlotInfo>>()

  const daysToProcess = selectedDayIds.length > 0 ? selectedDayIds : []

  data.forEach(classroom => {
    classroom.days.forEach(day => {
      if (daysToProcess.length === 0 || !daysToProcess.includes(day.day_of_week_id)) {
        return
      }

      if (!daySet.has(day.day_of_week_id)) {
        daySet.set(day.day_of_week_id, {
          id: day.day_of_week_id,
          name: day.day_name,
          number: day.day_number,
        })
      }
      if (!timeSlotsByDayMap.has(day.day_of_week_id)) {
        timeSlotsByDayMap.set(day.day_of_week_id, new Map())
      }
      const dayTimeSlots = timeSlotsByDayMap.get(day.day_of_week_id)!

      day.time_slots.forEach(slot => {
        const info: TimeSlotInfo = {
          id: slot.time_slot_id,
          code: slot.time_slot_code,
          name: slot.time_slot_name,
          display_order: slot.time_slot_display_order,
          default_start_time: null,
          default_end_time: null,
          is_active: slot.time_slot_is_active !== false,
        }
        if (!timeSlotSet.has(slot.time_slot_id)) {
          timeSlotSet.set(slot.time_slot_id, info)
        }
        if (!dayTimeSlots.has(slot.time_slot_id)) {
          dayTimeSlots.set(slot.time_slot_id, info)
        }
      })
    })
  })

  const days = Array.from(daySet.values())
    .filter(day => {
      if (selectedDayIds.length > 0) {
        return selectedDayIds.includes(day.id)
      }
      return false
    })
    .sort((a, b) => {
      const aNum = a.number === 0 ? 7 : a.number
      const bNum = b.number === 0 ? 7 : b.number
      return aNum - bNum
    })

  const timeSlots = Array.from(timeSlotSet.values()).sort((a, b) => {
    const orderA = a.display_order ?? 999
    const orderB = b.display_order ?? 999
    return orderA - orderB
  })

  /** For each day, time slots that have at least one cell in the data (sorted by display_order). Used to collapse empty time-slot rows. */
  const timeSlotsByDay = new Map<string, TimeSlotInfo[]>()
  days.forEach(day => {
    const slotMap = timeSlotsByDayMap.get(day.id)
    const list = slotMap
      ? Array.from(slotMap.values()).sort((a, b) => {
          const orderA = a.display_order ?? 999
          const orderB = b.display_order ?? 999
          return orderA - orderB
        })
      : []
    timeSlotsByDay.set(day.id, list)
  })

  return { days, timeSlots, timeSlotsByDay }
}

export function resolveTimeSlotPresentation({
  timeSlots,
  data,
  timeSlotId,
  fallbackName,
}: {
  timeSlots: Array<{
    id: string
    code: string
    name: string | null
    default_start_time: string | null
    default_end_time: string | null
  }>
  data: WeeklyScheduleDataByClassroom[]
  timeSlotId: string
  fallbackName?: string
}) {
  const timeSlot = timeSlots.find(ts => ts.id === timeSlotId)
  const timeSlotFromData = data
    .flatMap(c => c.days)
    .flatMap(d => d.time_slots)
    .find(ts => ts.time_slot_id === timeSlotId)

  const code = timeSlot?.code || timeSlotFromData?.time_slot_code || ''
  const name = timeSlot?.name || timeSlotFromData?.time_slot_name || fallbackName || code
  return {
    code,
    name: name || '',
    startTime: timeSlot?.default_start_time || null,
    endTime: timeSlot?.default_end_time || null,
  }
}

export function buildSelectedCellSnapshot(
  data: WeeklyScheduleDataByClassroom[],
  cell: { dayId: string; classroomId: string; timeSlotId: string }
) {
  const classroom = data.find(c => c.classroom_id === cell.classroomId)
  if (!classroom) return undefined

  const day = classroom.days.find(d => d.day_of_week_id === cell.dayId)
  if (!day) return undefined

  const timeSlot = day.time_slots.find(ts => ts.time_slot_id === cell.timeSlotId)
  if (!timeSlot) return undefined

  return {
    day_of_week_id: day.day_of_week_id,
    day_name: day.day_name,
    day_number: day.day_number,
    time_slot_id: timeSlot.time_slot_id,
    time_slot_code: timeSlot.time_slot_code,
    time_slot_name: timeSlot.time_slot_name,
    time_slot_display_order: timeSlot.time_slot_display_order,
    assignments: timeSlot.assignments,
    schedule_cell: timeSlot.schedule_cell || null,
    absences: timeSlot.absences,
    time_slot_is_active: timeSlot.time_slot_is_active,
    classroom_is_active: classroom.classroom_is_active,
  }
}

export default function WeeklyScheduleGridNew({
  data,
  selectedDayIds,
  weekStartISO,
  layout,
  onRefresh,
  onFilterPanelOpenChange,
  filterPanelOpen = false,
  initialSelectedCell = null,
  allowCardClick = true, // Default to allowing clicks
  displayMode = 'all-scheduled-staff',
  showNotes = false,
  onDisplayModeChange,
  displayModeCounts,
  slotCounts,
  showLegendSubstitutes = true,
  showLegendTemporaryCoverage = true,
  showFilterChips = true,
  contentBelowLegend,
  readOnly = false,
  returnToWeekly = false,
  showDateInHeader = true,
  leadingFilterContent,
  trailingFilterContent,
  contentBeforeSlotCount,
  schoolClosures = [],
  onClosureMarkOpen,
  onClosureMarkOpenForDay,
  onClosureChangeReason,
  scheduleDayIdsFromSettings,
}: WeeklyScheduleGridNewProps) {
  const [selectedCell, setSelectedCell] = useState<{
    dayId: string
    dayName: string
    timeSlotId: string
    timeSlotName: string
    timeSlotCode: string
    timeSlotStartTime: string | null
    timeSlotEndTime: string | null
    classroomId: string
    classroomName: string
    classroomColor: string | null
  } | null>(null)
  const [allClassGroupIds, setAllClassGroupIds] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [selectedCellSnapshot, setSelectedCellSnapshot] = useState<{
    day_of_week_id: string
    day_name: string
    day_number: number
    time_slot_id: string
    time_slot_code: string
    time_slot_name: string | null
    time_slot_display_order: number | null
    assignments: WeeklyScheduleData['assignments']
    schedule_cell: {
      id: string
      is_active: boolean
      enrollment_for_staffing: number | null
      notes: string | null
      effective_notes?: string | null
      weekly_note_override?: {
        override_mode: 'custom' | 'hidden'
        note: string | null
      } | null
      is_note_hidden_for_date?: boolean
      class_groups?: Array<{
        id: string
        name: string
        age_unit: 'months' | 'years'
        min_age: number | null
        max_age: number | null
        required_ratio: number
        preferred_ratio: number | null
      }>
    } | null
    absences?: Array<{
      teacher_id: string
      teacher_name: string
      has_sub: boolean
      is_partial: boolean
      time_off_request_id?: string
    }>
    time_slot_is_active?: boolean
    classroom_is_active?: boolean
  }>()
  const {
    setActivePanel,
    previousPanel,
    restorePreviousPanel,
    clearPreviousPanel,
    registerPanelCloseHandler,
  } = usePanelManager()
  const savedCellRef = useRef<typeof selectedCell>(null)

  // Calculate assignment counts for filter chips
  // Note: Since substitutes are merged into assignments with teacher_id, we can't distinguish them directly
  // For now, count all assignments, and separate permanent teachers from floaters
  const assignmentCounts = useMemo(() => calculateAssignmentCounts(data), [data])

  const countsForChips = displayModeCounts ?? assignmentCounts

  // Extract unique days and time slots from data, filtered by selectedDayIds
  const { days, timeSlots, timeSlotsByDay } = useMemo(
    () => extractDaysAndTimeSlots(data, selectedDayIds),
    [data, selectedDayIds]
  )

  // Fetch all active class group IDs once so cells can show "All class groups" when the cell has all of them
  useEffect(() => {
    fetch('/api/class-groups')
      .then(r => r.json())
      .then((rows: Array<{ id: string }>) =>
        startTransition(() => setAllClassGroupIds(rows.map(r => r.id)))
      )
      .catch(() => {})
  }, [])

  const hasAppliedInitialSelection = useRef(false)

  useEffect(() => {
    if (!initialSelectedCell || hasAppliedInitialSelection.current) return
    const classroom = data.find(c => c.classroom_id === initialSelectedCell.classroomId)
    if (!classroom) return
    const day = classroom.days.find(d => d.day_of_week_id === initialSelectedCell.dayId)
    if (!day) return
    const timeSlotDetails = resolveTimeSlotPresentation({
      timeSlots,
      data,
      timeSlotId: initialSelectedCell.timeSlotId,
    })

    setSelectedCell({
      dayId: day.day_of_week_id,
      dayName: day.day_name,
      timeSlotId: initialSelectedCell.timeSlotId,
      timeSlotName: timeSlotDetails.name,
      timeSlotCode: timeSlotDetails.code,
      timeSlotStartTime: timeSlotDetails.startTime,
      timeSlotEndTime: timeSlotDetails.endTime,
      classroomId: classroom.classroom_id,
      classroomName: classroom.classroom_name,
      classroomColor: classroom.classroom_color ?? null,
    })
    hasAppliedInitialSelection.current = true
  }, [initialSelectedCell, data, timeSlots])

  const buildSelectedCellData = useCallback(
    (cell: { dayId: string; classroomId: string; timeSlotId: string }) =>
      buildSelectedCellSnapshot(data, cell),
    [data]
  )

  const handleCellClick = (
    dayId: string,
    dayName: string,
    timeSlotId: string,
    timeSlotName: string,
    classroomId: string,
    classroomName: string
  ) => {
    if (isSaving) return
    // Close filter panel if open (only one panel can be open at a time)
    if (filterPanelOpen && onFilterPanelOpenChange) {
      onFilterPanelOpenChange(false)
    }

    const timeSlotDetails = resolveTimeSlotPresentation({
      timeSlots,
      data,
      timeSlotId,
      fallbackName: timeSlotName,
    })

    setSelectedCell({
      dayId,
      dayName,
      timeSlotId,
      timeSlotName,
      timeSlotCode: timeSlotDetails.code,
      timeSlotStartTime: timeSlotDetails.startTime,
      timeSlotEndTime: timeSlotDetails.endTime,
      classroomId,
      classroomName,
      classroomColor: data.find(c => c.classroom_id === classroomId)?.classroom_color ?? null,
    })
    setSelectedCellSnapshot(
      buildSelectedCellData({
        dayId,
        classroomId,
        timeSlotId,
      })
    )
  }

  const handleSave = async () => {
    // Close the panel first so it doesn't re-render with post-refresh data. Otherwise
    // we'd refresh, then clear the snapshot, and for one render the panel would show
    // selectedCellData from the refreshed grid (e.g. different staffing count) and the
    // badge could flash from "meets required" to "below required" before the panel closes.
    setSelectedCellSnapshot(undefined)
    setSelectedCell(null)
    savedCellRef.current = null
    setActivePanel(null)
    clearPreviousPanel()
    try {
      if (onRefresh) {
        await Promise.resolve(onRefresh())
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleClosePanel = () => {
    savedCellRef.current = null
    setSelectedCell(null)
    setSelectedCellSnapshot(undefined)
    setActivePanel(null)
    clearPreviousPanel()
  }

  // Handle panel restoration when Add Time Off closes
  useEffect(() => {
    if (previousPanel?.type === 'schedule' && !selectedCell && savedCellRef.current) {
      // Restore the panel
      setSelectedCell(savedCellRef.current)
      setActivePanel('schedule')
      restorePreviousPanel()
    }
  }, [previousPanel, selectedCell, setActivePanel, restorePreviousPanel])

  // Register panel with PanelManager when it opens
  useEffect(() => {
    if (selectedCell) {
      setActivePanel('schedule', () => {
        // Restore callback - save current state and reopen
        savedCellRef.current = selectedCell
        setSelectedCell(selectedCell)
      })

      // Register close request handler
      const unregister = registerPanelCloseHandler('schedule', () => {
        // Save state before closing
        savedCellRef.current = selectedCell
        setSelectedCell(null)
      })

      return unregister
    } else {
      setActivePanel(null)
    }
  }, [selectedCell, setActivePanel, registerPanelCloseHandler])

  // Get cell data for selected cell
  const selectedCellData = selectedCell
    ? (selectedCellSnapshot ?? buildSelectedCellData(selectedCell))
    : undefined

  // Calendar date of the selected cell (for Edit Temporary Coverage save-scope dialog)
  const cellDateISO = useMemo(() => {
    if (!selectedCell || !weekStartISO || !data.length) return null
    const classroom = data[0]
    const day = classroom.days.find(d => d.day_of_week_id === selectedCell.dayId)
    if (!day) return null
    const d = parseLocalDate(weekStartISO)
    d.setDate(d.getDate() + (day.day_number - 1))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [selectedCell, weekStartISO, data])

  // Final filter: ensure we only show selected days
  // If selectedDayIds is empty, don't show any days (settings might not be loaded or configured)
  // Only show days if we have explicit selectedDayIds
  const filteredDays = useMemo(() => {
    if (selectedDayIds.length === 0) return []
    return days.filter(day => selectedDayIds.includes(day.id))
  }, [days, selectedDayIds])

  // Per-day time slots (collapse empty time-slot rows when e.g. filtering by teacher)
  const daysWithTimeSlots = useMemo(
    () =>
      filteredDays.map(day => ({
        day,
        timeSlots: timeSlotsByDay.get(day.id) ?? [],
      })),
    [filteredDays, timeSlotsByDay]
  )

  // Transform data for days-x-classrooms layout (only (day, timeSlot) rows that have data for that day)
  // True when any absence in the displayed week has a partial sub (is_partial + has_sub)
  const hasPartialSubInWeek = useMemo(() => {
    if (!showLegendSubstitutes) return false
    return data.some(classroom =>
      classroom.days.some(day =>
        day.time_slots.some(slot =>
          (slot.absences ?? []).some(
            (a: { has_sub: boolean; is_partial: boolean }) => a.has_sub && a.is_partial
          )
        )
      )
    )
  }, [data, showLegendSubstitutes])
  const hasReassignedInWeek = useMemo(() => {
    if (!showLegendSubstitutes) return false
    return data.some(classroom =>
      classroom.days.some(day =>
        day.time_slots.some(slot => (slot.absences ?? []).some(a => a.is_reassigned === true))
      )
    )
  }, [data, showLegendSubstitutes])

  const daysXClassroomsData = useMemo(() => {
    if (layout !== 'days-x-classrooms') return null

    const result: Array<{
      day: { id: string; name: string; number: number }
      timeSlot: {
        id: string
        code: string
        name: string | null
        display_order: number | null
        is_active: boolean
      }
      classrooms: Array<{
        classroomId: string
        classroomName: string
        cellData?: WeeklyScheduleCellData
      }>
    }> = []

    daysWithTimeSlots.forEach(({ day, timeSlots: dayTimeSlots }) => {
      dayTimeSlots.forEach(timeSlot => {
        const classrooms: Array<{
          classroomId: string
          classroomName: string
          cellData?: WeeklyScheduleCellData
        }> = []

        data.forEach(classroom => {
          const dayData = classroom.days.find(d => d.day_of_week_id === day.id)
          const timeSlotData = dayData?.time_slots.find(ts => ts.time_slot_id === timeSlot.id)

          const cellData = timeSlotData
            ? {
                day_of_week_id: day.id,
                day_name: day.name,
                day_number: day.number,
                time_slot_id: timeSlot.id,
                time_slot_code: timeSlot.code,
                time_slot_name: timeSlot.name,
                time_slot_display_order: timeSlot.display_order,
                time_slot_is_active: timeSlotData.time_slot_is_active,
                assignments: timeSlotData.assignments,
                schedule_cell: timeSlotData.schedule_cell || null,
                absences: timeSlotData.absences,
              }
            : undefined

          classrooms.push({
            classroomId: classroom.classroom_id,
            classroomName: classroom.classroom_name,
            cellData,
          })
        })

        result.push({
          day,
          timeSlot,
          classrooms,
        })
      })
    })

    return result
  }, [data, daysWithTimeSlots, layout])

  // Generate grid templates
  const daysXClassroomsGrid = useMemo(() => {
    if (layout !== 'days-x-classrooms') return null
    return generateDaysXClassroomsGridTemplate(data.length, daysWithTimeSlots)
  }, [layout, data.length, daysWithTimeSlots])

  const classroomsXDaysGrid = useMemo(() => {
    if (layout !== 'classrooms-x-days') return null
    return generateClassroomsXDaysGridTemplate(filteredDays.length, timeSlots.length, data.length)
  }, [layout, filteredDays.length, timeSlots.length, data.length])

  // Render days-x-classrooms layout
  if (layout === 'days-x-classrooms' && daysXClassroomsData && daysXClassroomsGrid) {
    return (
      <>
        <div className="mb-6 rounded-md border border-gray-200 bg-gray-100 p-3 space-y-4">
          <ScheduleLegend
            showLegendSubstitutes={showLegendSubstitutes}
            showLegendTemporaryCoverage={showLegendTemporaryCoverage}
            showSchoolClosed={schoolClosures.length > 0}
            showPartialSub={hasPartialSubInWeek}
            showReassigned={hasReassignedInWeek}
            noWrapper
          />
          {contentBelowLegend && (
            <div className="flex flex-wrap items-center gap-3">{contentBelowLegend}</div>
          )}
          {showFilterChips && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {leadingFilterContent}
                {[
                  { value: 'all-scheduled-staff' as const, label: `All (${countsForChips.all})` },
                  {
                    value: 'coverage-issues' as const,
                    label: `Coverage Issues (${countsForChips.coverageIssues})`,
                  },
                  { value: 'substitutes-only' as const, label: `Subs (${countsForChips.subs})` },
                  { value: 'absences' as const, label: `Absences (${countsForChips.absences})` },
                  {
                    value: 'permanent-only' as const,
                    label: `Permanent staff (${countsForChips.permanent})`,
                  },
                ].map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={e => {
                      e.preventDefault()
                      e.stopPropagation()
                      onDisplayModeChange?.(option.value)
                    }}
                    className={
                      displayMode === option.value
                        ? 'rounded-full border border-button-fill bg-button-fill px-3 py-1 text-xs font-medium text-button-fill-foreground'
                        : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-300'
                    }
                  >
                    {option.label}
                  </button>
                ))}
                {slotCounts && (
                  <div className="ml-4 flex items-center gap-2">
                    {contentBeforeSlotCount}
                    <p className="text-sm text-muted-foreground italic">
                      Showing {slotCounts.shown} of {slotCounts.total} slots
                    </p>
                  </div>
                )}
              </div>
              {trailingFilterContent}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-white -ml-4 -mr-4 md:-ml-8">
          <div className="px-4 md:pl-8">
            <div className="relative h-[calc(100vh-300px)] min-h-[200px]">
              <div className="relative h-full min-h-0 overflow-x-auto overflow-y-auto">
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: daysXClassroomsGrid.columns,
                    gridTemplateRows: daysXClassroomsGrid.rows,
                    minWidth: 'fit-content',
                    position: 'relative',
                    rowGap: '12px',
                    columnGap: '20px',
                  }}
                >
                  {/* Header Row - Time column corner (opaque so content doesn't show through when scrolling) */}
                  <div
                    className="sticky top-0 z-20"
                    style={{
                      position: 'sticky',
                      top: 0,
                      left: 0,
                      alignSelf: 'stretch', // Fill full row height so corner is fully opaque when scrolling
                      backgroundColor: '#ffffff',
                      gridColumn: 1,
                      gridRow: 1,
                      minWidth: '120px', // Match the column width
                      minHeight: '36px', // Match header row when row is auto
                      zIndex: 20, // Keep below sidebar when expanded
                      boxShadow: '2px 0 4px -1px rgba(0, 0, 0, 0.06)', // Opaque edge so scrolling content doesn't show through
                    }}
                  />
                  {data.map((classroom, index) => {
                    const classroomColor = classroom.classroom_color || undefined
                    return (
                      <div
                        key={classroom.classroom_id}
                        className="sticky top-0 z-20 text-center pt-2 pb-0.5"
                        style={{
                          position: 'sticky',
                          top: 0,
                          zIndex: 20,
                          alignSelf: 'start', // Prevent grid stretch so sticky has room to stick
                          backgroundColor: 'white',
                          gridColumn: index + 2,
                          gridRow: 1,
                        }}
                      >
                        <div
                          className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold"
                          style={{
                            color: classroomColor || '#1f2937',
                          }}
                        >
                          <span>{classroom.classroom_name}</span>
                          {!classroom.classroom_is_active && (
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium leading-none text-slate-600">
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Data Rows - Build rows explicitly by day and time slot (per-day time slots so empty rows collapse) */}
                  {daysWithTimeSlots.map(({ day, timeSlots: dayTimeSlots }, dayIndex) => {
                    // Row indices: row 1 = global header; each day uses 1 (day header) + n slots; days after the first also have 1 spacer before their header.
                    // So "rows before this day" = 1 (global) + for each previous day: (day 0: 1+n0; day i>0: 1 spacer + 1 header + n_i slots = 2+n_i).
                    let rowsBeforeThisDay = 1 // row 1 is the global header
                    for (let i = 0; i < dayIndex; i++) {
                      const daySlotCount = daysWithTimeSlots[i].timeSlots.length
                      rowsBeforeThisDay += i === 0 ? 1 + daySlotCount : 2 + daySlotCount // day 0: header+slots; later days: spacer+header+slots
                    }
                    const spacerRow = dayIndex > 0 ? rowsBeforeThisDay + 1 : null // first row of this day's block is the spacer
                    const dayHeaderRow = dayIndex > 0 ? rowsBeforeThisDay + 2 : 2 // day header: skip spacer when dayIndex > 0
                    const firstTimeSlotRow = dayHeaderRow + 1

                    return (
                      <React.Fragment key={`day-group-${day.id}`}>
                        {/* Spacer Row - only for days after the first */}
                        {spacerRow && (
                          <>
                            {/* Time column spacer (transparent, no border or shadow) */}
                            <div
                              style={{
                                position: 'sticky',
                                left: 0,
                                gridColumn: 1,
                                gridRow: spacerRow,
                                zIndex: 10,
                              }}
                            />
                            {/* Classroom column spacers (white) */}
                            {data.map((classroom, classroomIndex) => (
                              <div
                                key={`spacer-${classroom.classroom_id}-${day.id}`}
                                style={{
                                  backgroundColor: 'white',
                                  gridColumn: classroomIndex + 2,
                                  gridRow: spacerRow,
                                }}
                              />
                            ))}
                          </>
                        )}

                        {/* Day Section Header */}
                        <div
                          className="sticky rounded-lg flex items-center"
                          style={{
                            position: 'sticky',
                            top: '30px',
                            left: 0,
                            zIndex: 20,
                            alignSelf: 'start', // Prevent grid stretch so sticky has room to stick
                            backgroundColor: 'white',
                            borderBottom: '1px solid #e5e7eb',
                            gridColumn: '1 / -1',
                            gridRow: dayHeaderRow,
                            marginLeft: 0,
                            paddingTop: '6px',
                            paddingBottom: '6px',
                            height: '36px',
                            maxHeight: '36px',
                          }}
                        >
                          <div
                            className="text-base font-bold text-gray-800 px-4"
                            style={{ position: 'sticky', left: 0 }}
                          >
                            {day.name}
                          </div>
                        </div>

                        {/* Time Slot Rows for this day (only slots that have data for this day) */}
                        {dayTimeSlots.map((timeSlot, timeSlotIndex) => {
                          const item = daysXClassroomsData.find(
                            d => d.day.id === day.id && d.timeSlot.id === timeSlot.id
                          )
                          if (!item) return null

                          const dataRow = firstTimeSlotRow + timeSlotIndex

                          return (
                            <React.Fragment key={`time-slot-${day.id}-${timeSlot.id}`}>
                              {/* Combined Day/Time Column */}
                              <div
                                className="flex items-center justify-center"
                                style={{
                                  position: 'sticky',
                                  left: 0, // Only sticky horizontally, not vertically
                                  backgroundColor: 'white',
                                  gridColumn: 1,
                                  gridRow: dataRow,
                                  minHeight: '120px', // Ensure minimum height to prevent squishing
                                  paddingTop: '8px',
                                  zIndex: 10, // Above scrolling content but below day headers
                                }}
                              >
                                <div className="flex flex-col items-center gap-1">
                                  <span className="inline-flex items-center px-4 py-2.5 rounded-full bg-gray-100 text-gray-700 text-sm font-medium">
                                    {timeSlot.code}
                                  </span>
                                  {!timeSlot.is_active && (
                                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium leading-none text-slate-600">
                                      Inactive
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Classroom Cells */}
                              {item.classrooms.map((classroom, classroomIndex) => {
                                const isInactive = isSlotEffectivelyInactive({
                                  schedule_cell: classroom.cellData?.schedule_cell,
                                  classroom_is_active: data.find(
                                    c => c.classroom_id === classroom.classroomId
                                  )?.classroom_is_active,
                                  time_slot_is_active: classroom.cellData?.time_slot_is_active,
                                })
                                const classroomColor =
                                  data.find(c => c.classroom_id === classroom.classroomId)
                                    ?.classroom_color || undefined
                                return (
                                  <div
                                    key={`cell-${classroom.classroomId}-${day.id}-${timeSlot.id}`}
                                    className="flex items-stretch h-full p-1.5"
                                    style={{
                                      backgroundColor: classroomColor
                                        ? hexToRgba(classroomColor, 0.08)
                                        : 'transparent',
                                      gridColumn: classroomIndex + 2,
                                      gridRow: dataRow,
                                      minHeight: '120px', // Ensure minimum height for Safari compatibility (matches grid row minmax)
                                    }}
                                  >
                                    <ScheduleGridCellCard
                                      data={classroom.cellData}
                                      displayMode={displayMode}
                                      showNotes={showNotes}
                                      allowCardClick={allowCardClick}
                                      isInactive={isInactive}
                                      allClassGroupIds={allClassGroupIds}
                                      isClosed={
                                        weekStartISO
                                          ? isCellClosed(
                                              weekStartISO,
                                              day.number,
                                              timeSlot.id,
                                              schoolClosures
                                            )
                                          : false
                                      }
                                      closureMetadata={
                                        weekStartISO
                                          ? getMatchingClosure(
                                              weekStartISO,
                                              day.number,
                                              timeSlot.id,
                                              schoolClosures as Array<{
                                                id: string
                                                date: string
                                                time_slot_id: string | null
                                                reason: string | null
                                              }>
                                            )
                                          : null
                                      }
                                      onClosureMarkOpen={onClosureMarkOpen}
                                      onClosureMarkOpenForDay={onClosureMarkOpenForDay}
                                      onClosureChangeReason={onClosureChangeReason}
                                      onClick={() =>
                                        handleCellClick(
                                          day.id,
                                          day.name,
                                          timeSlot.id,
                                          item.timeSlot.name || timeSlot.code,
                                          classroom.classroomId,
                                          classroom.classroomName
                                        )
                                      }
                                    />
                                  </div>
                                )
                              })}
                            </React.Fragment>
                          )
                        })}
                      </React.Fragment>
                    )
                  })}
                </div>
              </div>
              {isSaving && !selectedCell && (
                <>
                  <div
                    className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
                    aria-live="polite"
                  />
                  <div
                    className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center"
                    aria-hidden
                  >
                    <span className="px-4 py-2 text-sm font-medium text-slate-600">Saving…</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {selectedCell && !filterPanelOpen && (
          <ScheduleSidePanel
            isOpen={!!selectedCell}
            onClose={handleClosePanel}
            dayId={selectedCell.dayId}
            dayName={selectedCell.dayName}
            timeSlotId={selectedCell.timeSlotId}
            timeSlotName={selectedCell.timeSlotName}
            timeSlotCode={selectedCell.timeSlotCode}
            timeSlotStartTime={selectedCell.timeSlotStartTime}
            timeSlotEndTime={selectedCell.timeSlotEndTime}
            classroomId={selectedCell.classroomId}
            classroomName={selectedCell.classroomName}
            classroomColor={selectedCell.classroomColor}
            selectedDayIds={selectedDayIds}
            scheduleDayIdsFromSettings={scheduleDayIdsFromSettings}
            selectedCellData={selectedCellData}
            onSave={handleSave}
            onSaveStart={() => setIsSaving(true)}
            onSaveEnd={() => setIsSaving(false)}
            onRefresh={onRefresh}
            weekStartISO={weekStartISO}
            readOnly={readOnly}
            returnToWeekly={returnToWeekly}
            showDateInHeader={showDateInHeader}
            cellDateISO={cellDateISO}
          />
        )}
      </>
    )
  }

  // Render classrooms-x-days layout
  if (layout === 'classrooms-x-days' && classroomsXDaysGrid) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-gray-200 bg-gray-100 p-3 space-y-4">
          <ScheduleLegend
            showLegendSubstitutes={showLegendSubstitutes}
            showLegendTemporaryCoverage={showLegendTemporaryCoverage}
            showSchoolClosed={schoolClosures.length > 0}
            showPartialSub={hasPartialSubInWeek}
            showReassigned={hasReassignedInWeek}
            noWrapper
          />
          {contentBelowLegend && (
            <div className="flex flex-wrap items-center gap-3">{contentBelowLegend}</div>
          )}
          {showFilterChips && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {leadingFilterContent}
                {[
                  { value: 'all-scheduled-staff' as const, label: `All (${countsForChips.all})` },
                  {
                    value: 'coverage-issues' as const,
                    label: `Coverage Issues (${countsForChips.coverageIssues})`,
                  },
                  { value: 'substitutes-only' as const, label: `Subs (${countsForChips.subs})` },
                  { value: 'absences' as const, label: `Absences (${countsForChips.absences})` },
                  {
                    value: 'permanent-only' as const,
                    label: `Permanent staff (${countsForChips.permanent})`,
                  },
                ].map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={e => {
                      e.preventDefault()
                      e.stopPropagation()
                      onDisplayModeChange?.(option.value)
                    }}
                    className={
                      displayMode === option.value
                        ? 'rounded-full border border-button-fill bg-button-fill px-3 py-1 text-xs font-medium text-button-fill-foreground'
                        : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-300'
                    }
                  >
                    {option.label}
                  </button>
                ))}
                {slotCounts && (
                  <div className="ml-4 flex items-center gap-2">
                    {contentBeforeSlotCount}
                    <p className="text-sm text-muted-foreground italic">
                      Showing {slotCounts.shown} of {slotCounts.total} slots
                    </p>
                  </div>
                )}
              </div>
              {trailingFilterContent}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-white -ml-4 -mr-4 md:-ml-8">
          <div className="px-4 md:pl-8">
            <div className="relative h-[calc(100vh-300px)] min-h-[200px]">
              <div className="relative h-full min-h-0 overflow-x-auto overflow-y-auto">
                <div
                  className="grid"
                  style={
                    {
                      gridTemplateColumns: classroomsXDaysGrid.columns,
                      gridTemplateRows: classroomsXDaysGrid.rows,
                      width: 'fit-content',
                      minWidth: 'fit-content',
                      rowGap: '12px',
                      columnGap: '20px',
                      // CSS custom properties for header heights and column widths
                      '--header-row-1-height': 'calc(0.5rem + 1.5rem + 0.125rem)', // Day header: pt-2 + text-base line-height + pb-0.5
                      '--header-row-2-height': 'calc(0.5rem + 1.5rem + 0.75rem)', // Time slot header: pt-2 + chip height ~1.5rem + pb-3
                      '--classroom-column-width': '110px', // Classroom column width
                    } as React.CSSProperties
                  }
                >
                  {/* Header Row 1: Day Names */}
                  {/* Corner cell: opaque like classroom column so content doesn't show through when scrolling */}
                  <div
                    className="sticky top-0 z-20"
                    style={{
                      position: 'sticky',
                      top: 0,
                      left: 0,
                      alignSelf: 'start',
                      gridColumn: 1,
                      gridRow: 1,
                      backgroundColor: 'white', // Match day row (no gray)
                      borderBottom: '1px solid #e5e7eb',
                      borderRight: '1px solid #e5e7eb',
                      boxShadow: '2px 0 8px -2px rgba(0, 0, 0, 0.1)',
                      width: '110px',
                      minWidth: '110px',
                      maxWidth: '110px',
                      zIndex: 20,
                    }}
                  />
                  {filteredDays.map((day, dayIndex) => (
                    <div
                      key={`day-header-${day.id}`}
                      className="sticky top-0 z-20 text-center pt-2 pb-0.5"
                      style={{
                        position: 'sticky',
                        top: 0,
                        left: 'var(--classroom-column-width)', // Stop at right edge of classroom column
                        alignSelf: 'start', // Prevent grid stretch so sticky has room to stick
                        backgroundColor: 'white',
                        gridColumn: `${dayIndex * timeSlots.length + 2} / ${(dayIndex + 1) * timeSlots.length + 2}`,
                        gridRow: 1,
                        borderBottom: '1px solid #e5e7eb',
                        borderRight:
                          dayIndex < filteredDays.length - 1 ? '1px solid #e5e7eb' : 'none',
                      }}
                    >
                      <div className="text-base font-bold text-gray-800">{day.name}</div>
                    </div>
                  ))}

                  {/* Header Row 2: Time Slot Codes */}
                  {/* Corner cell: opaque like classroom column so content doesn't show through when scrolling */}
                  <div
                    className="sticky z-20"
                    style={{
                      position: 'sticky',
                      top: 'var(--header-row-1-height)', // Below row 1 so both headers stack
                      left: 0,
                      alignSelf: 'start',
                      gridColumn: 1,
                      gridRow: 2,
                      backgroundColor: 'white', // Match time slot header row
                      borderBottom: '1px solid #e5e7eb',
                      borderRight: '1px solid #e5e7eb',
                      boxShadow: '2px 0 8px -2px rgba(0, 0, 0, 0.1)',
                      width: '110px',
                      minWidth: '110px',
                      maxWidth: '110px',
                      zIndex: 20,
                    }}
                  />
                  {filteredDays.map((day, dayIndex) =>
                    timeSlots.map((slot, slotIndex) => (
                      <div
                        key={`time-header-${day.id}-${slot.id}`}
                        className="sticky z-20 text-center pt-2 pb-3"
                        style={{
                          position: 'sticky',
                          top: 'calc(0.5rem + 1.5rem + 0.125rem)', // Match day header height exactly
                          left: 'var(--classroom-column-width)', // Stop at right edge of classroom column
                          alignSelf: 'start', // Prevent grid stretch so sticky has room to stick
                          backgroundColor: 'white',
                          gridColumn: dayIndex * timeSlots.length + slotIndex + 2,
                          gridRow: 2,
                          borderBottom: '1px solid #e5e7eb',
                          borderRight:
                            slotIndex < timeSlots.length - 1 ||
                            (slotIndex === timeSlots.length - 1 &&
                              dayIndex < filteredDays.length - 1)
                              ? '1px solid #e5e7eb'
                              : 'none',
                          borderLeft: 'none',
                          boxShadow: '0 2px 4px -2px rgba(0, 0, 0, 0.08)',
                        }}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                            {slot.code}
                          </span>
                          {!slot.is_active && (
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium leading-none text-slate-600">
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  {/* Data Rows: Classrooms */}
                  {data.map((classroom, classroomIndex) => {
                    const rowIndex = classroomIndex + 3 // After 2 header rows
                    return (
                      <React.Fragment key={`classroom-row-${classroom.classroom_id}`}>
                        {/* Classroom Name Column */}
                        <div
                          className="z-20 flex items-center justify-center"
                          style={{
                            position: 'sticky',
                            left: 0,
                            top: 'calc(var(--header-row-1-height) + var(--header-row-2-height) + 5px)', // Sum of both header rows + small offset for borders/padding
                            alignSelf: 'start', // Prevent grid stretch so sticky has room to stick
                            backgroundColor: 'white',
                            gridColumn: 1, // Use simple column index
                            gridRow: rowIndex,
                            width: '110px', // Fixed width to match column width
                            minWidth: '110px', // Ensure minimum width
                            maxWidth: '110px', // Constrain to column width to prevent scrolling into header area
                            borderRight: '1px solid #e5e7eb',
                            borderBottom:
                              classroomIndex < data.length - 1 ? '1px solid #e5e7eb' : 'none',
                            boxShadow: '2px 0 8px -2px rgba(0, 0, 0, 0.1)',
                          }}
                        >
                          <div
                            className="text-sm font-semibold text-center"
                            style={{
                              color: classroom.classroom_color || '#1f2937',
                            }}
                          >
                            <div className="inline-flex flex-col items-center gap-1">
                              <span>
                                {(() => {
                                  const name = classroom.classroom_name
                                  const roomIndex = name.indexOf(' Room')
                                  if (roomIndex > 0) {
                                    // Split before "Room" - e.g., "Toddler A Room" -> "Toddler A<br>Room"
                                    const beforeRoom = name.substring(0, roomIndex)
                                    const room = name.substring(roomIndex + 1) // +1 to skip the space
                                    return (
                                      <>
                                        {beforeRoom}
                                        <br />
                                        {room}
                                      </>
                                    )
                                  }
                                  // If no " Room" found, split on last space as fallback
                                  const lastSpaceIndex = name.lastIndexOf(' ')
                                  if (lastSpaceIndex > 0) {
                                    const firstPart = name.substring(0, lastSpaceIndex)
                                    const secondPart = name.substring(lastSpaceIndex + 1)
                                    return (
                                      <>
                                        {firstPart}
                                        <br />
                                        {secondPart}
                                      </>
                                    )
                                  }
                                  // If no space found, return as-is
                                  return name
                                })()}
                              </span>
                              {!classroom.classroom_is_active && (
                                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium leading-none text-slate-600">
                                  Inactive
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Day/Time Slot Cells */}
                        {filteredDays.map((day, dayIndex) => {
                          const dayData = classroom.days.find(d => d.day_of_week_id === day.id)
                          const classroomColor = classroom.classroom_color || undefined

                          return timeSlots.map((slot, slotIndex) => {
                            const timeSlotData = dayData?.time_slots.find(
                              ts => ts.time_slot_id === slot.id
                            )
                            const cellData = timeSlotData
                              ? {
                                  day_of_week_id: day.id,
                                  day_name: day.name,
                                  day_number: day.number,
                                  time_slot_id: slot.id,
                                  time_slot_code: slot.code,
                                  time_slot_name: slot.name,
                                  time_slot_display_order: slot.display_order,
                                  time_slot_is_active: timeSlotData.time_slot_is_active,
                                  assignments: timeSlotData.assignments,
                                  schedule_cell: timeSlotData.schedule_cell || null,
                                  absences: timeSlotData.absences,
                                }
                              : undefined

                            const isInactive = isSlotEffectivelyInactive({
                              schedule_cell: cellData?.schedule_cell,
                              classroom_is_active: classroom.classroom_is_active,
                              time_slot_is_active: timeSlotData?.time_slot_is_active,
                            })
                            const colIndex = dayIndex * timeSlots.length + slotIndex + 2

                            return (
                              <div
                                key={`cell-${classroom.classroom_id}-${day.id}-${slot.id}`}
                                className="flex items-stretch h-full p-1.5"
                                style={{
                                  backgroundColor: classroomColor
                                    ? hexToRgba(classroomColor, 0.08)
                                    : 'transparent',
                                  gridColumn: colIndex,
                                  gridRow: rowIndex,
                                  borderRight:
                                    slotIndex < timeSlots.length - 1 ||
                                    (slotIndex === timeSlots.length - 1 &&
                                      dayIndex < filteredDays.length - 1)
                                      ? '1px solid #e5e7eb'
                                      : 'none',
                                  width: '100%',
                                  height: '100%',
                                  minHeight: '120px', // Ensure minimum height for Safari compatibility (matches grid row minmax)
                                }}
                              >
                                <ScheduleGridCellCard
                                  data={cellData}
                                  displayMode={displayMode}
                                  showNotes={showNotes}
                                  allowCardClick={allowCardClick}
                                  isInactive={isInactive}
                                  allClassGroupIds={allClassGroupIds}
                                  isClosed={
                                    weekStartISO
                                      ? isCellClosed(
                                          weekStartISO,
                                          day.number,
                                          slot.id,
                                          schoolClosures
                                        )
                                      : false
                                  }
                                  closureMetadata={
                                    weekStartISO
                                      ? getMatchingClosure(
                                          weekStartISO,
                                          day.number,
                                          slot.id,
                                          schoolClosures as Array<{
                                            id: string
                                            date: string
                                            time_slot_id: string | null
                                            reason: string | null
                                          }>
                                        )
                                      : null
                                  }
                                  onClosureMarkOpen={onClosureMarkOpen}
                                  onClosureMarkOpenForDay={onClosureMarkOpenForDay}
                                  onClosureChangeReason={onClosureChangeReason}
                                  onClick={() =>
                                    handleCellClick(
                                      day.id,
                                      day.name,
                                      slot.id,
                                      slot.name || slot.code,
                                      classroom.classroom_id,
                                      classroom.classroom_name
                                    )
                                  }
                                />
                              </div>
                            )
                          })
                        })}
                      </React.Fragment>
                    )
                  })}
                </div>
              </div>
              {isSaving && !selectedCell && (
                <>
                  <div
                    className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
                    aria-live="polite"
                  />
                  <div
                    className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center"
                    aria-hidden
                  >
                    <span className="px-4 py-2 text-sm font-medium text-slate-600">Saving…</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {selectedCell && !filterPanelOpen && (
          <ScheduleSidePanel
            isOpen={!!selectedCell}
            onClose={handleClosePanel}
            dayId={selectedCell.dayId}
            dayName={selectedCell.dayName}
            timeSlotId={selectedCell.timeSlotId}
            timeSlotName={selectedCell.timeSlotName}
            timeSlotCode={selectedCell.timeSlotCode}
            timeSlotStartTime={selectedCell.timeSlotStartTime}
            timeSlotEndTime={selectedCell.timeSlotEndTime}
            classroomId={selectedCell.classroomId}
            classroomName={selectedCell.classroomName}
            classroomColor={selectedCell.classroomColor}
            selectedDayIds={selectedDayIds}
            scheduleDayIdsFromSettings={scheduleDayIdsFromSettings}
            selectedCellData={selectedCellData}
            onSave={handleSave}
            onSaveStart={() => setIsSaving(true)}
            onSaveEnd={() => setIsSaving(false)}
            onRefresh={onRefresh}
            weekStartISO={weekStartISO}
            readOnly={readOnly}
            returnToWeekly={returnToWeekly}
            showDateInHeader={showDateInHeader}
            cellDateISO={cellDateISO}
          />
        )}
      </div>
    )
  }

  return null
}
