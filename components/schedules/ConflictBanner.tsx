'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'

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
  /** How the teacher is scheduled in the other room (for copy) */
  conflicting_role_label?: 'Permanent teacher' | 'Flex teacher' | 'Floater'
  /** True if user added this teacher as floater here; show "assign as Floater in both?" message */
  added_as_floater?: boolean
}

export type ConflictResolution = 'remove_other' | 'cancel' | 'mark_floater'

interface ConflictBannerProps {
  conflicts: Conflict[]
  onResolution: (conflictId: string, resolution: ConflictResolution) => void
  /** Called with the current selected resolutions so the handler can use them immediately (state may not have updated yet). */
  onApply: (resolutions: Map<string, ConflictResolution>) => void
  onCancel: () => void
}

export default function ConflictBanner({
  conflicts,
  onResolution,
  onApply,
  onCancel,
}: ConflictBannerProps) {
  const [selectedResolutions, setSelectedResolutions] = useState<Map<string, ConflictResolution>>(
    new Map()
  )

  const handleResolutionChange = (conflictId: string, resolution: ConflictResolution) => {
    const newResolutions = new Map(selectedResolutions)
    newResolutions.set(conflictId, resolution)
    setSelectedResolutions(newResolutions)
  }

  const handleApply = () => {
    // Sync panel state first
    for (const [conflictId, resolution] of selectedResolutions.entries()) {
      onResolution(conflictId, resolution)
    }
    // Pass resolutions so handler can use them immediately (state update is async)
    onApply(selectedResolutions)
  }

  const allResolved = conflicts.every(conflict =>
    selectedResolutions.has(conflict.conflicting_schedule_id)
  )

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-4">
      <div className="flex items-start gap-3 min-w-0">
        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1 space-y-3 min-w-0">
          <div>
            <h4 className="text-sm font-semibold text-amber-900 mb-2">
              Scheduling Conflicts Detected
            </h4>
            <p className="text-sm text-amber-800">
              The following teachers are already scheduled during this time slot:
            </p>
          </div>

          {conflicts.map(conflict => {
            const conflictId = conflict.conflicting_schedule_id
            const selectedResolution = selectedResolutions.get(conflictId)
            const roleLabel = conflict.conflicting_role_label ?? 'teacher'
            const isInconsistentFloater = conflict.added_as_floater === true

            return (
              <div
                key={conflictId}
                className="bg-white border border-amber-200 rounded-md p-3 space-y-3 min-w-0"
              >
                <p className="text-sm text-gray-700 min-w-0 break-words">
                  <span className="font-medium text-gray-900">
                    {conflict.teacher_name || 'Unknown teacher'}
                  </span>
                  {isInconsistentFloater ? (
                    <>
                      <span className="text-gray-600"> is already scheduled as a </span>
                      <span className="font-medium text-gray-900">{roleLabel}</span>
                      <span className="text-gray-600">
                        {' '}
                        in{' '}
                        <span className="font-medium text-gray-900">
                          {conflict.conflicting_classroom_name || 'Unknown classroom'}
                        </span>{' '}
                        during this day and time slot. Would you like to assign them as a Floater in
                        both classrooms?
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-gray-600"> is already scheduled in </span>
                      <span className="font-medium text-gray-900">
                        {conflict.conflicting_classroom_name || 'Unknown classroom'}
                      </span>
                      <span className="text-gray-600">
                        {' '}
                        during{' '}
                        <span className="font-medium text-gray-900">
                          {conflict.day_of_week_name || 'Unknown day'}{' '}
                          {conflict.time_slot_code || 'Unknown time'}
                        </span>
                        .
                      </span>
                    </>
                  )}
                </p>

                <RadioGroup
                  value={selectedResolution ?? ''}
                  onValueChange={(value: string) =>
                    handleResolutionChange(conflictId, value as ConflictResolution)
                  }
                  className="grid gap-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="remove_other" id={`${conflictId}-remove_other`} />
                    <Label
                      htmlFor={`${conflictId}-remove_other`}
                      className="text-sm font-normal cursor-pointer flex-1 min-w-0"
                    >
                      Keep here and remove other assignment
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cancel" id={`${conflictId}-cancel`} />
                    <Label
                      htmlFor={`${conflictId}-cancel`}
                      className="text-sm font-normal cursor-pointer flex-1 min-w-0"
                    >
                      Cancel adding to this slot
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="mark_floater" id={`${conflictId}-mark_floater`} />
                    <Label
                      htmlFor={`${conflictId}-mark_floater`}
                      className="text-sm font-normal cursor-pointer flex-1 min-w-0"
                    >
                      Keep both — Mark as Floater
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )
          })}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="teal" onClick={handleApply} disabled={!allResolved}>
              Apply selection
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
