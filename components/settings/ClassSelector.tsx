'use client'

import { useState, useEffect, useRef } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ChevronDown, X } from 'lucide-react'
import { Database } from '@/types/database'

type ClassGroup = Database['public']['Tables']['class_groups']['Row']

interface ClassSelectorProps {
  selectedClassIds: string[]
  onSelectionChange: (classIds: string[]) => void
  /** When provided, only these class group IDs are shown in the list */
  allowedClassGroupIds?: string[]
  /** When true, fetch and show inactive class groups (e.g. for schedule panel) */
  includeInactive?: boolean
  disabled?: boolean
}

export default function ClassSelector({
  selectedClassIds,
  onSelectionChange,
  allowedClassGroupIds,
  includeInactive = false,
  disabled = false,
}: ClassSelectorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [classes, setClasses] = useState<ClassGroup[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  const apiUrl = includeInactive ? '/api/class-groups?includeInactive=true' : '/api/class-groups'

  useEffect(() => {
    fetch(apiUrl)
      .then(r => r.json())
      .then(data => {
        setClasses(data as ClassGroup[])
      })
      .catch(console.error)
  }, [apiUrl])

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (target instanceof Element && target.closest('button[type="submit"]')) return
      if (containerRef.current?.contains(target)) return
      setIsExpanded(false)
    }

    document.addEventListener('click', handleDocumentClick)
    return () => {
      document.removeEventListener('click', handleDocumentClick)
    }
  }, [])

  const selectedIdSet = new Set(selectedClassIds ?? [])

  const filteredClasses = classes.filter(cls => {
    if (allowedClassGroupIds && allowedClassGroupIds.length > 0) {
      if (!allowedClassGroupIds.includes(cls.id)) return false
    }
    return cls.name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const handleToggle = (classId: string, checked: boolean) => {
    const newSelected = new Set(selectedIdSet)
    if (checked) {
      newSelected.add(classId)
    } else {
      newSelected.delete(classId)
    }
    onSelectionChange(Array.from(newSelected))
  }

  const handleRemove = (classId: string) => {
    const newSelected = new Set(selectedIdSet)
    newSelected.delete(classId)
    onSelectionChange(Array.from(newSelected))
  }

  const selectedClassesList = classes.filter(cls => selectedIdSet.has(cls.id))

  return (
    <div className="space-y-3">
      {/* Selected classes chips */}
      <div className="flex flex-wrap gap-2">
        {selectedClassesList.map(cls => {
          const isInactive = cls.is_active === false
          return (
            <div
              key={cls.id}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-sm ${
                isInactive
                  ? 'bg-slate-100 text-slate-600 border border-slate-200'
                  : 'bg-primary/10 text-primary'
              }`}
            >
              <span>
                {cls.name}
                {isInactive ? ' (Inactive)' : ''}
              </span>
              {!disabled && (
                <button
                  onClick={() => handleRemove(cls.id)}
                  className={
                    isInactive ? 'hover:bg-slate-200 rounded' : 'hover:bg-primary/20 rounded'
                  }
                  type="button"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {!disabled && (
        <div ref={containerRef} className="space-y-3">
          <div className="relative">
            <Input
              placeholder="Search class groups..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setIsExpanded(true)}
              onClick={() => setIsExpanded(true)}
              className="pr-9"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              onClick={() => setIsExpanded(prev => !prev)}
              aria-label={isExpanded ? 'Collapse class groups list' : 'Expand class groups list'}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {isExpanded && (
            <>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newSelected = new Set(selectedIdSet)
                    filteredClasses.forEach(cls => {
                      newSelected.add(cls.id)
                    })
                    onSelectionChange(Array.from(newSelected))
                  }}
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newSelected = new Set(selectedIdSet)
                    filteredClasses.forEach(cls => {
                      newSelected.delete(cls.id)
                    })
                    onSelectionChange(Array.from(newSelected))
                  }}
                >
                  Deselect all
                </Button>
              </div>

              <div className="max-h-72 overflow-y-auto rounded-md border">
                {filteredClasses.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    No class groups found
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredClasses.map(cls => {
                      const isSelected = selectedIdSet.has(cls.id)
                      const isInactive = cls.is_active === false
                      const checkboxId = `class-group-${cls.id}`
                      return (
                        <div
                          key={cls.id}
                          className="flex items-center space-x-2 p-2 hover:bg-accent rounded"
                        >
                          <Checkbox
                            id={checkboxId}
                            checked={isSelected}
                            onCheckedChange={checked => handleToggle(cls.id, checked === true)}
                          />
                          <Label htmlFor={checkboxId} className="cursor-pointer flex-1">
                            {cls.name}
                            {isInactive ? ' (Inactive)' : ''}
                          </Label>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {allowedClassGroupIds && allowedClassGroupIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing only class groups allowed in this classroom
        </p>
      )}
    </div>
  )
}
