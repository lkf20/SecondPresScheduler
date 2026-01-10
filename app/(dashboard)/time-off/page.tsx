import Link from 'next/link'
import { getTimeOffRequests } from '@/lib/api/time-off'
import { getTimeOffShifts } from '@/lib/api/time-off-shifts'
import { getTeachers } from '@/lib/api/teachers'
import DataTable, { Column } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { parseLocalDate } from '@/lib/utils/date'

export default async function TimeOffPage() {
  let requests = await getTimeOffRequests()
  const teachers = await getTeachers()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const ninetyDaysAgo = new Date(today)
  ninetyDaysAgo.setDate(today.getDate() - 90)

  // Fetch shifts for each request and add computed fields for display
  requests = await Promise.all(
    requests.map(async (request: any) => {
      const shifts = await getTimeOffShifts(request.id)
      const shiftCount = shifts.length
      const shiftMode = request.shift_selection_mode || 'all_scheduled'

      return {
        ...request,
        teacher_name:
          request.teacher?.display_name ||
          (request.teacher?.first_name && request.teacher?.last_name
            ? `${request.teacher.first_name} ${request.teacher.last_name}`
            : '—'),
        shifts_display:
          shiftMode === 'all_scheduled'
            ? `All scheduled (${shiftCount})`
            : `${shiftCount} shift${shiftCount !== 1 ? 's' : ''}`,
        reason_display: request.reason || '—',
      }
    })
  )

  const getStartDate = (request: any) => parseLocalDate(request.start_date)
  const getEndDate = (request: any) =>
    parseLocalDate(request.end_date || request.start_date)

  const pastRequests = requests
    .filter((request: any) => {
      const endDate = getEndDate(request)
      return endDate < today && endDate >= ninetyDaysAgo
    })
    .sort((a: any, b: any) => getEndDate(b).getTime() - getEndDate(a).getTime())

  const upcomingRequests = requests
    .filter((request: any) => getEndDate(request) >= today)
    .sort((a: any, b: any) => getStartDate(a).getTime() - getStartDate(b).getTime())

  const columns: Column<any>[] = [
    {
      key: 'teacher_name',
      header: 'Teacher',
      sortable: true,
      linkBasePath: '/time-off',
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
      key: 'shifts_display',
      header: 'Shifts',
      sortable: true,
    },
    {
      key: 'reason_display',
      header: 'Reason',
      sortable: true,
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
        data={upcomingRequests}
        columns={columns}
        searchable
        searchPlaceholder="Search time off requests..."
        emptyMessage="No time off requests found."
      />

      {pastRequests.length > 0 && (
        <details className="mt-6 rounded-lg bg-gray-50 border border-gray-200 p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-700 flex items-center justify-between">
            <span>Past Time Off (last 90 days)</span>
            <span className="text-muted-foreground">{pastRequests.length}</span>
          </summary>
          <div className="mt-4">
            <DataTable
              data={pastRequests}
              columns={columns}
              searchable={false}
              emptyMessage="No past time off requests in the last 90 days."
            />
          </div>
        </details>
      )}
    </div>
  )
}
