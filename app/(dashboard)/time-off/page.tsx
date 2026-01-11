import Link from 'next/link'
import { getTimeOffRequests } from '@/lib/api/time-off'
import { getTimeOffShifts, getTimeOffCoverageSummary } from '@/lib/api/time-off-shifts'
import { getTeacherSchedules } from '@/lib/api/schedules'
import TimeOffListClient from './TimeOffListClient'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { parseLocalDate } from '@/lib/utils/date'

export default async function TimeOffPage({
  searchParams,
}: {
  searchParams?: { view?: string }
}) {
  let requests = await getTimeOffRequests({ statuses: ['active', 'draft'] })
  type TimeOffRequest = Awaited<ReturnType<typeof getTimeOffRequests>>[number]
  type TimeOffShift = Awaited<ReturnType<typeof getTimeOffShifts>>[number]
  type TeacherSchedule = Awaited<ReturnType<typeof getTeacherSchedules>>[number]
  const scheduleCache = new Map<string, TeacherSchedule[]>()
  const formatDay = (name?: string | null) => {
    if (!name) return '—'
    if (name === 'Tuesday') return 'Tues'
    return name.slice(0, 3)
  }
  const view = searchParams?.view ?? 'active'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const ninetyDaysAgo = new Date(today)
  ninetyDaysAgo.setDate(today.getDate() - 90)

  // Fetch shifts for each request and add computed fields for display
  requests = await Promise.all(
    requests.map(async (request: TimeOffRequest) => {
      const shifts = await getTimeOffShifts(request.id)
      const shiftCount = shifts.length
      const coverage = await getTimeOffCoverageSummary({
        id: request.id,
        teacher_id: request.teacher_id,
        start_date: request.start_date,
        end_date: request.end_date || request.start_date,
      })
      if (!scheduleCache.has(request.teacher_id)) {
        const schedules = await getTeacherSchedules(request.teacher_id)
        scheduleCache.set(request.teacher_id, schedules)
      }
      const schedules = scheduleCache.get(request.teacher_id) || []
      const shiftKeys = new Set(
        shifts.map((shift: TimeOffShift) => `${shift.day_of_week_id}::${shift.time_slot_id}`)
      )
      const classroomsMap = new Map<string, { id: string; name: string; color: string | null }>()
      schedules.forEach((schedule: TeacherSchedule) => {
        if (!shiftKeys.has(`${schedule.day_of_week_id}::${schedule.time_slot_id}`)) return
        const classroom = schedule.classroom
        if (!classroom) return
        classroomsMap.set(classroom.id, {
          id: classroom.id,
          name: classroom.name,
          color: classroom.color ?? null,
        })
      })
      const classrooms = Array.from(classroomsMap.values())

      const requestEndDate = request.end_date || request.start_date
      const isPast = parseLocalDate(requestEndDate) < today
      let coverage_status: 'draft' | 'completed' | 'covered' | 'partially_covered' | 'needs_coverage'
      if (request.status === 'draft') {
        coverage_status = 'draft'
      } else if (isPast) {
        coverage_status = 'completed'
      } else if (coverage.total === 0 || coverage.uncovered === coverage.total) {
        coverage_status = 'needs_coverage'
      } else if (coverage.covered === coverage.total) {
        coverage_status = 'covered'
      } else {
        coverage_status = 'partially_covered'
      }

      const shiftDetails = shifts.map((shift: TimeOffShift) => {
        const dayName = formatDay(shift.day_of_week?.name)
        const timeCode = shift.time_slot?.code || '—'
        return `${dayName} ${timeCode}`
      })
      const coveredCount = coverage.covered

      return {
        ...request,
        teacher_name:
          request.teacher?.display_name ||
          (request.teacher?.first_name && request.teacher?.last_name
            ? `${request.teacher.first_name} ${request.teacher.last_name}`
            : '—'),
        shifts_display: `${shiftCount} shift${shiftCount !== 1 ? 's' : ''}`,
        coverage_status,
        coverage_total: coverage.total,
        coverage_covered: coveredCount,
        classrooms,
        shift_details: shiftDetails,
      }
    })
  )

  const getStartDate = (request: TimeOffRequest) => parseLocalDate(request.start_date)
  const getEndDate = (request: TimeOffRequest) =>
    parseLocalDate(request.end_date || request.start_date)

  const draftRequests = requests.filter((request: TimeOffRequest) => request.status === 'draft')
  const activeRequests = requests.filter((request: TimeOffRequest) => request.status === 'active')

  const pastRequests = activeRequests
    .filter((request: TimeOffRequest) => {
      const endDate = getEndDate(request)
      return endDate < today && endDate >= ninetyDaysAgo
    })
    .sort((a, b) => getEndDate(b).getTime() - getEndDate(a).getTime())

  const upcomingRequests = activeRequests
    .filter((request: TimeOffRequest) => getEndDate(request) >= today)
    .sort((a, b) => getStartDate(a).getTime() - getStartDate(b).getTime())

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-3xl">
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

      <TimeOffListClient
        view={view}
        draftRequests={draftRequests}
        upcomingRequests={upcomingRequests}
        pastRequests={pastRequests}
      />
      </div>
    </div>
  )
}
