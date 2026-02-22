'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Search, X } from 'lucide-react'

interface Day {
  id: string
  name: string
  day_number: number
}

interface TimeSlot {
  id: string
  code: string
  name: string | null
  display_order: number | null
}

interface Classroom {
  id: string
  name: string
}

export interface FilterState {
  selectedDayIds: string[]
  selectedTimeSlotIds: string[]
  selectedClassroomIds: string[]
  displayFilters: {
    belowRequired: boolean
    belowPreferred: boolean
    fullyStaffed: boolean
    inactive: boolean
  }
  displayMode:
    | 'permanent-only'
    | 'permanent-flexible'
    | 'substitutes-only'
    | 'all-scheduled-staff'
    | 'coverage-issues'
    | 'absences'
  layout: 'classrooms-x-days' | 'days-x-classrooms'
}

interface FilterPanelProps {
  isOpen: boolean
  onClose: () => void
  onFiltersChange: (filters: FilterState) => void
  initialFilters?: Partial<FilterState>
  availableDays: Day[]
  availableTimeSlots: TimeSlot[]
  availableClassrooms: Classroom[]
  selectedDayIdsFromSettings?: string[] // Days selected in Settings > Days and Time Slots
  hideStaffSection?: boolean // If true, hide "Show Staff" section and default to permanent-only
  slotCounts?: { shown: number; total: number } // Actual slot counts from the filtered data
}

export default function FilterPanel({
  isOpen,
  onClose,
  onFiltersChange,
  initialFilters,
  availableDays,
  availableTimeSlots,
  availableClassrooms,
  selectedDayIdsFromSettings = [],
  hideStaffSection = false,
  slotCounts,
}: FilterPanelProps) {
  // Initialize filters with defaults - only include days from settings
  const [filters, setFilters] = useState<FilterState>(() => {
    const daysToShow =
      selectedDayIdsFromSettings.length > 0
        ? availableDays.filter(d => selectedDayIdsFromSettings.includes(d.id))
        : availableDays
    // If hideStaffSection is true, always use 'permanent-only' regardless of initialFilters
    const displayMode = hideStaffSection
      ? 'permanent-only'
      : (initialFilters?.displayMode ?? 'all-scheduled-staff')

    return {
      selectedDayIds: initialFilters?.selectedDayIds ?? daysToShow.map(d => d.id),
      selectedTimeSlotIds:
        initialFilters?.selectedTimeSlotIds ?? availableTimeSlots.map(ts => ts.id),
      selectedClassroomIds:
        initialFilters?.selectedClassroomIds ?? availableClassrooms.map(c => c.id),
      displayFilters: {
        belowRequired: initialFilters?.displayFilters?.belowRequired ?? true,
        belowPreferred: initialFilters?.displayFilters?.belowPreferred ?? true,
        fullyStaffed: initialFilters?.displayFilters?.fullyStaffed ?? true,
        inactive: initialFilters?.displayFilters?.inactive ?? true,
      },
      displayMode,
      layout: initialFilters?.layout ?? 'days-x-classrooms', // Default: Days across the top
    }
  })

  const [classroomSearch, setClassroomSearch] = useState('')
  const [classroomPopoverOpen, setClassroomPopoverOpen] = useState(false)
  const [dayPopoverOpen, setDayPopoverOpen] = useState(false)
  const [timeSlotPopoverOpen, setTimeSlotPopoverOpen] = useState(false)
  const [daySearch, setDaySearch] = useState('')
  const [timeSlotSearch, setTimeSlotSearch] = useState('')
  const [daySelectionMode, setDaySelectionMode] = useState<'all' | 'select'>('all')
  const [timeSlotSelectionMode, setTimeSlotSelectionMode] = useState<'all' | 'select'>('all')
  const [classroomSelectionMode, setClassroomSelectionMode] = useState<'all' | 'select'>('all')

  // Filter and sort days - only show days selected in Settings > Days and Time Slots
  const sortedDays = useMemo(() => {
    const filtered =
      selectedDayIdsFromSettings.length > 0
        ? availableDays.filter(day => selectedDayIdsFromSettings.includes(day.id))
        : availableDays
    return filtered.sort((a, b) => {
      const aNum = a.day_number === 0 ? 7 : a.day_number
      const bNum = b.day_number === 0 ? 7 : b.day_number
      return aNum - bNum
    })
  }, [availableDays, selectedDayIdsFromSettings])

  // Sort time slots by display_order
  const sortedTimeSlots = useMemo(() => {
    return [...availableTimeSlots].sort((a, b) => {
      const orderA = a.display_order ?? 999
      const orderB = b.display_order ?? 999
      return orderA - orderB
    })
  }, [availableTimeSlots])

  // Filter classrooms by search
  const filteredClassrooms = useMemo(() => {
    if (!classroomSearch) return availableClassrooms
    const searchLower = classroomSearch.toLowerCase()
    return availableClassrooms.filter(c => c.name.toLowerCase().includes(searchLower))
  }, [availableClassrooms, classroomSearch])
  const filteredDays = useMemo(() => {
    if (!daySearch) return sortedDays
    const searchLower = daySearch.toLowerCase()
    return sortedDays.filter(d => d.name.toLowerCase().includes(searchLower))
  }, [sortedDays, daySearch])
  const filteredTimeSlots = useMemo(() => {
    if (!timeSlotSearch) return sortedTimeSlots
    const searchLower = timeSlotSearch.toLowerCase()
    return sortedTimeSlots.filter(ts => {
      const label = ts.name ? `${ts.code} ${ts.name}` : ts.code
      return label.toLowerCase().includes(searchLower)
    })
  }, [sortedTimeSlots, timeSlotSearch])

  // Track whether a change originated from internal state or external props
  const changeSourceRef = useRef<'internal' | 'external'>('internal')

  // Track previous initialFilters to detect external changes (like from filter chips)
  const prevInitialFiltersRef = useRef<Partial<FilterState> | undefined>(initialFilters)

  // Sync internal state when initialFilters changes from external sources (like filter chips)
  // Only sync displayMode since that's what the filter chips control
  useEffect(() => {
    if (initialFilters && initialFilters.displayMode !== undefined) {
      const prevInitialFilters = prevInitialFiltersRef.current
      prevInitialFiltersRef.current = initialFilters

      // Only sync if displayMode actually changed from external source
      if (
        prevInitialFilters?.displayMode !== initialFilters.displayMode &&
        filters.displayMode !== initialFilters.displayMode
      ) {
        changeSourceRef.current = 'external'
        setFilters(prev => ({
          ...prev,
          displayMode: hideStaffSection
            ? 'permanent-only'
            : (initialFilters.displayMode ?? prev.displayMode),
        }))
      }
    }
  }, [initialFilters, hideStaffSection, filters.displayMode])

  // Ensure displayMode is permanent-only when hideStaffSection is true
  useEffect(() => {
    if (hideStaffSection && filters.displayMode !== 'permanent-only') {
      // This is an internal enforcement, not from user interaction
      // Don't mark as internal to avoid triggering onFiltersChange unnecessarily
      // since this is just enforcing a constraint
      setFilters(prev => ({ ...prev, displayMode: 'permanent-only' }))
    }
  }, [hideStaffSection, filters.displayMode])

  // Update parent when filters change (skip initial mount to avoid overwriting saved state)
  // Don't update parent if change came from external source (to prevent infinite loops)
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      // Still call onFiltersChange on mount to ensure parent has the correct state
      onFiltersChange(filters)
      changeSourceRef.current = 'internal'
      return
    }

    // Only update parent if change came from internal state (user interaction)
    if (changeSourceRef.current === 'internal') {
      onFiltersChange(filters)
    } else {
      // Reset the flag after skipping external update
      changeSourceRef.current = 'internal'
    }
  }, [filters, onFiltersChange])

  const toggleDay = (dayId: string) => {
    setFilters(prev => ({
      ...prev,
      selectedDayIds: prev.selectedDayIds.includes(dayId)
        ? prev.selectedDayIds.filter(id => id !== dayId)
        : [...prev.selectedDayIds, dayId],
    }))
  }

  const toggleTimeSlot = (timeSlotId: string) => {
    setFilters(prev => ({
      ...prev,
      selectedTimeSlotIds: prev.selectedTimeSlotIds.includes(timeSlotId)
        ? prev.selectedTimeSlotIds.filter(id => id !== timeSlotId)
        : [...prev.selectedTimeSlotIds, timeSlotId],
    }))
  }

  const selectAllDays = () => {
    setFilters(prev => ({
      ...prev,
      selectedDayIds: sortedDays.map(d => d.id),
    }))
  }

  const clearAllDays = () => {
    setFilters(prev => ({
      ...prev,
      selectedDayIds: [],
    }))
  }

  const selectAllTimeSlots = () => {
    setFilters(prev => ({
      ...prev,
      selectedTimeSlotIds: sortedTimeSlots.map(ts => ts.id),
    }))
  }

  const clearAllTimeSlots = () => {
    setFilters(prev => ({
      ...prev,
      selectedTimeSlotIds: [],
    }))
  }

  const toggleClassroom = (classroomId: string) => {
    setFilters(prev => ({
      ...prev,
      selectedClassroomIds: prev.selectedClassroomIds.includes(classroomId)
        ? prev.selectedClassroomIds.filter(id => id !== classroomId)
        : [...prev.selectedClassroomIds, classroomId],
    }))
  }

  const selectAllClassrooms = () => {
    setFilters(prev => ({
      ...prev,
      selectedClassroomIds: availableClassrooms.map(c => c.id),
    }))
  }

  const clearAllClassrooms = () => {
    setFilters(prev => ({
      ...prev,
      selectedClassroomIds: [],
    }))
  }

  const toggleDisplayFilter = (key: keyof FilterState['displayFilters']) => {
    setFilters(prev => ({
      ...prev,
      displayFilters: {
        ...prev.displayFilters,
        [key]: !prev.displayFilters[key],
      },
    }))
  }

  const selectedClassroomsCount = filters.selectedClassroomIds.length
  const allClassroomsSelected = selectedClassroomsCount === availableClassrooms.length
  const someClassroomsSelected =
    selectedClassroomsCount > 0 && selectedClassroomsCount < availableClassrooms.length
  const selectedDaysCount = filters.selectedDayIds.length
  const allDaysSelected = selectedDaysCount === sortedDays.length
  const someDaysSelected = selectedDaysCount > 0 && selectedDaysCount < sortedDays.length
  const selectedTimeSlotsCount = filters.selectedTimeSlotIds.length
  const allTimeSlotsSelected = selectedTimeSlotsCount === sortedTimeSlots.length
  const someTimeSlotsSelected =
    selectedTimeSlotsCount > 0 && selectedTimeSlotsCount < sortedTimeSlots.length

  useEffect(() => {
    if (availableClassrooms.length === 0) return
    setClassroomSelectionMode(allClassroomsSelected ? 'all' : 'select')
  }, [allClassroomsSelected, availableClassrooms.length])
  useEffect(() => {
    if (sortedDays.length === 0) return
    setDaySelectionMode(allDaysSelected ? 'all' : 'select')
  }, [allDaysSelected, sortedDays.length])
  useEffect(() => {
    if (sortedTimeSlots.length === 0) return
    setTimeSlotSelectionMode(allTimeSlotsSelected ? 'all' : 'select')
  }, [allTimeSlotsSelected, sortedTimeSlots.length])

  // Use provided slot counts if available, otherwise calculate from filters
  // The provided counts are more accurate as they reflect actual data after display filters
  const totalPossibleSlots =
    slotCounts?.shown ??
    filters.selectedDayIds.length *
      filters.selectedTimeSlotIds.length *
      filters.selectedClassroomIds.length

  const totalSlotsIfAllSelected =
    slotCounts?.total ?? sortedDays.length * availableTimeSlots.length * availableClassrooms.length

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-gray-50">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Filter the weekly schedule view</SheetDescription>
        </SheetHeader>

        <div className="mt-6 mb-4">
          <p className="text-sm text-muted-foreground">
            Showing {totalPossibleSlots} of {totalSlotsIfAllSelected} slots
          </p>
        </div>

        <div className="space-y-10">
          {/* Day Selector */}
          <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-3">
            <Label className="text-base font-medium">Show Days</Label>
            <RadioGroup
              value={daySelectionMode}
              onValueChange={value => {
                const nextMode = value as 'all' | 'select'
                setDaySelectionMode(nextMode)
                if (nextMode === 'all') {
                  selectAllDays()
                }
              }}
              className="flex flex-wrap items-center gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="days-mode-all" />
                <label
                  htmlFor="days-mode-all"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  All days
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="select" id="days-mode-select" />
                <label
                  htmlFor="days-mode-select"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Select days
                </label>
              </div>
            </RadioGroup>
            {daySelectionMode === 'select' && (
              <>
                <Popover open={dayPopoverOpen} onOpenChange={setDayPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between">
                      {someDaysSelected
                        ? `${selectedDaysCount} selected`
                        : selectedDaysCount === 0
                          ? 'Select Days'
                          : 'All Days'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[320px] max-h-[70vh] overflow-hidden p-0"
                    align="start"
                  >
                    <div className="flex max-h-[70vh] flex-col space-y-2 p-2">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search days..."
                          value={daySearch}
                          onChange={e => setDaySearch(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                      <div className="flex gap-2 pb-2 border-b">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={selectAllDays}
                          className="h-8 text-xs"
                        >
                          Select All
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearAllDays}
                          className="h-8 text-xs"
                        >
                          Clear All
                        </Button>
                      </div>
                      <div className="max-h-[45vh] overflow-y-auto overscroll-contain space-y-2">
                        {filteredDays.length === 0 ? (
                          <div className="text-sm text-muted-foreground text-center py-4">
                            No days found
                          </div>
                        ) : (
                          filteredDays.map(day => {
                            const isSelected = filters.selectedDayIds.includes(day.id)
                            return (
                              <div
                                key={day.id}
                                className="flex items-center space-x-2 p-2 hover:bg-muted rounded"
                              >
                                <Checkbox
                                  id={`day-${day.id}`}
                                  checked={isSelected}
                                  onCheckedChange={() => toggleDay(day.id)}
                                />
                                <label
                                  htmlFor={`day-${day.id}`}
                                  className="text-sm font-medium leading-none cursor-pointer flex-1"
                                >
                                  {day.name}
                                </label>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                {filters.selectedDayIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {filters.selectedDayIds.map(dayId => {
                      const day = sortedDays.find(d => d.id === dayId)
                      if (!day) return null
                      return (
                        <div
                          key={dayId}
                          className="inline-flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-medium"
                        >
                          <span>{day.name}</span>
                          <button
                            type="button"
                            onClick={() => toggleDay(dayId)}
                            className="hover:bg-primary/20 rounded-full p-0.5 -mr-1"
                            aria-label={`Remove ${day.name}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Time Slot Selector */}
          <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-3">
            <Label className="text-base font-medium">Show Time Slots</Label>
            <RadioGroup
              value={timeSlotSelectionMode}
              onValueChange={value => {
                const nextMode = value as 'all' | 'select'
                setTimeSlotSelectionMode(nextMode)
                if (nextMode === 'all') {
                  selectAllTimeSlots()
                }
              }}
              className="flex flex-wrap items-center gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="timeslots-mode-all" />
                <label
                  htmlFor="timeslots-mode-all"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  All time slots
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="select" id="timeslots-mode-select" />
                <label
                  htmlFor="timeslots-mode-select"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Select time slots
                </label>
              </div>
            </RadioGroup>
            {timeSlotSelectionMode === 'select' && (
              <>
                <Popover open={timeSlotPopoverOpen} onOpenChange={setTimeSlotPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between">
                      {someTimeSlotsSelected
                        ? `${selectedTimeSlotsCount} selected`
                        : selectedTimeSlotsCount === 0
                          ? 'Select Time Slots'
                          : 'All Time Slots'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[320px] max-h-[70vh] overflow-hidden p-0"
                    align="start"
                  >
                    <div className="flex max-h-[70vh] flex-col space-y-2 p-2">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search time slots..."
                          value={timeSlotSearch}
                          onChange={e => setTimeSlotSearch(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                      <div className="flex gap-2 pb-2 border-b">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={selectAllTimeSlots}
                          className="h-8 text-xs"
                        >
                          Select All
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearAllTimeSlots}
                          className="h-8 text-xs"
                        >
                          Clear All
                        </Button>
                      </div>
                      <div className="max-h-[45vh] overflow-y-auto overscroll-contain space-y-2">
                        {filteredTimeSlots.length === 0 ? (
                          <div className="text-sm text-muted-foreground text-center py-4">
                            No time slots found
                          </div>
                        ) : (
                          filteredTimeSlots.map(timeSlot => {
                            const isSelected = filters.selectedTimeSlotIds.includes(timeSlot.id)
                            return (
                              <div
                                key={timeSlot.id}
                                className="flex items-center space-x-2 p-2 hover:bg-muted rounded"
                              >
                                <Checkbox
                                  id={`timeslot-${timeSlot.id}`}
                                  checked={isSelected}
                                  onCheckedChange={() => toggleTimeSlot(timeSlot.id)}
                                />
                                <label
                                  htmlFor={`timeslot-${timeSlot.id}`}
                                  className="text-sm font-medium leading-none cursor-pointer flex-1"
                                >
                                  {timeSlot.code}
                                  {timeSlot.name ? ` - ${timeSlot.name}` : ''}
                                </label>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                {filters.selectedTimeSlotIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {filters.selectedTimeSlotIds.map(timeSlotId => {
                      const timeSlot = sortedTimeSlots.find(ts => ts.id === timeSlotId)
                      if (!timeSlot) return null
                      return (
                        <div
                          key={timeSlotId}
                          className="inline-flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-medium"
                        >
                          <span>{timeSlot.code}</span>
                          <button
                            type="button"
                            onClick={() => toggleTimeSlot(timeSlotId)}
                            className="hover:bg-primary/20 rounded-full p-0.5 -mr-1"
                            aria-label={`Remove ${timeSlot.code}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Classroom Selector */}
          <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-3">
            <Label className="text-base font-medium">Show Classrooms</Label>
            <RadioGroup
              value={classroomSelectionMode}
              onValueChange={value => {
                const nextMode = value as 'all' | 'select'
                setClassroomSelectionMode(nextMode)
                if (nextMode === 'all') {
                  selectAllClassrooms()
                }
              }}
              className="flex flex-wrap items-center gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="classrooms-mode-all" />
                <label
                  htmlFor="classrooms-mode-all"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  All classrooms
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="select" id="classrooms-mode-select" />
                <label
                  htmlFor="classrooms-mode-select"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Select classrooms
                </label>
              </div>
            </RadioGroup>

            {classroomSelectionMode === 'select' && (
              <Popover open={classroomPopoverOpen} onOpenChange={setClassroomPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between">
                    {someClassroomsSelected
                      ? `${selectedClassroomsCount} selected`
                      : selectedClassroomsCount === 0
                        ? 'Select Classrooms'
                        : 'All Classrooms'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[320px] max-h-[70vh] overflow-hidden p-0"
                  align="start"
                >
                  <div className="flex max-h-[70vh] flex-col space-y-2 p-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search classrooms..."
                        value={classroomSearch}
                        onChange={e => setClassroomSearch(e.target.value)}
                        className="pl-8"
                      />
                    </div>

                    <div className="flex gap-2 pb-2 border-b">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={selectAllClassrooms}
                        className="h-8 text-xs"
                      >
                        Select All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllClassrooms}
                        className="h-8 text-xs"
                      >
                        Clear All
                      </Button>
                    </div>

                    <div className="max-h-[45vh] overflow-y-auto overscroll-contain space-y-2">
                      {filteredClassrooms.length === 0 ? (
                        <div className="text-sm text-muted-foreground text-center py-4">
                          No classrooms found
                        </div>
                      ) : (
                        filteredClassrooms.map(classroom => {
                          const isSelected = filters.selectedClassroomIds.includes(classroom.id)
                          return (
                            <div
                              key={classroom.id}
                              className="flex items-center space-x-2 p-2 hover:bg-muted rounded"
                            >
                              <Checkbox
                                id={`classroom-${classroom.id}`}
                                checked={isSelected}
                                onCheckedChange={() => toggleClassroom(classroom.id)}
                              />
                              <label
                                htmlFor={`classroom-${classroom.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                              >
                                {classroom.name}
                              </label>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Show selected classrooms as pills in select mode */}
            {classroomSelectionMode === 'select' && filters.selectedClassroomIds.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {filters.selectedClassroomIds.map(classroomId => {
                  const classroom = availableClassrooms.find(c => c.id === classroomId)
                  if (!classroom) return null
                  return (
                    <div
                      key={classroomId}
                      className="inline-flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-medium"
                    >
                      <span>{classroom.name}</span>
                      <button
                        type="button"
                        onClick={() => toggleClassroom(classroomId)}
                        className="hover:bg-primary/20 rounded-full p-0.5 -mr-1"
                        aria-label={`Remove ${classroom.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Display Filter */}
          <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-3">
            <Label className="text-base font-medium">Show Slots With</Label>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="below-required"
                  checked={filters.displayFilters.belowRequired}
                  onCheckedChange={() => toggleDisplayFilter('belowRequired')}
                />
                <label
                  htmlFor="below-required"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Below required staffing
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="below-preferred"
                  checked={filters.displayFilters.belowPreferred}
                  onCheckedChange={() => toggleDisplayFilter('belowPreferred')}
                />
                <label
                  htmlFor="below-preferred"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Below preferred staffing
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="fully-staffed"
                  checked={filters.displayFilters.fullyStaffed}
                  onCheckedChange={() => toggleDisplayFilter('fullyStaffed')}
                />
                <label
                  htmlFor="fully-staffed"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Fully staffed
                </label>
              </div>
              <div className="border-t border-gray-200 my-3"></div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="inactive"
                  checked={filters.displayFilters.inactive}
                  onCheckedChange={() => toggleDisplayFilter('inactive')}
                />
                <label
                  htmlFor="inactive"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Inactive
                </label>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Unchecked items will be hidden</p>
          </div>

          {/* Layout */}
          <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-3">
            <Label className="text-base font-medium">Layout</Label>
            <RadioGroup
              value={filters.layout}
              onValueChange={value =>
                setFilters(prev => ({
                  ...prev,
                  layout: value as FilterState['layout'],
                }))
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="days-x-classrooms" id="days-x-classrooms" />
                <label
                  htmlFor="days-x-classrooms"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Days × Classrooms
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="classrooms-x-days" id="classrooms-x-days" />
                <label
                  htmlFor="classrooms-x-days"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Classrooms × Days
                </label>
              </div>
            </RadioGroup>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
