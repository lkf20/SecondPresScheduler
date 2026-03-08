'use client'

import React from 'react'
import { CheckCircle2, AlertTriangle, XCircle, CornerDownRight } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { WeeklyScheduleData } from '@/lib/api/weekly-schedule'
import { BREAK_COVERAGE_ENABLED } from '@/lib/feature-flags'
import { getTotalEnrollmentForCalculation } from './ScheduleSidePanel'
import AbsentTeacherPopover from './AbsentTeacherPopover'

interface ScheduleCellProps {
  data?: WeeklyScheduleData & {
    schedule_cell?: {
      id: string
      is_active: boolean
      enrollment_for_staffing: number | null
      notes: string | null
      required_staff_override?: number | null
      preferred_staff_override?: number | null
      class_groups?: Array<{
        id: string
        name: string
        age_unit: 'months' | 'years'
        min_age: number | null
        max_age: number | null
        required_ratio: number
        preferred_ratio: number | null
        enrollment?: number | null
      }>
    } | null
    absences?: Array<{
      teacher_id: string
      teacher_name: string
      has_sub: boolean
      is_partial: boolean
      time_off_request_id?: string
    }>
    classroom_name?: string
  }
  onClick?: () => void
  displayMode?:
    | 'permanent-only'
    | 'permanent-flexible'
    | 'substitutes-only'
    | 'all-scheduled-staff'
    | 'coverage-issues'
    | 'absences'
}

export default function ScheduleCell({
  data,
  onClick,
  displayMode = 'all-scheduled-staff',
}: ScheduleCellProps) {
  const scheduleCell = data?.schedule_cell
  const isInactive = scheduleCell && !scheduleCell.is_active
  const isActive = scheduleCell?.is_active ?? false

  // Get class group names from schedule_cell; show "Name (n)" when per-class enrollment is set
  const classGroupNames =
    scheduleCell?.class_groups && scheduleCell.class_groups.length > 0
      ? scheduleCell.class_groups
          .map(cg => (cg.enrollment != null ? `${cg.name} (${cg.enrollment})` : cg.name))
          .join(', ')
      : data?.assignments && data.assignments.length > 0
        ? data.assignments.find(a => a.class_name)?.class_name
        : null

  // Total enrollment: per-class sum if any set, else cell enrollment_for_staffing
  const enrollment = getTotalEnrollmentForCalculation(
    scheduleCell?.class_groups ?? [],
    scheduleCell?.enrollment_for_staffing ?? null
  )

  // Calculate staffing status and tooltip message
  const getStaffingStatus = () => {
    if (!isActive || !scheduleCell?.class_groups || scheduleCell.class_groups.length === 0)
      return { status: null, message: null }

    // Find class group with lowest min_age for ratio calculation
    const classGroupForRatio = scheduleCell.class_groups.reduce((lowest, current) => {
      const currentMinAge = current.min_age ?? Infinity
      const lowestMinAge = lowest.min_age ?? Infinity
      return currentMinAge < lowestMinAge ? current : lowest
    })

    const enrollmentForRatio = enrollment
    const calculatedRequired =
      classGroupForRatio.required_ratio && enrollmentForRatio
        ? Math.ceil(enrollmentForRatio / classGroupForRatio.required_ratio)
        : undefined
    const calculatedPreferred =
      classGroupForRatio.preferred_ratio && enrollmentForRatio
        ? Math.ceil(enrollmentForRatio / classGroupForRatio.preferred_ratio)
        : undefined

    const requiredTeachers =
      scheduleCell.required_staff_override != null
        ? scheduleCell.required_staff_override
        : calculatedRequired
    const preferredTeachers =
      scheduleCell.preferred_staff_override != null
        ? scheduleCell.preferred_staff_override
        : calculatedPreferred

    // Count assigned teachers for this slot (teachers are assigned to the slot, not individual class groups)
    // Count floaters proportionally (0.5 for 2 classrooms, 0.33 for 3, etc.)
    const assignments = data?.assignments.filter(a => a.teacher_id) || []

    // For each assignment, calculate its contribution to staffing
    // Regular teachers count as 1.0, floaters count proportionally
    // Note: To count floaters across multiple classrooms, we'd need to query all classrooms
    // For now, we'll count floaters in this classroom as 0.5 (assuming they're in 2 classrooms)
    // This is a simplified approach - a full implementation would query all classrooms for the same day/time
    let assignedCount = 0

    for (const assignment of assignments) {
      if (assignment.is_floater) {
        // Simplified: assume floater is split across 2 classrooms
        // In a full implementation, we'd query all teacher_schedules for this teacher/day/time
        // and count how many classrooms they're assigned to as floaters
        assignedCount += 0.5
      } else {
        assignedCount += 1.0
      }
    }

    if (requiredTeachers === undefined) return { status: null, message: null }

    // Round to 1 decimal place for display
    const roundedCount = Math.round(assignedCount * 10) / 10

    if (roundedCount < requiredTeachers) {
      const shortfall = Math.round((requiredTeachers - roundedCount) * 10) / 10
      return {
        status: 'red',
        message: `Below required staffing by ${shortfall.toFixed(1)}`,
      }
    } else if (preferredTeachers !== undefined && roundedCount < preferredTeachers) {
      const shortfall = Math.round((preferredTeachers - roundedCount) * 10) / 10
      return {
        status: 'amber',
        message: `Below preferred staffing by ${shortfall.toFixed(1)}`,
      }
    } else {
      return {
        status: 'green',
        message: `Meets preferred staffing (${roundedCount.toFixed(1)} teachers)`,
      }
    }
  }

  const { status: staffingStatus, message: staffingMessage } = getStaffingStatus()

  return (
    <div
      className={`min-h-[60px] p-3 cursor-pointer transition-colors ${
        isInactive ? '' : 'hover:bg-gray-50/50'
      }`}
      onClick={onClick}
    >
      {(isActive || scheduleCell) && (
        <div className="flex items-start justify-between mb-1">
          {classGroupNames && (
            <div className="text-xs font-normal text-muted-foreground">
              {classGroupNames}
              {enrollment !== null && enrollment !== undefined && (
                <span className="text-muted-foreground/70"> ({enrollment})</span>
              )}
            </div>
          )}
          {isActive && staffingStatus && staffingMessage && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex-shrink-0 ml-2">
                    {staffingStatus === 'green' && (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                    {staffingStatus === 'amber' && (
                      <AlertTriangle className="h-4 w-4 text-amber-700" />
                    )}
                    {staffingStatus === 'red' && <XCircle className="h-4 w-4 text-red-600" />}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{staffingMessage}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}
      {scheduleCell &&
        ((scheduleCell.class_groups?.length ?? 0) > 0 || (data?.assignments?.length ?? 0) > 0) && (
          <div className="flex flex-col gap-1.5 mt-1">
            {(() => {
              // Filter assignments for this slot (teachers are assigned to the slot, not individual class groups)
              const classGroupIds = scheduleCell.class_groups?.map(cg => cg.id) ?? []
              const allAssignments = data?.assignments || []

              // Filter assignments: Teachers are assigned to classrooms, not specific class groups
              // All teachers in the assignments array are already filtered by classroom_id in the API
              // Include all teachers assigned to this classroom/day/time slot
              const filteredAssignments =
                allAssignments.filter(a => {
                  if (!a.teacher_id) return false
                  // Include all teachers and substitutes assigned to this classroom
                  // They're already filtered by classroom_id in the API
                  return true
                }) || []

              // Determine what to show based on displayMode
              const showAbsences = displayMode !== 'permanent-only'
              const showSubstitutes = displayMode !== 'permanent-only'
              const showRegularTeachers =
                displayMode !== 'substitutes-only' && displayMode !== 'absences'
              const showFloaters = displayMode !== 'substitutes-only' && displayMode !== 'absences'

              // Get absent teachers from absences array (not from assignments)
              const absences = showAbsences ? data?.absences || [] : []
              const absentTeacherIds = new Set(absences.map(a => a.teacher_id))

              // Get substitutes and map them to their absent teachers
              const substitutes = showSubstitutes
                ? filteredAssignments.filter(a => a.is_substitute === true)
                : []
              const substitutesByAbsentTeacher = new Map<string, typeof substitutes>()
              substitutes.forEach(sub => {
                if (sub.absent_teacher_id) {
                  if (!substitutesByAbsentTeacher.has(sub.absent_teacher_id)) {
                    substitutesByAbsentTeacher.set(sub.absent_teacher_id, [])
                  }
                  substitutesByAbsentTeacher.get(sub.absent_teacher_id)!.push(sub)
                }
              })

              // Get non-substitute assignments (teachers/flex/floaters) - only if showing them
              // IMPORTANT: Exclude teachers who are absent (they're already shown as absent)
              const nonSubstituteAssignments =
                showRegularTeachers || showFloaters
                  ? filteredAssignments.filter(
                      a => !a.is_substitute && !absentTeacherIds.has(a.teacher_id)
                    )
                  : []
              const teachers = showRegularTeachers
                ? nonSubstituteAssignments.filter(a => !a.is_floater && !a.is_flexible)
                : []
              const flexTeachers = showRegularTeachers
                ? nonSubstituteAssignments.filter(a => !a.is_floater && a.is_flexible)
                : []
              const floaters = showFloaters
                ? nonSubstituteAssignments.filter(a => a.is_floater)
                : []

              // Sort absences alphabetically by teacher name
              const sortedAbsences = [...absences].sort((a, b) =>
                (a.teacher_name || 'Unknown').localeCompare(b.teacher_name || 'Unknown')
              )

              // Sort each group alphabetically by display name
              const sortedTeachers = [...teachers].sort((a, b) =>
                (a.teacher_name || 'Unknown').localeCompare(b.teacher_name || 'Unknown')
              )
              const sortedFlexTeachers = [...flexTeachers].sort((a, b) =>
                (a.teacher_name || 'Unknown').localeCompare(b.teacher_name || 'Unknown')
              )
              const sortedFloaters = [...floaters].sort((a, b) =>
                (a.teacher_name || 'Unknown').localeCompare(b.teacher_name || 'Unknown')
              )

              // Build display order: absent (with their substitutes), then teachers, flex teachers, and floaters
              const displayGroups: Array<{
                type: 'absent' | 'teacher' | 'flexTeacher' | 'floater'
                absence?: (typeof absences)[0]
                assignment?: (typeof filteredAssignments)[0]
                substitutes: typeof substitutes
              }> = []

              // Add absent teachers with their substitutes (from absences array)
              sortedAbsences.forEach(absence => {
                displayGroups.push({
                  type: 'absent',
                  absence,
                  substitutes: (substitutesByAbsentTeacher.get(absence.teacher_id) || []).sort(
                    (a, b) =>
                      (a.teacher_name || 'Unknown').localeCompare(b.teacher_name || 'Unknown')
                  ),
                })
              })

              // Add teachers (with empty substitutes array) - only if showing regular teachers
              if (showRegularTeachers) {
                sortedTeachers.forEach(teacher => {
                  displayGroups.push({
                    type: 'teacher',
                    assignment: teacher,
                    substitutes: [],
                  })
                })
              }

              // Add flex teachers (with empty substitutes array) - only if showing regular teachers
              if (showRegularTeachers) {
                sortedFlexTeachers.forEach(flexTeacher => {
                  displayGroups.push({
                    type: 'flexTeacher',
                    assignment: flexTeacher,
                    substitutes: [],
                  })
                })
              }

              // Add floaters (with empty substitutes array) - only if showing floaters
              if (showFloaters) {
                sortedFloaters.forEach(floater => {
                  displayGroups.push({
                    type: 'floater',
                    assignment: floater,
                    substitutes: [],
                  })
                })
              }

              return displayGroups.flatMap(group => {
                const substitutes = group.substitutes
                const result: React.ReactNode[] = []

                // Handle absent teachers (from absences array)
                if (group.type === 'absent' && group.absence) {
                  const absence = group.absence
                  const teacherName = absence.teacher_name || 'Unknown'
                  const hasSubForAbsence = substitutes.length > 0 || absence.has_sub === true

                  // Gray styling for absent teachers (matches the key) - make clickable
                  const chip = (
                    <span
                      key={`absent-${absence.teacher_id}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold w-fit bg-gray-100 text-gray-700 border border-gray-300 cursor-pointer hover:bg-gray-200 transition-colors"
                      title={hasSubForAbsence ? 'Absent' : 'No sub assigned'}
                    >
                      <span>{teacherName}</span>
                      {!hasSubForAbsence && (
                        <AlertTriangle
                          className={`h-3 w-3 shrink-0 ${
                            staffingStatus === 'green'
                              ? 'text-gray-400'
                              : staffingStatus === 'amber'
                                ? 'text-amber-700'
                                : staffingStatus === 'red'
                                  ? 'text-red-600'
                                  : 'text-amber-700'
                          }`}
                        />
                      )}
                    </span>
                  )

                  // Wrap absent teachers in popover for actions
                  const absentChip = (
                    <AbsentTeacherPopover
                      key={`absent-popover-${absence.teacher_id}`}
                      teacherName={teacherName}
                      teacherId={absence.teacher_id}
                      timeOffRequestId={absence.time_off_request_id}
                    >
                      {chip}
                    </AbsentTeacherPopover>
                  )

                  // If this absent teacher has substitutes, render them directly under the absent chip with an L-shaped connector
                  if (substitutes.length > 0) {
                    result.push(
                      <div
                        key={`absent-with-subs-${absence.teacher_id}`}
                        className="flex flex-col gap-0.5"
                      >
                        {absentChip}
                        {substitutes.map(sub => (
                          <div
                            key={`sub-row-${absence.teacher_id}-${sub.id || sub.teacher_id}`}
                            className="flex items-center gap-1 ml-2 mt-0.5"
                          >
                            <CornerDownRight className="h-3 w-3 text-gray-400 shrink-0" />
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold w-fit bg-teal-50 text-teal-600 border border-teal-200"
                              title="Substitute"
                            >
                              {sub.teacher_name || 'Unknown'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )
                  } else {
                    // No substitutes, just show the absent teacher chip
                    result.push(absentChip)
                  }
                } else if (group.assignment) {
                  // Handle regular teachers and floaters (from assignments array)
                  const assignment = group.assignment
                  let className =
                    'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold w-fit '
                  let title: string | undefined = undefined

                  if (assignment.is_floater) {
                    className +=
                      'bg-purple-100 text-purple-800 border border-purple-300 border-dashed'
                    title = 'Floater assignment'
                  } else if (assignment.is_flexible) {
                    if (assignment.staffing_event_id) {
                      // When Break Coverage feature is off, show all temp coverage as standard.
                      if (assignment.event_category === 'break' && BREAK_COVERAGE_ENABLED) {
                        className +=
                          'bg-indigo-50 text-indigo-700 border border-indigo-300 border-dashed'
                        title = 'Break Coverage'
                      } else {
                        className +=
                          'bg-[#fdf2f8] text-pink-700 border border-[#f9a8d4] border-dashed'
                        title = 'Temporary coverage'
                      }
                    } else {
                      className += 'bg-blue-50 text-blue-800 border border-blue-500 border-dashed'
                      title = 'Flex Teacher'
                    }
                  } else {
                    className += 'bg-blue-100 text-blue-800 border border-blue-300'
                  }

                  const chip = (
                    <span
                      key={assignment.id || assignment.teacher_id}
                      className={className}
                      title={title}
                      style={
                        assignment.is_flexible
                          ? assignment.staffing_event_id
                            ? assignment.event_category === 'break' && BREAK_COVERAGE_ENABLED
                              ? {
                                  borderColor: '#a5b4fc',
                                  backgroundColor: '#eef2ff',
                                  color: '#4338ca',
                                }
                              : {
                                  borderColor: '#f9a8d4',
                                  backgroundColor: '#fdf2f8',
                                  color: '#db2777',
                                }
                            : { borderColor: '#3b82f6' }
                          : !assignment.is_floater
                            ? { borderColor: '#93c5fd' }
                            : undefined
                      }
                    >
                      {assignment.teacher_name || 'Unknown'}
                      {BREAK_COVERAGE_ENABLED &&
                        assignment.break_start_time &&
                        assignment.break_end_time && (
                          <span className="ml-1 inline-flex items-center text-[10px] opacity-80 whitespace-nowrap">
                            ☕ {assignment.break_start_time.slice(0, 5)} -{' '}
                            {assignment.break_end_time.slice(0, 5)}
                          </span>
                        )}
                    </span>
                  )

                  result.push(chip)
                }

                return result
              })
            })()}
          </div>
        )}
    </div>
  )
}
