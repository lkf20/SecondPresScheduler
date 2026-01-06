'use client'

import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { WeeklyScheduleData } from '@/lib/api/weekly-schedule'

interface ScheduleCellProps {
  data?: WeeklyScheduleData & {
    schedule_cell?: {
      id: string
      is_active: boolean
      enrollment_for_staffing: number | null
      notes: string | null
      class_groups?: Array<{
        id: string
        name: string
        min_age: number | null
        max_age: number | null
        required_ratio: number
        preferred_ratio: number | null
      }>
    } | null
  }
  day_of_week_id?: string
  time_slot_id?: string
  onClick: () => void
}

export default function ScheduleCell({ data, day_of_week_id, time_slot_id, onClick }: ScheduleCellProps) {
  const scheduleCell = data?.schedule_cell
  const isInactive = scheduleCell && !scheduleCell.is_active
  const isActive = scheduleCell?.is_active ?? false

  // Get class group names from schedule_cell (comma-separated)
  const classGroupNames = scheduleCell?.class_groups && scheduleCell.class_groups.length > 0
    ? scheduleCell.class_groups.map(cg => cg.name).join(', ')
    : (data?.assignments && data.assignments.length > 0 ? data.assignments.find(a => a.class_name)?.class_name : null)
  
  // Get enrollment for display
  const enrollment = scheduleCell?.enrollment_for_staffing ?? null

  // Calculate staffing status and tooltip message
  const getStaffingStatus = () => {
    if (!isActive || !scheduleCell?.class_groups || scheduleCell.class_groups.length === 0) return { status: null, message: null }
    
    // Find class group with lowest min_age for ratio calculation
    const classGroupForRatio = scheduleCell.class_groups.reduce((lowest, current) => {
      const currentMinAge = current.min_age ?? Infinity
      const lowestMinAge = lowest.min_age ?? Infinity
      return currentMinAge < lowestMinAge ? current : lowest
    })
    
    const requiredTeachers = classGroupForRatio.required_ratio && scheduleCell.enrollment_for_staffing
      ? Math.ceil(scheduleCell.enrollment_for_staffing / classGroupForRatio.required_ratio)
      : undefined
    
    const preferredTeachers = classGroupForRatio.preferred_ratio && scheduleCell.enrollment_for_staffing
      ? Math.ceil(scheduleCell.enrollment_for_staffing / classGroupForRatio.preferred_ratio)
      : undefined

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
        message: `Below required staffing by ${shortfall.toFixed(1)}`
      }
    } else if (preferredTeachers !== undefined && roundedCount < preferredTeachers) {
      const shortfall = Math.round((preferredTeachers - roundedCount) * 10) / 10
      return {
        status: 'amber',
        message: `Below preferred staffing by ${shortfall.toFixed(1)}`
      }
    } else {
      return {
        status: 'green',
        message: `Meets preferred staffing (${roundedCount.toFixed(1)} teachers)`
      }
    }
  }

  const { status: staffingStatus, message: staffingMessage } = getStaffingStatus()

  return (
    <div
      className={`min-h-[60px] p-3 cursor-pointer transition-colors ${
        isInactive 
          ? '' 
          : 'hover:bg-gray-50/50'
      }`}
      onClick={onClick}
    >
      {isActive && (
        <div className="flex items-start justify-between mb-1">
          {classGroupNames && (
            <div className="text-xs font-normal text-muted-foreground">
              {classGroupNames}
              {enrollment !== null && enrollment !== undefined && (
                <span className="text-muted-foreground/70"> ({enrollment})</span>
              )}
            </div>
          )}
          {staffingStatus && staffingMessage && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex-shrink-0 ml-2">
                    {staffingStatus === 'green' && (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                    {staffingStatus === 'amber' && (
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    )}
                    {staffingStatus === 'red' && (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
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
      {isActive && scheduleCell?.class_groups && scheduleCell.class_groups.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-1">
          {(() => {
            // Filter assignments for this slot (teachers are assigned to the slot, not individual class groups)
            const classGroupIds = scheduleCell.class_groups.map(cg => cg.id)
            const filteredAssignments = data?.assignments.filter(
              a => a.teacher_id && a.class_id && classGroupIds.includes(a.class_id)
            ) || []
            
            // Separate regular teachers and floaters
            const regularTeachers = filteredAssignments.filter(a => !a.is_floater)
            const floaters = filteredAssignments.filter(a => a.is_floater)
            
            // Sort each group alphabetically by display name
            const sortedRegular = regularTeachers.sort((a, b) => 
              (a.teacher_name || 'Unknown').localeCompare(b.teacher_name || 'Unknown')
            )
            const sortedFloaters = floaters.sort((a, b) => 
              (a.teacher_name || 'Unknown').localeCompare(b.teacher_name || 'Unknown')
            )
            
            // Combine: regular teachers first, then floaters
            const sortedAssignments = [...sortedRegular, ...sortedFloaters]
            
            return sortedAssignments.map((assignment) => (
              <span
                key={assignment.id || assignment.teacher_id}
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold w-fit ${
                  assignment.is_floater
                    ? 'bg-purple-100 text-purple-800 border border-purple-300 border-dashed'
                    : 'bg-blue-100 text-blue-800'
                }`}
                title={assignment.is_floater ? 'Floater assignment' : undefined}
              >
                {assignment.teacher_name || 'Unknown'}
              </span>
            ))
          })()}
        </div>
      )}
    </div>
  )
}

