'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface Conflict {
  teacher_id: string
  teacher_name?: string
  conflicting_schedule_id: string
  conflicting_classroom_id: string
  conflicting_classroom_name?: string
  day_of_week_id: string
  day_of_week_name?: string
  time_slot_id: string
  time_slot_code?: string
  target_classroom_id: string
}

export type ConflictResolution = 'remove_other' | 'cancel' | 'mark_floater'

interface ConflictBannerProps {
  conflicts: Conflict[]
  onResolution: (conflictId: string, resolution: ConflictResolution) => void
  onApply: () => void
  onCancel: () => void
}

export default function ConflictBanner({
  conflicts,
  onResolution,
  onApply,
  onCancel,
}: ConflictBannerProps) {
  const [selectedResolutions, setSelectedResolutions] = useState<Map<string, ConflictResolution>>(new Map())

  const handleResolutionChange = (conflictId: string, resolution: ConflictResolution) => {
    const newResolutions = new Map(selectedResolutions)
    newResolutions.set(conflictId, resolution)
    setSelectedResolutions(newResolutions)
  }

  const handleApply = () => {
    // Apply all resolutions
    for (const [conflictId, resolution] of selectedResolutions.entries()) {
      onResolution(conflictId, resolution)
    }
    onApply()
  }

  const allResolved = conflicts.every((conflict) => selectedResolutions.has(conflict.conflicting_schedule_id))

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-amber-900 mb-2">
              Scheduling Conflicts Detected
            </h4>
            <p className="text-sm text-amber-800">
              The following teachers are already scheduled during this time slot:
            </p>
          </div>

          {conflicts.map((conflict) => {
            const conflictId = conflict.conflicting_schedule_id
            const selectedResolution = selectedResolutions.get(conflictId)

            return (
              <div
                key={conflictId}
                className="bg-white border border-amber-200 rounded-md p-3 space-y-3"
              >
                <div className="text-sm">
                  <span className="font-medium text-gray-900">
                    {conflict.teacher_name || 'Unknown teacher'}
                  </span>
                  <span className="text-gray-600">
                    {' '}is already scheduled{' '}
                  </span>
                  <span className="font-medium text-gray-900">
                    {conflict.day_of_week_name || 'Unknown day'} {conflict.time_slot_code || 'Unknown time'}
                  </span>
                  <span className="text-gray-600">
                    {' '}in{' '}
                  </span>
                  <span className="font-medium text-gray-900">
                    {conflict.conflicting_classroom_name || 'Unknown classroom'}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      type="button"
                      variant={selectedResolution === 'remove_other' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleResolutionChange(conflictId, 'remove_other')}
                      className={cn(
                        'flex-1',
                        selectedResolution === 'remove_other' && 'bg-blue-600 hover:bg-blue-700'
                      )}
                    >
                      Keep here and remove other assignment
                    </Button>
                    <Button
                      type="button"
                      variant={selectedResolution === 'cancel' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleResolutionChange(conflictId, 'cancel')}
                      className={cn(
                        'flex-1',
                        selectedResolution === 'cancel' && 'bg-blue-600 hover:bg-blue-700'
                      )}
                    >
                      Cancel adding to this slot
                    </Button>
                    <Button
                      type="button"
                      variant={selectedResolution === 'mark_floater' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleResolutionChange(conflictId, 'mark_floater')}
                      className={cn(
                        'flex-1',
                        selectedResolution === 'mark_floater' && 'bg-blue-600 hover:bg-blue-700'
                      )}
                    >
                      Keep both - mark as floater
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              onClick={handleApply}
              disabled={!allResolved}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Apply selection
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}




