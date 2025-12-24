import Link from 'next/link'
import { getTeachers } from '@/lib/api/teachers'
import DataTable, { Column } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Database } from '@/types/database'
import ErrorMessage from '@/components/shared/ErrorMessage'

type Staff = Database['public']['Tables']['staff']['Row']

export default async function TeachersPage() {
  let teachers: Staff[] = []
  let error: string | null = null

  try {
    teachers = await getTeachers()
  } catch (err: any) {
    error = err.message || 'Failed to load teachers'
    console.error('Error loading teachers:', err)
  }

  const columns: Column<Staff>[] = [
    {
      key: 'display_name',
      header: 'Name',
      sortable: true,
      linkBasePath: '/teachers',
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
    },
    {
      key: 'phone',
      header: 'Phone',
    },
    {
      key: 'active',
      header: 'Status',
    },
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teachers</h1>
          <p className="text-muted-foreground mt-2">Manage teacher information and schedules</p>
        </div>
        <Link href="/teachers/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Teacher
          </Button>
        </Link>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <DataTable
        data={teachers}
        columns={columns}
        searchable
        searchPlaceholder="Search teachers..."
        emptyMessage="No teachers found. Add your first teacher to get started."
      />
    </div>
  )
}

