'use client'

import { useState, useEffect, useMemo } from 'react'
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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
  displayMode: 'permanent-only' | 'permanent-flexible' | 'substitutes-only' | 'all-scheduled-staff'
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
}: FilterPanelProps) {
  // Initialize filters with defaults - only include days from settings
  const [filters, setFilters] = useState<FilterState>(() => {
    const daysToShow = selectedDayIdsFromSettings.length > 0
      ? availableDays.filter(d => selectedDayIdsFromSettings.includes(d.id))
      : availableDays
    return {
      selectedDayIds: initialFilters?.selectedDayIds ?? daysToShow.map(d => d.id),
      selectedTimeSlotIds: initialFilters?.selectedTimeSlotIds ?? availableTimeSlots.map(ts => ts.id),
      selectedClassroomIds: initialFilters?.selectedClassroomIds ?? availableClassrooms.map(c => c.id),
      displayFilters: {
        belowRequired: initialFilters?.displayFilters?.belowRequired ?? true,
        belowPreferred: initialFilters?.displayFilters?.belowPreferred ?? true,
        fullyStaffed: initialFilters?.displayFilters?.fullyStaffed ?? true,
        inactive: initialFilters?.displayFilters?.inactive ?? true,
      },
      displayMode: initialFilters?.displayMode ?? 'all-scheduled-staff',
      layout: initialFilters?.layout ?? 'classrooms-x-days', // Default: Classrooms across the top
    }
  })

  const [classroomSearch, setClassroomSearch] = useState('')
  const [classroomPopoverOpen, setClassroomPopoverOpen] = useState(false)

  // Filter and sort days - only show days selected in Settings > Days and Time Slots
  const sortedDays = useMemo(() => {
    const filtered = selectedDayIdsFromSettings.length > 0
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
    return availableClassrooms.filter(c => 
      c.name.toLowerCase().includes(searchLower)
    )
  }, [availableClassrooms, classroomSearch])

  // Update parent when filters change
  useEffect(() => {
    onFiltersChange(filters)
  }, [filters, onFiltersChange])

  const toggleDay = (dayId: string) => {
    setFilters(prev => ({
      ...prev,
      selectedDayIds: prev.selectedDayIds.includes(dayId)
        ? prev.selectedDayIds.filter(id => id !== dayId)
        : [...prev.selectedDayIds, dayId]
    }))
  }

  const toggleTimeSlot = (timeSlotId: string) => {
    setFilters(prev => ({
      ...prev,
      selectedTimeSlotIds: prev.selectedTimeSlotIds.includes(timeSlotId)
        ? prev.selectedTimeSlotIds.filter(id => id !== timeSlotId)
        : [...prev.selectedTimeSlotIds, timeSlotId]
    }))
  }

  const toggleClassroom = (classroomId: string) => {
    setFilters(prev => ({
      ...prev,
      selectedClassroomIds: prev.selectedClassroomIds.includes(classroomId)
        ? prev.selectedClassroomIds.filter(id => id !== classroomId)
        : [...prev.selectedClassroomIds, classroomId]
    }))
  }

  const selectAllClassrooms = () => {
    setFilters(prev => ({
      ...prev,
      selectedClassroomIds: availableClassrooms.map(c => c.id)
    }))
  }

  const clearAllClassrooms = () => {
    setFilters(prev => ({
      ...prev,
      selectedClassroomIds: []
    }))
  }

  const toggleDisplayFilter = (key: keyof FilterState['displayFilters']) => {
    setFilters(prev => ({
      ...prev,
      displayFilters: {
        ...prev.displayFilters,
        [key]: !prev.displayFilters[key]
      }
    }))
  }

  const selectedClassroomsCount = filters.selectedClassroomIds.length
  const allClassroomsSelected = selectedClassroomsCount === availableClassrooms.length
  const someClassroomsSelected = selectedClassroomsCount > 0 && selectedClassroomsCount < availableClassrooms.length

  // Calculate total possible slots based on selected filters
  const totalPossibleSlots = filters.selectedDayIds.length * 
                             filters.selectedTimeSlotIds.length * 
                             filters.selectedClassroomIds.length
  
  // Calculate total slots if all filters were selected
  // Only use days that are selected in Settings (not all available days)
  const totalSlotsIfAllSelected = sortedDays.length * 
                                   availableTimeSlots.length * 
                                   availableClassrooms.length

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-gray-50">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>
            Filter the weekly schedule view
          </SheetDescription>
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
            <div className="flex flex-wrap gap-2">
              {sortedDays.map((day) => {
                const isSelected = filters.selectedDayIds.includes(day.id)
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => toggleDay(day.id)}
                    className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {day.name.slice(0, 3)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time Slot Selector */}
          <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-3">
            <Label className="text-base font-medium">Show Time Slots</Label>
            <div className="flex flex-wrap gap-2">
              {sortedTimeSlots.map((timeSlot) => {
                const isSelected = filters.selectedTimeSlotIds.includes(timeSlot.id)
                return (
                  <button
                    key={timeSlot.id}
                    type="button"
                    onClick={() => toggleTimeSlot(timeSlot.id)}
                    className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {timeSlot.code}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Classroom Selector */}
          <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-3">
            <Label className="text-base font-medium">Show Classrooms</Label>
            <Popover open={classroomPopoverOpen} onOpenChange={setClassroomPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {allClassroomsSelected
                    ? 'All Classrooms'
                    : someClassroomsSelected
                    ? `${selectedClassroomsCount} selected`
                    : 'Select Classrooms'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <div className="p-2 space-y-2">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search classrooms..."
                      value={classroomSearch}
                      onChange={(e) => setClassroomSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>

                  {/* Select All / Clear All */}
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

                  {/* Classroom Checkboxes */}
                  <div className="max-h-[300px] overflow-y-auto space-y-2">
                    {filteredClassrooms.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center py-4">
                        No classrooms found
                      </div>
                    ) : (
                      filteredClassrooms.map((classroom) => {
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
            
            {/* Show selected classrooms as pills when not all are selected */}
            {!allClassroomsSelected && filters.selectedClassroomIds.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {filters.selectedClassroomIds.map((classroomId) => {
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
            <p className="text-xs text-muted-foreground">
              Unchecked items will be hidden
            </p>
          </div>

          {/* Display Mode */}
          <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-3">
            <Label className="text-base font-medium">Show Staff</Label>
            <RadioGroup
              value={filters.displayMode}
              onValueChange={(value) => setFilters(prev => ({
                ...prev,
                displayMode: value as FilterState['displayMode']
              }))}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="permanent-only" id="permanent-only" />
                <label
                  htmlFor="permanent-only"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Permanent teachers
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="permanent-flexible" id="permanent-flexible" />
                <label
                  htmlFor="permanent-flexible"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Permanent + Flexible teachers
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="substitutes-only" id="substitutes-only" />
                <label
                  htmlFor="substitutes-only"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Substitutes only
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all-scheduled-staff" id="all-scheduled-staff" />
                <label
                  htmlFor="all-scheduled-staff"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  All scheduled staff
                </label>
              </div>
            </RadioGroup>
          </div>

          {/* Layout */}
          <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-3">
            <Label className="text-base font-medium">Layout</Label>
            <RadioGroup
              value={filters.layout}
              onValueChange={(value) => setFilters(prev => ({
                ...prev,
                layout: value as FilterState['layout']
              }))}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="classrooms-x-days" id="classrooms-x-days" />
                <label
                  htmlFor="classrooms-x-days"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Classrooms × Days
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="days-x-classrooms" id="days-x-classrooms" />
                <label
                  htmlFor="days-x-classrooms"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Days × Classrooms
                </label>
              </div>
            </RadioGroup>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

