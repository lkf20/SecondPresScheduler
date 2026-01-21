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
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Search, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Classroom {
  id: string
  name: string
  capacity?: number | null
  order?: number | null
  allowed_classes_display?: string
  is_active?: boolean
  color?: string | null
}

interface SortableClassroomsTableProps {
  classrooms: Classroom[]
  onOrderChange?: (classrooms: Classroom[]) => void
}

function SortableRow({ classroom }: { classroom: Classroom }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: classroom.id })

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
        <div className="flex items-center gap-2">
          {!classroom.is_active && (
            <Badge variant="secondary" className="text-xs">Inactive</Badge>
          )}
          <Link
            href={`/settings/classrooms/${classroom.id}`}
            className={cn(
              "hover:underline",
              !classroom.is_active && "text-muted-foreground"
            )}
          >
            {classroom.name}
          </Link>
        </div>
      </TableCell>
                    <TableCell>{classroom.capacity || '—'}</TableCell>
                    <TableCell className="max-w-md">
                      {classroom.allowed_classes_display || 'None'}
                    </TableCell>
                    <TableCell>
                      {classroom.color ? (
                        <div
                          className="w-8 h-8 rounded"
                          style={{ backgroundColor: classroom.color }}
                          title={classroom.color}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
    </TableRow>
  )
}

export default function SortableClassroomsTable({
  classrooms: initialClassrooms,
}: SortableClassroomsTableProps) {
  const [classrooms, setClassrooms] = useState(initialClassrooms)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  // Only enable drag-and-drop after client-side hydration
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Update local state when prop changes
  useEffect(() => {
    setClassrooms(initialClassrooms)
  }, [initialClassrooms])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = classrooms.findIndex((c) => c.id === active.id)
      const newIndex = classrooms.findIndex((c) => c.id === over.id)

      const newClassrooms = arrayMove(classrooms, oldIndex, newIndex)

      // Update order values based on new positions
      const updatedClassrooms = newClassrooms.map((classroom, index) => ({
        ...classroom,
        order: index + 1,
      }))

      setClassrooms(updatedClassrooms)

      // Save to database in the background
      setIsSaving(true)
      try {
        // Only update classrooms whose order actually changed
        const orderChanged = updatedClassrooms.filter((classroom) => {
          const original = initialClassrooms.find((c) => c.id === classroom.id)
          return original?.order !== classroom.order
        })

        if (orderChanged.length > 0) {
          await Promise.all(
            orderChanged.map((classroom) =>
              fetch(`/api/classrooms/${classroom.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order: classroom.order }),
              })
            )
          )
        }
      } catch (error) {
        console.error('Failed to save order:', error)
        // Revert on error
        setClassrooms(initialClassrooms)
        alert('Failed to save order. Please try again.')
      } finally {
        setIsSaving(false)
      }
    }
  }

  // Filter classrooms by search and active status
  const filteredClassrooms = classrooms.filter((c) => {
    const matchesSearch = !search || c.name.toLowerCase().includes(search.toLowerCase())
    const matchesActiveFilter = showInactive || c.is_active !== false
    return matchesSearch && matchesActiveFilter
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search classrooms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="show-inactive"
            checked={showInactive}
            onCheckedChange={setShowInactive}
          />
          <Label htmlFor="show-inactive" className="text-sm cursor-pointer">
            Show inactive
          </Label>
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
                <TableHead>Capacity</TableHead>
                <TableHead>Allowed Class Groups</TableHead>
                <TableHead>Color</TableHead>
              </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClassrooms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No classrooms found
                    </TableCell>
                  </TableRow>
                ) : (
                  <SortableContext
                    items={filteredClassrooms.map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {filteredClassrooms.map((classroom) => (
                      <SortableRow key={classroom.id} classroom={classroom} />
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
                <TableHead>Capacity</TableHead>
                <TableHead>Allowed Class Groups</TableHead>
                <TableHead>Color</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClassrooms.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No classrooms found
                  </TableCell>
                </TableRow>
              ) : (
                filteredClassrooms.map((classroom) => (
                  <TableRow key={classroom.id}>
                    <TableCell className="w-10">
                      <div className="p-1">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {!classroom.is_active && (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                        <Link
                          href={`/settings/classrooms/${classroom.id}`}
                          className={cn(
                            "hover:underline",
                            !classroom.is_active && "text-muted-foreground"
                          )}
                        >
                          {classroom.name}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell>{classroom.capacity || '—'}</TableCell>
                    <TableCell className="max-w-md">
                      {classroom.allowed_classes_display || 'None'}
                    </TableCell>
                    <TableCell>
                      {classroom.color ? (
                        <div
                          className="w-8 h-8 rounded"
                          style={{ backgroundColor: classroom.color }}
                          title={classroom.color}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
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
