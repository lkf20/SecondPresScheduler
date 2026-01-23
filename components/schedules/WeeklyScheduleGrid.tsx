'use client'

import { useState, useMemo } from 'react'
import ScheduleCell from './ScheduleCell'
import AssignmentModal from './AssignmentModal'
import type { WeeklyScheduleData } from '@/lib/api/weekly-schedule'

interface WeeklyScheduleGridProps {
  data: WeeklyScheduleData[]
}

export default function WeeklyScheduleGrid({ data }: WeeklyScheduleGridProps) {
  const [selectedCell, setSelectedCell] = useState<{
    day_of_week_id: string
    day_name: string
    time_slot_id: string
    time_slot_name: string
  } | null>(null)

  // Group data by time slot, then by day
  const gridData = useMemo(() => {
    const byTimeSlot = new Map<string, Map<string, WeeklyScheduleData>>()

    data.forEach(item => {
      if (!byTimeSlot.has(item.time_slot_id)) {
        byTimeSlot.set(item.time_slot_id, new Map())
      }
      const byDay = byTimeSlot.get(item.time_slot_id)!
      byDay.set(item.day_of_week_id, item)
    })

    return byTimeSlot
  }, [data])

  // Get unique time slots and days
  const timeSlots = useMemo(() => {
    const slots = Array.from(new Set(data.map(d => d.time_slot_id)))
    return slots
      .map(id => {
        const item = data.find(d => d.time_slot_id === id)
        return {
          id,
          code: item?.time_slot_code || '',
          name: item?.time_slot_name || '',
          display_order: item?.time_slot_display_order || 999,
        }
      })
      .sort((a, b) => (a.display_order || 999) - (b.display_order || 999))
  }, [data])

  const daysOfWeek = useMemo(() => {
    const days = Array.from(new Set(data.map(d => d.day_of_week_id)))
    return days
      .map(id => {
        const item = data.find(d => d.day_of_week_id === id)
        return {
          id,
          name: item?.day_name || '',
          number: item?.day_number || 0,
        }
      })
      .sort((a, b) => a.number - b.number)
  }, [data])

  const handleCellClick = (
    dayId: string,
    dayName: string,
    timeSlotId: string,
    timeSlotName: string
  ) => {
    setSelectedCell({
      day_of_week_id: dayId,
      day_name: dayName,
      time_slot_id: timeSlotId,
      time_slot_name: timeSlotName,
    })
  }

  const handleCloseModal = () => {
    setSelectedCell(null)
  }

  // Get assignments for selected cell
  const selectedCellData = selectedCell
    ? data.find(
        d =>
          d.day_of_week_id === selectedCell.day_of_week_id &&
          d.time_slot_id === selectedCell.time_slot_id
      )
    : null

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
                    className="border p-2 bg-muted font-medium text-center min-w-[200px]"
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
                    const cellData = gridData.get(slot.id)?.get(day.id)
                    return (
                      <td
                        key={day.id}
                        className="border p-2 align-top cursor-pointer"
                        onClick={() =>
                          handleCellClick(day.id, day.name, slot.id, slot.name || slot.code)
                        }
                      >
                        <ScheduleCell data={cellData} />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCell && selectedCellData && (
        <AssignmentModal
          dayName={selectedCell.day_name}
          timeSlotName={selectedCell.time_slot_name}
          data={selectedCellData}
          onClose={handleCloseModal}
        />
      )}
    </>
  )
}
