'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface Class {
  id: string
  name: string
}

interface SubClassPreferencesProps {
  subId: string
  selectedClassIds: string[]
  onSelectionChange: (classIds: string[]) => void
}

let cachedClassGroups: Class[] | null = null

export default function SubClassPreferences({
  selectedClassIds,
  onSelectionChange,
}: SubClassPreferencesProps) {
  const [classes, setClasses] = useState<Class[]>(() => cachedClassGroups || [])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(selectedClassIds))
  const [isSelectAllHovered, setIsSelectAllHovered] = useState(false)
  const [isDeselectAllHovered, setIsDeselectAllHovered] = useState(false)

  useEffect(() => {
    if (cachedClassGroups) {
      setClasses(cachedClassGroups)
      return
    }

    fetch('/api/class-groups')
      .then(r => r.json())
      .then(data => {
        cachedClassGroups = data as Class[]
        setClasses(cachedClassGroups)
      })
      .catch(console.error)
  }, [])

  // Sync selectedIds with prop changes
  useEffect(() => {
    setSelectedIds(new Set(selectedClassIds))
  }, [selectedClassIds])

  const filteredClasses = classes
  const hasSelections = selectedIds.size > 0

  const handleToggle = (classId: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(classId)) {
      newSelected.delete(classId)
    } else {
      newSelected.add(classId)
    }
    setSelectedIds(newSelected)
    onSelectionChange(Array.from(newSelected))
  }

  const handleSelectAll = () => {
    const allIds = new Set(filteredClasses.map(cls => cls.id))
    setSelectedIds(allIds)
    onSelectionChange(Array.from(allIds))
  }

  const handleClearAll = () => {
    const newSelected = new Set(selectedIds)
    filteredClasses.forEach(cls => {
      newSelected.delete(cls.id)
    })
    setSelectedIds(newSelected)
    onSelectionChange(Array.from(newSelected))
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-slate-900">Preferences</h3>
      <div className="rounded-lg border bg-white p-4">
        <div className="w-fit max-w-full">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Label>Prefers working with (Class Groups):</Label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                disabled={filteredClasses.length === 0}
                className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors hover:!bg-transparent disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  color: isSelectAllHovered ? 'rgb(15, 118, 110)' : 'rgb(71, 85, 105)',
                }}
                onMouseEnter={() => setIsSelectAllHovered(true)}
                onMouseLeave={() => setIsSelectAllHovered(false)}
              >
                Select all
              </button>
              {hasSelections && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={filteredClasses.length === 0}
                  className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors hover:!bg-transparent disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    color: isDeselectAllHovered ? 'rgb(15, 118, 110)' : 'rgb(71, 85, 105)',
                  }}
                  onMouseEnter={() => setIsDeselectAllHovered(true)}
                  onMouseLeave={() => setIsDeselectAllHovered(false)}
                >
                  Deselect all
                </button>
              )}
            </div>
          </div>

          {/* All classes as clickable chips */}
          <div className="flex flex-wrap gap-2 mt-4">
            {filteredClasses.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No class groups available</p>
            ) : (
              filteredClasses.map(cls => {
                const isSelected = selectedIds.has(cls.id)
                return (
                  <Badge
                    key={cls.id}
                    variant={isSelected ? 'default' : 'outline'}
                    className={cn(
                      'cursor-pointer transition-colors',
                      isSelected
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'hover:bg-accent hover:text-accent-foreground'
                    )}
                    onClick={() => handleToggle(cls.id)}
                  >
                    {cls.name}
                  </Badge>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
