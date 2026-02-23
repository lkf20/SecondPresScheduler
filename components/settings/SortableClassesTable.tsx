'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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

interface Class {
  id: string
  name: string
  order?: number | null
  is_active?: boolean
}

interface SortableClassesTableProps {
  classes: Class[]
  onOrderChange?: (classes: Class[]) => void
}

function SortableRow({ classItem }: { classItem: Class }) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: classItem.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        'cursor-pointer transition-colors hover:bg-slate-50',
        isDragging && 'bg-muted hover:bg-muted'
      )}
      onClick={event => {
        const target = event.target as HTMLElement
        if (target.closest('button, a, input, textarea, select, [role="switch"]')) return
        router.push(`/settings/classes/${classItem.id}`)
      }}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          router.push(`/settings/classes/${classItem.id}`)
        }
      }}
      tabIndex={0}
    >
      <TableCell className="w-10 text-base">
        <button
          {...attributes}
          {...listeners}
          onClick={event => event.stopPropagation()}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent rounded"
          type="button"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell className="text-base">
        <div className="flex items-center gap-2">
          {!classItem.is_active && (
            <Badge variant="secondary" className="text-xs">
              Inactive
            </Badge>
          )}
          <Link
            href={`/settings/classes/${classItem.id}`}
            className={cn(
              'hover:underline text-base',
              !classItem.is_active && 'text-muted-foreground'
            )}
          >
            {classItem.name}
          </Link>
        </div>
      </TableCell>
    </TableRow>
  )
}

export default function SortableClassesTable({
  classes: initialClasses,
}: SortableClassesTableProps) {
  const router = useRouter()
  const [classes, setClasses] = useState(initialClasses)
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
      const oldIndex = classes.findIndex(c => c.id === active.id)
      const newIndex = classes.findIndex(c => c.id === over.id)

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
        const orderChanged = updatedClasses.filter(classItem => {
          const original = initialClasses.find(c => c.id === classItem.id)
          return original?.order !== classItem.order
        })

        if (orderChanged.length > 0) {
          await Promise.all(
            orderChanged.map(classItem =>
              fetch(`/api/class-groups/${classItem.id}`, {
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

  // Filter classes by search and active status
  const filteredClasses = classes.filter(c => {
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
            placeholder="Search class groups..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
          <Label htmlFor="show-inactive" className="text-sm font-normal cursor-pointer">
            Show inactive
          </Label>
        </div>
        {isSaving && <span className="text-sm text-muted-foreground">Saving...</span>}
      </div>

      {isMounted ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 text-base"></TableHead>
                  <TableHead className="text-base">Name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClasses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground text-base">
                      No classes found
                    </TableCell>
                  </TableRow>
                ) : (
                  <SortableContext
                    items={filteredClasses.map(c => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {filteredClasses.map(classItem => (
                      <SortableRow key={classItem.id} classItem={classItem} />
                    ))}
                  </SortableContext>
                )}
              </TableBody>
            </Table>
          </div>
        </DndContext>
      ) : (
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-base"></TableHead>
                <TableHead className="text-base">Name</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClasses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground text-base">
                    No classes found
                  </TableCell>
                </TableRow>
              ) : (
                filteredClasses.map(classItem => (
                  <TableRow
                    key={classItem.id}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                    onClick={event => {
                      const target = event.target as HTMLElement
                      if (target.closest('button, a, input, textarea, select, [role="switch"]')) {
                        return
                      }
                      router.push(`/settings/classes/${classItem.id}`)
                    }}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        router.push(`/settings/classes/${classItem.id}`)
                      }
                    }}
                    tabIndex={0}
                  >
                    <TableCell className="w-10 text-base">
                      <div className="p-1">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </TableCell>
                    <TableCell className="text-base">
                      <div className="flex items-center gap-2">
                        {!classItem.is_active && (
                          <Badge variant="secondary" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                        <Link
                          href={`/settings/classes/${classItem.id}`}
                          className={cn(
                            'hover:underline text-base',
                            !classItem.is_active && 'text-muted-foreground'
                          )}
                        >
                          {classItem.name}
                        </Link>
                      </div>
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
