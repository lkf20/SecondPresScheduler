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
}

export default function ClassSelector({ selectedClassIds, onSelectionChange }: ClassSelectorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [classes, setClasses] = useState<ClassGroup[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    const abortController = new AbortController()

    const fetchClassGroups = async () => {
      try {
        const response = await fetch('/api/class-groups', { signal: abortController.signal })
        if (!response.ok) {
          throw new Error('Failed to load class groups')
        }
        const data = (await response.json()) as ClassGroup[]
        setClasses(data)
      } catch (error) {
        if ((error as Error).name === 'AbortError') return
        console.error('Failed to load class groups:', error)
      }
    }

    void fetchClassGroups()

    return () => {
      abortController.abort()
    }
  }, [])

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
        {selectedClassesList.map(cls => (
          <div
            key={cls.id}
            className="flex items-center gap-1 bg-primary/10 text-primary rounded-md px-2 py-1 text-sm"
          >
            <span>{cls.name}</span>
            <button
              onClick={() => handleRemove(cls.id)}
              className="hover:bg-primary/20 rounded"
              type="button"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

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
    </div>
  )
}
