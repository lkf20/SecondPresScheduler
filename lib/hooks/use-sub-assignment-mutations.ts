'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSchool } from '@/lib/contexts/SchoolContext'
import { invalidateSubAssignment, invalidateDashboard, invalidateWeeklySchedule } from '@/lib/utils/invalidation'
import { toast } from 'sonner'

type AssignShiftsData = {
  sub_id: string
  coverage_request_id: string
  selected_shift_ids: string[]
  notes?: string
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
    onMutate: async (variables) => {
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

      const subName = data?.sub_name || 'Sub'
      const shiftCount = variables.selected_shift_ids.length
      toast.success(`Assigned ${subName} to ${shiftCount} shift${shiftCount !== 1 ? 's' : ''}`)
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
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['dashboard', schoolId] })
      await queryClient.cancelQueries({ queryKey: ['weeklySchedule', schoolId] })

      // Snapshot previous values
      const previousDashboard = queryClient.getQueryData(['dashboard', schoolId])
      const previousWeeklySchedule = queryClient.getQueryData(['weeklySchedule', schoolId])

      return { previousDashboard, previousWeeklySchedule }
    },
    onSuccess: async () => {
      // Invalidate relevant queries
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
