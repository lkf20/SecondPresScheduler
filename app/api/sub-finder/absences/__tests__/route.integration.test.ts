/** @jest-environment node */

import { GET } from '@/app/api/sub-finder/absences/route'
import { getUserSchoolId } from '@/lib/utils/auth'
import { createClient } from '@/lib/supabase/server'
import { getTimeOffRequests, getActiveSubAssignmentsForTimeOffRequest } from '@/lib/api/time-off'
import { getTimeOffShifts } from '@/lib/api/time-off-shifts'
import { transformTimeOffCardData } from '@/lib/utils/time-off-card-data'
import { buildCoverageBadges, getCoverageStatus } from '@/lib/server/coverage/absence-status'
import { sortCoverageShifts, buildCoverageSegments } from '@/lib/server/coverage/coverage-summary'

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/api/time-off', () => ({
  getTimeOffRequests: jest.fn(),
  getActiveSubAssignmentsForTimeOffRequest: jest.fn(),
}))

jest.mock('@/lib/api/time-off-shifts', () => ({
  getTimeOffShifts: jest.fn(),
}))

jest.mock('@/lib/utils/time-off-card-data', () => ({
  transformTimeOffCardData: jest.fn(),
}))

jest.mock('@/lib/server/coverage/absence-status', () => ({
  getCoverageStatus: jest.fn(),
  buildCoverageBadges: jest.fn(),
}))

jest.mock('@/lib/server/coverage/coverage-summary', () => ({
  sortCoverageShifts: jest.fn(),
  buildCoverageSegments: jest.fn(),
}))

describe('GET /api/sub-finder/absences integration', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns 403 when school context is missing', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue(null)
    const request = {
      nextUrl: new URL('http://localhost:3000/api/sub-finder/absences'),
    }

    const response = await GET(request as any)
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error).toMatch(/missing school_id|profile/i)
  })

  it('returns transformed absence cards on success', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')

    const teacherSchedulesQuery = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({
        data: [
          {
            teacher_id: 'teacher-1',
            day_of_week_id: 'day-1',
            time_slot_id: 'slot-1',
            classroom: { id: 'classroom-1', name: 'Infant Room', color: '#dbeafe' },
          },
        ],
      }),
    }

    const subAssignmentsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockResolvedValue({ data: [] }),
    }

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'teacher_schedules') return teacherSchedulesQuery
        if (table === 'sub_assignments') return subAssignmentsQuery
        throw new Error(`Unexpected table: ${table}`)
      }),
    })
    ;(getTimeOffRequests as jest.Mock).mockResolvedValue([
      {
        id: 'req-1',
        teacher_id: 'teacher-1',
        start_date: '2099-02-09',
        end_date: '2099-02-09',
        reason: 'Vacation',
        notes: 'Family trip',
        teacher: {
          first_name: 'Tara',
          last_name: 'Doe',
          display_name: 'Tara D.',
        },
      },
    ])
    ;(getTimeOffShifts as jest.Mock).mockResolvedValue([
      {
        id: 'shift-1',
        date: '2099-02-09',
        day_of_week_id: 'day-1',
        time_slot_id: 'slot-1',
        day_of_week: { name: 'Monday' },
        time_slot: { code: 'EM' },
      },
    ])
    ;(getActiveSubAssignmentsForTimeOffRequest as jest.Mock).mockResolvedValue([])
    ;(transformTimeOffCardData as jest.Mock).mockReturnValue({
      id: 'req-1',
      teacher_id: 'teacher-1',
      teacher_name: 'Tara D.',
      start_date: '2099-02-09',
      end_date: '2099-02-09',
      reason: 'Vacation',
      notes: 'Family trip',
      classrooms: [{ id: 'classroom-1', name: 'Infant Room', color: '#dbeafe' }],
      total: 1,
      uncovered: 1,
      partial: 0,
      covered: 0,
      shift_details: [
        {
          id: 'shift-1',
          date: '2099-02-09',
          day_name: 'Mon',
          time_slot_code: 'EM',
          class_name: 'Infant',
          classroom_name: 'Infant Room',
          status: 'uncovered',
        },
      ],
    })
    ;(getCoverageStatus as jest.Mock).mockReturnValue('uncovered')
    ;(buildCoverageBadges as jest.Mock).mockReturnValue([{ label: 'Uncovered', tone: 'warning' }])
    ;(sortCoverageShifts as jest.Mock).mockImplementation((shifts: any) => shifts)
    ;(buildCoverageSegments as jest.Mock).mockReturnValue([{ id: 'shift-1', status: 'uncovered' }])

    const request = {
      nextUrl: new URL('http://localhost:3000/api/sub-finder/absences'),
    }

    const response = await GET(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(getTimeOffRequests).toHaveBeenCalledWith({ statuses: ['active'] })
    expect(json).toHaveLength(1)
    expect(json[0]).toMatchObject({
      id: 'req-1',
      teacher_name: 'Tara D.',
      coverage_status: 'uncovered',
      shifts: {
        total: 1,
        uncovered: 1,
        partially_covered: 0,
        fully_covered: 0,
      },
    })
  })

  it('respects include_partially_covered flag and keeps no-shift absences', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: [] }),
      })),
    })
    ;(getTimeOffRequests as jest.Mock).mockResolvedValue([
      {
        id: 'req-uncovered',
        teacher_id: 'teacher-1',
        start_date: '2099-02-10',
        end_date: '2099-02-10',
      },
      {
        id: 'req-partial',
        teacher_id: 'teacher-1',
        start_date: '2099-02-11',
        end_date: '2099-02-11',
      },
      {
        id: 'req-fully-covered',
        teacher_id: 'teacher-1',
        start_date: '2099-02-12',
        end_date: '2099-02-12',
      },
      {
        id: 'req-no-shifts',
        teacher_id: 'teacher-1',
        start_date: '2099-02-13',
        end_date: '2099-02-13',
      },
    ])
    ;(getTimeOffShifts as jest.Mock).mockResolvedValue([])
    ;(getActiveSubAssignmentsForTimeOffRequest as jest.Mock).mockResolvedValue([])
    ;(transformTimeOffCardData as jest.Mock).mockImplementation((request: { id: string }) => {
      if (request.id === 'req-uncovered') {
        return {
          id: request.id,
          teacher_id: 'teacher-1',
          teacher_name: 'Uncovered',
          start_date: '2099-02-10',
          end_date: '2099-02-10',
          reason: null,
          notes: null,
          classrooms: [],
          total: 1,
          uncovered: 1,
          partial: 0,
          covered: 0,
          shift_details: [],
        }
      }
      if (request.id === 'req-partial') {
        return {
          id: request.id,
          teacher_id: 'teacher-1',
          teacher_name: 'Partial',
          start_date: '2099-02-11',
          end_date: '2099-02-11',
          reason: null,
          notes: null,
          classrooms: [],
          total: 1,
          uncovered: 0,
          partial: 1,
          covered: 0,
          shift_details: [],
        }
      }
      if (request.id === 'req-fully-covered') {
        return {
          id: request.id,
          teacher_id: 'teacher-1',
          teacher_name: 'Covered',
          start_date: '2099-02-12',
          end_date: '2099-02-12',
          reason: null,
          notes: null,
          classrooms: [],
          total: 1,
          uncovered: 0,
          partial: 0,
          covered: 1,
          shift_details: [],
        }
      }
      return {
        id: request.id,
        teacher_id: 'teacher-1',
        teacher_name: 'No shifts',
        start_date: '2099-02-13',
        end_date: '2099-02-13',
        reason: null,
        notes: null,
        classrooms: [],
        total: 0,
        uncovered: 0,
        partial: 0,
        covered: 0,
        shift_details: [],
      }
    })
    ;(getCoverageStatus as jest.Mock).mockReturnValue('uncovered')
    ;(buildCoverageBadges as jest.Mock).mockReturnValue([])
    ;(sortCoverageShifts as jest.Mock).mockImplementation((shifts: any) => shifts)
    ;(buildCoverageSegments as jest.Mock).mockImplementation(() => [])

    const withPartialRequest = {
      nextUrl: new URL(
        'http://localhost:3000/api/sub-finder/absences?include_partially_covered=true'
      ),
    }
    const withPartialResponse = await GET(withPartialRequest as any)
    const withPartialJson = await withPartialResponse.json()
    const withPartialIds = withPartialJson.map((row: { id: string }) => row.id)

    expect(withPartialResponse.status).toBe(200)
    expect(withPartialIds).toEqual(['req-uncovered', 'req-partial', 'req-no-shifts'])

    const uncoveredOnlyRequest = {
      nextUrl: new URL(
        'http://localhost:3000/api/sub-finder/absences?include_partially_covered=false'
      ),
    }
    const uncoveredOnlyResponse = await GET(uncoveredOnlyRequest as any)
    const uncoveredOnlyJson = await uncoveredOnlyResponse.json()
    const uncoveredOnlyIds = uncoveredOnlyJson.map((row: { id: string }) => row.id)

    expect(uncoveredOnlyResponse.status).toBe(200)
    expect(uncoveredOnlyIds).toEqual(['req-uncovered', 'req-no-shifts'])
  })

  it('returns 500 on unexpected failures', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: [] }),
      })),
    })
    ;(getTimeOffRequests as jest.Mock).mockRejectedValue(new Error('forced absences failure'))

    const request = {
      nextUrl: new URL('http://localhost:3000/api/sub-finder/absences'),
    }

    const response = await GET(request as any)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toMatch(/forced absences failure/i)
  })
})
