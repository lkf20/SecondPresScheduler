'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
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
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(selectedClassIds))

  useEffect(() => {
    fetch('/api/class-groups')
      .then((r) => r.json())
      .then((data) => {
        setClasses(data)
      })
      .catch(console.error)
  }, [])

  // Sync selectedIds with prop changes
  useEffect(() => {
    setSelectedIds(new Set(selectedClassIds))
  }, [selectedClassIds])

  const filteredClasses = classes.filter((cls) => {
    return cls.name.toLowerCase().includes(searchQuery.toLowerCase())
  })

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
    const allIds = new Set(filteredClasses.map((cls) => cls.id))
    setSelectedIds(allIds)
    onSelectionChange(Array.from(allIds))
  }

  const handleClearAll = () => {
    const newSelected = new Set(selectedIds)
    filteredClasses.forEach((cls) => {
      newSelected.delete(cls.id)
    })
    setSelectedIds(newSelected)
    onSelectionChange(Array.from(newSelected))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Prefers working with (Class Groups):</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={filteredClasses.length === 0}
          >
            Select All
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            disabled={filteredClasses.length === 0}
          >
            Clear All
          </Button>
        </div>
      </div>

      {/* Search input */}
      <Input
        placeholder="Search class groups..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {/* All classes as clickable chips */}
      <div className="flex flex-wrap gap-2">
        {filteredClasses.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            {searchQuery ? 'No class groups found matching your search' : 'No class groups available'}
          </p>
        ) : (
          filteredClasses.map((cls) => {
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
  )
}
