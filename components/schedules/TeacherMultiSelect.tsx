'use client'

import { useState, useEffect, useRef } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X, CheckCircle2, AlertTriangle, XCircle, ChevronDown, Search } from 'lucide-react'

interface Teacher {
  id: string
  name: string
  teacher_id?: string
  is_floater?: boolean
}

interface TeacherMultiSelectProps {
  selectedTeachers: Teacher[]
  onTeachersChange: (teachers: Teacher[]) => void
  requiredCount?: number
  preferredCount?: number
  disabled?: boolean
}

export default function TeacherMultiSelect({
  selectedTeachers,
  onTeachersChange,
  requiredCount,
  preferredCount,
  disabled = false,
}: TeacherMultiSelectProps) {
  const [teachers, setTeachers] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(selectedTeachers.map((t) => t.teacher_id || t.id))
  )
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/teachers')
      .then((r) => r.json())
      .then((data) => {
        setTeachers(data.filter((t: any) => t.is_teacher && t.active))
      })
      .catch(console.error)
  }, [])

  // Sync selectedIds with prop changes
  useEffect(() => {
    setSelectedIds(new Set(selectedTeachers.map((t) => t.teacher_id || t.id)))
  }, [selectedTeachers])

  const filteredTeachers = teachers
    .filter((teacher) => {
      const name = teacher.display_name || `${teacher.first_name} ${teacher.last_name}`
      return name.toLowerCase().includes(searchQuery.toLowerCase())
    })
    .sort((a, b) => {
      // Sort by display_name first, then first_name if no display_name
      const nameA = a.display_name || a.first_name || ''
      const nameB = b.display_name || b.first_name || ''
      return nameA.localeCompare(nameB)
    })

  const handleToggle = (teacherId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds)
    if (checked) {
      newSelected.add(teacherId)
    } else {
      newSelected.delete(teacherId)
    }
    setSelectedIds(newSelected)

    const selected = teachers
      .filter((t) => newSelected.has(t.id))
      .map((t) => {
        // Preserve existing is_floater status if teacher was already selected
        const existing = selectedTeachers.find((st) => (st.teacher_id || st.id) === t.id)
        return {
          id: '', // Will be set when saved
          name: t.display_name || `${t.first_name} ${t.last_name}`,
          teacher_id: t.id,
          is_floater: existing?.is_floater ?? false,
        }
      })
    onTeachersChange(selected)
    
    // Clear search bar when a checkbox is clicked and focus it
    setSearchQuery('')
    // Focus the search input after state update
    setTimeout(() => {
      searchInputRef.current?.focus()
    }, 0)
  }

  const handleRemove = (teacherId: string) => {
    handleToggle(teacherId, false)
  }

  const selectedTeachersList = teachers
    .filter((t) => selectedIds.has(t.id))
    .sort((a, b) => {
      // Sort by display_name first, then first_name if no display_name
      const nameA = a.display_name || a.first_name || ''
      const nameB = b.display_name || b.first_name || ''
      return nameA.localeCompare(nameB)
    })
  const assignedCount = selectedTeachersList.length

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Get display text for button
  const getButtonText = () => {
    if (selectedTeachersList.length === 0) {
      return 'Select teachers...'
    }
    if (selectedTeachersList.length === 1) {
      return selectedTeachersList[0].display_name || `${selectedTeachersList[0].first_name} ${selectedTeachersList[0].last_name}`
    }
    return `${selectedTeachersList.length} teachers selected`
  }

  // Calculate status
  let statusIcon = <CheckCircle2 className="h-4 w-4 text-green-600" />
  let statusText = 'Meets required'
  let statusColor = 'text-green-600'

  if (requiredCount !== undefined) {
    if (assignedCount < requiredCount) {
      statusIcon = <XCircle className="h-4 w-4 text-red-600" />
      statusText = `Below required by ${requiredCount - assignedCount}`
      statusColor = 'text-red-600'
    } else if (preferredCount !== undefined && assignedCount < preferredCount) {
      statusIcon = <AlertTriangle className="h-4 w-4 text-yellow-600" />
      statusText = `Below preferred by ${preferredCount - assignedCount}`
      statusColor = 'text-yellow-600'
    }
  }

  return (
    <div className="space-y-3">
      {/* Search bar and dropdown */}
      <div className="relative" ref={dropdownRef}>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
        >
          <span className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className={selectedTeachersList.length === 0 ? 'text-muted-foreground' : ''}>
              {getButtonText()}
            </span>
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>

        {/* Dropdown menu */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg">
            {/* Search input inside dropdown */}
            <div className="p-2 border-b">
              <Input
                ref={searchInputRef}
                placeholder="Search teachers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
                autoFocus
              />
            </div>

            {/* Teacher list */}
            <div className="max-h-60 overflow-y-auto">
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
                        onClick={() => !disabled && handleToggle(teacher.id, !isSelected)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => !disabled && handleToggle(teacher.id, checked === true)}
                          disabled={disabled}
                        />
                        <Label className="cursor-pointer flex-1">{name}</Label>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Selected teachers chips */}
      {selectedTeachersList.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTeachersList.map((teacher) => {
            // Find the corresponding selected teacher to get is_floater status
            const selectedTeacher = selectedTeachers.find((st) => (st.teacher_id || st.id) === teacher.id)
            const isFloater = selectedTeacher?.is_floater ?? false
            
            return (
              <div
                key={teacher.id}
                className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                  isFloater
                    ? 'bg-purple-100 text-purple-800 border border-purple-300 border-dashed'
                    : 'bg-primary/10 text-primary'
                }`}
              >
                <span>
                  {teacher.display_name || `${teacher.first_name} ${teacher.last_name}`}
                </span>
                <Select
                  value={isFloater ? 'floater' : 'teacher'}
                  onValueChange={(value) => {
                    const updated = selectedTeachers.map((st) => {
                      if ((st.teacher_id || st.id) === teacher.id) {
                        return { ...st, is_floater: value === 'floater' }
                      }
                      return st
                    })
                    onTeachersChange(updated)
                  }}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-6 w-[75px] px-1 text-xs border-0 shadow-none focus:ring-0 text-center">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="floater">Floater</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  onClick={() => handleRemove(teacher.id)}
                  className="hover:bg-primary/20 rounded"
                  disabled={disabled}
                  type="button"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Status Summary - moved below teacher list */}
      {requiredCount !== undefined && (
        <div className="flex items-center gap-2">
          {statusIcon}
          <span className={`text-sm font-medium ${statusColor}`}>
            {statusText}
          </span>
        </div>
      )}
    </div>
  )
}

