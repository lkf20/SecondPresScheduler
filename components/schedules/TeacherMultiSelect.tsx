'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X, CheckCircle2, AlertTriangle, XCircle, ChevronDown, Search } from 'lucide-react'
import { Database } from '@/types/database'
import { useDisplayNameFormat } from '@/lib/hooks/use-display-name-format'
import { getStaffDisplayName } from '@/lib/utils/staff-display-name'
import { useSchoolTeachersQuery } from '@/lib/hooks/use-school-teachers-query'

type Staff = Database['public']['Tables']['staff']['Row']

type StaffRoleType = Database['public']['Tables']['staff_role_types']['Row']
type StaffRoleAssignment = Database['public']['Tables']['staff_role_type_assignments']['Row']

type StaffWithRole = Staff & {
  staff_role_type_assignments?: Array<
    StaffRoleAssignment & { staff_role_types?: StaffRoleType | null }
  >
}

interface Teacher {
  id: string
  name: string
  teacher_id?: string
  is_floater?: boolean
  is_flexible?: boolean
}

interface TeacherMultiSelectProps {
  selectedTeachers: Teacher[]
  onTeachersChange: (teachers: Teacher[]) => void
  requiredCount?: number
  preferredCount?: number
  disabled?: boolean
  roleFilter?: 'FLEXIBLE' | 'PERMANENT'
}

export default function TeacherMultiSelect({
  selectedTeachers,
  onTeachersChange,
  requiredCount,
  preferredCount,
  disabled = false,
  roleFilter,
}: TeacherMultiSelectProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(selectedTeachers.map(t => t.teacher_id || t.id))
  )
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { format: displayNameFormat } = useDisplayNameFormat()
  const { data: teachersRaw = [] } = useSchoolTeachersQuery()
  const teachers = useMemo(
    () =>
      Array.isArray(teachersRaw) ? (teachersRaw as StaffWithRole[]).filter(t => t.active) : [],
    [teachersRaw]
  )

  // Sync selectedIds with prop changes
  useEffect(() => {
    setSelectedIds(new Set(selectedTeachers.map(t => t.teacher_id || t.id)))
  }, [selectedTeachers])

  const filteredTeachers = teachers
    .filter(teacher => {
      if (roleFilter === 'FLEXIBLE') {
        const isFlex = teacher.staff_role_type_assignments?.some(
          a => a.staff_role_types?.code === 'FLEXIBLE'
        )
        if (!isFlex) return false
      } else if (roleFilter === 'PERMANENT') {
        const isFlex = teacher.staff_role_type_assignments?.some(
          a => a.staff_role_types?.code === 'FLEXIBLE'
        )
        if (isFlex) return false
      }

      const name = getStaffDisplayName(
        {
          first_name: teacher.first_name ?? '',
          last_name: teacher.last_name ?? '',
          display_name: teacher.display_name ?? null,
        },
        displayNameFormat
      )
      return name.toLowerCase().includes(searchQuery.toLowerCase())
    })
    .sort((a, b) => {
      // Sort by display_name first, then first_name if no display_name
      const nameA = getStaffDisplayName(
        {
          first_name: a.first_name ?? '',
          last_name: a.last_name ?? '',
          display_name: a.display_name ?? null,
        },
        displayNameFormat
      )
      const nameB = getStaffDisplayName(
        {
          first_name: b.first_name ?? '',
          last_name: b.last_name ?? '',
          display_name: b.display_name ?? null,
        },
        displayNameFormat
      )
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
      .filter(t => newSelected.has(t.id))
      .map(t => {
        // Preserve existing is_floater and is_flexible if teacher was already selected
        const existing = selectedTeachers.find(st => (st.teacher_id || st.id) === t.id)
        const isFlexFromStaff =
          (t as StaffWithRole).staff_role_type_assignments?.some(
            a => a.staff_role_types?.code === 'FLEXIBLE'
          ) ?? false
        const is_flexible =
          roleFilter === 'FLEXIBLE'
            ? true
            : roleFilter === 'PERMANENT'
              ? false
              : (existing?.is_flexible ?? isFlexFromStaff)
        return {
          id: '', // Will be set when saved
          name: getStaffDisplayName(
            {
              first_name: t.first_name ?? '',
              last_name: t.last_name ?? '',
              display_name: t.display_name ?? null,
            },
            displayNameFormat
          ),
          teacher_id: t.id,
          is_floater: existing?.is_floater ?? false,
          is_flexible,
        }
      })
    onTeachersChange(selected)

    if (checked) {
      // When adding a teacher, clear search and focus so user can keep searching
      setSearchQuery('')
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 0)
    } else {
      // When removing a chip, don't open or leave the dropdown open
      setIsOpen(false)
    }
  }

  const handleRemove = (teacherId: string) => {
    handleToggle(teacherId, false)
  }

  const selectedTeachersList =
    teachers.length > 0
      ? teachers
          .filter(t => selectedIds.has(t.id))
          .sort((a, b) => {
            // Sort by display_name first, then first_name if no display_name
            const nameA = getStaffDisplayName(
              {
                first_name: a.first_name ?? '',
                last_name: a.last_name ?? '',
                display_name: a.display_name ?? null,
              },
              displayNameFormat
            )
            const nameB = getStaffDisplayName(
              {
                first_name: b.first_name ?? '',
                last_name: b.last_name ?? '',
                display_name: b.display_name ?? null,
              },
              displayNameFormat
            )
            return nameA.localeCompare(nameB)
          })
      : [...selectedTeachers].sort((a, b) => a.name.localeCompare(b.name))

  const getTeacherLabel = (teacher: Staff | Teacher) => {
    if ('name' in teacher && teacher.name) return teacher.name
    return getStaffDisplayName(
      {
        first_name: (teacher as Staff).first_name ?? '',
        last_name: (teacher as Staff).last_name ?? '',
        display_name: (teacher as Staff).display_name ?? null,
      },
      displayNameFormat
    )
  }
  const assignedCount = selectedTeachersList.length

  // Close dropdown when clicking outside; clear search so next open shows placeholder
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

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
      statusIcon = <AlertTriangle className="h-4 w-4 text-amber-700" />
      statusText = `Below preferred by ${preferredCount - assignedCount}`
      statusColor = 'text-amber-700'
    }
  }

  return (
    <div className="space-y-3">
      {/* Single search input: focus opens list below (no duplicate search bar) */}
      <div className="relative" ref={dropdownRef}>
        <div className="relative flex items-center">
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search teachers..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => !disabled && setIsOpen(true)}
            onClick={() => !disabled && setIsOpen(true)}
            disabled={disabled}
            className="w-full pl-10 pr-9"
          />
          <ChevronDown
            className={`absolute right-3 h-4 w-4 text-muted-foreground pointer-events-none transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>

        {/* Dropdown: list only (search is the input above) */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg">
            {/* Teacher list */}
            <div className="max-h-60 overflow-y-auto">
              {filteredTeachers.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  No teachers found
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredTeachers.map(teacher => {
                    const isSelected = selectedIds.has(teacher.id)
                    const name = getStaffDisplayName(
                      {
                        first_name: teacher.first_name ?? '',
                        last_name: teacher.last_name ?? '',
                        display_name: teacher.display_name ?? null,
                      },
                      displayNameFormat
                    )
                    return (
                      <div
                        key={teacher.id}
                        className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer"
                        onClick={() => !disabled && handleToggle(teacher.id, !isSelected)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={checked =>
                            !disabled && handleToggle(teacher.id, checked === true)
                          }
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
          {selectedTeachersList.map(teacher => {
            // Find the corresponding selected teacher to get is_floater status
            const selectedTeacher = selectedTeachers.find(
              st => (st.teacher_id || st.id) === teacher.id
            )
            const isFloater = selectedTeacher?.is_floater ?? false

            return (
              <div
                key={teacher.id}
                className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                  isFloater
                    ? 'bg-purple-100 text-purple-800 border border-purple-300 border-dashed'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                <span>{getTeacherLabel(teacher)}</span>
                <Select
                  value={isFloater ? 'floater' : 'teacher'}
                  onValueChange={value => {
                    const updated = selectedTeachers.map(st => {
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
                  className="hover:bg-primary/20 rounded ml-2"
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
          <span className={`text-sm font-medium ${statusColor}`}>{statusText}</span>
        </div>
      )}
    </div>
  )
}
