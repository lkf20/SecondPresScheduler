/**
 * Shared schedule filter logic for weekly and baseline schedule pages.
 * Applies structural filters (classrooms, days, time slots), fill-in of missing
 * structure, staffing/display filters, and collapse when slotFilterMode is 'select'.
 */

import type { WeeklyScheduleDataByClassroom } from '@/lib/api/weekly-schedule'
import { getTotalEnrollmentForCalculation } from '@/components/schedules/ScheduleSidePanel'
import {
  getSlotCoverageTotalBaseline,
  getSlotCoverageTotalWeekly,
} from '@/lib/schedules/coverage-weights'
import {
  getEffectiveClassroomIds,
  getEffectiveTimeSlotIds,
  isStaffingNarrowing,
  type ScheduleFilterInput,
} from '@/lib/schedules/schedule-filter-helpers'
import { isSlotInactive } from '@/lib/utils/schedule-slot-activity'

export interface ScheduleFilterOptions {
  teacherFilterId: string | null
  availableDays: Array<{ id: string; name?: string; day_number?: number }>
  availableTimeSlots: Array<{
    id: string
    code?: string
    name?: string | null
    display_order?: number | null
    default_start_time?: string | null
    default_end_time?: string | null
    is_active?: boolean
  }>
  availableClassrooms: Array<{ id: string; is_active?: boolean }>
  /** When true, apply displayMode branches (absences, substitutes-only, permanent-only, coverage-issues). Set false for baseline. */
  applyDisplayMode: boolean
}

export interface ScheduleFiltersInput extends ScheduleFilterInput {
  selectedDayIds: string[]
  displayMode?:
    | 'permanent-only'
    | 'permanent-flexible'
    | 'substitutes-only'
    | 'all-scheduled-staff'
    | 'coverage-issues'
    | 'absences'
}

type CoverageContext = 'weekly' | 'baseline'

/**
 * When coverageIssuesOnly is true (e.g. displayMode === 'coverage-issues'), only slots below
 * required or below preferred are shown; fully-staffed slots are hidden regardless of df.fullyStaffed.
 */
function slotPassesStaffingFilter(
  slot: WeeklyScheduleDataByClassroom['days'][0]['time_slots'][0],
  df: NonNullable<ScheduleFilterInput['displayFilters']>,
  coverageContext: CoverageContext,
  coverageIssuesOnly?: boolean
): boolean {
  const scheduleCell = slot.schedule_cell
  if (!scheduleCell) return df.inactive

  const classGroups = scheduleCell.class_groups ?? []
  const totalEnrollment = getTotalEnrollmentForCalculation(
    classGroups,
    scheduleCell.enrollment_for_staffing ?? null
  )
  if (!classGroups.length || totalEnrollment == null) return df.inactive

  const classGroupForRatio = classGroups.reduce((lowest, current) => {
    const currentMinAge = current.min_age ?? Infinity
    const lowestMinAge = lowest.min_age ?? Infinity
    return currentMinAge < lowestMinAge ? current : lowest
  })
  const calculatedRequired = classGroupForRatio.required_ratio
    ? Math.ceil(totalEnrollment / classGroupForRatio.required_ratio)
    : undefined
  const calculatedPreferred = classGroupForRatio.preferred_ratio
    ? Math.ceil(totalEnrollment / classGroupForRatio.preferred_ratio)
    : undefined
  const requiredTeachers =
    scheduleCell.required_staff_override != null
      ? scheduleCell.required_staff_override
      : calculatedRequired
  const preferredTeachers =
    scheduleCell.preferred_staff_override != null
      ? scheduleCell.preferred_staff_override
      : calculatedPreferred

  const coverageTotal =
    coverageContext === 'baseline'
      ? getSlotCoverageTotalBaseline(slot)
      : getSlotCoverageTotalWeekly(slot)

  const belowRequired = requiredTeachers !== undefined && coverageTotal < requiredTeachers
  const belowPreferred =
    preferredTeachers !== undefined && coverageTotal < preferredTeachers
  const fullyStaffed =
    requiredTeachers !== undefined &&
    coverageTotal >= requiredTeachers &&
    (preferredTeachers === undefined || coverageTotal >= preferredTeachers)

  if (belowRequired) return df.belowRequired
  if (belowPreferred) return df.belowPreferred
  if (fullyStaffed) return coverageIssuesOnly ? false : df.fullyStaffed
  return false
}

/** Return required/preferred staff for a slot (for ratio comparison). Used with coverage totals from coverage-weights. */
export function getSlotRequiredPreferred(
  slot: WeeklyScheduleDataByClassroom['days'][0]['time_slots'][0]
): { required?: number; preferred?: number } | null {
  const scheduleCell = slot.schedule_cell
  if (!scheduleCell?.class_groups?.length) return null

  const classGroups = scheduleCell.class_groups
  const totalEnrollment = getTotalEnrollmentForCalculation(
    classGroups,
    scheduleCell.enrollment_for_staffing ?? null
  )
  if (totalEnrollment == null) return null

  const classGroupForRatio = classGroups.reduce((lowest, current) => {
    const currentMinAge = current.min_age ?? Infinity
    const lowestMinAge = lowest.min_age ?? Infinity
    return currentMinAge < lowestMinAge ? current : lowest
  })
  const calculatedRequired = classGroupForRatio.required_ratio
    ? Math.ceil(totalEnrollment / classGroupForRatio.required_ratio)
    : undefined
  const calculatedPreferred = classGroupForRatio.preferred_ratio
    ? Math.ceil(totalEnrollment / classGroupForRatio.preferred_ratio)
    : undefined
  const required =
    scheduleCell.required_staff_override != null
      ? scheduleCell.required_staff_override
      : calculatedRequired
  const preferred =
    scheduleCell.preferred_staff_override != null
      ? scheduleCell.preferred_staff_override
      : calculatedPreferred
  if (required === undefined && preferred === undefined) return null
  return { required, preferred }
}

/**
 * Apply filters to schedule data: structural (classroom/day/slot), teacher filter,
 * optional displayMode (weekly), staffing checkboxes, and collapse when narrowing.
 */
export function applyScheduleFilters(
  scheduleData: WeeklyScheduleDataByClassroom[],
  filters: ScheduleFiltersInput | null,
  options: ScheduleFilterOptions
): WeeklyScheduleDataByClassroom[] {
  if (!filters) return scheduleData

  const df = filters.displayFilters ?? {
    belowRequired: true,
    belowPreferred: true,
    fullyStaffed: true,
    inactive: true,
  }
  const slotFilterMode = filters.slotFilterMode ?? 'all'
  const showAllSlots = slotFilterMode === 'all'
  const staffingNarrowing = isStaffingNarrowing(filters)
  const { teacherFilterId, availableDays, availableTimeSlots, availableClassrooms, applyDisplayMode } =
    options

  const effectiveClassroomIds = getEffectiveClassroomIds(
    filters,
    availableClassrooms as { id: string; is_active?: boolean }[]
  )
  const effectiveTimeSlotIds = getEffectiveTimeSlotIds(
    filters,
    availableTimeSlots as { id: string; is_active?: boolean }[]
  )

  const dayById = new Map(availableDays.map(d => [d.id, d]))
  const timeSlotById = new Map(
    availableTimeSlots.map(ts => [
      ts.id,
      {
        ...ts,
        default_start_time: (ts as { default_start_time?: string | null }).default_start_time ?? null,
        default_end_time: (ts as { default_end_time?: string | null }).default_end_time ?? null,
        is_active: (ts as { is_active?: boolean }).is_active !== false,
      },
    ])
  )

  const result = scheduleData
    .filter(classroom => {
      if (!effectiveClassroomIds.includes(classroom.classroom_id)) return false
      if (showAllSlots) return true
      return df.inactive || classroom.classroom_is_active !== false
    })
    .map(classroom => {
      const daysWithSlots = filters.selectedDayIds.map(dayId => {
        const dayInfo = dayById.get(dayId)
        const existingDay = classroom.days.find(d => d.day_of_week_id === dayId)
        const existingTimeSlots = existingDay?.time_slots ?? []
        const time_slots = effectiveTimeSlotIds
          .map(slotId => {
            const existing = existingTimeSlots.find(s => s.time_slot_id === slotId)
            if (existing) return existing
            const ts = timeSlotById.get(slotId)
            if (!ts) return null
            return {
              time_slot_id: ts.id,
              time_slot_code: ts.code,
              time_slot_name: ts.name ?? null,
              time_slot_display_order: ts.display_order ?? null,
              time_slot_start_time: ts.default_start_time ?? null,
              time_slot_end_time: ts.default_end_time ?? null,
              time_slot_is_active: ts.is_active,
              assignments: [] as WeeklyScheduleDataByClassroom['days'][0]['time_slots'][0]['assignments'],
              schedule_cell: null,
            }
          })
          .filter(Boolean) as typeof existingTimeSlots
        return {
          day_of_week_id: dayId,
          day_name: dayInfo?.name ?? '',
          day_number: dayInfo?.day_number ?? 0,
          time_slots,
        }
      })

      const days = daysWithSlots.map(day => ({
        ...day,
        time_slots: day.time_slots.filter(slot => {
          if (
            teacherFilterId &&
            !(slot.assignments || []).some(a => a.teacher_id === teacherFilterId)
          ) {
            return false
          }
          if (showAllSlots) {
            // All slots: displayMode (if any) and staffing checkboxes still apply
          } else if (!df.inactive && slot.time_slot_is_active === false) {
            return false
          }

          if (applyDisplayMode && filters.displayMode === 'absences') {
            return !!(slot.absences && slot.absences.length > 0)
          }
          if (applyDisplayMode && filters.displayMode === 'substitutes-only') {
            return (slot.assignments || []).some(a => a.is_substitute === true)
          }
          if (applyDisplayMode && filters.displayMode === 'permanent-only') {
            return (slot.assignments || []).some(
              a => !!a.teacher_id && !a.is_floater && a.is_substitute !== true
            )
          }
          if (applyDisplayMode && filters.displayMode === 'coverage-issues') {
            const scheduleCell = slot.schedule_cell
            if (!scheduleCell || !scheduleCell.is_active) return false
            return slotPassesStaffingFilter(slot, df, 'weekly', true)
          }

          if (showAllSlots) return true

          if (isSlotInactive(slot)) return df.inactive

          const coverageContext = applyDisplayMode ? 'weekly' : 'baseline'
          return slotPassesStaffingFilter(slot, df, coverageContext)
        }),
      }))

      return { ...classroom, days }
    })

  if (!staffingNarrowing) return result
  return result
    .map(classroom => ({
      ...classroom,
      days: classroom.days.filter(day => day.time_slots.length > 0),
    }))
    .filter(classroom => classroom.days.length > 0)
}
