'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronDown, X } from 'lucide-react'
import { Database } from '@/types/database'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type ClassGroup = Database['public']['Tables']['class_groups']['Row']

interface ClassSelectorProps {
  selectedClassIds: string[]
  onSelectionChange: (classIds: string[]) => void
  /** When provided, only these class group IDs are shown in the list */
  allowedClassGroupIds?: string[]
  /** When true, fetch and show inactive class groups (e.g. for schedule panel) */
  includeInactive?: boolean
  disabled?: boolean
  /** When true, render the dropdown without a portal so it can scroll inside a Sheet/Dialog (avoids Radix scroll lock). */
  disablePortal?: boolean
}

export default function ClassSelector({
  selectedClassIds,
  onSelectionChange,
  allowedClassGroupIds,
  includeInactive = false,
  disabled = false,
  disablePortal = false,
}: ClassSelectorProps) {
  const [classes, setClasses] = useState<ClassGroup[]>([])
  const [popoverOpen, setPopoverOpen] = useState(false)
  const hasAutoSelectedRef = useRef(false)

  const apiUrl = includeInactive ? '/api/class-groups?includeInactive=true' : '/api/class-groups'

  useEffect(() => {
    const abortController = new AbortController()
    const fetchClassGroups = async () => {
      try {
        const response = await fetch(apiUrl, { signal: abortController.signal })
        if (!response.ok) throw new Error('Failed to load class groups')
        const data = (await response.json()) as ClassGroup[]
        setClasses(data)
      } catch (error) {
        if ((error as Error).name === 'AbortError') return
        console.error('Failed to load class groups:', error)
      }
    }
    void fetchClassGroups()
    return () => abortController.abort()
  }, [apiUrl])

  const selectedIdSet = new Set(selectedClassIds ?? [])

  // Sorted list for display (by order, then name)
  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => {
      const orderA = a.order ?? Infinity
      const orderB = b.order ?? Infinity
      if (orderA !== orderB) return orderA - orderB
      return a.name.localeCompare(b.name)
    })
  }, [classes])

  // Options available to add: allowed, active, not yet selected (inactive can only appear as chips if already selected)
  const addableClasses = useMemo(() => {
    return sortedClasses.filter(cls => {
      if (selectedIdSet.has(cls.id)) return false
      if (cls.is_active === false) return false
      if (allowedClassGroupIds !== undefined) {
        if (!allowedClassGroupIds.includes(cls.id)) return false
      }
      return true
    })
  }, [sortedClasses, selectedClassIds, allowedClassGroupIds])

  const selectedClassesList = sortedClasses.filter(cls => selectedIdSet.has(cls.id))

  // Class groups that can be chosen for this context (allowed + active)
  const selectableForRoom = useMemo(() => {
    return sortedClasses.filter(cls => {
      if (cls.is_active === false) return false
      if (allowedClassGroupIds !== undefined) {
        return allowedClassGroupIds.includes(cls.id)
      }
      return true
    })
  }, [sortedClasses, allowedClassGroupIds])

  // Hide dropdown only when every selectable class group is already selected (not when addable list is empty for other reasons)
  const allSelected =
    selectableForRoom.length > 0 && selectableForRoom.every(cls => selectedIdSet.has(cls.id))

  // When only one class group is available for the classroom, auto-select it once to save a step
  useEffect(() => {
    if (hasAutoSelectedRef.current) return
    if (selectableForRoom.length !== 1) return
    if (selectedClassIds.length > 0) return
    hasAutoSelectedRef.current = true
    onSelectionChange([selectableForRoom[0].id])
  }, [selectableForRoom, selectedClassIds.length, onSelectionChange])

  const handleAdd = (classId: string) => {
    onSelectionChange([...selectedClassIds, classId])
    setPopoverOpen(false)
  }

  const handleSelectAll = () => {
    onSelectionChange(selectableForRoom.map(c => c.id))
    setPopoverOpen(false)
  }

  const handleRemove = (classId: string) => {
    onSelectionChange(selectedClassIds.filter(id => id !== classId))
  }

  return (
    <div className="space-y-3">
      {/* Selected class groups as chips (label provided by parent when needed) */}
      <div className="flex flex-wrap gap-2 min-h-[2.5rem]">
        {selectedClassesList.map(cls => {
          const isInactive = cls.is_active === false
          return (
            <div
              key={cls.id}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-sm',
                isInactive
                  ? 'bg-slate-100 text-slate-600 border border-slate-200'
                  : 'bg-primary/10 text-primary'
              )}
            >
              <span>
                {cls.name}
                {isInactive ? ' (Inactive)' : ''}
              </span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(cls.id)}
                  className={
                    isInactive
                      ? 'hover:bg-slate-200 rounded p-0.5'
                      : 'hover:bg-primary/20 rounded p-0.5'
                  }
                  aria-label={`Remove ${cls.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )
        })}

        {/* Dropdown to add a class group; hidden when all are selected */}
        {!disabled && !allSelected && (
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 min-w-[10rem] justify-between gap-2 font-normal text-muted-foreground"
                aria-label="Add class group"
              >
                <span>Add class group</span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="start" disablePortal={disablePortal}>
              {addableClasses.length > 0 && (
                <div className="border-b border-border px-2 py-1.5">
                  <button
                    type="button"
                    className="w-full px-2 py-1.5 text-left text-sm font-medium text-teal-700 hover:bg-teal-50 focus:bg-teal-50 focus:outline-none rounded"
                    onClick={handleSelectAll}
                  >
                    Select all
                  </button>
                </div>
              )}
              <ul className="max-h-60 overflow-y-auto overscroll-contain py-1">
                {addableClasses.map(cls => (
                  <li key={cls.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
                      onClick={() => handleAdd(cls.id)}
                    >
                      {cls.name}
                    </button>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {allowedClassGroupIds !== undefined && allowedClassGroupIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing only class groups allowed in this classroom. To update go to{' '}
          <Link
            href="/settings/classrooms"
            className="text-teal-700 underline underline-offset-2 hover:text-teal-800"
          >
            Settings → Classrooms
          </Link>
        </p>
      )}
    </div>
  )
}
