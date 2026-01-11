'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import ErrorMessage from '@/components/shared/ErrorMessage'
import type { ClassClassroomMappingWithDetails } from '@/lib/api/class-classroom-mappings'
import { Database } from '@/types/database'

type ClassGroup = Database['public']['Tables']['class_groups']['Row']
type Classroom = Database['public']['Tables']['classrooms']['Row']
type DayOfWeek = Database['public']['Tables']['days_of_week']['Row']

interface MappingConfigurationModalProps {
  dayName: string
  timeSlotCode: string
  dayOfWeekId: string
  timeSlotId: string
  existingMappings: ClassClassroomMappingWithDetails[]
  onClose: () => void
}

interface ClassClassroomCombo {
  class_id: string
  class_name: string
  classroom_id: string
  classroom_name: string
  isEnabled: boolean
  mappingId?: string
}

export default function MappingConfigurationModal({
  dayName,
  timeSlotCode,
  dayOfWeekId,
  timeSlotId,
  existingMappings,
  onClose,
}: MappingConfigurationModalProps) {
  const [classes, setClasses] = useState<ClassGroup[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [combinations, setCombinations] = useState<ClassClassroomCombo[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [classesRes, classroomsRes] = await Promise.all([
          fetch('/api/class-groups'),
          fetch('/api/classrooms'),
        ])

        const classesData = await classesRes.json()
        const classroomsData = await classroomsRes.json()

        setClasses(classesData as ClassGroup[])
        setClassrooms(classroomsData as Classroom[])

        // Build all combinations
        const combos: ClassClassroomCombo[] = []
        ;(classesData as ClassGroup[]).forEach((cls) => {
          ;(classroomsData as Classroom[]).forEach((classroom) => {
            const existing = existingMappings.find(
              (m) => m.class_id === cls.id && m.classroom_id === classroom.id
            )
            combos.push({
              class_id: cls.id,
              class_name: cls.name,
              classroom_id: classroom.id,
              classroom_name: classroom.name,
              isEnabled: !!existing,
              mappingId: existing?.id,
            })
          })
        })

        setCombinations(combos.sort((a, b) => {
          const classroomCompare = a.classroom_name.localeCompare(b.classroom_name)
          if (classroomCompare !== 0) return classroomCompare
          return a.class_name.localeCompare(b.class_name)
        }))
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [existingMappings])

  const handleToggle = (index: number) => {
    const newCombinations = [...combinations]
    newCombinations[index].isEnabled = !newCombinations[index].isEnabled
    setCombinations(newCombinations)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      // Find what needs to be created and deleted
      const toCreate = combinations.filter((c) => c.isEnabled && !c.mappingId)
      const toDelete = combinations.filter((c) => !c.isEnabled && c.mappingId)

      // Delete mappings that were unchecked
      for (const combo of toDelete) {
        if (combo.mappingId) {
          await fetch(`/api/class-classroom-mappings/${combo.mappingId}`, {
            method: 'DELETE',
          })
        }
      }

      // Create new mappings
      if (toCreate.length > 0) {
        const newMappings = toCreate.map((c) => ({
          class_id: c.class_id,
          classroom_id: c.classroom_id,
          day_of_week_id: dayOfWeekId,
          time_slot_id: timeSlotId,
        }))

        await fetch('/api/class-classroom-mappings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mappings: newMappings }),
        })
      }

      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save mappings')
    } finally {
      setSaving(false)
    }
  }

  const handleCopyToOtherDays = async (targetDays: string[]) => {
    try {
      setSaving(true)
      setError(null)

      // Get enabled combinations
      const enabledCombos = combinations.filter((c) => c.isEnabled)

      if (enabledCombos.length === 0) {
        setError('No mappings selected to copy')
        return
      }

      // Create mappings for target days
      const newMappings = []
      for (const targetDayId of targetDays) {
        for (const combo of enabledCombos) {
          newMappings.push({
            class_id: combo.class_id,
            classroom_id: combo.classroom_id,
            day_of_week_id: targetDayId,
            time_slot_id: timeSlotId,
          })
        }
      }

      await fetch('/api/class-classroom-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: newMappings }),
      })

      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to copy mappings')
    } finally {
      setSaving(false)
    }
  }

  const handleCopyToAllWeekdays = async () => {
    // Get all weekday IDs (Monday-Friday, day_number 1-5)
    const weekdays = await fetch('/api/days-of-week')
      .then((r) => r.json())
      .then((days) => (days as DayOfWeek[]).filter((d) => d.day_number >= 1 && d.day_number <= 5).map((d) => d.id))
    
    const targetDays = weekdays.filter((id: string) => id !== dayOfWeekId)
    await handleCopyToOtherDays(targetDays)
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {dayName} - {timeSlotCode}
          </DialogTitle>
          <DialogDescription>
            Select which class/classroom combinations are available for this time slot
          </DialogDescription>
        </DialogHeader>

        {error && <ErrorMessage message={error} className="mb-4" />}

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading classes and classrooms...
          </div>
        ) : (
          <>
            <div className="space-y-2 mt-4 max-h-[60vh] overflow-y-auto">
              {combinations.map((combo, idx) => (
                <div
                  key={`${combo.class_id}-${combo.classroom_id}`}
                  className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer"
                  onClick={() => handleToggle(idx)}
                >
                  <Checkbox
                    checked={combo.isEnabled}
                    onCheckedChange={() => handleToggle(idx)}
                  />
                  <Label className="cursor-pointer flex-1">
                    <span className="font-semibold text-muted-foreground">
                      {combo.classroom_name}
                    </span>
                    {' - '}
                    <span>{combo.class_name}</span>
                  </Label>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 mt-6">
              <div className="flex justify-between items-center">
                <Button
                  variant="outline"
                  onClick={handleCopyToAllWeekdays}
                  disabled={saving}
                >
                  Copy to All Weekdays
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={onClose} disabled={saving}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
