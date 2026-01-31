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
import TeacherSelector from './TeacherSelector'
import RatioIndicator from './RatioIndicator'
import type { WeeklyScheduleData } from '@/lib/api/weekly-schedule'
import { Database } from '@/types/database'

type ClassGroupRow = Database['public']['Tables']['class_groups']['Row']
type ClassroomRow = Database['public']['Tables']['classrooms']['Row']
type EnrollmentRow = Database['public']['Tables']['enrollments']['Row']

interface AssignmentModalProps {
  dayName: string
  timeSlotName: string
  data: WeeklyScheduleData
  onClose: () => void
}

interface ClassGroup {
  class_group_id: string
  class_group_name: string
  classroom_id: string
  classroom_name: string
  enrollment: number
  required_teachers?: number
  preferred_teachers?: number
  assigned_teachers: Array<{ id: string; name: string; teacher_id: string }>
}

export default function AssignmentModal({
  dayName,
  timeSlotName,
  data,
  onClose,
}: AssignmentModalProps) {
  const [classes, setClasses] = useState<ClassGroupRow[]>([])
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])
  const [classGroups, setClassGroups] = useState<Map<string, ClassGroup>>(new Map())
  const [loading, setLoading] = useState(true)

  // Fetch all classes, classrooms, and enrollments
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [classesRes, classroomsRes, enrollmentsRes] = await Promise.all([
          fetch('/api/class-groups'),
          fetch('/api/classrooms'),
          fetch('/api/enrollments'),
        ])

        const classesData = await classesRes.json()
        const classroomsData = await classroomsRes.json()
        const enrollmentsData = await enrollmentsRes.json().catch(() => [])

        setClasses(classesData as ClassGroupRow[])
        setClassrooms(classroomsData as ClassroomRow[])
        setEnrollments(enrollmentsData as EnrollmentRow[])
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Build class groups from existing assignments and configured mappings only
  useEffect(() => {
    if (loading || classes.length === 0 || classrooms.length === 0) return

    const groups = new Map<string, ClassGroup>()

    // First, add existing assignments
    data.assignments.forEach(assignment => {
      // Use classroom_id as the key since teachers are now assigned to classrooms, not class groups
      const classGroupId = assignment.class_group_id
      const key = `${classGroupId || 'no-class'}-${assignment.classroom_id}`

      if (assignment.teacher_id) {
        // Teacher assignment
        if (!groups.has(key)) {
          const classInfo = data.assignments.find(
            a =>
              !a.teacher_id &&
              a.class_group_id === classGroupId &&
              a.classroom_id === assignment.classroom_id
          )
          if (classInfo && classGroupId && classInfo.class_name) {
            groups.set(key, {
              class_group_id: classGroupId,
              class_group_name: classInfo.class_name,
              classroom_id: classInfo.classroom_id,
              classroom_name: classInfo.classroom_name,
              enrollment: classInfo.enrollment || 0,
              required_teachers: classInfo.required_teachers,
              preferred_teachers: classInfo.preferred_teachers,
              assigned_teachers: [],
            })
          }
        }
        const group = groups.get(key)
        if (group) {
          group.assigned_teachers.push({
            id: assignment.id,
            name: assignment.teacher_name,
            teacher_id: assignment.teacher_id,
          })
        }
      } else {
        // Class info (for class group placeholders)
        // Only create group if we have class_group_id and class_name
        if (!groups.has(key) && classGroupId && assignment.class_name) {
          groups.set(key, {
            class_group_id: classGroupId,
            class_group_name: assignment.class_name,
            classroom_id: assignment.classroom_id,
            classroom_name: assignment.classroom_name,
            enrollment: assignment.enrollment || 0,
            required_teachers: assignment.required_teachers,
            preferred_teachers: assignment.preferred_teachers,
            assigned_teachers: [],
          })
        }
      }
    })

<<<<<<< HEAD
    // Then, add configured mappings that don't have assignments yet
    mappings.forEach(mapping => {
      const classGroupId = mapping.class_group_id
      if (!classGroupId) return
      const key = `${classGroupId}-${mapping.classroom_id}`
      if (!groups.has(key)) {
        // Get enrollment for this class/day/time
        const enrollment = enrollments.find(
          e =>
            e.class_group_id === classGroupId &&
            e.day_of_week_id === data.day_of_week_id &&
            e.time_slot_id === data.time_slot_id
        )

        groups.set(key, {
          class_group_id: classGroupId,
          class_group_name: mapping.class_group?.name || 'Unknown',
          classroom_id: mapping.classroom_id,
          classroom_name: mapping.classroom?.name || 'Unknown',
          enrollment: enrollment?.enrollment_count || 0,
          required_teachers: undefined,
          preferred_teachers: undefined,
          assigned_teachers: [],
        })
      }
    })

    setClassGroups(groups)
  }, [data, classes, classrooms, enrollments, mappings, loading])
=======
    setClassGroups(groups)
  }, [data, classes, classrooms, enrollments, loading])
>>>>>>> 43e2e07 (chore(db): drop staffing_rules and audit log table, add audit policy)

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {dayName} - {timeSlotName}
          </DialogTitle>
          <DialogDescription>
            Assign teachers to classes and classrooms for this time slot
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading classes and classrooms...
            </div>
          ) : Array.from(classGroups.values()).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="mb-2">No classes or classrooms found.</p>
              <p className="text-sm">Please add classes and classrooms in Settings first.</p>
            </div>
          ) : (
            Array.from(classGroups.values())
              .sort((a, b) => {
                // Sort by classroom name first, then class name
                const classroomCompare = a.classroom_name.localeCompare(b.classroom_name)
                if (classroomCompare !== 0) return classroomCompare
                return a.class_group_name.localeCompare(b.class_group_name)
              })
              .map(group => (
                <div
                  key={`${group.class_group_id}-${group.classroom_id}`}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-semibold text-muted-foreground">
                        {group.classroom_name}
                      </div>
                      <div className="text-lg font-semibold">{group.class_group_name}</div>
                      {group.enrollment > 0 && (
                        <div className="text-sm text-muted-foreground mt-1">
                          Enrollment: {group.enrollment}
                        </div>
                      )}
                    </div>
                    <RatioIndicator
                      required={group.required_teachers}
                      preferred={group.preferred_teachers}
                      assigned={group.assigned_teachers.length}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Assigned Teachers</label>
                    <TeacherSelector
                      dayOfWeekId={data.day_of_week_id}
                      timeSlotId={data.time_slot_id}
                      classId={group.class_group_id}
                      classroomId={group.classroom_id}
                      selectedTeachers={group.assigned_teachers}
                      onTeachersChange={teachers => {
                        // TODO: Handle teacher assignment updates
                        console.log('Teachers changed:', teachers)
                      }}
                    />
                  </div>
                </div>
              ))
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
