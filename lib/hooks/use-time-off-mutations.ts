'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSchool } from '@/lib/contexts/SchoolContext'
import {
  invalidateTimeOffRequest,
  invalidateDashboard,
  invalidateSubFinderAbsences,
} from '@/lib/utils/invalidation'
import { toast } from 'sonner'

type CreateTimeOffRequestData = {
  teacher_id: string
  start_date: string
  end_date?: string
  reason?: string
  notes?: string
  shift_selection_mode: 'all_scheduled' | 'select_shifts'
  shifts?: Array<{
    date: string
    day_of_week_id: string
    time_slot_id: string
  }>
}

type UpdateTimeOffRequestData = {
  teacher_id?: string
  start_date?: string
  end_date?: string
  reason?: string
  notes?: string
  shift_selection_mode?: 'all_scheduled' | 'select_shifts'
  shifts?: Array<{
    date: string
    day_of_week_id: string
    time_slot_id: string
  }>
}

export function useCreateTimeOffRequest() {
  const queryClient = useQueryClient()
  const schoolId = useSchool()

  return useMutation({
    mutationFn: async (data: CreateTimeOffRequestData) => {
      const response = await fetch('/api/time-off', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: 'Failed to create time off request' }))
        throw new Error(error.error || 'Failed to create time off request')
      }

      return response.json()
    },
    onSuccess: async (data, variables) => {
      // Invalidate relevant queries
      await Promise.all([
        invalidateTimeOffRequest(queryClient, schoolId, data?.coverage_request_id),
        invalidateDashboard(queryClient, schoolId),
        invalidateSubFinderAbsences(queryClient, schoolId),
      ])

      const teacherName = variables.teacher_id // You might want to fetch the actual name
      toast.success(`Time off added for ${teacherName}`)
    },
    onError: (error: Error) => {
      toast.error(`Failed to create time off request: ${error.message}`)
    },
  })
}

export function useUpdateTimeOffRequest() {
  const queryClient = useQueryClient()
  const schoolId = useSchool()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTimeOffRequestData }) => {
      const response = await fetch(`/api/time-off/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: 'Failed to update time off request' }))
        throw new Error(error.error || 'Failed to update time off request')
      }

      return response.json()
    },
    onSuccess: async data => {
      // Invalidate relevant queries
      await Promise.all([
        invalidateTimeOffRequest(queryClient, schoolId, data?.coverage_request_id),
        invalidateDashboard(queryClient, schoolId),
        invalidateSubFinderAbsences(queryClient, schoolId),
      ])

      toast.success('Time off request updated')
    },
    onError: (error: Error) => {
      toast.error(`Failed to update time off request: ${error.message}`)
    },
  })
}

export function useCancelTimeOffRequest() {
  const queryClient = useQueryClient()
  const schoolId = useSchool()

  return useMutation({
    mutationFn: async ({
      id,
      action,
      assignmentHandling,
    }: {
      id: string
      action?: 'cancel_assignments' | 'keep_as_extra_coverage'
      assignmentHandling?: 'cancel_assignments' | 'keep_as_extra_coverage'
    }) => {
      const response = await fetch(`/api/time-off/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, assignmentHandling }),
      })

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: 'Failed to cancel time off request' }))
        throw new Error(error.error || 'Failed to cancel time off request')
      }

      return response.json()
    },
    onSuccess: async data => {
      // Invalidate relevant queries
      await Promise.all([
        invalidateTimeOffRequest(queryClient, schoolId, data?.coverage_request_id),
        invalidateDashboard(queryClient, schoolId),
        invalidateSubFinderAbsences(queryClient, schoolId),
      ])

      toast.success('Time off request cancelled')
    },
    onError: (error: Error) => {
      if (error.message === 'Time off request is already cancelled') {
        toast.info('This time off request was already cancelled.')
        return
      }
      toast.error(`Failed to cancel time off request: ${error.message}`)
    },
  })
}
