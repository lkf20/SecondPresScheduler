/** @jest-environment node */

import { GET } from '@/app/api/time-off-requests/route'
import { getTimeOffRequests } from '@/lib/api/time-off'
import { getTimeOffShifts } from '@/lib/api/time-off-shifts'
import { transformTimeOffCardData } from '@/lib/utils/time-off-card-data'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({})),
}))

jest.mock('@/lib/api/time-off', () => ({
  getTimeOffRequests: jest.fn(),
}))

jest.mock('@/lib/api/time-off-shifts', () => ({
  getTimeOffShifts: jest.fn(async () => []),
}))

jest.mock('@/lib/utils/time-off-card-data', () => ({
  transformTimeOffCardData: jest.fn(),
}))

describe('GET /api/time-off-requests integration', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns 500 with error payload when fetching requests fails', async () => {
    ;(getTimeOffRequests as jest.Mock).mockRejectedValueOnce(new Error('forced failure'))

    const request = {
      nextUrl: new URL('http://localhost:3000/api/time-off-requests'),
    }

    const response = await GET(request as any)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toMatch(/forced failure/i)
  })

  it('applies status, date, and teacher filters', async () => {
    ;(getTimeOffRequests as jest.Mock).mockResolvedValueOnce([
      {
        id: 'req-1',
        teacher_id: 'teacher-1',
        start_date: '2026-02-10',
        end_date: '2026-02-11',
        reason: null,
        notes: null,
      },
      {
        id: 'req-2',
        teacher_id: 'teacher-2',
        start_date: '2026-02-10',
        end_date: '2026-02-10',
        reason: null,
        notes: null,
      },
      {
        id: 'req-3',
        teacher_id: 'teacher-1',
        start_date: '2026-02-20',
        end_date: '2026-02-20',
        reason: null,
        notes: null,
      },
    ])
    ;(transformTimeOffCardData as jest.Mock).mockImplementation((request: { id: string }) => ({
      id: request.id,
      status: 'needs_coverage',
      teacher_name: request.id,
      start_date: '2026-02-10',
      end_date: '2026-02-10',
      total: 0,
      covered: 0,
      partial: 0,
      uncovered: 0,
      classrooms: [],
      shift_details: [],
    }))

    const request = {
      nextUrl: new URL(
        'http://localhost:3000/api/time-off-requests?status=active,draft&teacher_id=teacher-1&start_date=2026-02-09&end_date=2026-02-12&include_classrooms=false&include_assignments=false'
      ),
    }

    const response = await GET(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(getTimeOffRequests).toHaveBeenCalledWith({ statuses: ['active', 'draft'] })
    expect(json.data).toHaveLength(1)
    expect(json.data[0].id).toBe('req-1')
    expect(getTimeOffShifts).toHaveBeenCalledTimes(1)
    expect(json.meta.filters.teacher_id).toBe('teacher-1')
  })

  it('applies coverage_status filter against transformed results', async () => {
    ;(getTimeOffRequests as jest.Mock).mockResolvedValueOnce([
      {
        id: 'req-covered',
        teacher_id: 'teacher-1',
        start_date: '2026-02-10',
        end_date: '2026-02-10',
        reason: null,
        notes: null,
      },
      {
        id: 'req-needs',
        teacher_id: 'teacher-1',
        start_date: '2026-02-10',
        end_date: '2026-02-10',
        reason: null,
        notes: null,
      },
    ])
    ;(transformTimeOffCardData as jest.Mock).mockImplementation((request: { id: string }) => ({
      id: request.id,
      status: request.id === 'req-covered' ? 'covered' : 'needs_coverage',
      teacher_name: request.id,
      start_date: '2026-02-10',
      end_date: '2026-02-10',
      total: 0,
      covered: 0,
      partial: 0,
      uncovered: 0,
      classrooms: [],
      shift_details: [],
    }))

    const request = {
      nextUrl: new URL(
        'http://localhost:3000/api/time-off-requests?coverage_status=needs_coverage&include_classrooms=false&include_assignments=false'
      ),
    }

    const response = await GET(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.data[0].id).toBe('req-needs')
  })
})
