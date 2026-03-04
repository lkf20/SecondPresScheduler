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
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

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

  it('merges coverage and teacher-date assignments and prefers coverage-linked assignment data', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')

    const teacherSchedulesQuery = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({ data: [] }),
    }

    const subAssignmentsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'assignment-1',
            coverage_request_shift_id: null,
            date: '2099-03-01',
            time_slot_id: 'slot-1',
            is_partial: false,
            assignment_type: 'manual',
            sub: { display_name: 'Teacher-Date Sub' },
          },
          {
            id: 'assignment-2',
            coverage_request_shift_id: null,
            date: '2099-03-02',
            time_slot_id: 'slot-2',
            is_partial: false,
            assignment_type: 'manual',
            sub: { display_name: 'Extra Sub' },
          },
        ],
      }),
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
        id: 'req-merge',
        coverage_request_id: 'coverage-1',
        teacher_id: 'teacher-1',
        start_date: '2099-03-01',
        end_date: '2099-03-02',
        reason: 'Vacation',
        notes: null,
      },
    ])
    ;(getTimeOffShifts as jest.Mock).mockResolvedValue([
      {
        id: 'shift-1',
        date: '2099-03-01',
        day_of_week_id: 'day-1',
        time_slot_id: 'slot-1',
        day_of_week: { name: 'Monday' },
        time_slot: { code: 'EM' },
      },
    ])
    ;(getActiveSubAssignmentsForTimeOffRequest as jest.Mock).mockResolvedValue([
      {
        id: 'coverage-assignment-1',
        date: '2099-03-01',
        time_slot_id: 'slot-1',
        is_partial: true,
        assignment_type: 'coverage',
        sub: { display_name: 'Coverage Sub' },
        coverage_request_shift: {
          date: '2099-03-01',
          time_slot_id: 'slot-1',
        },
      },
    ])
    ;(transformTimeOffCardData as jest.Mock).mockReturnValue({
      id: 'req-merge',
      teacher_id: 'teacher-1',
      teacher_name: 'Teacher One',
      start_date: '2099-03-01',
      end_date: '2099-03-02',
      reason: 'Vacation',
      notes: null,
      classrooms: [],
      total: 2,
      uncovered: 1,
      partial: 1,
      covered: 0,
      shift_details: [],
    })
    ;(getCoverageStatus as jest.Mock).mockReturnValue('partial')
    ;(buildCoverageBadges as jest.Mock).mockReturnValue([])
    ;(sortCoverageShifts as jest.Mock).mockImplementation((shifts: any) => shifts)
    ;(buildCoverageSegments as jest.Mock).mockReturnValue([])

    const request = {
      nextUrl: new URL('http://localhost:3000/api/sub-finder/absences'),
    }

    const response = await GET(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toHaveLength(1)
    expect(transformTimeOffCardData).toHaveBeenCalled()

    const transformArgs = (transformTimeOffCardData as jest.Mock).mock.calls.at(-1)
    expect(transformArgs).toBeDefined()
    const assignmentRows = transformArgs[2]

    expect(assignmentRows).toHaveLength(2)
    expect(assignmentRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: '2099-03-01',
          time_slot_id: 'slot-1',
          is_partial: true,
          assignment_type: 'coverage',
          sub: { display_name: 'Coverage Sub' },
        }),
        expect.objectContaining({
          date: '2099-03-02',
          time_slot_id: 'slot-2',
          assignment_type: 'manual',
          sub: { display_name: 'Extra Sub' },
        }),
      ])
    )
  })

  it('continues when coverage-linked assignment lookup fails and falls back to teacher-date assignments', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')

    const teacherSchedulesQuery = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({ data: [] }),
    }

    const subAssignmentsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'assignment-1',
            coverage_request_shift_id: null,
            date: '2099-03-01',
            time_slot_id: 'slot-1',
            is_partial: false,
            assignment_type: 'manual',
            sub: { display_name: 'Teacher-Date Sub' },
          },
        ],
      }),
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
        id: 'req-fallback',
        coverage_request_id: 'coverage-1',
        teacher_id: 'teacher-1',
        start_date: '2099-03-01',
        end_date: '2099-03-01',
        reason: null,
        notes: null,
      },
    ])
    ;(getTimeOffShifts as jest.Mock).mockResolvedValue([
      {
        id: 'shift-1',
        date: '2099-03-01',
        day_of_week_id: 'day-1',
        time_slot_id: 'slot-1',
        day_of_week: { name: 'Monday' },
        time_slot: { code: 'EM' },
      },
    ])
    ;(getActiveSubAssignmentsForTimeOffRequest as jest.Mock).mockRejectedValue(
      new Error('coverage assignment lookup failed')
    )
    ;(transformTimeOffCardData as jest.Mock).mockReturnValue({
      id: 'req-fallback',
      teacher_id: 'teacher-1',
      teacher_name: 'Teacher One',
      start_date: '2099-03-01',
      end_date: '2099-03-01',
      reason: null,
      notes: null,
      classrooms: [],
      total: 1,
      uncovered: 0,
      partial: 0,
      covered: 1,
      shift_details: [],
    })
    ;(getCoverageStatus as jest.Mock).mockReturnValue('fully_covered')
    ;(buildCoverageBadges as jest.Mock).mockReturnValue([])
    ;(sortCoverageShifts as jest.Mock).mockImplementation((shifts: any) => shifts)
    ;(buildCoverageSegments as jest.Mock).mockReturnValue([])

    const request = {
      nextUrl: new URL(
        'http://localhost:3000/api/sub-finder/absences?include_partially_covered=true'
      ),
    }

    const response = await GET(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toHaveLength(0)
    expect(transformTimeOffCardData).toHaveBeenCalled()
    const transformArgs = (transformTimeOffCardData as jest.Mock).mock.calls.at(-1)
    expect(transformArgs[2]).toEqual([
      expect.objectContaining({
        date: '2099-03-01',
        time_slot_id: 'slot-1',
        assignment_type: 'manual',
      }),
    ])
  })

  it('filters out absences that are entirely in the past', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: [] }),
      })),
    })
    ;(getTimeOffRequests as jest.Mock).mockResolvedValue([
      {
        id: 'req-past',
        teacher_id: 'teacher-1',
        start_date: '2000-01-01',
        end_date: '2000-01-02',
      },
      {
        id: 'req-future',
        teacher_id: 'teacher-1',
        start_date: '2099-02-10',
        end_date: '2099-02-10',
      },
    ])
    ;(getTimeOffShifts as jest.Mock).mockResolvedValue([])
    ;(getActiveSubAssignmentsForTimeOffRequest as jest.Mock).mockResolvedValue([])
    ;(transformTimeOffCardData as jest.Mock).mockImplementation((request: { id: string }) => {
      if (request.id === 'req-past') {
        return {
          id: request.id,
          teacher_id: 'teacher-1',
          teacher_name: 'Past Teacher',
          start_date: '2000-01-01',
          end_date: '2000-01-02',
          reason: null,
          notes: null,
          classrooms: [],
          total: 0,
          uncovered: 0,
          partial: 0,
          covered: 0,
          shift_details: [],
        }
      }
      return {
        id: request.id,
        teacher_id: 'teacher-1',
        teacher_name: 'Future Teacher',
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
    })
    ;(getCoverageStatus as jest.Mock).mockReturnValue('uncovered')
    ;(buildCoverageBadges as jest.Mock).mockReturnValue([])
    ;(sortCoverageShifts as jest.Mock).mockImplementation((shifts: any) => shifts)
    ;(buildCoverageSegments as jest.Mock).mockImplementation(() => [])

    const request = {
      nextUrl: new URL('http://localhost:3000/api/sub-finder/absences'),
    }

    const response = await GET(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.map((item: { id: string }) => item.id)).toEqual(['req-future'])
  })
})
