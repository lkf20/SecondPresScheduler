'use client'

import { useState, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface ClassSelectorProps {
  value: string | null
  onChange: (classId: string | null) => void
  allowedClassIds?: string[]
  disabled?: boolean
}

export default function ClassSelector({
  value,
  onChange,
  allowedClassIds,
  disabled = false,
}: ClassSelectorProps) {
  const [classes, setClasses] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/class-groups')
      .then((r) => r.json())
      .then((data) => {
        setClasses(data)
      })
      .catch(console.error)
  }, [])

  // Filter class groups based on allowed IDs
  const availableClasses = allowedClassIds && allowedClassIds.length > 0
    ? classes.filter((cls) => allowedClassIds.includes(cls.id))
    : classes

  return (
    <div className="space-y-2">
      <Label htmlFor="class-select" className="text-base font-medium mb-6 block">Class Group</Label>
      <Select
        value={value || 'none'}
        onValueChange={(val) => onChange(val === 'none' ? null : val)}
        disabled={disabled}
      >
        <SelectTrigger id="class-select">
          <SelectValue placeholder="Select a class group" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          {availableClasses.map((cls) => (
            <SelectItem key={cls.id} value={cls.id}>
              {cls.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {allowedClassIds && allowedClassIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing only class groups allowed in this classroom
        </p>
      )}
    </div>
  )
}

