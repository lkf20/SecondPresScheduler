'use client'

import { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import ScheduleCell from './ScheduleCell'
import ScheduleSidePanel from './ScheduleSidePanel'
import type { WeeklyScheduleDataByClassroom } from '@/lib/api/weekly-schedule'

interface WeeklyScheduleGridNewProps {
  data: WeeklyScheduleDataByClassroom[]
  selectedDayIds: string[]
}

export default function WeeklyScheduleGridNew({
  data,
  selectedDayIds,
}: WeeklyScheduleGridNewProps) {
  const [selectedCell, setSelectedCell] = useState<{
    dayId: string
    dayName: string
    timeSlotId: string
    timeSlotName: string
    classroomId: string
    classroomName: string
  } | null>(null)

  // Extract unique days and time slots from data, filtered by selectedDayIds
  const { days, timeSlots } = useMemo(() => {
    const daySet = new Map<string, { id: string; name: string; number: number }>()
    const timeSlotSet = new Map<string, { id: string; code: string; name: string | null; display_order: number | null }>()

    data.forEach((classroom) => {
      classroom.days.forEach((day) => {
        // Only include days that are in selectedDayIds (if selectedDayIds is provided and not empty)
        if (selectedDayIds.length > 0 && !selectedDayIds.includes(day.day_of_week_id)) {
          return
        }
        
        if (!daySet.has(day.day_of_week_id)) {
          daySet.set(day.day_of_week_id, {
            id: day.day_of_week_id,
            name: day.day_name,
            number: day.day_number,
          })
        }
        day.time_slots.forEach((slot) => {
          if (!timeSlotSet.has(slot.time_slot_id)) {
            timeSlotSet.set(slot.time_slot_id, {
              id: slot.time_slot_id,
              code: slot.time_slot_code,
              name: slot.time_slot_name,
              display_order: slot.time_slot_display_order,
            })
          }
        })
      })
    })

    const daysArray = Array.from(daySet.values()).sort((a, b) => {
      // Handle Sunday (day_number 0 or 7) for sorting
      const aNum = a.number === 0 ? 7 : a.number
      const bNum = b.number === 0 ? 7 : b.number
      return aNum - bNum
    })
    const timeSlotsArray = Array.from(timeSlotSet.values()).sort((a, b) => {
      const orderA = a.display_order ?? 999
      const orderB = b.display_order ?? 999
      return orderA - orderB
    })

    return { days: daysArray, timeSlots: timeSlotsArray }
  }, [data, selectedDayIds])

  const handleCellClick = (
    dayId: string,
    dayName: string,
    timeSlotId: string,
    timeSlotName: string,
    classroomId: string,
    classroomName: string
  ) => {
    setSelectedCell({
      dayId,
      dayName,
      timeSlotId,
      timeSlotName,
      classroomId,
      classroomName,
    })
  }

  const handleClosePanel = () => {
    setSelectedCell(null)
  }

  // Get assignments for selected cell
  const selectedCellData = selectedCell
    ? (() => {
        const classroom = data.find((c) => c.classroom_id === selectedCell.classroomId)
        if (!classroom) return null

        const day = classroom.days.find((d) => d.day_of_week_id === selectedCell.dayId)
        if (!day) return null

        const timeSlot = day.time_slots.find((ts) => ts.time_slot_id === selectedCell.timeSlotId)
        return timeSlot ? timeSlot.assignments : null
      })()
    : null

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <div className="min-w-full">
          <Table>
            <TableHeader>
              {/* Day headers row */}
              <TableRow>
                <TableHead className="sticky left-0 z-20 bg-background border-r min-w-[150px]">
                  Classroom
                </TableHead>
                {days.map((day) => (
                  <TableHead
                    key={day.id}
                    colSpan={timeSlots.length}
                    className="text-center bg-muted border-r last:border-r-0"
                  >
                    {day.name}
                  </TableHead>
                ))}
              </TableRow>
              {/* Time slot sub-headers row */}
              <TableRow>
                <TableHead className="sticky left-0 z-20 bg-background border-r"></TableHead>
                {days.map((day) =>
                  timeSlots.map((slot) => (
                    <TableHead
                      key={`${day.id}-${slot.id}`}
                      className="text-center bg-muted/50 min-w-[120px] border-r last:border-r-0"
                    >
                      {slot.code}
                    </TableHead>
                  ))
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((classroom) => (
                <TableRow key={classroom.classroom_id}>
                  <TableCell className="sticky left-0 z-10 bg-background border-r font-medium">
                    {classroom.classroom_name}
                  </TableCell>
                  {days
                    .filter((day) => {
                      // Only show days that are in selectedDayIds (if selectedDayIds is provided and not empty)
                      if (selectedDayIds.length > 0) {
                        return selectedDayIds.includes(day.id)
                      }
                      return true
                    })
                    .map((day) => {
                      const dayData = classroom.days.find((d) => d.day_of_week_id === day.id)
                      return timeSlots.map((slot) => {
                        const timeSlotData = dayData?.time_slots.find(
                          (ts) => ts.time_slot_id === slot.id
                        )
                        const cellData = timeSlotData
                          ? {
                              day_of_week_id: day.id,
                              day_name: day.name,
                              day_number: day.number,
                              time_slot_id: slot.id,
                              time_slot_code: slot.code,
                              time_slot_name: slot.name,
                              time_slot_display_order: slot.display_order,
                              assignments: timeSlotData.assignments,
                            }
                          : undefined

                        return (
                          <TableCell
                            key={`${classroom.classroom_id}-${day.id}-${slot.id}`}
                            className="border-r last:border-r-0 align-top p-2"
                          >
                            <ScheduleCell
                              data={cellData}
                              onClick={() =>
                                handleCellClick(
                                  day.id,
                                  day.name,
                                  slot.id,
                                  slot.name || slot.code,
                                  classroom.classroom_id,
                                  classroom.classroom_name
                                )
                              }
                            />
                          </TableCell>
                        )
                      })
                    })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedCell && selectedCellData && (
        <ScheduleSidePanel
          isOpen={!!selectedCell}
          onClose={handleClosePanel}
          dayId={selectedCell.dayId}
          dayName={selectedCell.dayName}
          timeSlotId={selectedCell.timeSlotId}
          timeSlotName={selectedCell.timeSlotName}
          classroomId={selectedCell.classroomId}
          classroomName={selectedCell.classroomName}
          assignments={selectedCellData}
        />
      )}
    </>
  )
}

