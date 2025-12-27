import Link from 'next/link'
import { getClassrooms } from '@/lib/api/classrooms'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Database } from '@/types/database'
import ErrorMessage from '@/components/shared/ErrorMessage'
import SortableClassroomsTable from '@/components/settings/SortableClassroomsTable'

type Classroom = Database['public']['Tables']['classrooms']['Row']

export default async function ClassroomsPage() {
  let classrooms: Classroom[] = []
  let error: string | null = null

  try {
    classrooms = await getClassrooms()
  } catch (err: any) {
    error = err.message || 'Failed to load classrooms'
    console.error('Error loading classrooms:', err)
  }

  // Add computed fields for display
  const classroomsWithComputed = classrooms.map((classroom: any) => ({
    ...classroom,
    allowed_classes_display: classroom.allowed_classes_count > 0
      ? `${classroom.allowed_classes_names} (${classroom.allowed_classes_count})`
      : 'None',
  }))

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-8">
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Classrooms</h1>
          <p className="text-muted-foreground mt-2">
            Manage classroom locations and capacity. Drag rows to reorder.
          </p>
        </div>
        <div className="flex-shrink-0">
          <Link href="/settings/classrooms/new">
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Classroom
            </Button>
          </Link>
        </div>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <SortableClassroomsTable classrooms={classroomsWithComputed} />
    </div>
  )
}

