'use client'

import { useState, useEffect } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { X, Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Database } from '@/types/database'

type ClassGroup = Database['public']['Tables']['class_groups']['Row']

interface ClassSelectorProps {
  selectedClassIds: string[]
  onSelectionChange: (classIds: string[]) => void
}

export default function ClassSelector({ selectedClassIds, onSelectionChange }: ClassSelectorProps) {
  const [classes, setClasses] = useState<ClassGroup[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(selectedClassIds))

  useEffect(() => {
    fetch('/api/class-groups')
      .then(r => r.json())
      .then(data => {
        setClasses(data as ClassGroup[])
      })
      .catch(console.error)
  }, [])

  // Sync selectedIds with prop changes
  useEffect(() => {
    setSelectedIds(new Set(selectedClassIds))
  }, [selectedClassIds])

  const filteredClasses = classes.filter(cls => {
    return cls.name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const handleToggle = (classId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds)
    if (checked) {
      newSelected.add(classId)
    } else {
      newSelected.delete(classId)
    }
    setSelectedIds(newSelected)
  }

  const handleSave = () => {
    onSelectionChange(Array.from(selectedIds))
    setIsDialogOpen(false)
    setSearchQuery('')
  }

  const handleRemove = (classId: string) => {
    const newSelected = new Set(selectedIds)
    newSelected.delete(classId)
    setSelectedIds(newSelected)
    onSelectionChange(Array.from(newSelected))
  }

  const selectedClassesList = classes.filter(cls => selectedIds.has(cls.id))

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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsDialogOpen(true)}
          className="h-7"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Class Groups
        </Button>
      </div>

      {/* Selection Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Class Groups</DialogTitle>
            <DialogDescription>
              Choose which class groups are allowed in this classroom
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col flex-1 min-h-0">
            {/* Search input */}
            <Input
              placeholder="Search class groups..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="mb-3"
            />

            {/* Select All / Clear All buttons */}
            <div className="flex gap-2 mb-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const newSelected = new Set(selectedIds)
                  filteredClasses.forEach(cls => {
                    newSelected.add(cls.id)
                  })
                  setSelectedIds(newSelected)
                }}
                className="flex-1"
              >
                Select All
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const newSelected = new Set(selectedIds)
                  filteredClasses.forEach(cls => {
                    newSelected.delete(cls.id)
                  })
                  setSelectedIds(newSelected)
                }}
                className="flex-1"
              >
                Clear All
              </Button>
            </div>

            {/* Class list */}
            <div className="border rounded-md overflow-y-auto flex-1 min-h-0">
              {filteredClasses.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  No class groups found
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredClasses.map(cls => {
                    const isSelected = selectedIds.has(cls.id)
                    return (
                      <div
                        key={cls.id}
                        className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer"
                        onClick={() => handleToggle(cls.id, !isSelected)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={checked => handleToggle(cls.id, checked === true)}
                        />
                        <Label className="cursor-pointer flex-1">{cls.name}</Label>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false)
                  setSearchQuery('')
                }}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleSave}>
                Save ({selectedIds.size} selected)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
