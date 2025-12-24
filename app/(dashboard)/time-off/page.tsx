import Link from 'next/link'
import { getTimeOffRequests } from '@/lib/api/time-off'
import { getTeachers } from '@/lib/api/teachers'
import DataTable, { Column } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default async function TimeOffPage() {
  const requests = await getTimeOffRequests()
  const teachers = await getTeachers()

  const columns: Column<any>[] = [
    {
      key: 'teacher',
      header: 'Teacher',
      cell: (row) => row.teacher?.display_name || `${row.teacher?.first_name} ${row.teacher?.last_name}`,
      sortable: true,
    },
    {
      key: 'start_date',
      header: 'Start Date',
      sortable: true,
    },
    {
      key: 'end_date',
      header: 'End Date',
      sortable: true,
    },
    {
      key: 'time_slot',
      header: 'Time Slot',
      cell: (row) => row.time_slot?.name || 'All Day',
    },
    {
      key: 'notes',
      header: 'Notes',
    },
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Time Off Requests</h1>
          <p className="text-muted-foreground mt-2">Manage teacher time off requests</p>
        </div>
        <Link href="/time-off/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Time Off
          </Button>
        </Link>
      </div>

      <DataTable
        data={requests}
        columns={columns}
        searchable
        searchPlaceholder="Search time off requests..."
        emptyMessage="No time off requests found."
      />
    </div>
  )
}

