/** @jest-environment node */

import { GET } from '@/app/api/reports/sub-availability/route'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getScheduleSettings } from '@/lib/api/schedule-settings'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))

jest.mock('@/lib/api/schedule-settings', () => ({
  getScheduleSettings: jest.fn(),
}))

type TableDataMap = Record<string, any[]>

const makeSupabaseMock = (tables: TableDataMap) => {
  const applyFilters = (
    rows: any[],
    filters: Array<{ type: 'eq' | 'in'; column: string; value: any }>
  ) =>
    filters.reduce((current, filter) => {
      if (filter.type === 'eq') {
        return current.filter(row => row[filter.column] === filter.value)
      }
      return current.filter(
        row => Array.isArray(filter.value) && filter.value.includes(row[filter.column])
      )
    }, rows)

  const sortRows = (rows: any[], sorts: Array<{ column: string; ascending: boolean }>) =>
    [...rows].sort((a, b) => {
      for (const sort of sorts) {
        const av = a[sort.column]
        const bv = b[sort.column]
        if (av === bv) continue
        if (av === null || av === undefined) return 1
        if (bv === null || bv === undefined) return -1
        if (av < bv) return sort.ascending ? -1 : 1
        if (av > bv) return sort.ascending ? 1 : -1
      }
      return 0
    })

  return {
    from: (table: string) => {
      const filters: Array<{ type: 'eq' | 'in'; column: string; value: any }> = []
      const sorts: Array<{ column: string; ascending: boolean }> = []
      const builder: any = {
        select: () => builder,
        eq: (column: string, value: any) => {
          filters.push({ type: 'eq', column, value })
          return builder
        },
        in: (column: string, value: any) => {
          filters.push({ type: 'in', column, value })
          return builder
        },
        order: (column: string, options?: { ascending?: boolean }) => {
          sorts.push({ column, ascending: options?.ascending !== false })
          const tableRows = tables[table] || []
          const filtered = applyFilters(tableRows, filters)
          return Promise.resolve({ data: sortRows(filtered, sorts), error: null })
        },
      }
      return builder
    },
  }
}

describe('GET /api/reports/sub-availability', () => {
  const request = new Request('http://localhost/api/reports/sub-availability')

  beforeEach(() => {
    jest.clearAllMocks()
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({
      selected_day_ids: ['day-mon'],
      time_zone: 'America/New_York',
    })
  })

  it('returns report JSON data', async () => {
    ;(createClient as jest.Mock).mockResolvedValue(
      makeSupabaseMock({
        days_of_week: [{ id: 'day-mon', name: 'Monday', display_order: 1 }],
        time_slots: [
          {
            id: 'slot-am',
            code: 'AM',
            name: 'Morning',
            display_order: 1,
            school_id: 'school-1',
            is_active: true,
          },
        ],
        class_groups: [
          {
            id: 'cg-1',
            name: 'Infants',
            order: 1,
            min_age: 0,
            school_id: 'school-1',
            is_active: true,
          },
          {
            id: 'cg-2',
            name: 'Toddler A',
            order: 2,
            min_age: 1,
            school_id: 'school-1',
            is_active: true,
          },
          {
            id: 'cg-3',
            name: 'Toddler B',
            order: 3,
            min_age: 1,
            school_id: 'school-1',
            is_active: true,
          },
        ],
        staff: [
          {
            id: 'sub-1',
            first_name: 'Anne',
            last_name: 'M',
            display_name: null,
            phone: '5025551212',
            capabilities_notes: 'Can open',
            school_id: 'school-1',
            is_sub: true,
            active: true,
          },
        ],
        sub_availability: [
          {
            sub_id: 'sub-1',
            day_of_week_id: 'day-mon',
            time_slot_id: 'slot-am',
            available: true,
            school_id: 'school-1',
          },
        ],
        sub_class_preferences: [
          { sub_id: 'sub-1', class_group_id: 'cg-1', can_teach: true, school_id: 'school-1' },
        ],
      })
    )

    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.sub_count).toBe(1)
    expect(json.report_context.rows[0].subName).toBe('Anne M')
    expect(json.report_context.rows[0].phone).toBe('(502) 555-1212')
    expect(json.report_context.rows[0].canTeach).toEqual(['Infants'])
  })

  it('returns full name when nameFormat=full', async () => {
    ;(createClient as jest.Mock).mockResolvedValue(
      makeSupabaseMock({
        days_of_week: [{ id: 'day-mon', name: 'Monday', display_order: 1 }],
        time_slots: [
          {
            id: 'slot-am',
            code: 'AM',
            name: 'Morning',
            display_order: 1,
            school_id: 'school-1',
            is_active: true,
          },
        ],
        class_groups: [],
        staff: [
          {
            id: 'sub-1',
            first_name: 'Anne',
            last_name: 'M',
            display_name: 'Anne Teacher',
            phone: null,
            capabilities_notes: null,
            school_id: 'school-1',
            is_sub: true,
            active: true,
          },
        ],
        sub_availability: [],
        sub_class_preferences: [],
      })
    )

    const response = await GET(
      new Request('http://localhost/api/reports/sub-availability?nameFormat=full')
    )
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.report_context.rows[0].subName).toBe('Anne M')
  })

  it('returns 403 when school id is unavailable', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue(null)
    const response = await GET(request)
    expect(response.status).toBe(403)
  })
})
