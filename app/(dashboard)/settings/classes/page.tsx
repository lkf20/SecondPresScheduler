import Link from 'next/link'
import { getClasses } from '@/lib/api/classes'
import DataTable, { Column } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Database } from '@/types/database'
import ErrorMessage from '@/components/shared/ErrorMessage'

type Class = Database['public']['Tables']['classes']['Row']

export default async function ClassesPage() {
  let classes: Class[] = []
  let error: string | null = null

  try {
    classes = await getClasses()
  } catch (err: any) {
    error = err.message || 'Failed to load classes'
    console.error('Error loading classes:', err)
  }

  const columns: Column<Class>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      linkBasePath: '/settings/classes',
    },
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Classes</h1>
          <p className="text-muted-foreground mt-2">Manage class names</p>
        </div>
        <Link href="/settings/classes/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Class
          </Button>
        </Link>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <DataTable
        data={classes}
        columns={columns}
        searchable
        searchPlaceholder="Search classes..."
        emptyMessage="No classes found. Add your first class to get started."
      />
    </div>
  )
}

