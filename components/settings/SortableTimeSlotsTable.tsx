'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Database } from '@/types/database'
import { useQueryClient } from '@tanstack/react-query'
import { useSchool } from '@/lib/contexts/SchoolContext'
import ActiveStatusChip from '@/components/settings/ActiveStatusChip'
import { invalidateSchedulingSurfaces } from '@/lib/utils/invalidation'

type TimeSlot = Database['public']['Tables']['time_slots']['Row']

interface SortableTimeSlotsTableProps {
  timeSlots: TimeSlot[]
}

const sortByDisplayOrderThenCode = (a: TimeSlot, b: TimeSlot) => {
  const orderA = a.display_order ?? Number.MAX_SAFE_INTEGER
  const orderB = b.display_order ?? Number.MAX_SAFE_INTEGER
  if (orderA !== orderB) return orderA - orderB
  return a.code.localeCompare(b.code)
}

const formatTime12Hour = (time24: string | null | undefined): string => {
  if (!time24) return '—'
  try {
    const [hours, minutes] = time24.split(':')
    const hour24 = Number.parseInt(hours, 10)
    if (Number.isNaN(hour24)) return time24
    const mins = minutes || '00'
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24
    const ampm = hour24 >= 12 ? 'PM' : 'AM'
    return `${hour12}:${mins} ${ampm}`
  } catch {
    return time24
  }
}

const timeToMinutes = (time24: string | null | undefined): number => {
  if (!time24) return Number.MAX_SAFE_INTEGER
  try {
    const [hours, minutes] = time24.split(':')
    const hour24 = Number.parseInt(hours, 10)
    const mins = Number.parseInt(minutes || '0', 10)
    if (Number.isNaN(hour24) || Number.isNaN(mins)) return Number.MAX_SAFE_INTEGER
    return hour24 * 60 + mins
  } catch {
    return Number.MAX_SAFE_INTEGER
  }
}

function SortableRow({ timeSlot }: { timeSlot: TimeSlot }) {
  const router = useRouter()
  const isActive = timeSlot.is_active !== false
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: timeSlot.id,
  })

  return (
    <TableRow
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={cn(
        'cursor-default transition-colors hover:bg-slate-50',
        isDragging && 'bg-muted hover:bg-muted'
      )}
      onClick={event => {
        const target = event.target as HTMLElement
        if (target.closest('button, a, input, textarea, select, [role="switch"]')) return
        router.push(`/settings/timeslots/${timeSlot.id}`)
      }}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          router.push(`/settings/timeslots/${timeSlot.id}`)
        }
      }}
      tabIndex={0}
    >
      <TableCell className="w-10 text-base">
        <button
          {...attributes}
          {...listeners}
          type="button"
          onClick={event => event.stopPropagation()}
          className="touch-none cursor-grab active:cursor-grabbing rounded p-1 hover:bg-accent"
          style={{ cursor: 'grab' }}
          aria-label={`Reorder ${timeSlot.name || timeSlot.code}`}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell className="text-base font-medium">{timeSlot.code}</TableCell>
      <TableCell className="text-base">{timeSlot.name || '—'}</TableCell>
      <TableCell className="text-base">{formatTime12Hour(timeSlot.default_start_time)}</TableCell>
      <TableCell className="text-base">{formatTime12Hour(timeSlot.default_end_time)}</TableCell>
      <TableCell>
        <ActiveStatusChip isActive={isActive} />
      </TableCell>
    </TableRow>
  )
}

export default function SortableTimeSlotsTable({
  timeSlots: initialTimeSlots,
}: SortableTimeSlotsTableProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const schoolId = useSchool()
  const [timeSlots, setTimeSlots] = useState(initialTimeSlots)
  const [isSaving, setIsSaving] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [startTimeSort, setStartTimeSort] = useState<'asc' | 'desc' | null>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    setTimeSlots([...initialTimeSlots].sort(sortByDisplayOrderThenCode))
  }, [initialTimeSlots])

  const displayedTimeSlots = useMemo(() => {
    if (!startTimeSort) return timeSlots
    const sorted = [...timeSlots].sort((a, b) => {
      const aMinutes = timeToMinutes(a.default_start_time)
      const bMinutes = timeToMinutes(b.default_start_time)
      if (aMinutes !== bMinutes) return aMinutes - bMinutes
      return a.code.localeCompare(b.code)
    })
    return startTimeSort === 'asc' ? sorted : sorted.reverse()
  }, [timeSlots, startTimeSort])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = displayedTimeSlots.findIndex(slot => slot.id === active.id)
    const newIndex = displayedTimeSlots.findIndex(slot => slot.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const reordered = arrayMove(displayedTimeSlots, oldIndex, newIndex).map((slot, index) => ({
      ...slot,
      display_order: index + 1,
    }))
    setTimeSlots(reordered)
    if (startTimeSort !== null) {
      setStartTimeSort(null)
    }

    setIsSaving(true)
    try {
      const changed = reordered.filter(slot => {
        const original = initialTimeSlots.find(s => s.id === slot.id)
        return original?.display_order !== slot.display_order
      })
      if (changed.length > 0) {
        await Promise.all(
          changed.map(async slot => {
            const response = await fetch(`/api/timeslots/${slot.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ display_order: slot.display_order }),
            })
            if (!response.ok) {
              let message = `Failed to update time slot order for ${slot.code}`
              try {
                const errorData = (await response.json()) as { error?: string }
                if (errorData?.error) message = errorData.error
              } catch {
                // Ignore JSON parse issues and keep fallback message.
              }
              throw new Error(message)
            }
          })
        )
        await invalidateSchedulingSurfaces(queryClient, schoolId)
      }
    } catch (error) {
      console.error('Failed to save time slot order:', error)
      setTimeSlots(initialTimeSlots)
      alert('Failed to save time slot order. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        {isSaving && <span className="text-sm text-muted-foreground">Saving...</span>}
      </div>

      {isMounted ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-left hover:text-slate-900"
                      onClick={() =>
                        setStartTimeSort(current => {
                          if (current === null) return 'asc'
                          return current === 'asc' ? 'desc' : 'asc'
                        })
                      }
                    >
                      Start Time
                      {startTimeSort === null || startTimeSort === 'asc' ? (
                        <ArrowUp className="h-3.5 w-3.5 text-slate-500" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-slate-500" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead>End Time</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedTimeSlots.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-base text-muted-foreground">
                      No time slots found
                    </TableCell>
                  </TableRow>
                ) : (
                  <SortableContext
                    items={displayedTimeSlots.map(slot => slot.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {displayedTimeSlots.map(slot => (
                      <SortableRow key={slot.id} timeSlot={slot} />
                    ))}
                  </SortableContext>
                )}
              </TableBody>
            </Table>
          </div>
        </DndContext>
      ) : (
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-left hover:text-slate-900"
                    onClick={() => {
                      setStartTimeSort(current => {
                        if (current === null) return 'asc'
                        return current === 'asc' ? 'desc' : 'asc'
                      })
                    }}
                  >
                    Start Time
                    {startTimeSort === null || startTimeSort === 'asc' ? (
                      <ArrowUp className="h-3.5 w-3.5 text-slate-500" />
                    ) : (
                      <ArrowDown className="h-3.5 w-3.5 text-slate-500" />
                    )}
                  </button>
                </TableHead>
                <TableHead>End Time</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedTimeSlots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-base text-muted-foreground">
                    No time slots found
                  </TableCell>
                </TableRow>
              ) : (
                displayedTimeSlots.map(slot => {
                  const isActive = slot.is_active !== false
                  return (
                    <TableRow
                      key={slot.id}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                      onClick={event => {
                        const target = event.target as HTMLElement
                        if (target.closest('button, a, input, textarea, select, [role="switch"]'))
                          return
                        router.push(`/settings/timeslots/${slot.id}`)
                      }}
                    >
                      <TableCell className="w-10 text-base">
                        <div className="rounded p-1">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </TableCell>
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
      )}
    </div>
  )
}
