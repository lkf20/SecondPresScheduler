'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
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
  const [activeClassGroups, setActiveClassGroups] = useState<ClassGroup[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(selectedClassGroupIds)
  )
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Fetch active class groups for the dropdown
  useEffect(() => {
    fetch('/api/class-groups')
      .then((r) => r.json())
      .then((data) => {
        setActiveClassGroups(data)
      })
      .catch(console.error)
  }, [])

  // Merge existing class groups (may include inactive) with active ones from API
  // This ensures we have all class groups that are selected, even if inactive
  const allClassGroups = useMemo(() => {
    const existingMap = new Map<string, ClassGroup>()
    
    // Add existing class groups first (these may include inactive ones)
    existingClassGroups.forEach(cg => {
      existingMap.set(cg.id, cg)
    })
    
    // Add active class groups from API (will overwrite if duplicate, but that's fine)
    activeClassGroups.forEach(cg => {
      existingMap.set(cg.id, cg)
    })
    
    // Convert to array and sort by order, then name
    return Array.from(existingMap.values()).sort((a, b) => {
      const orderA = a.order ?? Infinity
      const orderB = b.order ?? Infinity
      if (orderA !== orderB) return orderA - orderB
      return a.name.localeCompare(b.name)
    })
  }, [existingClassGroups, activeClassGroups])

  // Sync selectedIds with prop changes
  useEffect(() => {
    setSelectedIds(new Set(selectedClassGroupIds))
  }, [selectedClassGroupIds])

  // Filter class groups for dropdown (only show active ones, preserve order)
  const filteredClassGroups = activeClassGroups
    .filter((cg) => {
      // Filter by allowed IDs if provided
      if (allowedClassGroupIds && allowedClassGroupIds.length > 0) {
        if (!allowedClassGroupIds.includes(cg.id)) return false
      }
      // Filter by search query
      return cg.name.toLowerCase().includes(searchQuery.toLowerCase())
    })
    // Keep the order from API (already sorted by order field, then name)

  const handleToggle = (classGroupId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds)
    if (checked) {
      newSelected.add(classGroupId)
    } else {
      newSelected.delete(classGroupId)
    }
    setSelectedIds(newSelected)
  }

  const handleSave = () => {
    onSelectionChange(Array.from(selectedIds))
    setIsDialogOpen(false)
    setSearchQuery('')
  }

  const handleRemove = (classGroupId: string) => {
    const newSelected = new Set(selectedIds)
    newSelected.delete(classGroupId)
    setSelectedIds(newSelected)
    onSelectionChange(Array.from(newSelected))
  }

  // Get selected class groups (may include inactive ones from existingClassGroups)
  // Preserve order from allClassGroups which is sorted by order field, then name
  const selectedClassGroupsList = allClassGroups
    .filter((cg) => selectedIds.has(cg.id))

  return (
    <div className="space-y-2">
      <Label htmlFor="class-group-select" className="text-base font-medium mb-6 block">
        Class Groups
      </Label>
      
      {/* Selected class groups as chips */}
      <div className="flex flex-wrap items-center gap-2 min-h-[2.5rem]">
        {selectedClassGroupsList.map((cg) => {
          const isInactive = cg.is_active === false
          return (
            <Badge 
              key={cg.id} 
              variant={isInactive ? "outline" : "secondary"} 
              className={cn(
                "flex items-center gap-1",
                isInactive && "border-destructive/50 text-muted-foreground"
              )}
            >
              {cg.name}
              {isInactive && (
                <span className="ml-1 text-xs text-destructive">(Inactive)</span>
              )}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(cg.id)}
                  className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          )
        })}
        {!disabled && (
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
        )}
      </div>

      {/* Selection Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Class Groups</DialogTitle>
            <DialogDescription>
              Choose which class groups are assigned to this slot
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col flex-1 min-h-0">
            {/* Search input */}
            <Input
              ref={searchInputRef}
              placeholder="Search class groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
                  filteredClassGroups.forEach((cg) => {
                    newSelected.add(cg.id)
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
                  filteredClassGroups.forEach((cg) => {
                    newSelected.delete(cg.id)
                  })
                  setSelectedIds(newSelected)
                }}
                className="flex-1"
              >
                Clear All
              </Button>
            </div>

            {/* Class group list */}
            <div className="border rounded-md overflow-y-auto flex-1 min-h-0">
              {filteredClassGroups.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  No class groups found
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredClassGroups.map((cg) => {
                    const isSelected = selectedIds.has(cg.id)
                    return (
                      <div
                        key={cg.id}
                        className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer"
                        onClick={() => handleToggle(cg.id, !isSelected)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            handleToggle(cg.id, checked === true)
                          }
                        />
                        <Label className="cursor-pointer flex-1">
                          {cg.name}
                        </Label>
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

      {allowedClassGroupIds && allowedClassGroupIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing only class groups allowed in this classroom
        </p>
      )}
    </div>
  )
}
