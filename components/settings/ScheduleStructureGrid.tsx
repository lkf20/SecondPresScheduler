'use client'

import { useState, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import MappingConfigurationModal from './MappingConfigurationModal'
import type { ClassClassroomMappingWithDetails } from '@/lib/api/class-classroom-mappings'
import { Database } from '@/types/database'

type DayOfWeek = Database['public']['Tables']['days_of_week']['Row']
type TimeSlot = Database['public']['Tables']['time_slots']['Row']

interface ScheduleStructureGridProps {
  mappings: ClassClassroomMappingWithDetails[]
  selectedDayIds: string[]
  onMappingsChange: () => void
}

export default function ScheduleStructureGrid({
  mappings,
  selectedDayIds,
  onMappingsChange,
}: ScheduleStructureGridProps) {
  const [selectedCell, setSelectedCell] = useState<{
    day_of_week_id: string
    day_name: string
    time_slot_id: string
    time_slot_code: string
  } | null>(null)

  // Fetch days and time slots
  const [daysOfWeek, setDaysOfWeek] = useState<DayOfWeek[]>([])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])

  useEffect(() => {
    fetch('/api/days-of-week')
      .then(r => r.json())
      .then(data => {
        // Filter to only show selected days
        const filtered = (data as DayOfWeek[]).filter(d => selectedDayIds.includes(d.id))
        // Handle both old (0) and new (7) Sunday values for sorting
        const sorted = filtered.sort((a, b) => {
          const aNum = a.day_number === 0 ? 7 : a.day_number
          const bNum = b.day_number === 0 ? 7 : b.day_number
          return aNum - bNum
        })
        setDaysOfWeek(sorted)
      })
      .catch(console.error)

    fetch('/api/timeslots')
      .then(r => r.json())
      .then(data => {
        setTimeSlots(
          (data as TimeSlot[]).sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
        )
      })
      .catch(console.error)
  }, [selectedDayIds])

  // Count mappings per day/time slot
  const mappingCounts = useMemo(() => {
    const counts = new Map<string, number>()
    mappings.forEach(mapping => {
      const key = `${mapping.day_of_week_id}-${mapping.time_slot_id}`
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    return counts
  }, [mappings])

  const handleCellClick = (
    dayId: string,
    dayName: string,
    timeSlotId: string,
    timeSlotCode: string
  ) => {
    setSelectedCell({
      day_of_week_id: dayId,
      day_name: dayName,
      time_slot_id: timeSlotId,
      time_slot_code: timeSlotCode,
    })
  }

  const handleCloseModal = () => {
    setSelectedCell(null)
    onMappingsChange() // Refresh mappings after changes
  }

  // Get mappings for selected cell
  const selectedCellMappings = selectedCell
    ? mappings.filter(
        m =>
          m.day_of_week_id === selectedCell.day_of_week_id &&
          m.time_slot_id === selectedCell.time_slot_id
      )
    : []

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <div className="min-w-full">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border p-2 bg-muted font-medium text-left sticky left-0 z-10">
                  Time Slot
                </th>
                {daysOfWeek.map(day => (
                  <th
                    key={day.id}
                    className="border p-2 bg-muted font-medium text-center min-w-[150px]"
                  >
                    {day.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map(slot => (
                <tr key={slot.id}>
                  <td className="border p-2 bg-muted font-medium sticky left-0 z-10">
                    {slot.code}
                    {slot.name && <div className="text-xs text-muted-foreground">{slot.name}</div>}
                  </td>
                  {daysOfWeek.map(day => {
                    const key = `${day.id}-${slot.id}`
                    const count = mappingCounts.get(key) || 0
                    return (
                      <td key={day.id} className="border p-2 align-top">
                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">
                            {count} mapping{count !== 1 ? 's' : ''}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => handleCellClick(day.id, day.name, slot.id, slot.code)}
                          >
                            Configure
                          </Button>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCell && (
        <MappingConfigurationModal
          dayName={selectedCell.day_name}
          timeSlotCode={selectedCell.time_slot_code}
          dayOfWeekId={selectedCell.day_of_week_id}
          timeSlotId={selectedCell.time_slot_id}
          existingMappings={selectedCellMappings}
          onClose={handleCloseModal}
        />
      )}
    </>
  )
}
