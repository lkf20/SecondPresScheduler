'use client'

import { useState, useEffect } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface Teacher {
  id: string
  name: string
  teacher_id?: string
}

interface TeacherSelectorProps {
  dayOfWeekId: string
  timeSlotId: string
  classId: string
  classroomId: string
  selectedTeachers: Teacher[]
  onTeachersChange: (teachers: Teacher[]) => void
}

export default function TeacherSelector({
  dayOfWeekId,
  timeSlotId,
  classId,
  classroomId,
  selectedTeachers,
  onTeachersChange,
}: TeacherSelectorProps) {
  const [teachers, setTeachers] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(selectedTeachers.map((t) => t.teacher_id || t.id))
  )

  useEffect(() => {
    fetch('/api/teachers')
      .then((r) => r.json())
      .then((data) => {
        setTeachers(data.filter((t: any) => t.is_teacher && t.active))
      })
      .catch(console.error)
  }, [])

  const filteredTeachers = teachers.filter((teacher) => {
    const name = teacher.display_name || `${teacher.first_name} ${teacher.last_name}`
    return name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const handleToggle = (teacherId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds)
    if (checked) {
      newSelected.add(teacherId)
    } else {
      newSelected.delete(teacherId)
    }
    setSelectedIds(newSelected)

    const selected = filteredTeachers
      .filter((t) => newSelected.has(t.id))
      .map((t) => ({
        id: '', // Will be set when saved
        name: t.display_name || `${t.first_name} ${t.last_name}`,
        teacher_id: t.id,
      }))
    onTeachersChange(selected)
  }

  const handleRemove = (teacherId: string) => {
    handleToggle(teacherId, false)
  }

  const selectedTeachersList = teachers.filter((t) => selectedIds.has(t.id))

  return (
    <div className="space-y-3">
      {/* Selected teachers chips */}
      {selectedTeachersList.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTeachersList.map((teacher) => (
            <div
              key={teacher.id}
              className="flex items-center gap-1 bg-primary/10 text-primary rounded px-2 py-1 text-sm"
            >
              <span>
                {teacher.display_name || `${teacher.first_name} ${teacher.last_name}`}
              </span>
              <button
                onClick={() => handleRemove(teacher.id)}
                className="hover:bg-primary/20 rounded"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search input */}
      <Input
        placeholder="Search teachers..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full"
      />

      {/* Teacher list */}
      <div className="border rounded-md max-h-48 overflow-y-auto">
        {filteredTeachers.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">
            No teachers found
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredTeachers.map((teacher) => {
              const isSelected = selectedIds.has(teacher.id)
              const name = teacher.display_name || `${teacher.first_name} ${teacher.last_name}`
              return (
                <div
                  key={teacher.id}
                  className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer"
                  onClick={() => handleToggle(teacher.id, !isSelected)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => handleToggle(teacher.id, checked === true)}
                  />
                  <Label className="cursor-pointer flex-1">{name}</Label>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

