'use client'

import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import RatioIndicator from './RatioIndicator'
import type { WeeklyScheduleData } from '@/lib/api/weekly-schedule'

interface ScheduleCellProps {
  data?: WeeklyScheduleData
  onClick: () => void
}

export default function ScheduleCell({ data, onClick }: ScheduleCellProps) {
  if (!data || data.assignments.length === 0) {
    return (
      <div className="min-h-[60px] flex items-center justify-center">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onClick}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>
    )
  }

  // Group assignments by class/classroom (unique combinations)
  const classGroups = new Map<string, {
    class_name: string
    classroom_name: string
    enrollment: number
    required_teachers?: number
    preferred_teachers?: number
    assigned_count: number
    teachers: string[]
  }>()

  data.assignments.forEach((assignment) => {
    if (assignment.teacher_id) {
      // This is a teacher assignment
      const key = `${assignment.class_id}-${assignment.classroom_id}`
      if (!classGroups.has(key)) {
        // Find the class info from a non-teacher assignment
        const classInfo = data.assignments.find(
          (a) => !a.teacher_id && a.class_id === assignment.class_id && a.classroom_id === assignment.classroom_id
        )
        if (classInfo) {
          classGroups.set(key, {
            class_name: classInfo.class_name,
            classroom_name: classInfo.classroom_name,
            enrollment: classInfo.enrollment || 0,
            required_teachers: classInfo.required_teachers,
            preferred_teachers: classInfo.preferred_teachers,
            assigned_count: 0,
            teachers: [],
          })
        }
      }
      const group = classGroups.get(key)
      if (group) {
        group.teachers.push(assignment.teacher_name)
        group.assigned_count = group.teachers.length
      }
    } else {
      // This is class info (no teacher assigned yet)
      const key = `${assignment.class_id}-${assignment.classroom_id}`
      if (!classGroups.has(key)) {
        classGroups.set(key, {
          class_name: assignment.class_name,
          classroom_name: assignment.classroom_name,
          enrollment: assignment.enrollment || 0,
          required_teachers: assignment.required_teachers,
          preferred_teachers: assignment.preferred_teachers,
          assigned_count: 0,
          teachers: [],
        })
      }
    }
  })

  return (
    <div className="space-y-2 min-h-[60px]">
      {Array.from(classGroups.values()).map((group, idx) => (
        <div
          key={idx}
          className="border rounded p-2 hover:bg-accent cursor-pointer"
          onClick={onClick}
        >
          <div className="text-sm font-medium mb-1">{group.class_name}</div>
          {group.enrollment > 0 && (
            <div className="text-xs text-muted-foreground mb-1">
              Enroll: {group.enrollment}
            </div>
          )}
          <RatioIndicator
            enrollment={group.enrollment}
            required={group.required_teachers}
            preferred={group.preferred_teachers}
            assigned={group.assigned_count}
          />
          {group.teachers.length > 0 && (
            <div className="mt-2 space-y-1">
              {group.teachers.map((teacher, tIdx) => (
                <div key={tIdx} className="text-xs bg-primary/10 text-primary rounded px-1.5 py-0.5 inline-block mr-1">
                  {teacher}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="w-full mt-2"
        onClick={onClick}
      >
        <Plus className="h-4 w-4 mr-1" />
        Add
      </Button>
    </div>
  )
}

