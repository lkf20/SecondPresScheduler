'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSchool } from '@/lib/contexts/SchoolContext'
import {
  invalidateSubAssignment,
  invalidateDashboard,
  invalidateWeeklySchedule,
} from '@/lib/utils/invalidation'
import { clearDataHealthCache } from '@/lib/dashboard/data-health-cache'
import { toast } from 'sonner'

export type PartialAssignmentInput = {
  /** coverage_request_shift_id */
  shift_id: string
  /** Optional HH:mm informational start time */
  partial_start_time?: string | null
  /** Optional HH:mm informational end time */
  partial_end_time?: string | null
}

export type AssignShiftsData = {
  sub_id: string
  coverage_request_id: string
  selected_shift_ids: string[]
  notes?: string
  /** Coverage_request_shift_ids to create as floater (0.5 each). Used for floater slots and conflict override. */
  is_floater_shift_ids?: string[]
  /**
   * Optional: shifts to create as partial assignments (is_partial=true).
   * Shifts in selected_shift_ids but NOT in this array are created as full assignments.
   * Each entry must have a shift_id present in selected_shift_ids.
   */
  partial_assignments?: PartialAssignmentInput[]
  /** Conflict resolutions per shift_id: 'floater' | 'move' | 'replace' */
  resolutions?: Record<string, string>
}

type UnassignShiftData = {
  assignment_id: string
}

export function useAssignSubShifts() {
  const queryClient = useQueryClient()
  const schoolId = useSchool()

  return useMutation({
    mutationFn: async (data: AssignShiftsData) => {
      const response = await fetch('/api/sub-finder/assign-shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to assign shifts' }))
        throw new Error(error.error || 'Failed to assign shifts')
      }

      return response.json()
    },
    onMutate: async variables => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['subRecommendations', schoolId] })
      await queryClient.cancelQueries({ queryKey: ['dashboard', schoolId] })
      await queryClient.cancelQueries({ queryKey: ['weeklySchedule', schoolId] })

      // Snapshot previous values for rollback
      const previousRecommendations = queryClient.getQueryData([
        'subRecommendations',
        schoolId,
        variables.coverage_request_id,
      ])
      const previousDashboard = queryClient.getQueryData(['dashboard', schoolId])

      return { previousRecommendations, previousDashboard }
    },
    onSuccess: async (data, variables) => {
      // Invalidate relevant queries
      await Promise.all([
        invalidateSubAssignment(queryClient, schoolId, variables.coverage_request_id),
        invalidateDashboard(queryClient, schoolId),
        invalidateWeeklySchedule(queryClient, schoolId),
      ])

      // Use server result counts (not payload intent) for accurate toast messaging
      const assignedShiftCount =
        typeof data?.assignments_created === 'number' ? data.assignments_created : 0
      const partialCount =
        typeof data?.partial_assignments_created === 'number' ? data.partial_assignments_created : 0
      const fullCount =
        typeof data?.full_assignments_created === 'number' ? data.full_assignments_created : 0

      const partialNote =
        partialCount > 0 && fullCount === 0
          ? ' (partial)'
          : partialCount > 0
            ? ` (${partialCount} partial)`
            : ''

      toast.success(
        `Assigned ${assignedShiftCount} shift${assignedShiftCount !== 1 ? 's' : ''}${partialNote}`
      )
    },
    onError: (error: Error, variables, context) => {
      // Rollback on error
      if (context?.previousRecommendations) {
        queryClient.setQueryData(
          ['subRecommendations', schoolId, variables.coverage_request_id],
          context.previousRecommendations
        )
      }
      if (context?.previousDashboard) {
        queryClient.setQueryData(['dashboard', schoolId], context.previousDashboard)
      }

      toast.error(`Failed to assign shifts: ${error.message}`)
    },
  })
}

export function useUnassignSubShift() {
  const queryClient = useQueryClient()
  const schoolId = useSchool()

  return useMutation({
    mutationFn: async (data: UnassignShiftData) => {
      const response = await fetch(`/api/sub-assignments/${data.assignment_id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to unassign shift' }))
        throw new Error(error.error || 'Failed to unassign shift')
      }

      return response.json()
    },
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['dashboard', schoolId] })
      await queryClient.cancelQueries({ queryKey: ['weeklySchedule', schoolId] })

      // Snapshot previous values
      const previousDashboard = queryClient.getQueryData(['dashboard', schoolId])
      const previousWeeklySchedule = queryClient.getQueryData(['weeklySchedule', schoolId])

      return { previousDashboard, previousWeeklySchedule }
    },
    onSuccess: async () => {
      clearDataHealthCache()
      await Promise.all([
        invalidateDashboard(queryClient, schoolId),
        invalidateWeeklySchedule(queryClient, schoolId),
      ])

      toast.success('Sub assignment removed')
    },
    onError: (error: Error, variables, context) => {
      // Rollback on error
      if (context?.previousDashboard) {
        queryClient.setQueryData(['dashboard', schoolId], context.previousDashboard)
      }
      if (context?.previousWeeklySchedule) {
        queryClient.setQueryData(['weeklySchedule', schoolId], context.previousWeeklySchedule)
      }

      toast.error(`Failed to unassign shift: ${error.message}`)
    },
  })
}
