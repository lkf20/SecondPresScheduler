/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/dashboard/overview/route'
import { getUserSchoolId } from '@/lib/utils/auth'
import { createClient } from '@/lib/supabase/server'

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

type Row = Record<string, any>

class QueryBuilderMock {
  private filters: Array<(row: Row) => boolean> = []
  private orderBy: { column: string; ascending: boolean } | null = null

  constructor(
    private readonly table: string,
    private readonly dataByTable: Record<string, Row[]>
  ) {}

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

  order(column: string, opts?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: opts?.ascending !== false }
    return this
  }

  maybeSingle() {
    return Promise.resolve(this.executeSingle())
  }

  then(resolve: (value: { data: Row[]; error: null }) => unknown) {
    return Promise.resolve(resolve(this.executeMany()))
  }

  private executeMany() {
    let rows = [...(this.dataByTable[this.table] || [])]
    for (const filter of this.filters) rows = rows.filter(filter)
    if (this.orderBy) {
      const { column, ascending } = this.orderBy
      rows.sort((a, b) => {
        if (a[column] === b[column]) return 0
        return a[column] < b[column] ? (ascending ? -1 : 1) : ascending ? 1 : -1
      })
    }
    return { data: rows, error: null as null }
  }

  private executeSingle() {
    const { data } = this.executeMany()
    return { data: data[0] ?? null, error: null as null }
  }
}

const mockSupabaseClient = (dataByTable: Record<string, Row[]>) => {
  ;(createClient as jest.Mock).mockResolvedValue({
    from: (table: string) => new QueryBuilderMock(table, dataByTable),
  })
}

describe('GET /api/dashboard/overview', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    mockSupabaseClient({
      schedule_settings: [],
      coverage_requests: [],
      time_off_requests: [],
      coverage_request_shifts: [],
      sub_assignments: [],
      schedule_cells: [],
      teacher_schedules: [],
      staffing_event_shifts: [],
      classrooms: [],
    })
  })

  it('returns 403 when user has no school context', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValueOnce(null)
    const request = new NextRequest(
      'http://localhost:3000/api/dashboard/overview?start_date=2026-02-01&end_date=2026-02-14'
    )
    const response = await GET(request)
    const json = await response.json()
    expect(response.status).toBe(403)
    expect(json.error).toMatch(/school/i)
  })

  it('returns 400 when start_date or end_date missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/dashboard/overview')
    const response = await GET(request)
    const json = await response.json()
    expect(response.status).toBe(400)
    expect(json.error).toMatch(/start_date|end_date/i)
  })

  it('includes display-order metadata in dashboard shift_details and keeps settings order', async () => {
    mockSupabaseClient({
      schedule_settings: [
        {
          school_id: 'school-1',
          default_display_name_format: 'first_last_initial',
          time_zone: 'America/New_York',
        },
      ],
      coverage_requests: [
        {
          id: 'cr-1',
          teacher_id: 'teacher-1',
          start_date: '2026-03-18',
          end_date: '2026-03-19',
          request_type: 'time_off',
          source_request_id: 'tor-1',
          status: 'open',
          total_shifts: 2,
          covered_shifts: 1,
          created_at: '2026-03-01T12:00:00.000Z',
          teacher: {
            id: 'teacher-1',
            first_name: 'Jane',
            last_name: 'Doe',
            display_name: null,
          },
          school_id: 'school-1',
        },
      ],
      time_off_requests: [{ id: 'tor-1', reason: 'Sick', notes: null, status: 'active' }],
      coverage_request_shifts: [
        {
          id: 'shift-am',
          coverage_request_id: 'cr-1',
          status: 'active',
          date: '2026-03-18',
          time_slot_id: 'slot-am',
          classroom_id: 'classroom-1',
          classroom: { id: 'classroom-1', name: 'Infant Room', color: '#abc' },
          day_of_week: { id: 'dow-wed', name: 'Wednesday', day_number: 3, display_order: 3 },
          time_slot: { id: 'slot-am', code: 'AM', name: 'Morning', display_order: 2 },
        },
        {
          id: 'shift-em',
          coverage_request_id: 'cr-1',
          status: 'active',
          date: '2026-03-18',
          time_slot_id: 'slot-em',
          classroom_id: 'classroom-1',
          classroom: { id: 'classroom-1', name: 'Infant Room', color: '#abc' },
          day_of_week: { id: 'dow-wed', name: 'Wednesday', day_number: 3, display_order: 3 },
          time_slot: { id: 'slot-em', code: 'EM', name: 'Early Morning', display_order: 1 },
        },
      ],
      sub_assignments: [
        {
          id: 'sa-1',
          status: 'active',
          date: '2026-03-18',
          day_of_week_id: 'dow-wed',
          time_slot_id: 'slot-em',
          classroom_id: 'classroom-1',
          notes: null,
          sub_id: 'sub-1',
          teacher_id: 'teacher-1',
          coverage_request_shift_id: 'shift-em',
          is_partial: false,
          assignment_type: 'Sub Shift',
          sub: { id: 'sub-1', first_name: 'Bella', last_name: 'W', display_name: null },
          teacher: { id: 'teacher-1', first_name: 'Jane', last_name: 'Doe', display_name: null },
          classroom: { id: 'classroom-1', name: 'Infant Room', color: '#abc' },
          day_of_week: { id: 'dow-wed', name: 'Wednesday', display_order: 3 },
          time_slot: { id: 'slot-em', code: 'EM', display_order: 1 },
          coverage_request_shift: { coverage_request_id: 'cr-1' },
        },
      ],
      schedule_cells: [],
      teacher_schedules: [],
      staffing_event_shifts: [],
      classrooms: [],
    })

    const request = new NextRequest(
      'http://localhost:3000/api/dashboard/overview?start_date=2026-03-18&end_date=2026-03-19'
    )
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    const requestItem = json.coverage_requests[0]
    expect(requestItem).toBeTruthy()
    expect(requestItem.shift_details).toHaveLength(2)

    expect(requestItem.shift_details[0].time_slot_code).toBe('EM')
    expect(requestItem.shift_details[0].time_slot_display_order).toBe(1)
    expect(requestItem.shift_details[0].day_display_order).toBe(3)
    expect(requestItem.shift_details[1].time_slot_code).toBe('AM')
    expect(requestItem.shift_details[1].time_slot_display_order).toBe(2)
    expect(requestItem.shift_details[1].day_display_order).toBe(3)
  })

  it('excludes coverage request shifts that fall outside the request date range', async () => {
    mockSupabaseClient({
      schedule_settings: [
        {
          school_id: 'school-1',
          default_display_name_format: 'first_last_initial',
          time_zone: 'America/New_York',
        },
      ],
      coverage_requests: [
        {
          id: 'cr-2',
          teacher_id: 'teacher-2',
          start_date: '2026-03-24',
          end_date: '2026-03-26',
          request_type: 'time_off',
          source_request_id: 'tor-2',
          status: 'open',
          total_shifts: 3,
          covered_shifts: 0,
          created_at: '2026-03-20T12:00:00.000Z',
          teacher: {
            id: 'teacher-2',
            first_name: 'Anne',
            last_name: 'M',
            display_name: null,
          },
          school_id: 'school-1',
        },
      ],
      time_off_requests: [{ id: 'tor-2', reason: 'Vacation', notes: null, status: 'active' }],
      coverage_request_shifts: [
        {
          id: 'shift-outside-range',
          coverage_request_id: 'cr-2',
          status: 'active',
          date: '2026-03-23',
          time_slot_id: 'slot-em',
          classroom_id: 'classroom-1',
          classroom: { id: 'classroom-1', name: 'Infant Room', color: '#abc' },
          day_of_week: { id: 'dow-mon', name: 'Monday', day_number: 1, display_order: 1 },
          time_slot: { id: 'slot-em', code: 'EM', name: 'Early Morning', display_order: 1 },
        },
        {
          id: 'shift-in-range',
          coverage_request_id: 'cr-2',
          status: 'active',
          date: '2026-03-24',
          time_slot_id: 'slot-am',
          classroom_id: 'classroom-1',
          classroom: { id: 'classroom-1', name: 'Infant Room', color: '#abc' },
          day_of_week: { id: 'dow-tue', name: 'Tuesday', day_number: 2, display_order: 2 },
          time_slot: { id: 'slot-am', code: 'AM', name: 'Morning', display_order: 2 },
        },
      ],
      sub_assignments: [],
      schedule_cells: [],
      teacher_schedules: [],
      staffing_event_shifts: [],
      classrooms: [],
    })

    const request = new NextRequest(
      'http://localhost:3000/api/dashboard/overview?start_date=2026-03-01&end_date=2026-03-31'
    )
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    const item = json.coverage_requests.find((r: any) => r.id === 'cr-2')
    expect(item).toBeTruthy()
    expect(item.total_shifts).toBe(1)
    expect(item.shift_details).toHaveLength(1)
    expect(item.shift_details[0].date).toBe('2026-03-24')
    expect(item.shift_details[0].label).toContain('Mar 24')
  })
})
