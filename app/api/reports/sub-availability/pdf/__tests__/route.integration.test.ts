/** @jest-environment node */

import { GET } from '@/app/api/reports/sub-availability/pdf/route'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getScheduleSettings } from '@/lib/api/schedule-settings'
import { launchPdfBrowser } from '@/lib/reports/puppeteer-launch'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))

jest.mock('@/lib/api/schedule-settings', () => ({
  getScheduleSettings: jest.fn(),
}))

jest.mock('@/lib/reports/puppeteer-launch', () => ({
  launchPdfBrowser: jest.fn(),
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

describe('GET /api/reports/sub-availability/pdf', () => {
  const newPageMock = jest.fn()
  const closeMock = jest.fn()
  const browserMock = {
    newPage: newPageMock,
    close: closeMock,
  }
  const setContentMock = jest.fn()
  const pdfMock = jest.fn()
  let consoleErrorSpy: jest.SpyInstance
  const request = new Request('http://localhost/api/reports/sub-availability/pdf')

  beforeEach(() => {
    jest.clearAllMocks()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({
      selected_day_ids: ['day-mon'],
      time_zone: 'America/New_York',
    })

    newPageMock.mockResolvedValue({
      setContent: setContentMock,
      pdf: pdfMock,
    })
    closeMock.mockResolvedValue(undefined)
    setContentMock.mockResolvedValue(undefined)
    pdfMock.mockResolvedValue(Buffer.from('fake-pdf'))
    ;(launchPdfBrowser as jest.Mock).mockResolvedValue(browserMock)
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('returns a PDF response on success', async () => {
    ;(createClient as jest.Mock).mockResolvedValue(
      makeSupabaseMock({
        days_of_week: [{ id: 'day-mon', name: 'Mon', display_order: 1 }],
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
          { id: 'cg-1', name: 'Infants', order: 1, school_id: 'school-1', is_active: true },
        ],
        staff: [
          {
            id: 'sub-1',
            first_name: 'Anne',
            last_name: 'M',
            display_name: 'Anne M.',
            phone: '5025551212',
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

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(launchPdfBrowser).toHaveBeenCalled()
    expect(setContentMock).toHaveBeenCalled()
    const renderedHtml = setContentMock.mock.calls[0]?.[0] as string
    expect(renderedHtml).toContain('availability-mark-icon')
    expect(pdfMock).toHaveBeenCalled()
  })

  it('returns 403 when school id is unavailable', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue(null)

    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error).toMatch(/missing school_id/i)
  })

  it('returns 500 when puppeteer fails', async () => {
    ;(createClient as jest.Mock).mockResolvedValue(
      makeSupabaseMock({
        days_of_week: [],
        time_slots: [],
        class_groups: [],
        staff: [],
        sub_availability: [],
        sub_class_preferences: [],
      })
    )
    ;(launchPdfBrowser as jest.Mock).mockRejectedValue(new Error('browser failed'))

    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toMatch(/failed/i)
  })

  it('returns success with empty dataset', async () => {
    ;(createClient as jest.Mock).mockResolvedValue(
      makeSupabaseMock({
        days_of_week: [{ id: 'day-mon', name: 'Mon', display_order: 1 }],
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
        staff: [],
        sub_availability: [],
        sub_class_preferences: [],
      })
    )

    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
  })

  it('accepts colorFriendly query param', async () => {
    ;(createClient as jest.Mock).mockResolvedValue(
      makeSupabaseMock({
        days_of_week: [{ id: 'day-mon', name: 'Mon', display_order: 1 }],
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
        staff: [],
        sub_availability: [],
        sub_class_preferences: [],
      })
    )

    const response = await GET(
      new Request('http://localhost/api/reports/sub-availability/pdf?colorFriendly=false')
    )
    expect(response.status).toBe(200)
    expect(setContentMock).toHaveBeenCalled()
  })

  it('accepts paperSize query param', async () => {
    ;(createClient as jest.Mock).mockResolvedValue(
      makeSupabaseMock({
        days_of_week: [{ id: 'day-mon', name: 'Mon', display_order: 1 }],
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
        staff: [],
        sub_availability: [],
        sub_class_preferences: [],
      })
    )

    const response = await GET(
      new Request('http://localhost/api/reports/sub-availability/pdf?paperSize=legal')
    )
    expect(response.status).toBe(200)
    expect(pdfMock).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'legal',
      })
    )
  })

  it('accepts nameFormat query param', async () => {
    ;(createClient as jest.Mock).mockResolvedValue(
      makeSupabaseMock({
        days_of_week: [{ id: 'day-mon', name: 'Mon', display_order: 1 }],
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
      new Request('http://localhost/api/reports/sub-availability/pdf?nameFormat=full')
    )
    expect(response.status).toBe(200)
    expect(setContentMock).toHaveBeenCalled()
  })

  it('accepts rich text header/footer query params and passes them into rendered html', async () => {
    ;(createClient as jest.Mock).mockResolvedValue(
      makeSupabaseMock({
        days_of_week: [{ id: 'day-mon', name: 'Mon', display_order: 1 }],
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
        staff: [],
        sub_availability: [],
        sub_class_preferences: [],
      })
    )

    const response = await GET(
      new Request(
        'http://localhost/api/reports/sub-availability/pdf?topHeaderHtml=%3Cdiv%3EHello%3C%2Fdiv%3E&footerNotesHtml=%3Cdiv%3EFooter%3C%2Fdiv%3E'
      )
    )

    expect(response.status).toBe(200)
    expect(setContentMock).toHaveBeenCalled()
    const renderedHtml = setContentMock.mock.calls[0]?.[0] as string
    expect(renderedHtml).toContain('class="header-center"')
    expect(renderedHtml).toContain('Hello')
    expect(renderedHtml).toContain('Footer')
  })

  it('truncates oversized rich text query values before rendering', async () => {
    ;(createClient as jest.Mock).mockResolvedValue(
      makeSupabaseMock({
        days_of_week: [{ id: 'day-mon', name: 'Mon', display_order: 1 }],
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
        staff: [],
        sub_availability: [],
        sub_class_preferences: [],
      })
    )

    const longTopHeader = 'A'.repeat(2500)
    const longFooter = 'B'.repeat(5000)
    const response = await GET(
      new Request(
        `http://localhost/api/reports/sub-availability/pdf?topHeaderHtml=${longTopHeader}&footerNotesHtml=${longFooter}`
      )
    )

    expect(response.status).toBe(200)
    const renderedHtml = setContentMock.mock.calls.at(-1)?.[0] as string
    expect(renderedHtml).toContain('A'.repeat(2000))
    expect(renderedHtml).not.toContain('A'.repeat(2001))
    expect(renderedHtml).toContain('B'.repeat(4000))
    expect(renderedHtml).not.toContain('B'.repeat(4001))
  })
})
