'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import ScheduleCell from './ScheduleCell'
import ScheduleSidePanel from './ScheduleSidePanel'
import type { WeeklyScheduleData, WeeklyScheduleDataByClassroom } from '@/lib/api/weekly-schedule'
import { usePanelManager } from '@/lib/contexts/PanelManagerContext'

interface WeeklyScheduleGridNewProps {
  data: WeeklyScheduleDataByClassroom[]
  selectedDayIds: string[]
  layout: 'classrooms-x-days' | 'days-x-classrooms'
  onRefresh?: () => void
  onFilterPanelOpenChange?: (open: boolean) => void
  filterPanelOpen?: boolean
  initialSelectedCell?: {
    classroomId: string
    dayId: string
    timeSlotId: string
  } | null
  allowCardClick?: boolean // If false, cards are not clickable (default: true)
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
  // Columns: Combined Day/Time (120px) + Classrooms (minmax(230px, 1fr) each) - matches Classrooms x Days
  const columns = `120px repeat(${classroomCount}, minmax(230px, 1fr))`
  
  // Rows: Header (auto) + (Spacer row + Day header + time slots for each day)
  // For the first day: no spacer, just day header + time slots
  // For subsequent days: spacer row + day header + time slots
  const dayRows = days.map((day, dayIndex) => {
    const spacerRow = dayIndex === 0 ? '' : '16px' // Add spacer before each day except the first
    const dayHeaderRow = '36px' // Fixed small height for day headers (accommodates padding + text)
    // Use 120px minimum to match Classrooms x Days layout
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
  // Columns: Classroom (110px - reduced to fit "Kindergarten" while saving space) + (Day columns: each day has timeSlotCount columns)
  // Column width: 220px card + 10px left margin + 10px right margin = 220px + 20px = 240px minimum, using 230px for tighter spacing
  const dayColumns = Array(dayCount).fill(`repeat(${timeSlotCount}, minmax(230px, 1fr))`).join(' ')
  const columns = `110px ${dayColumns}`
  
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
  initialSelectedCell = null,
  allowCardClick = true, // Default to allowing clicks
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
  const { setActivePanel, previousPanel, restorePreviousPanel, registerPanelCloseHandler } = usePanelManager()
  const savedCellRef = useRef<typeof selectedCell>(null)

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

  const hasAppliedInitialSelection = useRef(false)

  useEffect(() => {
    if (!initialSelectedCell || hasAppliedInitialSelection.current) return
    const classroom = data.find((c) => c.classroom_id === initialSelectedCell.classroomId)
    if (!classroom) return
    const day = classroom.days.find((d) => d.day_of_week_id === initialSelectedCell.dayId)
    if (!day) return
    const timeSlotMeta = timeSlots.find((ts) => ts.id === initialSelectedCell.timeSlotId)
    const timeSlotFromData = day.time_slots.find(
      (ts) => ts.time_slot_id === initialSelectedCell.timeSlotId
    )
    const timeSlotCode = timeSlotMeta?.code || timeSlotFromData?.time_slot_code || ''
    const timeSlotName = timeSlotMeta?.name || timeSlotFromData?.time_slot_name || timeSlotCode

    setSelectedCell({
      dayId: day.day_of_week_id,
      dayName: day.day_name,
      timeSlotId: initialSelectedCell.timeSlotId,
      timeSlotName: timeSlotName || '',
      timeSlotCode,
      timeSlotStartTime: timeSlotMeta?.default_start_time || null,
      timeSlotEndTime: timeSlotMeta?.default_end_time || null,
      classroomId: classroom.classroom_id,
      classroomName: classroom.classroom_name,
    })
    hasAppliedInitialSelection.current = true
  }, [initialSelectedCell, data, timeSlots])

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
    setActivePanel(null)
  }

  // Handle panel restoration when Add Time Off closes
  useEffect(() => {
    if (previousPanel?.type === 'schedule' && !selectedCell && savedCellRef.current) {
      // Restore the panel
      setSelectedCell(savedCellRef.current)
      setActivePanel('schedule')
      restorePreviousPanel()
    }
  }, [previousPanel, selectedCell, setActivePanel, restorePreviousPanel])

  // Register panel with PanelManager when it opens
  useEffect(() => {
    if (selectedCell) {
      setActivePanel('schedule', () => {
        // Restore callback - save current state and reopen
        savedCellRef.current = selectedCell
        setSelectedCell(selectedCell)
      })
      
      // Register close request handler
      const unregister = registerPanelCloseHandler('schedule', () => {
        // Save state before closing
        savedCellRef.current = selectedCell
        setSelectedCell(null)
      })
      
      return unregister
    } else {
      setActivePanel(null)
    }
  }, [selectedCell, setActivePanel, registerPanelCloseHandler])

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
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-600 border border-teal-200">
                Substitute
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
                Absent
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
                          borderRight: '1px solid #f3f4f6',
                          boxShadow: '2px 0 8px -2px rgba(0, 0, 0, 0.1)',
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
                      borderRight: '1px solid #f3f4f6',
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
                            borderRight: '1px solid #f3f4f6',
                            boxShadow: '2px 0 8px -2px rgba(0, 0, 0, 0.1)',
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
                              className="p-0 flex items-center justify-center"
                              style={{
                                backgroundColor: classroomColor 
                                  ? hexToRgba(classroomColor, 0.08)
                                  : 'transparent',
                                gridColumn: classroomIndex + 2,
                                gridRow: dataRow,
                                minHeight: '120px', // Ensure minimum height for Safari compatibility (matches grid row minmax)
                              }}
                            >
                              <div
                                className={`rounded-lg border border-gray-200 bg-white shadow-sm transition-all duration-200 min-h-[120px] flex-shrink-0 ${
                                  allowCardClick ? 'hover:shadow-md cursor-pointer' : 'cursor-default'
                                } ${
                                  isInactive ? 'opacity-60 bg-gray-50' : ''
                                }`}
                                style={{
                                  width: '220px',
                                  minWidth: '220px',
                                  maxWidth: '220px',
                                  marginTop: '6px',
                                  marginBottom: '6px',
                                  marginLeft: '10px',
                                  marginRight: '10px',
                                }}
                                onClick={allowCardClick ? () =>
                                  handleCellClick(
                                    day.id,
                                    day.name,
                                    timeSlot.id,
                                    item.timeSlot.name || timeSlot.code,
                                    classroom.classroomId,
                                    classroom.classroomName
                                  )
                                : undefined}
                              >
                                <ScheduleCell data={classroom.cellData} />
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
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-600 border border-teal-200">
                Substitute
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
                Absent
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

        <div>
          <div
            className="grid overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)]"
            style={{
              gridTemplateColumns: classroomsXDaysGrid.columns,
              gridTemplateRows: classroomsXDaysGrid.rows,
              width: '100%', // Constrain to parent width
              maxWidth: '100%', // Ensure it doesn't exceed parent
              minWidth: 0, // Allow grid to shrink below content size, enabling internal scrolling
              // CSS custom properties for header heights and column widths
              '--header-row-1-height': 'calc(0.5rem + 1.5rem + 0.125rem)', // Day header: pt-2 + text-base line-height + pb-0.5
              '--header-row-2-height': 'calc(0.5rem + 1.5rem + 0.75rem)', // Time slot header: pt-2 + chip height ~1.5rem + pb-3
              '--classroom-column-width': '110px', // Classroom column width
            } as React.CSSProperties}
          >
            {/* Header Row 1: Day Names */}
            {/* Empty cell in column 1 to prevent classroom column from scrolling into header area */}
            <div
              style={{
                gridColumn: 1,
                gridRow: 1,
                backgroundColor: 'transparent',
              }}
            />
            {filteredDays.map((day, dayIndex) => (
              <div
                key={`day-header-${day.id}`}
                className="sticky top-0 z-30 text-center pt-2 pb-0.5"
                style={{
                  backgroundColor: dayIndex % 2 === 0 ? 'white' : '#f3f4f6',
                  gridColumn: `${dayIndex * timeSlots.length + 2} / ${(dayIndex + 1) * timeSlots.length + 2}`,
                  gridRow: 1,
                  borderBottom: '1px solid #e5e7eb',
                  borderRight: dayIndex < filteredDays.length - 1 ? '1px solid #e5e7eb' : 'none',
                  position: 'sticky',
                  top: 0,
                  left: 'var(--classroom-column-width)', // Stop at right edge of classroom column
                }}
              >
                <div className="text-base font-bold text-gray-800">{day.name}</div>
              </div>
            ))}

            {/* Header Row 2: Time Slot Codes */}
            {/* Empty cell in column 1 to prevent classroom column from scrolling into header area */}
            <div
              style={{
                gridColumn: 1,
                gridRow: 2,
                backgroundColor: 'transparent',
              }}
            />
            {filteredDays.map((day, dayIndex) =>
              timeSlots.map((slot, slotIndex) => (
                <div
                  key={`time-header-${day.id}-${slot.id}`}
                  className="sticky z-30 text-center pt-2 pb-3"
                  style={{
                    backgroundColor: 'white',
                    gridColumn: dayIndex * timeSlots.length + slotIndex + 2,
                    gridRow: 2,
                    borderBottom: '1px solid #e5e7eb',
                    borderRight: slotIndex < timeSlots.length - 1 || (slotIndex === timeSlots.length - 1 && dayIndex < filteredDays.length - 1) ? '1px solid #e5e7eb' : 'none',
                    borderLeft: 'none',
                    boxShadow: '0 2px 4px -2px rgba(0, 0, 0, 0.08)',
                    position: 'sticky',
                    top: 'calc(0.5rem + 1.5rem + 0.125rem)', // Match day header height exactly
                    left: 'var(--classroom-column-width)', // Stop at right edge of classroom column
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
                    className="z-20 flex items-center justify-center"
                    style={{
                      backgroundColor: 'white',
                      gridColumn: 1, // Use simple column index
                      gridRow: rowIndex,
                      position: 'sticky',
                      left: 0,
                      top: 'calc(var(--header-row-1-height) + var(--header-row-2-height) + 5px)', // Sum of both header rows + small offset for borders/padding
                      width: '110px', // Fixed width to match column width
                      minWidth: '110px', // Ensure minimum width
                      maxWidth: '110px', // Constrain to column width to prevent scrolling into header area
                      borderRight: '1px solid #e5e7eb',
                      borderBottom: classroomIndex < data.length - 1 ? '1px solid #e5e7eb' : 'none',
                      boxShadow: '2px 0 8px -2px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <div
                      className="text-sm font-semibold text-center"
                      style={{
                        color: classroom.classroom_color || '#1f2937'
                      }}
                    >
                      {(() => {
                        const name = classroom.classroom_name
                        const roomIndex = name.indexOf(' Room')
                        if (roomIndex > 0) {
                          // Split before "Room" - e.g., "Toddler A Room" -> "Toddler A<br>Room"
                          const beforeRoom = name.substring(0, roomIndex)
                          const room = name.substring(roomIndex + 1) // +1 to skip the space
                          return (
                            <>
                              {beforeRoom}
                              <br />
                              {room}
                            </>
                          )
                        }
                        // If no " Room" found, split on last space as fallback
                        const lastSpaceIndex = name.lastIndexOf(' ')
                        if (lastSpaceIndex > 0) {
                          const firstPart = name.substring(0, lastSpaceIndex)
                          const secondPart = name.substring(lastSpaceIndex + 1)
                          return (
                            <>
                              {firstPart}
                              <br />
                              {secondPart}
                            </>
                          )
                        }
                        // If no space found, return as-is
                        return name
                      })()}
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
                          className="p-0"
                          style={{
                            backgroundColor: classroomColor ? hexToRgba(classroomColor, 0.08) : 'transparent',
                            gridColumn: colIndex,
                            gridRow: rowIndex,
                            borderRight: slotIndex < timeSlots.length - 1 || (slotIndex === timeSlots.length - 1 && dayIndex < filteredDays.length - 1) ? '1px solid #e5e7eb' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            height: '100%',
                            minHeight: '120px', // Ensure minimum height for Safari compatibility (matches grid row minmax)
                          }}
                        >
                          <div
                            className={`rounded-lg border border-gray-200 bg-white shadow-sm transition-all duration-200 ${
                              allowCardClick ? 'hover:shadow-md cursor-pointer' : 'cursor-default'
                            } ${
                              isInactive ? 'opacity-60 bg-gray-50' : ''
                            }`}
                            style={{
                              width: '220px',
                              minWidth: '220px',
                              maxWidth: '220px',
                              minHeight: '120px',
                              boxSizing: 'border-box',
                              flexShrink: 0,
                              flexGrow: 0,
                              marginTop: '10px',
                              marginBottom: '10px',
                              marginLeft: '10px',
                              marginRight: '10px',
                            }}
                            onClick={allowCardClick ? () =>
                              handleCellClick(
                                day.id,
                                day.name,
                                slot.id,
                                slot.name || slot.code,
                                classroom.classroom_id,
                                classroom.classroom_name
                              )
                            : undefined}
                          >
                            <ScheduleCell data={cellData} />
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
