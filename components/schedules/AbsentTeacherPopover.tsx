'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface AbsentTeacherPopoverProps {
  teacherName: string
  teacherId: string
  timeOffRequestId?: string
  children: React.ReactNode
}

export default function AbsentTeacherPopover({
  teacherName,
  teacherId,
  timeOffRequestId,
  children,
}: AbsentTeacherPopoverProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const handleFindSub = () => {
    setOpen(false)
    // Navigate to Sub Finder in Existing Absences mode
    // If we have a time_off_request_id, use it as absence_id
    // Otherwise, filter by teacher_id
    if (timeOffRequestId) {
      router.push(`/sub-finder?absence_id=${timeOffRequestId}`)
    } else {
      router.push(`/sub-finder?teacher_id=${teacherId}`)
    }
  }

  const handleEditTimeOff = () => {
    setOpen(false)
    // Navigate to Time Off page with the time off request in edit mode
    if (timeOffRequestId) {
      router.push(`/time-off?edit=${timeOffRequestId}`)
    } else {
      // Fallback: just go to time off page
      router.push(`/time-off`)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-gray-900">{teacherName} - Absent</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={handleFindSub} className="w-full justify-start" variant="default">
              Find sub
            </Button>
            <Button
              onClick={handleEditTimeOff}
              className="w-full justify-start"
              variant="outline"
              disabled={!timeOffRequestId}
            >
              Edit time off
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
