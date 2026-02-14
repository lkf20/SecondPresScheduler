'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, X } from 'lucide-react'
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

export default function SubClassPreferences({
  selectedClassIds,
  onSelectionChange,
}: SubClassPreferencesProps) {
  const [classes, setClasses] = useState<Class[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(selectedClassIds))

  useEffect(() => {
    fetch('/api/class-groups')
      .then(r => r.json())
      .then(data => {
        setClasses(data)
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
        <div className="flex flex-wrap items-center gap-6 mb-3">
          <Label>Prefers working with (Class Groups):</Label>
          <button
            type="button"
            onClick={handleSelectAll}
            disabled={filteredClasses.length === 0}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            Select all
          </button>
          {hasSelections && (
            <button
              type="button"
              onClick={handleClearAll}
              disabled={filteredClasses.length === 0}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
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
  )
}
