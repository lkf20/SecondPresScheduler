import Link from 'next/link'
import { getSubs } from '@/lib/api/subs'
import DataTable, { Column } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Database } from '@/types/database'
import ErrorMessage from '@/components/shared/ErrorMessage'

type Staff = Database['public']['Tables']['staff']['Row']

export default async function SubsPage() {
  let subs: Staff[] = []
  let error: string | null = null

  try {
    subs = await getSubs()
  } catch (err: any) {
    error = err.message || 'Failed to load subs'
    console.error('Error loading subs:', err)
  }

  const columns: Column<Staff>[] = [
    {
      key: 'display_name',
      header: 'Name',
      sortable: true,
      linkBasePath: '/subs',
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
          <h1 className="text-3xl font-bold tracking-tight">Subs</h1>
          <p className="text-muted-foreground mt-2">Manage substitute teacher information</p>
        </div>
        <Link href="/subs/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Sub
          </Button>
        </Link>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <DataTable
        data={subs}
        columns={columns}
        searchable
        searchPlaceholder="Search subs..."
        emptyMessage="No subs found. Add your first sub to get started."
      />
    </div>
  )
}
