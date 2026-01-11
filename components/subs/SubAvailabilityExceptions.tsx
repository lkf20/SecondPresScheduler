'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import DatePickerInput from '@/components/ui/date-picker-input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'

interface TimeSlot {
  id: string
  code: string
  name: string | null
}

interface ExceptionHeader {
  id: string
  start_date: string
  end_date: string
  available: boolean
  time_slot_ids?: string[]
}

interface SubAvailabilityExceptionsProps {
  subId: string
  exceptionHeaders: ExceptionHeader[]
  timeSlots: TimeSlot[]
  onAddException: (exception: {
    start_date: string
    end_date: string
    available: boolean
    time_slot_ids: string[]
  }) => Promise<void>
  onDeleteException: (headerId: string) => Promise<void>
}

export default function SubAvailabilityExceptions({
  subId,
  exceptionHeaders,
  timeSlots,
  onAddException,
  onDeleteException,
}: SubAvailabilityExceptionsProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [newException, setNewException] = useState({
    start_date: '',
    end_date: '',
    available: true,
    time_slot_ids: [] as string[],
  })

  const handleAddException = async () => {
    if (!newException.start_date || !newException.end_date || newException.time_slot_ids.length === 0) {
      alert('Please fill in all fields and select at least one time slot')
      return
    }

    try {
      await onAddException(newException)
      setNewException({
        start_date: '',
        end_date: '',
        available: true,
        time_slot_ids: [],
      })
      setIsAdding(false)
    } catch (error) {
      console.error('Error adding exception:', error)
    }
  }

  const handleTimeSlotToggle = (timeSlotId: string, checked: boolean) => {
    const updated = checked
      ? [...newException.time_slot_ids, timeSlotId]
      : newException.time_slot_ids.filter((id) => id !== timeSlotId)
    setNewException({ ...newException, time_slot_ids: updated })
  }

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start).toLocaleDateString()
    const endDate = new Date(end).toLocaleDateString()
    return start === end ? startDate : `${startDate} - ${endDate}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2"
        >
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <span>One-off Exceptions</span>
          {exceptionHeaders.length > 0 && (
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">
              {exceptionHeaders.length}
            </span>
          )}
        </Button>
        {isExpanded && (
          <Button
            type="button"
            size="sm"
            onClick={() => setIsAdding(true)}
            disabled={isAdding}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Exception
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="space-y-3">
          {isAdding && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">New Exception</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_date">Start Date</Label>
                    <DatePickerInput
                      id="start_date"
                      value={newException.start_date}
                      onChange={(value) =>
                        setNewException({ ...newException, start_date: value })
                      }
                      placeholder="Select start date"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_date">End Date</Label>
                    <DatePickerInput
                      id="end_date"
                      value={newException.end_date}
                      onChange={(value) =>
                        setNewException({ ...newException, end_date: value })
                      }
                      placeholder="Select end date"
                      allowClear
                      closeOnSelect
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label>Type</Label>
                  <RadioGroup
                    value={newException.available ? 'available' : 'unavailable'}
                    onValueChange={(value) =>
                      setNewException({ ...newException, available: value === 'available' })
                    }
                    className="mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="available" id="available" />
                      <Label htmlFor="available" className="font-normal cursor-pointer">
                        Available
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="unavailable" id="unavailable" />
                      <Label htmlFor="unavailable" className="font-normal cursor-pointer">
                        Unavailable
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label>Affected Shifts</Label>
                  <div className="flex gap-4 mt-2">
                    {timeSlots.map((slot) => (
                      <div key={slot.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`slot-${slot.id}`}
                          checked={newException.time_slot_ids.includes(slot.id)}
                          onCheckedChange={(checked) =>
                            handleTimeSlotToggle(slot.id, checked === true)
                          }
                        />
                        <Label
                          htmlFor={`slot-${slot.id}`}
                          className="font-normal cursor-pointer text-sm"
                        >
                          {slot.code}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={handleAddException}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsAdding(false)
                      setNewException({
                        start_date: '',
                        end_date: '',
                        available: true,
                        time_slot_ids: [],
                      })
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {exceptionHeaders.map((header) => (
            <Card key={header.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {formatDateRange(header.start_date, header.end_date)}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          header.available
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {header.available ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                    {header.time_slot_ids && header.time_slot_ids.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {header.time_slot_ids.map((slotId) => {
                          const slot = timeSlots.find((s) => s.id === slotId)
                          return (
                            <span
                              key={slotId}
                              className="text-xs bg-muted px-2 py-0.5 rounded"
                            >
                              {slot?.code || slotId}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onDeleteException(header.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {exceptionHeaders.length === 0 && !isAdding && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No exceptions added yet. Click "Add Exception" to create one.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
