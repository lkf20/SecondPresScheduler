import Link from 'next/link'
import { getTimeSlots } from '@/lib/api/timeslots'
import DataTable, { Column } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Database } from '@/types/database'
import ErrorMessage from '@/components/shared/ErrorMessage'

type TimeSlot = Database['public']['Tables']['time_slots']['Row']

export default async function TimeSlotsPage() {
  let timeslots: TimeSlot[] = []
  let error: string | null = null

  try {
    timeslots = await getTimeSlots()
  } catch (err: any) {
    error = err.message || 'Failed to load time slots'
    console.error('Error loading time slots:', err)
  }

  const columns: Column<TimeSlot>[] = [
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      linkBasePath: '/settings/timeslots',
    },
    {
      key: 'name',
      header: 'Name',
      sortable: true,
    },
    {
      key: 'default_start_time',
      header: 'Start Time',
    },
    {
      key: 'default_end_time',
      header: 'End Time',
    },
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Time Slots</h1>
          <p className="text-muted-foreground mt-2">Configure time periods and default times</p>
        </div>
        <Link href="/settings/timeslots/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Time Slot
          </Button>
        </Link>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <DataTable
        data={timeslots}
        columns={columns}
        searchable
        searchPlaceholder="Search time slots..."
        emptyMessage="No time slots found."
      />
    </div>
  )
}

