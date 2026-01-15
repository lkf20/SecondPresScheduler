import Link from 'next/link'
import { getTimeOffRequests } from '@/lib/api/time-off'
import { getTimeOffShifts, getTimeOffCoverageSummary } from '@/lib/api/time-off-shifts'
import { getTeacherSchedules } from '@/lib/api/schedules'
import TimeOffListClient from './TimeOffListClient'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { parseLocalDate } from '@/lib/utils/date'
import { transformTimeOffCardData } from '@/lib/utils/time-off-card-data'
import { getHeaderClasses } from '@/lib/utils/colors'

export default async function TimeOffPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>
}) {
  const params = await searchParams
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
  const view = params?.view ?? 'active'
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

      // Build shift details with coverage status
      // Get all assignments for this request
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      
      const dates = shifts.map((shift: TimeOffShift) => shift.date).sort()
      const startDate = dates[0]
      const endDate = dates[dates.length - 1]
      
      const { data: assignments } = await supabase
        .from('sub_assignments')
        .select('date, time_slot_id, is_partial, assignment_type')
        .eq('teacher_id', request.teacher_id)
        .gte('date', startDate)
        .lte('date', endDate)
      
      // Transform using shared utility
      const transformed = transformTimeOffCardData(
        {
          id: request.id,
          teacher_id: request.teacher_id,
          start_date: request.start_date,
          end_date: request.end_date,
          reason: request.reason,
          notes: request.notes,
          teacher: request.teacher as any,
        },
        shifts.map((shift: TimeOffShift) => ({
          id: shift.id,
          date: shift.date,
          day_of_week_id: shift.day_of_week_id,
          time_slot_id: shift.time_slot_id,
          day_of_week: shift.day_of_week,
          time_slot: shift.time_slot,
        })),
        (assignments || []).map((assignment: any) => ({
          date: assignment.date,
          time_slot_id: assignment.time_slot_id,
          is_partial: assignment.is_partial,
          assignment_type: assignment.assignment_type || null,
        })),
        classrooms,
        {
          includeDetailedShifts: false,
          formatDay,
        }
      )
      
      const shiftDetails = transformed.shift_details || []

      return {
        ...request,
        teacher_name: transformed.teacher_name,
        shifts_display: `${shiftCount} shift${shiftCount !== 1 ? 's' : ''}`,
        coverage_status,
        coverage_total: transformed.total,
        coverage_covered: transformed.covered,
        coverage_partial: transformed.partial,
        coverage_uncovered: transformed.uncovered,
        classrooms: transformed.classrooms,
        shift_details: shiftDetails,
        reason: transformed.reason,
        notes: transformed.notes,
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
    <div className="w-full max-w-4xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className={getHeaderClasses('3xl')}>Time Off Requests</h1>
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
  )
}
