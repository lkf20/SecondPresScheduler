'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Database } from '@/types/database'
import ActiveStatusChip from '@/components/settings/ActiveStatusChip'

type TimeSlot = Database['public']['Tables']['time_slots']['Row']

interface SortableTimeSlotsTableProps {
  timeSlots: TimeSlot[]
}

const sortByDisplayOrderThenCode = (a: TimeSlot, b: TimeSlot) => {
  const orderA = a.display_order ?? Number.MAX_SAFE_INTEGER
  const orderB = b.display_order ?? Number.MAX_SAFE_INTEGER
  if (orderA !== orderB) return orderA - orderB
  return (a.code || '').localeCompare(b.code || '')
}

const formatTime12Hour = (time24: string | null | undefined): string => {
  if (!time24) return '—'
  const [hours, minutes] = time24.split(':')
  const hour24 = Number.parseInt(hours, 10)
  if (Number.isNaN(hour24)) return time24
  const mins = minutes || '00'
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24
  const ampm = hour24 >= 12 ? 'PM' : 'AM'
  return `${hour12}:${mins} ${ampm}`
}

export default function SortableTimeSlotsTable({ timeSlots }: SortableTimeSlotsTableProps) {
  const router = useRouter()
  const orderedTimeSlots = useMemo(
    () => [...timeSlots].sort(sortByDisplayOrderThenCode),
    [timeSlots]
  )

  return (
    <div className="rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Start Time</TableHead>
            <TableHead>End Time</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orderedTimeSlots.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-base text-muted-foreground">
                No time slots found
              </TableCell>
            </TableRow>
          ) : (
            orderedTimeSlots.map(slot => {
              const isActive = slot.is_active !== false
              return (
                <TableRow
                  key={slot.id}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                  onClick={event => {
                    const target = event.target as HTMLElement
                    if (target.closest('button, a, input, textarea, select, [role=\"switch\"]'))
                      return
                    router.push(`/settings/timeslots/${slot.id}`)
                  }}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      router.push(`/settings/timeslots/${slot.id}`)
                    }
                  }}
                  tabIndex={0}
                >
                  <TableCell className="text-base font-medium">{slot.code}</TableCell>
                  <TableCell className="text-base">{slot.name || '—'}</TableCell>
                  <TableCell className="text-base">
                    {formatTime12Hour(slot.default_start_time)}
                  </TableCell>
                  <TableCell className="text-base">
                    {formatTime12Hour(slot.default_end_time)}
                  </TableCell>
                  <TableCell>
                    <ActiveStatusChip isActive={isActive} />
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
