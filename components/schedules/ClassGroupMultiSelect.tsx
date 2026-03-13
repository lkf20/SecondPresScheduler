'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { X, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

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
    onSelectionChange([...selectedClassGroupIds, ...addableClassGroups.map(cg => cg.id)])
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

      {/* Selected class groups as chips — items-start + compact height so chips stay short when inline with dropdown */}
      <div className="flex flex-wrap items-start gap-2 min-h-[2.5rem]">
        {selectedClassGroupsList.map(cg => {
          const isInactive = cg.is_active === false
          return (
            <Badge
              key={cg.id}
              variant={isInactive ? 'outline' : 'secondary'}
              className={cn(
                'inline-flex h-6 items-center gap-1 px-2.5 py-0.5 text-sm shrink-0 rounded-full',
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
        {/* Simple dropdown: add a class group. Content without Portal so it scrolls inside the side panel. */}
        {!disabled && (
          <PopoverPrimitive.Root open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverPrimitive.Trigger asChild>
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
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Content
              align="start"
              sideOffset={4}
              className={cn(
                'z-[100] w-56 rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-none',
                'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
                'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2'
              )}
            >
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
              <ul className="max-h-60 overflow-y-auto overscroll-contain py-1">
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
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Root>
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
