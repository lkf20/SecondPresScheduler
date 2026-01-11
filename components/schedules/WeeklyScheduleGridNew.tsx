'use client'

import React, { useState, useMemo } from 'react'
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import ScheduleCell from './ScheduleCell'
import ScheduleSidePanel from './ScheduleSidePanel'
import type { WeeklyScheduleData, WeeklyScheduleDataByClassroom } from '@/lib/api/weekly-schedule'

interface WeeklyScheduleGridNewProps {
  data: WeeklyScheduleDataByClassroom[]
  selectedDayIds: string[]
  layout: 'classrooms-x-days' | 'days-x-classrooms'
  onRefresh?: () => void
  onFilterPanelOpenChange?: (open: boolean) => void
  filterPanelOpen?: boolean
}

type WeeklyScheduleCellData = WeeklyScheduleData & {
  schedule_cell: WeeklyScheduleDataByClassroom['days'][number]['time_slots'][number]['schedule_cell']
}

// Helper function to convert hex color to rgba with opacity
function hexToRgba(hex: string, opacity: number = 0.08): string {
  // Remove # if present
  const cleanHex = hex.replace('#', '')
  
  // Parse RGB values
  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)
  
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

// Helper function to generate grid template for days-x-classrooms layout
function generateDaysXClassroomsGridTemplate(
  classroomCount: number,
  days: Array<{ id: string; name: string; number: number }>,
  timeSlots: Array<{ id: string; code: string }>
): { columns: string; rows: string } {
  // Columns: Combined Day/Time (120px) + Classrooms (minmax(180px, 1fr) each) - widened for better card fit
  const columns = `120px repeat(${classroomCount}, minmax(180px, 1fr))`
  
  // Rows: Header (auto) + (Spacer row + Day header + time slots for each day)
  // For the first day: no spacer, just day header + time slots
  // For subsequent days: spacer row + day header + time slots
  const dayRows = days.map((day, dayIndex) => {
    const spacerRow = dayIndex === 0 ? '' : '16px' // Add spacer before each day except the first
    const dayHeaderRow = '36px' // Fixed small height for day headers (accommodates padding + text)
    const timeSlotRows = timeSlots.map(() => 'minmax(120px, auto)').join(' ')
    return dayIndex === 0 
      ? `${dayHeaderRow} ${timeSlotRows}`
      : `${spacerRow} ${dayHeaderRow} ${timeSlotRows}`
  }).join(' ')
  
  const rows = `auto ${dayRows}`
  
  return { columns, rows }
}

// Helper function to generate grid template for classrooms-x-days layout
function generateClassroomsXDaysGridTemplate(
  dayCount: number,
  timeSlotCount: number
): { columns: string; rows: string } {
  // Columns: Classroom (150px) + (Day columns: each day has timeSlotCount columns)
  const dayColumns = Array(dayCount).fill(`repeat(${timeSlotCount}, minmax(140px, 1fr))`).join(' ')
  const columns = `150px ${dayColumns}`
  
  // Rows: 2 header rows + 1 row per classroom
  const rows = `auto auto repeat(${dayCount > 0 ? 'auto' : '0'}, minmax(120px, auto))`
  
  return { columns, rows }
}

export default function WeeklyScheduleGridNew({
  data,
  selectedDayIds,
  layout,
  onRefresh,
  onFilterPanelOpenChange,
  filterPanelOpen = false,
}: WeeklyScheduleGridNewProps) {
  const [selectedCell, setSelectedCell] = useState<{
    dayId: string
    dayName: string
    timeSlotId: string
    timeSlotName: string
    timeSlotCode: string
    timeSlotStartTime: string | null
    timeSlotEndTime: string | null
    classroomId: string
    classroomName: string
  } | null>(null)

  // Extract unique days and time slots from data, filtered by selectedDayIds
  const { days, timeSlots } = useMemo(() => {
    const daySet = new Map<string, { id: string; name: string; number: number }>()
    const timeSlotSet = new Map<string, { id: string; code: string; name: string | null; display_order: number | null; default_start_time: string | null; default_end_time: string | null }>()

    // If selectedDayIds is provided and not empty, only process those days
    // If empty, don't process any days (settings might not be configured)
    const daysToProcess = selectedDayIds.length > 0 
      ? selectedDayIds 
      : [] // Empty array means don't process any days

    data.forEach((classroom) => {
      classroom.days.forEach((day) => {
        // Strict filtering: only include days that are in selectedDayIds
        // If selectedDayIds is empty, don't include any days
        if (daysToProcess.length === 0 || !daysToProcess.includes(day.day_of_week_id)) {
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
              default_start_time: null, // Will be fetched from API if needed
              default_end_time: null,
            })
          }
        })
      })
    })

    const daysArray = Array.from(daySet.values())
      .filter((day) => {
        // Final filter: only include selected days if selectedDayIds is provided and not empty
        // If selectedDayIds is empty, don't include any days
        if (selectedDayIds.length > 0) {
          return selectedDayIds.includes(day.id)
        }
        return false // Don't show any days if selectedDayIds is empty
      })
      .sort((a, b) => {
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
    // Close filter panel if open (only one panel can be open at a time)
    if (filterPanelOpen && onFilterPanelOpenChange) {
      onFilterPanelOpenChange(false)
    }

    // Find time slot details for code and time range
    const timeSlot = timeSlots.find((ts) => ts.id === timeSlotId)
    // Also try to find from data structure
    const timeSlotFromData = data
      .flatMap((c) => c.days)
      .flatMap((d) => d.time_slots)
      .find((ts) => ts.time_slot_id === timeSlotId)
    
    setSelectedCell({
      dayId,
      dayName,
      timeSlotId,
      timeSlotName,
      timeSlotCode: timeSlot?.code || timeSlotFromData?.time_slot_code || '',
      timeSlotStartTime: timeSlot?.default_start_time || null,
      timeSlotEndTime: timeSlot?.default_end_time || null,
      classroomId,
      classroomName,
    })
  }

  const handleSave = () => {
    // Trigger refresh
    if (onRefresh) {
      onRefresh()
    }
  }

  const handleClosePanel = () => {
    setSelectedCell(null)
  }

  // Get cell data for selected cell
  const selectedCellData = selectedCell
    ? (() => {
        const classroom = data.find((c) => c.classroom_id === selectedCell.classroomId)
        if (!classroom) return undefined

        const day = classroom.days.find((d) => d.day_of_week_id === selectedCell.dayId)
        if (!day) return undefined

        const timeSlot = day.time_slots.find((ts) => ts.time_slot_id === selectedCell.timeSlotId)
        return timeSlot ? {
          day_of_week_id: day.day_of_week_id,
          day_name: day.day_name,
          day_number: day.day_number,
          time_slot_id: timeSlot.time_slot_id,
          time_slot_code: timeSlot.time_slot_code,
          time_slot_name: timeSlot.time_slot_name,
          time_slot_display_order: timeSlot.time_slot_display_order,
          assignments: timeSlot.assignments,
          schedule_cell: timeSlot.schedule_cell || null,
        } : undefined
      })()
    : undefined

  // Final filter: ensure we only show selected days
  // If selectedDayIds is empty, don't show any days (settings might not be loaded or configured)
  // Only show days if we have explicit selectedDayIds
  const filteredDays = useMemo(() => {
    if (selectedDayIds.length === 0) return []
    return days.filter((day) => selectedDayIds.includes(day.id))
  }, [days, selectedDayIds])

  // Transform data for days-x-classrooms layout
  const daysXClassroomsData = useMemo(() => {
    if (layout !== 'days-x-classrooms') return null

    // Reorganize: day → timeSlot → classrooms
    const result: Array<{
      day: { id: string; name: string; number: number }
      timeSlot: { id: string; code: string; name: string | null; display_order: number | null }
      classrooms: Array<{
        classroomId: string
        classroomName: string
        cellData?: WeeklyScheduleCellData
      }>
    }> = []

    filteredDays.forEach((day) => {
      timeSlots.forEach((timeSlot) => {
        const classrooms: Array<{
          classroomId: string
          classroomName: string
          cellData?: WeeklyScheduleCellData
        }> = []

        data.forEach((classroom) => {
          const dayData = classroom.days.find((d) => d.day_of_week_id === day.id)
          const timeSlotData = dayData?.time_slots.find(
            (ts) => ts.time_slot_id === timeSlot.id
          )

          const cellData = timeSlotData
            ? {
                day_of_week_id: day.id,
                day_name: day.name,
                day_number: day.number,
                time_slot_id: timeSlot.id,
                time_slot_code: timeSlot.code,
                time_slot_name: timeSlot.name,
                time_slot_display_order: timeSlot.display_order,
                assignments: timeSlotData.assignments,
                schedule_cell: timeSlotData.schedule_cell || null,
              }
            : undefined

          classrooms.push({
            classroomId: classroom.classroom_id,
            classroomName: classroom.classroom_name,
            cellData,
          })
        })

        result.push({
          day,
          timeSlot,
          classrooms,
        })
      })
    })

    return result
  }, [data, filteredDays, timeSlots, layout])

  // Generate grid templates
  const daysXClassroomsGrid = useMemo(() => {
    if (layout !== 'days-x-classrooms') return null
    return generateDaysXClassroomsGridTemplate(data.length, filteredDays, timeSlots)
  }, [layout, data.length, filteredDays, timeSlots])

  const classroomsXDaysGrid = useMemo(() => {
    if (layout !== 'classrooms-x-days') return null
    return generateClassroomsXDaysGridTemplate(filteredDays.length, timeSlots.length)
  }, [layout, filteredDays.length, timeSlots.length])

  // Render days-x-classrooms layout
  if (layout === 'days-x-classrooms' && daysXClassroomsData && daysXClassroomsGrid) {
    return (
      <>
        {/* Legend */}
        <div className="mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-700">Key:</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                Teacher
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300 border-dashed">
                Floater
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-gray-600">Meets preferred</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-gray-600">Below preferred</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-gray-600">Below required</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)]" style={{ position: 'relative' }}>
          <div
            className="grid"
            style={{
              gridTemplateColumns: daysXClassroomsGrid.columns,
              gridTemplateRows: daysXClassroomsGrid.rows,
              minWidth: 'fit-content',
              position: 'relative',
            }}
          >
            {/* Header Row - Time Column Header */}
            <div
              className="sticky top-0 z-30 text-center pt-2 pb-0.5"
              style={{ 
                position: 'sticky',
                top: 0,
                left: 0,
                backgroundColor: 'white', 
                gridColumn: 1, 
                gridRow: 1,
                minWidth: '120px', // Match the column width
                zIndex: 50, // Higher than classroom headers (z-40) to stay on top when scrolling
              }}
            >
            </div>
            {data.map((classroom, index) => {
              const classroomColor = classroom.classroom_color || undefined
              return (
                <div
                  key={classroom.classroom_id}
                  className="sticky top-0 z-40 text-center pt-2 pb-0.5"
                  style={{
                    backgroundColor: 'white',
                    gridColumn: index + 2,
                    gridRow: 1,
                  }}
                >
                  <div
                    className="text-sm font-semibold"
                    style={{
                      color: classroomColor || '#1f2937'
                    }}
                  >
                    {classroom.classroom_name}
                  </div>
                </div>
              )
            })}

            {/* Data Rows - Build rows explicitly by day and time slot */}
            {filteredDays.map((day, dayIndex) => {
              const dayTimeSlots = daysXClassroomsData.filter(item => item.day.id === day.id)
              
              // Calculate rows: account for spacer rows before each day (except first)
              // Row 1: Header
              // For each previous day: 1 spacer row (if not first) + 1 day header row + timeSlots.length data rows
              const spacerRowsBeforeThisDay = dayIndex > 0 ? dayIndex : 0 // One spacer per day except first
              const rowsBeforeThisDay = dayIndex * (1 + timeSlots.length) + spacerRowsBeforeThisDay
              const spacerRow = dayIndex > 0 ? 2 + rowsBeforeThisDay - 1 : null // Spacer row number (if exists)
              const dayHeaderRow = 2 + rowsBeforeThisDay // Day header row
              const firstTimeSlotRow = dayHeaderRow + 1 // Time slots start after day header
              
              return (
                <React.Fragment key={`day-group-${day.id}`}>
                  {/* Spacer Row - only for days after the first */}
                  {spacerRow && (
                    <>
                      {/* Time column spacer (white background) */}
                      <div
                        style={{
                          position: 'sticky',
                          left: 0, // Only sticky horizontally, not vertically
                          backgroundColor: 'white',
                          gridColumn: 1,
                          gridRow: spacerRow,
                          zIndex: 10,
                          borderRight: '1px solid #e5e7eb',
                          boxShadow: '2px 0 4px -2px rgba(0, 0, 0, 0.1)',
                        }}
                      />
                      {/* Classroom column spacers (with classroom colors) */}
                      {data.map((classroom, classroomIndex) => {
                        const classroomColor = classroom.classroom_color || undefined
                        return (
                          <div
                            key={`spacer-${classroom.classroom_id}-${day.id}`}
                            style={{
                              backgroundColor: classroomColor 
                                ? hexToRgba(classroomColor, 0.08)
                                : 'transparent',
                              gridColumn: classroomIndex + 2,
                              gridRow: spacerRow,
                            }}
                          />
                        )
                      })}
                    </>
                  )}

                  {/* Day Section Header */}
                  <div
                    className="sticky px-4 rounded-lg flex items-center"
                    style={{
                      position: 'sticky',
                      top: '30px',
                      left: 0,
                      zIndex: 50,
                      backgroundColor: '#f9fafb',
                      borderTop: '1px solid #e5e7eb',
                      borderLeft: '1px solid #e5e7eb',
                      borderRight: '1px solid #e5e7eb',
                      borderBottom: '2px solid #e5e7eb',
                      boxShadow: '0 2px 4px -2px rgba(0, 0, 0, 0.1)',
                      gridColumn: '1 / -1',
                      gridRow: dayHeaderRow,
                      marginLeft: 0,
                      paddingTop: '6px',
                      paddingBottom: '6px',
                      height: '36px',
                      maxHeight: '36px',
                      overflow: 'hidden',
                    }}
                  >
                    <div className="text-base font-bold text-gray-800">
                      {day.name}
                    </div>
                  </div>

                  {/* Time Slot Rows for this day */}
                  {timeSlots.map((timeSlot, timeSlotIndex) => {
                    const item = dayTimeSlots.find(ts => ts.timeSlot.id === timeSlot.id)
                    if (!item) return null
                    
                    const dataRow = firstTimeSlotRow + timeSlotIndex
                    
                    return (
                      <React.Fragment key={`time-slot-${day.id}-${timeSlot.id}`}>
                        {/* Combined Day/Time Column */}
                        <div
                          className="flex items-center justify-center"
                          style={{
                            position: 'sticky',
                            left: 0, // Only sticky horizontally, not vertically
                            backgroundColor: 'white',
                            gridColumn: 1,
                            gridRow: dataRow,
                            minHeight: '120px', // Ensure minimum height to prevent squishing
                            paddingTop: '8px',
                            zIndex: 10, // Above scrolling content but below day headers
                            borderRight: '1px solid #e5e7eb',
                            boxShadow: '2px 0 4px -2px rgba(0, 0, 0, 0.1)',
                          }}
                        >
                          <span className="inline-flex items-center px-4 py-2.5 rounded-full bg-gray-100 text-gray-700 text-sm font-medium">
                            {timeSlot.code}
                          </span>
                        </div>

                        {/* Classroom Cells */}
                        {item.classrooms.map((classroom, classroomIndex) => {
                          const isInactive =
                            classroom.cellData?.schedule_cell &&
                            !classroom.cellData.schedule_cell.is_active
                          const classroomColor = data.find(c => c.classroom_id === classroom.classroomId)?.classroom_color || undefined
                          return (
                            <div
                              key={`cell-${classroom.classroomId}-${day.id}-${timeSlot.id}`}
                              className="p-0"
                              style={{
                                backgroundColor: classroomColor 
                                  ? hexToRgba(classroomColor, 0.08)
                                  : 'transparent',
                                gridColumn: classroomIndex + 2,
                                gridRow: dataRow,
                                paddingTop: '8px', // Reduced padding to prevent overlap
                              }}
                            >
                              <div
                                className={`rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-200 min-h-[120px] min-w-[160px] m-1.5 ${
                                  isInactive ? 'opacity-60 bg-gray-50' : ''
                                }`}
                              >
                                <ScheduleCell
                                  data={classroom.cellData}
                                  onClick={() =>
                                    handleCellClick(
                                      day.id,
                                      day.name,
                                      timeSlot.id,
                                      item.timeSlot.name || timeSlot.code,
                                      classroom.classroomId,
                                      classroom.classroomName
                                    )
                                  }
                                />
                              </div>
                            </div>
                          )
                        })}
                      </React.Fragment>
                    )
                  })}
                </React.Fragment>
              )
            })}
          </div>
        </div>

        {selectedCell && !filterPanelOpen && (
          <ScheduleSidePanel
            isOpen={!!selectedCell}
            onClose={handleClosePanel}
            dayId={selectedCell.dayId}
            dayName={selectedCell.dayName}
            timeSlotId={selectedCell.timeSlotId}
            timeSlotName={selectedCell.timeSlotName}
            timeSlotCode={selectedCell.timeSlotCode}
            timeSlotStartTime={selectedCell.timeSlotStartTime}
            timeSlotEndTime={selectedCell.timeSlotEndTime}
            classroomId={selectedCell.classroomId}
            classroomName={selectedCell.classroomName}
            selectedDayIds={selectedDayIds}
            selectedCellData={selectedCellData}
            onSave={handleSave}
          />
        )}
      </>
    )
  }

  // Render classrooms-x-days layout
  if (layout === 'classrooms-x-days' && classroomsXDaysGrid) {
    return (
      <>
        {/* Legend */}
        <div className="mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-700">Key:</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                Teacher
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300 border-dashed">
                Floater
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-gray-600">Meets preferred</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-gray-600">Below preferred</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-gray-600">Below required</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)]">
          <div
            className="grid"
            style={{
              gridTemplateColumns: classroomsXDaysGrid.columns,
              gridTemplateRows: classroomsXDaysGrid.rows,
              minWidth: 'fit-content',
            }}
          >
            {/* Header Row 1: Day Names */}
            <div
              className="sticky top-0 left-0 z-40 pt-2 pb-0.5"
              style={{ 
                backgroundColor: 'white', 
                gridColumn: 1, 
                gridRow: 1,
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Classroom</div>
            </div>
            {filteredDays.map((day, dayIndex) => (
              <div
                key={`day-header-${day.id}`}
                className="sticky top-0 z-40 text-center pt-2 pb-0.5"
                style={{
                  backgroundColor: 'white',
                  gridColumn: `${dayIndex * timeSlots.length + 2} / ${(dayIndex + 1) * timeSlots.length + 2}`,
                  gridRow: 1,
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                <div className="text-base font-bold text-gray-800">{day.name}</div>
              </div>
            ))}

            {/* Header Row 2: Time Slot Codes */}
            <div
              className="sticky top-0 left-0 z-40 pt-2 pb-0.5"
              style={{ 
                backgroundColor: 'white', 
                gridColumn: 1, 
                gridRow: 2,
                borderBottom: '1px solid #e5e7eb',
              }}
            ></div>
            {filteredDays.map((day, dayIndex) =>
              timeSlots.map((slot, slotIndex) => (
                <div
                  key={`time-header-${day.id}-${slot.id}`}
                  className="sticky top-0 z-40 text-center pt-2 pb-0.5"
                  style={{
                    backgroundColor: 'white',
                    gridColumn: dayIndex * timeSlots.length + slotIndex + 2,
                    gridRow: 2,
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                    {slot.code}
                  </span>
                </div>
              ))
            )}

            {/* Data Rows: Classrooms */}
            {data.map((classroom, classroomIndex) => {
              const rowIndex = classroomIndex + 3 // After 2 header rows
              return (
                <React.Fragment key={`classroom-row-${classroom.classroom_id}`}>
                  {/* Classroom Name Column */}
                  <div
                    className="sticky left-0 z-10 pt-2"
                    style={{
                      backgroundColor: 'white',
                      gridColumn: 1,
                      gridRow: rowIndex,
                    }}
                  >
                    <div
                      className="text-sm font-semibold"
                      style={{
                        color: classroom.classroom_color || '#1f2937'
                      }}
                    >
                      {classroom.classroom_name}
                    </div>
                  </div>

                  {/* Day/Time Slot Cells */}
                  {filteredDays.map((day, dayIndex) => {
                    const dayData = classroom.days.find((d) => d.day_of_week_id === day.id)
                    const classroomColor = classroom.classroom_color || undefined
                    
                    return timeSlots.map((slot, slotIndex) => {
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
                            schedule_cell: timeSlotData.schedule_cell || null,
                          }
                        : undefined

                      const isInactive = cellData?.schedule_cell && !cellData.schedule_cell.is_active
                      const colIndex = dayIndex * timeSlots.length + slotIndex + 2
                      
                      return (
                        <div
                          key={`cell-${classroom.classroom_id}-${day.id}-${slot.id}`}
                          className="p-0 pt-2"
                          style={{
                            backgroundColor: classroomColor 
                              ? hexToRgba(classroomColor, 0.08)
                              : 'transparent',
                            gridColumn: colIndex,
                            gridRow: rowIndex,
                          }}
                        >
                          <div
                            className={`rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-200 min-h-[120px] min-w-[140px] m-1.5 ${
                              isInactive ? 'opacity-60 bg-gray-50' : ''
                            }`}
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
                          </div>
                        </div>
                      )
                    })
                  })}
                </React.Fragment>
              )
            })}
          </div>
        </div>

        {selectedCell && !filterPanelOpen && (
          <ScheduleSidePanel
            isOpen={!!selectedCell}
            onClose={handleClosePanel}
            dayId={selectedCell.dayId}
            dayName={selectedCell.dayName}
            timeSlotId={selectedCell.timeSlotId}
            timeSlotName={selectedCell.timeSlotName}
            timeSlotCode={selectedCell.timeSlotCode}
            timeSlotStartTime={selectedCell.timeSlotStartTime}
            timeSlotEndTime={selectedCell.timeSlotEndTime}
            classroomId={selectedCell.classroomId}
            classroomName={selectedCell.classroomName}
            selectedDayIds={selectedDayIds}
            selectedCellData={selectedCellData}
            onSave={handleSave}
          />
        )}
      </>
    )
  }

  return null
}
