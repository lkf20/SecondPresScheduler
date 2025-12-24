import Link from 'next/link'
import { getClassrooms } from '@/lib/api/classrooms'
import DataTable, { Column } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Database } from '@/types/database'
import ErrorMessage from '@/components/shared/ErrorMessage'

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

  const columns: Column<Classroom>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      linkBasePath: '/settings/classrooms',
    },
    {
      key: 'capacity',
      header: 'Capacity',
    },
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Classrooms</h1>
          <p className="text-muted-foreground mt-2">Manage classroom locations and capacity</p>
        </div>
        <Link href="/settings/classrooms/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Classroom
          </Button>
        </Link>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <DataTable
        data={classrooms}
        columns={columns}
        searchable
        searchPlaceholder="Search classrooms..."
        emptyMessage="No classrooms found. Add your first classroom to get started."
      />
    </div>
  )
}

