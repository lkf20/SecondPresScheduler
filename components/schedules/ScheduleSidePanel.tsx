'use client'

import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import RatioIndicator from './RatioIndicator'
import type { WeeklyScheduleData } from '@/lib/api/weekly-schedule'

interface ScheduleSidePanelProps {
  isOpen: boolean
  onClose: () => void
  dayId: string
  dayName: string
  timeSlotId: string
  timeSlotName: string
  classroomId: string
  classroomName: string
  assignments: WeeklyScheduleData['assignments']
}

interface ClassGroup {
  class_id: string
  class_name: string
  classroom_id: string
  classroom_name: string
  enrollment: number
  required_teachers?: number
  preferred_teachers?: number
  assigned_teachers: Array<{ id: string; name: string; teacher_id: string }>
}

export default function ScheduleSidePanel({
  isOpen,
  onClose,
  dayName,
  timeSlotName,
  classroomName,
  assignments,
}: ScheduleSidePanelProps) {
  const [classGroups, setClassGroups] = useState<Map<string, ClassGroup>>(new Map())

  // Build class groups from assignments
  useEffect(() => {
    const groups = new Map<string, ClassGroup>()

    assignments.forEach((assignment) => {
      const key = `${assignment.class_id}-${assignment.classroom_id}`
      
      if (assignment.teacher_id) {
        // Teacher assignment
        if (!groups.has(key)) {
          const classInfo = assignments.find(
            (a) => !a.teacher_id && a.class_id === assignment.class_id && a.classroom_id === assignment.classroom_id
          )
          if (classInfo) {
            groups.set(key, {
              class_id: assignment.class_id,
              class_name: assignment.class_name,
              classroom_id: assignment.classroom_id,
              classroom_name: assignment.classroom_name,
              enrollment: assignment.enrollment || 0,
              required_teachers: assignment.required_teachers,
              preferred_teachers: assignment.preferred_teachers,
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
        // Class info (no teacher assigned yet)
        if (!groups.has(key)) {
          groups.set(key, {
            class_id: assignment.class_id,
            class_name: assignment.class_name,
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

    setClassGroups(groups)
  }, [assignments])

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {dayName} - {timeSlotName}
          </SheetTitle>
          <SheetDescription>{classroomName}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {Array.from(classGroups.values()).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No assignments for this time slot</p>
              <Button className="mt-4" variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Assignment
              </Button>
            </div>
          ) : (
            Array.from(classGroups.values()).map((group) => (
              <div
                key={`${group.class_id}-${group.classroom_id}`}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{group.class_name}</h3>
                    <p className="text-sm text-muted-foreground">{group.classroom_name}</p>
                  </div>
                </div>

                {group.enrollment > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Enrollment: </span>
                    <span className="font-medium">{group.enrollment}</span>
                  </div>
                )}

                <RatioIndicator
                  enrollment={group.enrollment}
                  required={group.required_teachers}
                  preferred={group.preferred_teachers}
                  assigned={group.assigned_teachers.length}
                />

                {group.assigned_teachers.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Assigned Teachers:</div>
                    <div className="flex flex-wrap gap-2">
                      {group.assigned_teachers.map((teacher) => (
                        <div
                          key={teacher.id}
                          className="text-sm bg-primary/10 text-primary rounded px-2 py-1"
                        >
                          {teacher.name}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No teachers assigned
                  </div>
                )}

                <Button variant="outline" size="sm" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Teacher
                </Button>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

