import Link from 'next/link'
import { getAllTeacherSchedules } from '@/lib/api/schedules'
import DataTable, { Column } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import ErrorMessage from '@/components/shared/ErrorMessage'

export default async function SchedulesPage() {
  let schedules: any[] = []
  let error: string | null = null

  try {
    schedules = await getAllTeacherSchedules()
    
    // Add computed fields for display
    schedules = schedules.map((schedule: any) => ({
      ...schedule,
      teacher_name: schedule.teacher?.display_name || 
                    (schedule.teacher?.first_name && schedule.teacher?.last_name
                      ? `${schedule.teacher.first_name} ${schedule.teacher.last_name}`
                      : '—'),
      day_name: schedule.day_of_week?.name || '—',
      time_slot_name: schedule.time_slot?.name || schedule.time_slot?.code || '—',
      class_name: schedule.class?.name || '—',
      classroom_name: schedule.classroom?.name || '—',
    }))
  } catch (err: any) {
    error = err.message || 'Failed to load schedules'
    console.error('Error loading schedules:', err)
  }

  const columns: Column<any>[] = [
    {
      key: 'teacher_name',
      header: 'Teacher',
      sortable: true,
      linkBasePath: '/schedules',
    },
    {
      key: 'day_name',
      header: 'Day',
      sortable: true,
    },
    {
      key: 'time_slot_name',
      header: 'Time Slot',
      sortable: true,
    },
    {
      key: 'class_name',
      header: 'Class',
      sortable: true,
    },
    {
      key: 'classroom_name',
      header: 'Classroom',
      sortable: true,
    },
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teacher Schedules</h1>
          <p className="text-muted-foreground mt-2">Manage teacher weekly schedules</p>
        </div>
        <Link href="/schedules/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Schedule
          </Button>
        </Link>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <DataTable
        data={schedules}
        columns={columns}
        searchable
        searchPlaceholder="Search schedules..."
        emptyMessage="No schedules found. Add your first schedule to get started."
      />
    </div>
  )
}

