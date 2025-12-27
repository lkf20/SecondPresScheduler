'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Search, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Class {
  id: string
  name: string
  order?: number | null
  [key: string]: any
}

interface SortableClassesTableProps {
  classes: Class[]
  onOrderChange?: (classes: Class[]) => void
}

function SortableRow({ classItem }: { classItem: Class }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: classItem.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && 'bg-muted')}
    >
      <TableCell className="w-10">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent rounded"
          type="button"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell>
        <Link
          href={`/settings/classes/${classItem.id}`}
          className="hover:underline"
        >
          {classItem.name}
        </Link>
      </TableCell>
    </TableRow>
  )
}

export default function SortableClassesTable({
  classes: initialClasses,
  onOrderChange,
}: SortableClassesTableProps) {
  const [classes, setClasses] = useState(initialClasses)
  const [search, setSearch] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  // Only enable drag-and-drop after client-side hydration
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Update local state when prop changes
  useEffect(() => {
    setClasses(initialClasses)
  }, [initialClasses])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = classes.findIndex((c) => c.id === active.id)
      const newIndex = classes.findIndex((c) => c.id === over.id)

      const newClasses = arrayMove(classes, oldIndex, newIndex)

      // Update order values based on new positions
      const updatedClasses = newClasses.map((classItem, index) => ({
        ...classItem,
        order: index + 1,
      }))

      setClasses(updatedClasses)

      // Save to database in the background
      setIsSaving(true)
      try {
        // Only update classes whose order actually changed
        const orderChanged = updatedClasses.filter((classItem, index) => {
          const original = initialClasses.find((c) => c.id === classItem.id)
          return original?.order !== classItem.order
        })

        if (orderChanged.length > 0) {
          await Promise.all(
            orderChanged.map((classItem) =>
              fetch(`/api/classes/${classItem.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order: classItem.order }),
              })
            )
          )
        }
      } catch (error) {
        console.error('Failed to save order:', error)
        // Revert on error
        setClasses(initialClasses)
        alert('Failed to save order. Please try again.')
      } finally {
        setIsSaving(false)
      }
    }
  }

  // Filter classes by search
  const filteredClasses = search
    ? classes.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
      )
    : classes

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search classes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        {isSaving && (
          <span className="text-sm text-muted-foreground">Saving...</span>
        )}
      </div>

      {isMounted ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClasses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      No classes found
                    </TableCell>
                  </TableRow>
                ) : (
                  <SortableContext
                    items={filteredClasses.map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {filteredClasses.map((classItem) => (
                      <SortableRow key={classItem.id} classItem={classItem} />
                    ))}
                  </SortableContext>
                )}
              </TableBody>
            </Table>
          </div>
        </DndContext>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Name</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClasses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    No classes found
                  </TableCell>
                </TableRow>
              ) : (
                filteredClasses.map((classItem) => (
                  <TableRow key={classItem.id}>
                    <TableCell className="w-10">
                      <div className="p-1">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/settings/classes/${classItem.id}`}
                        className="hover:underline"
                      >
                        {classItem.name}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

