'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { X, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface ClassGroup {
  id: string
  name: string
  order?: number | null
  is_active?: boolean
}

interface ClassGroupMultiSelectProps {
  selectedClassGroupIds: string[]
  onSelectionChange: (classGroupIds: string[]) => void
  allowedClassGroupIds?: string[]
  disabled?: boolean
  existingClassGroups?: ClassGroup[] // Class groups already assigned (may include inactive)
}

export default function ClassGroupMultiSelect({
  selectedClassGroupIds,
  onSelectionChange,
  allowedClassGroupIds,
  disabled = false,
  existingClassGroups = [],
}: ClassGroupMultiSelectProps) {
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([])
  const [popoverOpen, setPopoverOpen] = useState(false)

  // Fetch all class groups once
  useEffect(() => {
    fetch('/api/class-groups?includeInactive=true')
      .then(r => r.json())
      .then(data => {
        setClassGroups(data)
      })
      .catch(console.error)
  }, [])

  // Merge existing class groups (may include inactive) with active ones from API
  const allClassGroups = useMemo(() => {
    const existingMap = new Map<string, ClassGroup>()
    existingClassGroups.forEach(cg => {
      existingMap.set(cg.id, cg)
    })
    classGroups.forEach(cg => {
      existingMap.set(cg.id, cg)
    })
    return Array.from(existingMap.values()).sort((a, b) => {
      const orderA = a.order ?? Infinity
      const orderB = b.order ?? Infinity
      if (orderA !== orderB) return orderA - orderB
      return a.name.localeCompare(b.name)
    })
  }, [existingClassGroups, classGroups])

  // Options available to add: allowed, active, not yet selected
  const addableClassGroups = useMemo(() => {
    const selectedSet = new Set(selectedClassGroupIds)
    return allClassGroups.filter(cg => {
      if (selectedSet.has(cg.id)) return false
      if (cg.is_active === false) return false
      if (allowedClassGroupIds && allowedClassGroupIds.length > 0) {
        if (!allowedClassGroupIds.includes(cg.id)) return false
      }
      return true
    })
  }, [allClassGroups, selectedClassGroupIds, allowedClassGroupIds])

  const selectedClassGroupsList = allClassGroups.filter(cg => selectedClassGroupIds.includes(cg.id))

  const handleAdd = (classGroupId: string) => {
    onSelectionChange([...selectedClassGroupIds, classGroupId])
    setPopoverOpen(false)
  }

  const handleSelectAll = () => {
    onSelectionChange([
      ...selectedClassGroupIds,
      ...addableClassGroups.map(cg => cg.id),
    ])
    setPopoverOpen(false)
  }

  const handleRemove = (classGroupId: string) => {
    onSelectionChange(selectedClassGroupIds.filter(id => id !== classGroupId))
  }

  const allSelected = addableClassGroups.length === 0

  return (
    <div className="space-y-2">
      <Label htmlFor="class-group-select" className="text-base font-medium mb-6 block">
        Class Groups
      </Label>

      {/* Selected class groups as chips */}
      <div className="flex flex-wrap items-center gap-2 min-h-[2.5rem]">
        {selectedClassGroupsList.map(cg => {
          const isInactive = cg.is_active === false
          return (
            <Badge
              key={cg.id}
              variant={isInactive ? 'outline' : 'secondary'}
              className={cn(
                'flex items-center gap-1 px-3 py-1 text-sm',
                isInactive && 'border-slate-200 bg-slate-50 text-slate-500'
              )}
            >
              {cg.name}
              {isInactive && <span className="ml-1 text-xs text-slate-500">(Inactive)</span>}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(cg.id)}
                  className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                  aria-label={`Remove ${cg.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          )
        })}
        {/* Simple dropdown: add a class group */}
        {!disabled && (
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 min-w-[10rem] justify-between gap-2 font-normal text-muted-foreground"
                disabled={allSelected}
                aria-label={allSelected ? 'All class groups selected' : 'Add class group'}
              >
                <span>{allSelected ? 'All selected' : 'Add class group'}</span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="start">
              {addableClassGroups.length > 0 && (
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
              <ul className="max-h-60 overflow-y-auto py-1">
                {addableClassGroups.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted-foreground">
                    No more class groups to add
                  </li>
                ) : (
                  addableClassGroups.map(cg => (
                    <li key={cg.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
                        onClick={() => handleAdd(cg.id)}
                      >
                        {cg.name}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {allowedClassGroupIds && allowedClassGroupIds.length > 0 && (
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
