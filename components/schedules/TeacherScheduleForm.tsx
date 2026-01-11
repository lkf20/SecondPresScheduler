'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import FormField from '@/components/shared/FormField'
import { Database } from '@/types/database'
import type { Classroom, ClassGroup, TimeSlot } from '@/types/api'

type TeacherSchedule = Database['public']['Tables']['teacher_schedules']['Row']

type StaffOption = {
  id: string
  first_name: string
  last_name: string
  display_name: string | null
  is_teacher?: boolean | null
}

type DayOfWeek = {
  id: string
  name: string
  day_number?: number | null
}

const scheduleSchema = z.object({
  teacher_id: z.string().min(1, 'Teacher is required'),
  day_of_week_id: z.string().min(1, 'Day of week is required'),
  time_slot_id: z.string().min(1, 'Time slot is required'),
  class_id: z.string().min(1, 'Class group is required'),
  classroom_id: z.string().min(1, 'Classroom is required'),
})

type ScheduleFormData = z.infer<typeof scheduleSchema>

interface TeacherScheduleFormProps {
  schedule?: TeacherSchedule & {
    teacher?: StaffOption | null
    day_of_week?: DayOfWeek | null
    time_slot?: TimeSlot | null
    class?: ClassGroup | null
    classroom?: Classroom | null
  }
  onSubmit: (data: ScheduleFormData) => Promise<void>
  onCancel?: () => void
}

export default function TeacherScheduleForm({ schedule, onSubmit, onCancel }: TeacherScheduleFormProps) {
  const [teachers, setTeachers] = useState<StaffOption[]>([])
  const [daysOfWeek, setDaysOfWeek] = useState<DayOfWeek[]>([])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [classes, setClasses] = useState<ClassGroup[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])

  useEffect(() => {
    fetch('/api/teachers').then((r) => r.json()).then((data) => setTeachers(Array.isArray(data) ? data : [])).catch(console.error)
    fetch('/api/timeslots').then((r) => r.json()).then((data) => setTimeSlots(Array.isArray(data) ? data : [])).catch(console.error)
    fetch('/api/class-groups').then((r) => r.json()).then((data) => setClasses(Array.isArray(data) ? data : [])).catch(console.error)
    fetch('/api/classrooms').then((r) => r.json()).then((data) => setClassrooms(Array.isArray(data) ? data : [])).catch(console.error)
    fetch('/api/days-of-week')
      .then((r) => {
        if (!r.ok) {
          throw new Error(`HTTP error! status: ${r.status}`)
        }
        return r.json()
      })
      .then((data) => {
        // Handle both array and error object responses
        if (Array.isArray(data)) {
          setDaysOfWeek(data)
        } else if (data.error) {
          console.error('Days of week API error:', data.error)
        } else {
          console.warn('Unexpected days of week response:', data)
        }
      })
      .catch((error) => {
        console.error('Failed to fetch days of week:', error)
      })
  }, [])

  const {
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    reset,
  } = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: schedule
      ? {
          teacher_id: schedule.teacher_id,
          day_of_week_id: schedule.day_of_week_id,
          time_slot_id: schedule.time_slot_id,
          class_id: schedule.class_id,
          classroom_id: schedule.classroom_id,
        }
      : undefined,
  })

  // Reset form when schedule changes
  useEffect(() => {
    if (schedule) {
      reset({
        teacher_id: schedule.teacher_id,
        day_of_week_id: schedule.day_of_week_id,
        time_slot_id: schedule.time_slot_id,
        class_id: schedule.class_id,
        classroom_id: schedule.classroom_id,
      })
    }
  }, [schedule, reset])

  const teacherId = watch('teacher_id')
  const dayOfWeekId = watch('day_of_week_id')
  const timeSlotId = watch('time_slot_id')
  const classId = watch('class_id')
  const classroomId = watch('classroom_id')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField label="Teacher" error={errors.teacher_id?.message} required>
          <Select value={teacherId || ''} onValueChange={(value) => setValue('teacher_id', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select a teacher" />
            </SelectTrigger>
            <SelectContent>
              {teachers
                .filter((t) => t.is_teacher)
                .map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.display_name || `${teacher.first_name} ${teacher.last_name}`}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Day of Week" error={errors.day_of_week_id?.message} required>
          <Select value={dayOfWeekId || ''} onValueChange={(value) => setValue('day_of_week_id', value)}>
            <SelectTrigger>
              <SelectValue placeholder={daysOfWeek.length === 0 ? "Loading days..." : "Select a day"} />
            </SelectTrigger>
            <SelectContent>
              {daysOfWeek.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">No days available</div>
              ) : (
                daysOfWeek.map((day) => (
                  <SelectItem key={day.id} value={day.id}>
                    {day.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Time Slot" error={errors.time_slot_id?.message} required>
          <Select value={timeSlotId || ''} onValueChange={(value) => setValue('time_slot_id', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select a time slot" />
            </SelectTrigger>
            <SelectContent>
              {timeSlots
                .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                .map((slot) => (
                  <SelectItem key={slot.id} value={slot.id}>
                    {slot.name || slot.code}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Class Group" error={errors.class_id?.message} required>
          <Select value={classId || ''} onValueChange={(value) => setValue('class_id', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select a class group" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Classroom" error={errors.classroom_id?.message} required>
          <Select value={classroomId || ''} onValueChange={(value) => setValue('classroom_id', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select a classroom" />
            </SelectTrigger>
            <SelectContent>
              {classrooms.map((classroom) => (
                <SelectItem key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <div className="flex justify-end gap-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : schedule ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  )
}
