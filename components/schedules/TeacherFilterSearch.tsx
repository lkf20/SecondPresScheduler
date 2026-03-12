'use client'

import { useState, useEffect, useRef } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { X, Search, ChevronDown } from 'lucide-react'
import { useDisplayNameFormat } from '@/lib/hooks/use-display-name-format'
import { getStaffDisplayName } from '@/lib/utils/staff-display-name'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type Staff = Database['public']['Tables']['staff']['Row']
type StaffRoleType = Database['public']['Tables']['staff_role_types']['Row']
type StaffRoleAssignment = Database['public']['Tables']['staff_role_type_assignments']['Row']

type StaffWithRole = Staff & {
  staff_role_type_assignments?: Array<
    StaffRoleAssignment & { staff_role_types?: StaffRoleType | null }
  >
}

export interface TeacherFilterSearchProps {
  value: string | null
  onChange: (teacherId: string | null) => void
  placeholder?: string
  className?: string
}

export default function TeacherFilterSearch({
  value,
  onChange,
  placeholder = 'Filter by teacher',
  className,
}: TeacherFilterSearchProps) {
  const [teachers, setTeachers] = useState<StaffWithRole[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { format: displayNameFormat } = useDisplayNameFormat()

  useEffect(() => {
    fetch('/api/teachers')
      .then(r => r.json())
      .then(data => {
        setTeachers(Array.isArray(data) ? (data as StaffWithRole[]).filter(t => t.active) : [])
      })
      .catch(console.error)
  }, [])

  const selectedTeacher = value ? teachers.find(t => t.id === value) : null

  const displayName = selectedTeacher
    ? getStaffDisplayName(
        {
          first_name: selectedTeacher.first_name ?? '',
          last_name: selectedTeacher.last_name ?? '',
          display_name: selectedTeacher.display_name ?? null,
        },
        displayNameFormat
      )
    : ''

  const filteredTeachers = teachers
    .filter(t => {
      const name = getStaffDisplayName(
        {
          first_name: t.first_name ?? '',
          last_name: t.last_name ?? '',
          display_name: t.display_name ?? null,
        },
        displayNameFormat
      )
      return name.toLowerCase().includes(searchQuery.toLowerCase().trim())
    })
    .sort((a, b) => {
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

  const handleSelect = (teacherId: string) => {
    onChange(teacherId)
    setSearchQuery('')
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
    setSearchQuery('')
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'min-w-[180px] justify-between gap-2 text-left font-normal',
            !value && 'text-muted-foreground',
            className
          )}
          aria-label={
            value ? `Filtering by ${displayName}. Click to change or clear.` : placeholder
          }
        >
          <span className="truncate">{value ? displayName : placeholder}</span>
          {value ? (
            <span
              role="button"
              tabIndex={0}
              onClick={e => {
                e.preventDefault()
                e.stopPropagation()
                handleClear(e)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  onChange(null)
                  setSearchQuery('')
                  setOpen(false)
                }
              }}
              className="flex items-center shrink-0 rounded p-0.5 text-muted-foreground hover:bg-slate-200 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Clear teacher filter"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Search teachers..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
              autoFocus
              aria-label="Search teachers"
            />
          </div>
        </div>
        <ul className="max-h-[240px] overflow-y-auto py-1" role="listbox" aria-label="Teachers">
          {filteredTeachers.length === 0 ? (
            <li className="px-3 py-4 text-sm text-muted-foreground text-center">
              {searchQuery.trim() ? 'No teachers match.' : 'No teachers found.'}
            </li>
          ) : (
            filteredTeachers.map(teacher => {
              const name = getStaffDisplayName(
                {
                  first_name: teacher.first_name ?? '',
                  last_name: teacher.last_name ?? '',
                  display_name: teacher.display_name ?? null,
                },
                displayNameFormat
              )
              const isSelected = value === teacher.id
              return (
                <li key={teacher.id} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onClick={() => handleSelect(teacher.id)}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm rounded-none',
                      'hover:bg-accent hover:text-accent-foreground',
                      'focus:bg-accent focus:text-accent-foreground focus:outline-none',
                      isSelected && 'bg-accent/80 font-medium'
                    )}
                  >
                    {name}
                  </button>
                </li>
              )
            })
          )}
        </ul>
        {value && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center gap-2 text-muted-foreground"
              onClick={handleClear}
            >
              <X className="h-4 w-4" />
              Clear teacher filter
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
