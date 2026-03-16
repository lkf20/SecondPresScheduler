'use client'

import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { clearDataHealthCache } from '@/lib/dashboard/data-health-cache'
import { invalidateSubAssignment } from '@/lib/utils/invalidation'

export type UnassignScope = 'single' | 'all_for_absence'

export interface UnassignContext {
  /** Time off request ID or coverage request ID (API resolves to time_off_request) */
  absenceId: string
  subId: string
  subName?: string
  teacherName?: string
  /** Required for scope 'single' */
  assignmentId?: string | null
  /** Alternative for scope 'single' when assignmentId is not available */
  coverageRequestShiftId?: string | null
}

export interface UseUnassignSubOptions {
  schoolId: string
  onSuccess?: () => void | Promise<void>
  coverageRequestId?: string
}

export function useUnassignSub({ schoolId, onSuccess, coverageRequestId }: UseUnassignSubOptions) {
  const queryClient = useQueryClient()
  const [isPending, setIsPending] = useState(false)

  const unassign = useCallback(
    async (scope: UnassignScope, context: UnassignContext) => {
      if (!context.subId || !context.absenceId) {
        toast.error('Missing information to remove sub. Try refreshing.')
        return
      }
      if (scope === 'single' && !context.assignmentId && !context.coverageRequestShiftId) {
        toast.error('Unable to remove this assignment. Try refreshing the page.')
        return
      }

      try {
        setIsPending(true)
        const response = await fetch('/api/sub-finder/unassign-shifts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            absence_id: context.absenceId,
            sub_id: context.subId,
            scope,
            assignment_id: scope === 'single' ? context.assignmentId : undefined,
            coverage_request_shift_id:
              scope === 'single' ? context.coverageRequestShiftId : undefined,
          }),
        })

        if (!response.ok) {
          const errorBody = await response
            .json()
            .catch(() => ({ error: 'Failed to remove sub assignment.' }))
          throw new Error(errorBody.error || 'Failed to remove sub assignment.')
        }

        clearDataHealthCache()
        await invalidateSubAssignment(queryClient, schoolId, coverageRequestId ?? context.absenceId)
        const result = await response.json().catch(() => ({ removed_count: 0 }))

        const removedSubName = context.subName || 'the sub'
        const removedCount = result.removed_count || 0
        const remainingOnShift = result.remaining_active_on_target_shift

        if (scope === 'single' && typeof remainingOnShift === 'number' && remainingOnShift > 0) {
          toast.success(
            `Removed ${removedSubName} from this assignment (${removedCount}). ${remainingOnShift} active assignment${remainingOnShift === 1 ? '' : 's'} still remain on this shift.`
          )
        } else {
          toast.success(
            scope === 'single'
              ? `Removed ${removedSubName} from this shift (${removedCount} assignment${removedCount === 1 ? '' : 's'}).`
              : `Removed ${removedSubName} from all shifts for this request (${removedCount} assignment${removedCount === 1 ? '' : 's'}).`
          )
        }

        await onSuccess?.()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to remove sub assignment.'
        toast.error(message)
        throw error
      } finally {
        setIsPending(false)
      }
    },
    [schoolId, queryClient, onSuccess, coverageRequestId]
  )

  return { unassign, isPending }
}
