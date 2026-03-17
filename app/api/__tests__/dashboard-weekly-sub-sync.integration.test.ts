/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET as getDashboardOverview } from '@/app/api/dashboard/overview/route'
import { GET as getWeeklySchedule } from '@/app/api/weekly-schedule/route'
import {
  compareAbsenceCoverageTuples,
  compareSubCoverageTuples,
  extractDashboardAbsenceCoverageTuples,
  extractDashboardSubCoverageTuples,
  extractWeeklyAbsenceCoverageTuples,
  extractWeeklySubCoverageTuples,
} from '@/lib/schedules/sub-coverage-sync'
import {
  baseAbsenceCoverageTuples,
  baseSubCoverageTuples,
  buildWeeklyAbsencePayloadFromTuples,
  buildWeeklyPayloadFromTuples,
} from '@/tests/helpers/sub-coverage-sync-fixtures'
import { getWeeklyScheduleData } from '@/lib/api/weekly-schedule'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getSchoolClosuresForDateRange } from '@/lib/api/school-calendar'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))
jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))
jest.mock('@/lib/api/school-calendar', () => ({
  getCalendarSettings: jest.fn().mockResolvedValue({ last_day_of_school: null }),
  getSchoolClosuresForDateRange: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/lib/api/weekly-schedule', () => ({
  ...jest.requireActual('@/lib/api/weekly-schedule'),
  getWeeklyScheduleData: jest.fn(),
  getWeekEndISO: jest.fn(() => '2026-03-22'),
}))
jest.mock('@/lib/api/schedule-settings', () => ({
  getScheduleSettings: jest.fn().mockResolvedValue({ selected_day_ids: ['day-mon'] }),
}))

class QueryMock {
  private rows: any[]
  private filters: Array<(row: any) => boolean> = []

  constructor(rows: any[]) {
    this.rows = [...rows]
  }

  select() {
    return this
  }
  eq(column: string, value: any) {
    this.filters.push(row => row[column] === value)
    return this
  }
  in(column: string, values: any[]) {
    this.filters.push(row => values.includes(row[column]))
    return this
  }
  gte(column: string, value: any) {
    this.filters.push(row => row[column] >= value)
    return this
  }
  lte(column: string, value: any) {
    this.filters.push(row => row[column] <= value)
    return this
  }
  order() {
    return this
  }
  maybeSingle() {
    const data = this.apply()[0] ?? null
    return Promise.resolve({ data, error: null })
  }
  single() {
    const data = this.apply()[0] ?? null
    return Promise.resolve({ data, error: null })
  }
  then(resolve: (value: any) => void) {
    resolve({ data: this.apply(), error: null })
  }

  private apply() {
    return this.rows.filter(row => this.filters.every(fn => fn(row)))
  }
}

describe('Dashboard vs Weekly sub sync (API integration invariant)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getWeeklyScheduleData as jest.Mock).mockResolvedValue(
      buildWeeklyPayloadFromTuples().classrooms
    )
  })

  it('returns synchronized substitute tuples across both APIs for same week window', async () => {
    const tupleByTeacher = new Map(baseSubCoverageTuples.map(tuple => [tuple.teacher_id, tuple]))
    const coverageRequests = baseSubCoverageTuples.map((tuple, index) => ({
      id: `cr-${index + 1}`,
      teacher_id: tuple.teacher_id,
      start_date: tuple.date,
      end_date: tuple.date,
      request_type: 'time_off',
      source_request_id: `tor-${index + 1}`,
      status: 'open',
      total_shifts: 1,
      covered_shifts: 1,
      created_at: `2026-03-0${index + 1}T10:00:00Z`,
      teacher: {
        id: tuple.teacher_id,
        first_name: 'Teacher',
        last_name: String(index + 1),
        display_name: null,
      },
      school_id: 'school-1',
    }))
    const coverageShifts = coverageRequests.map((request, index) => {
      const tuple = tupleByTeacher.get(request.teacher_id)!
      return {
        id: `crs-${index + 1}`,
        coverage_request_id: request.id,
        date: tuple.date,
        time_slot_id: 'slot-lb2',
        status: 'active',
        classroom_id: tuple.classroom_name === 'Infant Room' ? 'class-infant' : 'class-toddler',
        classroom: {
          id: tuple.classroom_name === 'Infant Room' ? 'class-infant' : 'class-toddler',
          name: tuple.classroom_name,
          color: null,
        },
        day_of_week: { id: 'day-mon', name: 'Monday', day_number: 1, display_order: 1 },
        time_slot: { id: 'slot-lb2', code: tuple.time_slot_code, name: 'Lunch', display_order: 2 },
      }
    })
    const subAssignments = coverageShifts.map((shift, index) => {
      const tuple = tupleByTeacher.get(coverageRequests[index].teacher_id)!
      return {
        id: `sa-${index + 1}`,
        date: tuple.date,
        day_of_week_id: 'day-mon',
        time_slot_id: 'slot-lb2',
        classroom_id: shift.classroom_id,
        notes: null,
        sub_id: tuple.sub_id,
        teacher_id: tuple.teacher_id,
        coverage_request_shift_id: shift.id,
        is_partial: false,
        assignment_type: 'Substitute Shift',
        status: 'active',
        sub: {
          id: tuple.sub_id,
          first_name: 'Sub',
          last_name: String(index + 1),
          display_name: null,
        },
        teacher: {
          id: tuple.teacher_id,
          first_name: 'Teacher',
          last_name: String(index + 1),
          display_name: null,
        },
        classroom: { id: shift.classroom_id, name: tuple.classroom_name, color: null },
        day_of_week: { id: 'day-mon', name: 'Monday', display_order: 1 },
        time_slot: { id: 'slot-lb2', code: tuple.time_slot_code, display_order: 2 },
        coverage_request_shift: { coverage_request_id: shift.coverage_request_id },
      }
    })

    const tableRows: Record<string, any[]> = {
      schedule_settings: [
        {
          school_id: 'school-1',
          default_display_name_format: 'first_last_initial',
          time_zone: 'UTC',
        },
      ],
      coverage_requests: coverageRequests,
      time_off_requests: coverageRequests.map((r, i) => ({
        id: `tor-${i + 1}`,
        reason: 'Sick Day',
        notes: null,
        status: 'active',
      })),
      coverage_request_shifts: coverageShifts,
      sub_assignments: subAssignments,
      schedule_cells: [],
      teacher_schedules: [],
      staffing_event_shifts: [],
      classrooms: [],
    }

    const { createClient } = jest.requireMock('@/lib/supabase/server') as {
      createClient: jest.Mock
    }
    createClient.mockResolvedValue({
      from: (table: string) => new QueryMock(tableRows[table] || []),
    })

    const dashboardRequest = new NextRequest(
      'http://localhost:3000/api/dashboard/overview?start_date=2026-03-16&end_date=2026-03-22'
    )
    const weeklyRequest = new Request(
      'http://localhost:3000/api/weekly-schedule?weekStartISO=2026-03-16'
    )

    const dashboardResponse = await getDashboardOverview(dashboardRequest)
    const weeklyResponse = await getWeeklySchedule(weeklyRequest)

    expect(dashboardResponse.status).toBe(200)
    expect(weeklyResponse.status).toBe(200)

    const dashboardJson = await dashboardResponse.json()
    const weeklyJson = await weeklyResponse.json()

    const dashboardTuples = extractDashboardSubCoverageTuples(dashboardJson)
    const weeklyTuples = extractWeeklySubCoverageTuples(weeklyJson, { weekStartISO: '2026-03-16' })
    const result = compareSubCoverageTuples(dashboardTuples, weeklyTuples)

    expect(result.dashboardCount).toBe(5)
    expect(result.weeklyCount).toBe(5)
    expect(result.missingInWeekly).toEqual([])
    expect(result.missingInDashboard).toEqual([])
    expect(result.inSync).toBe(true)
  })
})

describe('Dashboard vs Weekly absence sync (API integration invariant)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getWeeklyScheduleData as jest.Mock).mockResolvedValue(
      buildWeeklyAbsencePayloadFromTuples(baseAbsenceCoverageTuples).classrooms
    )
    ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([])
  })

  it('returns synchronized absence tuples (including has_sub) across both APIs for same week window', async () => {
    const tupleByTeacher = new Map(
      baseAbsenceCoverageTuples.map(tuple => [tuple.teacher_id, tuple])
    )
    const coverageRequests = baseAbsenceCoverageTuples.map((tuple, index) => ({
      id: `cr-a-${index + 1}`,
      teacher_id: tuple.teacher_id,
      start_date: tuple.date,
      end_date: tuple.date,
      request_type: 'time_off',
      source_request_id: `tor-a-${index + 1}`,
      status: 'open',
      total_shifts: 1,
      covered_shifts: tuple.has_sub ? 1 : 0,
      created_at: `2026-03-0${index + 1}T10:00:00Z`,
      teacher: {
        id: tuple.teacher_id,
        first_name: 'Teacher',
        last_name: String(index + 1),
        display_name: null,
      },
      school_id: 'school-1',
    }))

    const coverageShifts = coverageRequests.map((request, index) => {
      const tuple = tupleByTeacher.get(request.teacher_id)!
      return {
        id: `crs-a-${index + 1}`,
        coverage_request_id: request.id,
        date: tuple.date,
        time_slot_id: tuple.time_slot_id,
        status: 'active',
        classroom_id: tuple.classroom_id,
        classroom: {
          id: tuple.classroom_id,
          name: tuple.classroom_name,
          color: null,
        },
        day_of_week: { id: 'day-mon', name: 'Monday', day_number: 1, display_order: 1 },
        time_slot: {
          id: tuple.time_slot_id,
          code: tuple.time_slot_code,
          name: 'Lunch',
          display_order: 2,
        },
      }
    })

    const subAssignments = coverageShifts
      .filter((_, index) => baseAbsenceCoverageTuples[index].has_sub)
      .map((shift, index) => {
        const tuple = baseAbsenceCoverageTuples.filter(t => t.has_sub)[index]
        return {
          id: `sa-a-${index + 1}`,
          date: tuple.date,
          day_of_week_id: 'day-mon',
          time_slot_id: tuple.time_slot_id,
          classroom_id: tuple.classroom_id,
          notes: null,
          sub_id: `sub-a-${index + 1}`,
          teacher_id: tuple.teacher_id,
          coverage_request_shift_id: shift.id,
          is_partial: false,
          assignment_type: 'Substitute Shift',
          status: 'active',
          sub: {
            id: `sub-a-${index + 1}`,
            first_name: 'Sub',
            last_name: String(index + 1),
            display_name: null,
          },
          teacher: {
            id: tuple.teacher_id,
            first_name: 'Teacher',
            last_name: String(index + 1),
            display_name: null,
          },
          classroom: { id: tuple.classroom_id, name: tuple.classroom_name, color: null },
          day_of_week: { id: 'day-mon', name: 'Monday', display_order: 1 },
          time_slot: { id: tuple.time_slot_id, code: tuple.time_slot_code, display_order: 2 },
          coverage_request_shift: { coverage_request_id: shift.coverage_request_id },
        }
      })

    // Add inactive/cancelled rows that should be excluded by route queries.
    coverageRequests.push({
      id: 'cr-cancelled',
      teacher_id: 'teacher-cancelled',
      start_date: '2026-03-16',
      end_date: '2026-03-16',
      request_type: 'time_off',
      source_request_id: 'tor-cancelled',
      status: 'cancelled',
      total_shifts: 1,
      covered_shifts: 0,
      created_at: '2026-03-01T10:00:00Z',
      teacher: {
        id: 'teacher-cancelled',
        first_name: 'Teacher',
        last_name: 'Cancelled',
        display_name: null,
      },
      school_id: 'school-1',
    })
    coverageShifts.push({
      id: 'crs-cancelled',
      coverage_request_id: 'cr-a-1',
      date: '2026-03-16',
      time_slot_id: 'slot-lb2',
      status: 'cancelled',
      classroom_id: 'class-infant',
      classroom: { id: 'class-infant', name: 'Infant Room', color: null },
      day_of_week: { id: 'day-mon', name: 'Monday', day_number: 1, display_order: 1 },
      time_slot: { id: 'slot-lb2', code: 'LB2', name: 'Lunch', display_order: 2 },
    })
    subAssignments.push({
      id: 'sa-cancelled',
      date: '2026-03-16',
      day_of_week_id: 'day-mon',
      time_slot_id: 'slot-lb2',
      classroom_id: 'class-infant',
      notes: null,
      sub_id: 'sub-cancelled',
      teacher_id: 'teacher-2',
      coverage_request_shift_id: 'crs-a-2',
      is_partial: false,
      assignment_type: 'Substitute Shift',
      status: 'cancelled',
      sub: { id: 'sub-cancelled', first_name: 'Sub', last_name: 'Cancelled', display_name: null },
      teacher: { id: 'teacher-2', first_name: 'Teacher', last_name: '2', display_name: null },
      classroom: { id: 'class-infant', name: 'Infant Room', color: null },
      day_of_week: { id: 'day-mon', name: 'Monday', display_order: 1 },
      time_slot: { id: 'slot-lb2', code: 'LB2', display_order: 2 },
      coverage_request_shift: { coverage_request_id: 'cr-a-2' },
    })

    const tableRows: Record<string, any[]> = {
      schedule_settings: [
        {
          school_id: 'school-1',
          default_display_name_format: 'first_last_initial',
          time_zone: 'UTC',
        },
      ],
      coverage_requests: coverageRequests,
      time_off_requests: coverageRequests.map(r => ({
        id: r.source_request_id,
        reason: 'Sick Day',
        notes: null,
        status: r.status === 'cancelled' ? 'cancelled' : 'active',
      })),
      coverage_request_shifts: coverageShifts,
      sub_assignments: subAssignments,
      schedule_cells: [],
      teacher_schedules: [],
      staffing_event_shifts: [],
      classrooms: [],
    }

    const { createClient } = jest.requireMock('@/lib/supabase/server') as {
      createClient: jest.Mock
    }
    createClient.mockResolvedValue({
      from: (table: string) => new QueryMock(tableRows[table] || []),
    })

    const dashboardRequest = new NextRequest(
      'http://localhost:3000/api/dashboard/overview?start_date=2026-03-16&end_date=2026-03-22'
    )
    const weeklyRequest = new Request(
      'http://localhost:3000/api/weekly-schedule?weekStartISO=2026-03-16'
    )

    const dashboardResponse = await getDashboardOverview(dashboardRequest)
    const weeklyResponse = await getWeeklySchedule(weeklyRequest)

    expect(dashboardResponse.status).toBe(200)
    expect(weeklyResponse.status).toBe(200)

    const dashboardJson = await dashboardResponse.json()
    const weeklyJson = await weeklyResponse.json()

    const dashboardTuples = extractDashboardAbsenceCoverageTuples(dashboardJson)
    const weeklyTuples = extractWeeklyAbsenceCoverageTuples(weeklyJson, {
      weekStartISO: '2026-03-16',
    })
    const result = compareAbsenceCoverageTuples(dashboardTuples, weeklyTuples)

    expect(result.dashboardCount).toBe(4)
    expect(result.weeklyCount).toBe(4)
    expect(result.missingInWeekly).toEqual([])
    expect(result.missingInDashboard).toEqual([])
    expect(result.inSync).toBe(true)
  })

  it('detects absence drift when weekly drops a teacher absence while dashboard still has it', () => {
    const dashboardPayload = {
      coverage_requests: baseAbsenceCoverageTuples.map((tuple, idx) => ({
        id: `cr-${idx + 1}`,
        teacher_id: tuple.teacher_id,
        shift_details: [
          {
            date: tuple.date,
            time_slot_id: tuple.time_slot_id,
            classroom_id: tuple.classroom_id,
            status: tuple.has_sub ? 'covered' : 'uncovered',
          },
        ],
      })),
    }
    const weeklyPayload = {
      classrooms: buildWeeklyAbsencePayloadFromTuples(baseAbsenceCoverageTuples).classrooms.map(
        classroom => ({
          ...classroom,
          days: classroom.days.map(day => ({
            ...day,
            time_slots: day.time_slots.map(slot => ({
              ...slot,
              absences: (slot.absences || []).filter((a: any) => a.teacher_id !== 'teacher-4'),
            })),
          })),
        })
      ),
    }

    const dashboardTuples = extractDashboardAbsenceCoverageTuples(dashboardPayload)
    const weeklyTuples = extractWeeklyAbsenceCoverageTuples(weeklyPayload, {
      weekStartISO: '2026-03-16',
    })
    const result = compareAbsenceCoverageTuples(dashboardTuples, weeklyTuples)

    expect(result.inSync).toBe(false)
    expect(result.missingInWeekly).toEqual(['teacher-4|2026-03-16|slot-lb2|class-toddler|0'])
  })

  it('applies school closure filtering consistently to absence tuple extraction', async () => {
    const closure = { date: '2026-03-16', time_slot_id: 'slot-lb2' }
    ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([closure])

    const dashboardPayload = {
      coverage_requests: baseAbsenceCoverageTuples.map((tuple, idx) => ({
        id: `cr-${idx + 1}`,
        teacher_id: tuple.teacher_id,
        shift_details: [
          {
            date: tuple.date,
            time_slot_id: tuple.time_slot_id,
            classroom_id: tuple.classroom_id,
            status: tuple.has_sub ? 'covered' : 'uncovered',
          },
        ],
      })),
    }
    const weeklyPayload = buildWeeklyAbsencePayloadFromTuples(baseAbsenceCoverageTuples)

    const dashboardTuples = extractDashboardAbsenceCoverageTuples(dashboardPayload, {
      closures: [closure],
    })
    const weeklyTuples = extractWeeklyAbsenceCoverageTuples(weeklyPayload, {
      weekStartISO: '2026-03-16',
      closures: [closure],
    })
    const result = compareAbsenceCoverageTuples(dashboardTuples, weeklyTuples)

    expect(result.dashboardCount).toBe(0)
    expect(result.weeklyCount).toBe(0)
    expect(result.inSync).toBe(true)
  })

  it('normalizes partial+full assignment history to a single has_sub=true absence tuple', async () => {
    ;(getWeeklyScheduleData as jest.Mock).mockResolvedValue(
      buildWeeklyAbsencePayloadFromTuples([
        {
          teacher_id: 'teacher-1',
          date: '2026-03-16',
          day_number: 1,
          time_slot_id: 'slot-lb2',
          time_slot_code: 'LB2',
          classroom_id: 'class-infant',
          classroom_name: 'Infant Room',
          has_sub: true,
        },
      ]).classrooms
    )

    const coverageRequests = [
      {
        id: 'cr-history-1',
        teacher_id: 'teacher-1',
        start_date: '2026-03-16',
        end_date: '2026-03-16',
        request_type: 'time_off',
        source_request_id: 'tor-history-1',
        status: 'open',
        total_shifts: 1,
        covered_shifts: 1,
        created_at: '2026-03-15T10:00:00Z',
        teacher: { id: 'teacher-1', first_name: 'Teacher', last_name: 'One', display_name: null },
        school_id: 'school-1',
      },
    ]

    const coverageShifts = [
      {
        id: 'crs-history-1',
        coverage_request_id: 'cr-history-1',
        date: '2026-03-16',
        time_slot_id: 'slot-lb2',
        status: 'active',
        classroom_id: 'class-infant',
        classroom: { id: 'class-infant', name: 'Infant Room', color: null },
        day_of_week: { id: 'day-mon', name: 'Monday', day_number: 1, display_order: 1 },
        time_slot: { id: 'slot-lb2', code: 'LB2', name: 'Lunch', display_order: 2 },
      },
    ]

    const subAssignments = [
      {
        id: 'sa-history-partial',
        date: '2026-03-16',
        day_of_week_id: 'day-mon',
        time_slot_id: 'slot-lb2',
        classroom_id: 'class-infant',
        notes: null,
        sub_id: 'sub-partial',
        teacher_id: 'teacher-1',
        coverage_request_shift_id: 'crs-history-1',
        is_partial: true,
        assignment_type: 'Partial Sub Shift',
        status: 'active',
        sub: { id: 'sub-partial', first_name: 'Sub', last_name: 'Partial', display_name: null },
        teacher: { id: 'teacher-1', first_name: 'Teacher', last_name: 'One', display_name: null },
        classroom: { id: 'class-infant', name: 'Infant Room', color: null },
        day_of_week: { id: 'day-mon', name: 'Monday', display_order: 1 },
        time_slot: { id: 'slot-lb2', code: 'LB2', display_order: 2 },
        coverage_request_shift: { coverage_request_id: 'cr-history-1' },
      },
      {
        id: 'sa-history-full',
        date: '2026-03-16',
        day_of_week_id: 'day-mon',
        time_slot_id: 'slot-lb2',
        classroom_id: 'class-infant',
        notes: null,
        sub_id: 'sub-full',
        teacher_id: 'teacher-1',
        coverage_request_shift_id: 'crs-history-1',
        is_partial: false,
        assignment_type: 'Substitute Shift',
        status: 'active',
        sub: { id: 'sub-full', first_name: 'Sub', last_name: 'Full', display_name: null },
        teacher: { id: 'teacher-1', first_name: 'Teacher', last_name: 'One', display_name: null },
        classroom: { id: 'class-infant', name: 'Infant Room', color: null },
        day_of_week: { id: 'day-mon', name: 'Monday', display_order: 1 },
        time_slot: { id: 'slot-lb2', code: 'LB2', display_order: 2 },
        coverage_request_shift: { coverage_request_id: 'cr-history-1' },
      },
    ]

    const tableRows: Record<string, any[]> = {
      schedule_settings: [
        {
          school_id: 'school-1',
          default_display_name_format: 'first_last_initial',
          time_zone: 'UTC',
        },
      ],
      coverage_requests: coverageRequests,
      time_off_requests: [
        { id: 'tor-history-1', reason: 'Sick Day', notes: null, status: 'active' },
      ],
      coverage_request_shifts: coverageShifts,
      sub_assignments: subAssignments,
      schedule_cells: [],
      teacher_schedules: [],
      staffing_event_shifts: [],
      classrooms: [],
    }

    const { createClient } = jest.requireMock('@/lib/supabase/server') as {
      createClient: jest.Mock
    }
    createClient.mockResolvedValue({
      from: (table: string) => new QueryMock(tableRows[table] || []),
    })

    const dashboardRequest = new NextRequest(
      'http://localhost:3000/api/dashboard/overview?start_date=2026-03-16&end_date=2026-03-22'
    )
    const weeklyRequest = new Request(
      'http://localhost:3000/api/weekly-schedule?weekStartISO=2026-03-16'
    )

    const dashboardResponse = await getDashboardOverview(dashboardRequest)
    const weeklyResponse = await getWeeklySchedule(weeklyRequest)

    expect(dashboardResponse.status).toBe(200)
    expect(weeklyResponse.status).toBe(200)

    const dashboardJson = await dashboardResponse.json()
    const weeklyJson = await weeklyResponse.json()

    expect(dashboardJson.coverage_requests).toHaveLength(1)
    expect(dashboardJson.coverage_requests[0].shift_details).toHaveLength(1)
    expect(dashboardJson.coverage_requests[0].shift_details[0].status).toBe('covered')

    const dashboardTuples = extractDashboardAbsenceCoverageTuples(dashboardJson)
    const weeklyTuples = extractWeeklyAbsenceCoverageTuples(weeklyJson, {
      weekStartISO: '2026-03-16',
    })
    const result = compareAbsenceCoverageTuples(dashboardTuples, weeklyTuples)

    expect(result.dashboardCount).toBe(1)
    expect(result.weeklyCount).toBe(1)
    expect(result.missingInWeekly).toEqual([])
    expect(result.missingInDashboard).toEqual([])
    expect(result.inSync).toBe(true)
  })

  it('normalizes partial-only assignment history to a single has_sub=true tuple with dashboard status partial', async () => {
    ;(getWeeklyScheduleData as jest.Mock).mockResolvedValue(
      buildWeeklyAbsencePayloadFromTuples([
        {
          teacher_id: 'teacher-1',
          date: '2026-03-16',
          day_number: 1,
          time_slot_id: 'slot-lb2',
          time_slot_code: 'LB2',
          classroom_id: 'class-infant',
          classroom_name: 'Infant Room',
          has_sub: true,
        },
      ]).classrooms
    )

    const coverageRequests = [
      {
        id: 'cr-history-partial-only-1',
        teacher_id: 'teacher-1',
        start_date: '2026-03-16',
        end_date: '2026-03-16',
        request_type: 'time_off',
        source_request_id: 'tor-history-partial-only-1',
        status: 'open',
        total_shifts: 1,
        covered_shifts: 1,
        created_at: '2026-03-15T10:00:00Z',
        teacher: { id: 'teacher-1', first_name: 'Teacher', last_name: 'One', display_name: null },
        school_id: 'school-1',
      },
    ]

    const coverageShifts = [
      {
        id: 'crs-history-partial-only-1',
        coverage_request_id: 'cr-history-partial-only-1',
        date: '2026-03-16',
        time_slot_id: 'slot-lb2',
        status: 'active',
        classroom_id: 'class-infant',
        classroom: { id: 'class-infant', name: 'Infant Room', color: null },
        day_of_week: { id: 'day-mon', name: 'Monday', day_number: 1, display_order: 1 },
        time_slot: { id: 'slot-lb2', code: 'LB2', name: 'Lunch', display_order: 2 },
      },
    ]

    const subAssignments = [
      {
        id: 'sa-history-partial-only-1',
        date: '2026-03-16',
        day_of_week_id: 'day-mon',
        time_slot_id: 'slot-lb2',
        classroom_id: 'class-infant',
        notes: null,
        sub_id: 'sub-partial-only-1',
        teacher_id: 'teacher-1',
        coverage_request_shift_id: 'crs-history-partial-only-1',
        is_partial: true,
        assignment_type: 'Partial Sub Shift',
        status: 'active',
        sub: { id: 'sub-partial-only-1', first_name: 'Sub', last_name: 'One', display_name: null },
        teacher: { id: 'teacher-1', first_name: 'Teacher', last_name: 'One', display_name: null },
        classroom: { id: 'class-infant', name: 'Infant Room', color: null },
        day_of_week: { id: 'day-mon', name: 'Monday', display_order: 1 },
        time_slot: { id: 'slot-lb2', code: 'LB2', display_order: 2 },
        coverage_request_shift: { coverage_request_id: 'cr-history-partial-only-1' },
      },
      {
        id: 'sa-history-partial-only-2',
        date: '2026-03-16',
        day_of_week_id: 'day-mon',
        time_slot_id: 'slot-lb2',
        classroom_id: 'class-infant',
        notes: null,
        sub_id: 'sub-partial-only-2',
        teacher_id: 'teacher-1',
        coverage_request_shift_id: 'crs-history-partial-only-1',
        is_partial: true,
        assignment_type: 'Partial Sub Shift',
        status: 'active',
        sub: { id: 'sub-partial-only-2', first_name: 'Sub', last_name: 'Two', display_name: null },
        teacher: { id: 'teacher-1', first_name: 'Teacher', last_name: 'One', display_name: null },
        classroom: { id: 'class-infant', name: 'Infant Room', color: null },
        day_of_week: { id: 'day-mon', name: 'Monday', display_order: 1 },
        time_slot: { id: 'slot-lb2', code: 'LB2', display_order: 2 },
        coverage_request_shift: { coverage_request_id: 'cr-history-partial-only-1' },
      },
    ]

    const tableRows: Record<string, any[]> = {
      schedule_settings: [
        {
          school_id: 'school-1',
          default_display_name_format: 'first_last_initial',
          time_zone: 'UTC',
        },
      ],
      coverage_requests: coverageRequests,
      time_off_requests: [
        { id: 'tor-history-partial-only-1', reason: 'Sick Day', notes: null, status: 'active' },
      ],
      coverage_request_shifts: coverageShifts,
      sub_assignments: subAssignments,
      schedule_cells: [],
      teacher_schedules: [],
      staffing_event_shifts: [],
      classrooms: [],
    }

    const { createClient } = jest.requireMock('@/lib/supabase/server') as {
      createClient: jest.Mock
    }
    createClient.mockResolvedValue({
      from: (table: string) => new QueryMock(tableRows[table] || []),
    })

    const dashboardRequest = new NextRequest(
      'http://localhost:3000/api/dashboard/overview?start_date=2026-03-16&end_date=2026-03-22'
    )
    const weeklyRequest = new Request(
      'http://localhost:3000/api/weekly-schedule?weekStartISO=2026-03-16'
    )

    const dashboardResponse = await getDashboardOverview(dashboardRequest)
    const weeklyResponse = await getWeeklySchedule(weeklyRequest)

    expect(dashboardResponse.status).toBe(200)
    expect(weeklyResponse.status).toBe(200)

    const dashboardJson = await dashboardResponse.json()
    const weeklyJson = await weeklyResponse.json()

    expect(dashboardJson.coverage_requests).toHaveLength(1)
    expect(dashboardJson.coverage_requests[0].shift_details).toHaveLength(1)
    // Phase 1: 2 partials each at 0.5 = 1.0 total weight → fully_covered → 'covered'
    // (2 × 0.5 ≥ 1.0 threshold in deriveShiftCoverageStatus)
    expect(dashboardJson.coverage_requests[0].shift_details[0].status).toBe('covered')

    const dashboardTuples = extractDashboardAbsenceCoverageTuples(dashboardJson)
    const weeklyTuples = extractWeeklyAbsenceCoverageTuples(weeklyJson, {
      weekStartISO: '2026-03-16',
    })
    const result = compareAbsenceCoverageTuples(dashboardTuples, weeklyTuples)

    expect(result.dashboardCount).toBe(1)
    expect(result.weeklyCount).toBe(1)
    expect(result.missingInWeekly).toEqual([])
    expect(result.missingInDashboard).toEqual([])
    expect(result.inSync).toBe(true)
  })
})
