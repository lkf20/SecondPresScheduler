/** @jest-environment node */

import { POST } from '@/app/api/sub-finder/unassign-shifts/route'
import { createJsonRequest } from '@/tests/helpers/api'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getAuditActorContext, logAuditEvent } from '@/lib/audit/logAuditEvent'
import { reconcileCoverageRequestCounters } from '@/lib/api/coverage-request-counters'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))

jest.mock('@/lib/audit/logAuditEvent', () => ({
  getAuditActorContext: jest.fn(),
  logAuditEvent: jest.fn(),
}))

jest.mock('@/lib/api/coverage-request-counters', () => ({
  reconcileCoverageRequestCounters: jest.fn().mockResolvedValue(undefined),
}))

const SCHOOL_ID = 'school-1'
const TOR_ID = 'timeoff-1'
const TEACHER_ID = 'teacher-1'
const SUB_ID = 'sub-1'

const makeTorQuery = (override?: Partial<{ id: string; school_id: string }>) => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({
    data: {
      id: override?.id ?? TOR_ID,
      teacher_id: TEACHER_ID,
      start_date: '2099-02-10',
      end_date: '2099-02-12',
      school_id: override?.school_id ?? SCHOOL_ID,
    },
    error: null,
  }),
})

const makeTosQuery = (shifts = [{ id: 'tos-1', date: '2099-02-10', time_slot_id: 'slot-1' }]) => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockResolvedValue({ data: shifts, error: null }),
})

const makeAssignmentsQuery = (
  assignments: Array<{
    id: string
    date: string
    time_slot_id: string
    coverage_request_shift_id?: string | null
    is_partial?: boolean
  }>,
  updateMock?: jest.Mock
) => {
  const _updateMock =
    updateMock ??
    jest.fn(() => ({
      in: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      })),
    }))
  // Flexible query mock that handles both list selects (lte-terminated) and
  // count selects ({ count: 'exact', head: true }, eq-terminated)
  const query: any = {
    select: jest.fn((_cols?: string, opts?: { head?: boolean; count?: string }) => {
      if (opts?.head) {
        // Count query — return a mock that resolves with count
        return {
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockResolvedValue({ count: 0, error: null }),
          in: jest.fn().mockResolvedValue({ count: 0, error: null }),
        }
      }
      return query
    }),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockResolvedValue({ data: assignments, error: null }),
    update: _updateMock,
  }
  return query
}

const makeCoverageRequestShiftsQuery = () => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockResolvedValue({ data: { coverage_request_id: 'cr-1' }, error: null }),
})

const makeCoverageRequestsMaybeSingleQuery = () => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'cr-1' }, error: null }),
  in: jest.fn().mockResolvedValue({ data: [{ id: 'cr-1' }], error: null }),
  single: jest
    .fn()
    .mockResolvedValue({ data: { source_request_id: TOR_ID, school_id: SCHOOL_ID }, error: null }),
})

const makeStaffQuery = () => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockResolvedValue({
    data: { first_name: 'Alex', last_name: 'Sub', display_name: null },
    error: null,
  }),
  in: jest.fn().mockResolvedValue({
    data: [
      { id: TEACHER_ID, first_name: 'Teacher', last_name: 'Name', display_name: null },
      { id: SUB_ID, first_name: 'Alex', last_name: 'Sub', display_name: null },
    ],
    error: null,
  }),
})

const makeCoverageRequestQuery = (coverageRequestId = 'cr-1') => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockResolvedValue({
    data: [{ id: coverageRequestId }],
    error: null,
  }),
  single: jest.fn().mockResolvedValue({
    data: { source_request_id: TOR_ID, school_id: SCHOOL_ID },
    error: null,
  }),
})

describe('POST /api/sub-finder/unassign-shifts integration', () => {
  beforeEach(() => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue(SCHOOL_ID)
    ;(getAuditActorContext as jest.Mock).mockResolvedValue({
      actorId: 'user-1',
      actorName: 'Test User',
    })
    ;(logAuditEvent as jest.Mock).mockResolvedValue(undefined)
    ;(reconcileCoverageRequestCounters as jest.Mock).mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns 400 when required fields are missing', async () => {
    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/unassign-shifts',
      'POST',
      { sub_id: SUB_ID }
    )
    const response = await POST(request as any)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error).toMatch(/absence_id.*sub_id.*scope/i)
  })

  it('returns 400 when scope=single and neither assignment_id nor coverage_request_shift_id provided', async () => {
    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/unassign-shifts',
      'POST',
      { absence_id: TOR_ID, sub_id: SUB_ID, scope: 'single' }
    )
    const response = await POST(request as any)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error).toMatch(/assignment_id or coverage_request_shift_id/i)
  })

  it('returns 404 when time off request not found', async () => {
    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'time_off_requests') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
          }
        }
        if (table === 'coverage_requests') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/unassign-shifts',
      'POST',
      { absence_id: 'bad-id', sub_id: SUB_ID, scope: 'all_for_absence' }
    )
    const response = await POST(request as any)
    expect(response.status).toBe(404)
  })

  it('returns 400 when scope=single and coverage_request_shift_id has multiple active assignments (no assignment_id provided)', async () => {
    const assignmentsQuery = makeAssignmentsQuery([
      {
        id: 'a-1',
        date: '2099-02-10',
        time_slot_id: 'slot-1',
        coverage_request_shift_id: 'crs-1',
        is_partial: true,
      },
      {
        id: 'a-2',
        date: '2099-02-10',
        time_slot_id: 'slot-1',
        coverage_request_shift_id: 'crs-1',
        is_partial: true,
      },
    ])

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'time_off_requests') return makeTorQuery()
        if (table === 'time_off_shifts') return makeTosQuery()
        if (table === 'sub_assignments') return assignmentsQuery
        if (table === 'staff') return makeStaffQuery()
        if (table === 'coverage_requests') return makeCoverageRequestsMaybeSingleQuery()
        if (table === 'coverage_request_shifts') return makeCoverageRequestShiftsQuery()
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/unassign-shifts',
      'POST',
      {
        absence_id: TOR_ID,
        sub_id: SUB_ID,
        scope: 'single',
        coverage_request_shift_id: 'crs-1',
        // No assignment_id — should fail because 2 active partials exist
      }
    )
    const response = await POST(request as any)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error).toMatch(/multiple active assignments/i)
    expect(json.error).toMatch(/assignment_id/i)
  })

  it('cancels specific partial assignment by assignment_id when multiple exist', async () => {
    const updateMock = jest.fn(() => ({
      in: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      })),
    }))
    const assignmentsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'a-1',
            date: '2099-02-10',
            time_slot_id: 'slot-1',
            coverage_request_shift_id: 'crs-1',
            is_partial: true,
          },
          {
            id: 'a-2',
            date: '2099-02-10',
            time_slot_id: 'slot-1',
            coverage_request_shift_id: 'crs-1',
            is_partial: true,
          },
        ],
        error: null,
      }),
      update: updateMock,
    }

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'time_off_requests') return makeTorQuery()
        if (table === 'time_off_shifts') return makeTosQuery()
        if (table === 'sub_assignments') return assignmentsQuery
        if (table === 'staff') return makeStaffQuery()
        if (table === 'coverage_requests') return makeCoverageRequestsMaybeSingleQuery()
        if (table === 'coverage_request_shifts') return makeCoverageRequestShiftsQuery()
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/unassign-shifts',
      'POST',
      {
        absence_id: TOR_ID,
        sub_id: SUB_ID,
        scope: 'single',
        assignment_id: 'a-1',
      }
    )
    const response = await POST(request as any)
    expect(response.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith({ status: 'cancelled' })
    expect(reconcileCoverageRequestCounters).toHaveBeenCalled()
  })

  it('cancels all matching assignments when scope=all_for_absence', async () => {
    const updateMock = jest.fn(() => ({
      in: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      })),
    }))
    const assignmentsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'a-1',
            date: '2099-02-10',
            time_slot_id: 'slot-1',
            coverage_request_shift_id: 'crs-1',
            is_partial: true,
          },
          {
            id: 'a-2',
            date: '2099-02-11',
            time_slot_id: 'slot-1',
            coverage_request_shift_id: 'crs-2',
            is_partial: false,
          },
        ],
        error: null,
      }),
      update: updateMock,
    }

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'time_off_requests') return makeTorQuery()
        if (table === 'time_off_shifts')
          return makeTosQuery([
            { id: 'tos-1', date: '2099-02-10', time_slot_id: 'slot-1' },
            { id: 'tos-2', date: '2099-02-11', time_slot_id: 'slot-1' },
          ])
        if (table === 'sub_assignments') return assignmentsQuery
        if (table === 'staff') return makeStaffQuery()
        if (table === 'coverage_requests') return makeCoverageRequestsMaybeSingleQuery()
        if (table === 'coverage_request_shifts') return makeCoverageRequestShiftsQuery()
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/unassign-shifts',
      'POST',
      { absence_id: TOR_ID, sub_id: SUB_ID, scope: 'all_for_absence' }
    )
    const response = await POST(request as any)
    expect(response.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith({ status: 'cancelled' })
    expect(reconcileCoverageRequestCounters).toHaveBeenCalled()
  })

  it('cancels linked reassignment shift/event when removing linked sub assignment', async () => {
    const assignmentsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'a-1',
            date: '2099-02-10',
            time_slot_id: 'slot-1',
            coverage_request_shift_id: 'crs-1',
            is_partial: false,
            staffing_event_shift_id: 'ses-1',
          },
        ],
        error: null,
      }),
      update: jest.fn(() => ({
        in: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    }

    let staffingEventShiftsCall = 0
    const staffingEventShiftsFrom = jest.fn(() => {
      staffingEventShiftsCall += 1
      if (staffingEventShiftsCall === 1) {
        // Load active linked shifts
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue({
            data: [{ id: 'ses-1', staffing_event_id: 'event-1' }],
            error: null,
          }),
        }
      }
      if (staffingEventShiftsCall === 2) {
        // Cancel linked shifts
        return {
          update: jest.fn(() => ({
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            select: jest.fn().mockResolvedValue({
              data: [{ id: 'ses-1' }],
              error: null,
            }),
          })),
        }
      }
      // Count remaining active shifts for event
      return {
        select: jest.fn((_cols?: string, opts?: { head?: boolean; count?: string }) => {
          if (opts?.head) {
            return {
              eq: jest.fn().mockReturnThis(),
              in: jest.fn().mockReturnThis(),
              gte: jest.fn().mockReturnThis(),
              lte: jest.fn().mockResolvedValue({ count: 0, error: null }),
            }
          }
          return {
            eq: jest.fn().mockReturnThis(),
          }
        }),
      }
    })

    const staffingEventsUpdate = jest.fn(() => ({
      eq: jest.fn().mockReturnThis(),
    }))

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'time_off_requests') return makeTorQuery()
        if (table === 'time_off_shifts') return makeTosQuery()
        if (table === 'sub_assignments') return assignmentsQuery
        if (table === 'staff') return makeStaffQuery()
        if (table === 'coverage_requests') return makeCoverageRequestsMaybeSingleQuery()
        if (table === 'coverage_request_shifts') return makeCoverageRequestShiftsQuery()
        if (table === 'staffing_event_shifts') return staffingEventShiftsFrom()
        if (table === 'staffing_events') {
          return {
            update: staffingEventsUpdate,
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/unassign-shifts',
      'POST',
      { absence_id: TOR_ID, sub_id: SUB_ID, scope: 'single', assignment_id: 'a-1' }
    )
    const response = await POST(request as any)

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.linked_reassignment_shift_cancelled_count).toBe(1)
    expect(json.linked_reassignment_event_cancelled_count).toBe(1)
    expect(staffingEventsUpdate).toHaveBeenCalledWith({ status: 'cancelled' })
  })

  it('falls back when staffing_event_shift_id column is unavailable', async () => {
    let nonHeadSelectCall = 0
    const subAssignmentsQuery: any = {
      select: jest.fn((_cols?: string, opts?: { head?: boolean; count?: string }) => {
        if (opts?.head) {
          return {
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockResolvedValue({ count: 0, error: null }),
          }
        }

        nonHeadSelectCall += 1
        if (nonHeadSelectCall === 1) {
          return {
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockResolvedValue({
              data: null,
              error: { code: '42703', message: 'column staffing_event_shift_id does not exist' },
            }),
          }
        }

        return {
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'a-1',
                date: '2099-02-10',
                time_slot_id: 'slot-1',
                coverage_request_shift_id: 'crs-1',
                is_partial: false,
              },
            ],
            error: null,
          }),
        }
      }),
      update: jest.fn(() => ({
        in: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    }

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'time_off_requests') return makeTorQuery()
        if (table === 'time_off_shifts') return makeTosQuery()
        if (table === 'sub_assignments') return subAssignmentsQuery
        if (table === 'staff') return makeStaffQuery()
        if (table === 'coverage_requests') return makeCoverageRequestsMaybeSingleQuery()
        if (table === 'coverage_request_shifts') return makeCoverageRequestShiftsQuery()
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/unassign-shifts',
      'POST',
      { absence_id: TOR_ID, sub_id: SUB_ID, scope: 'single', assignment_id: 'a-1' }
    )
    const response = await POST(request as any)

    expect(response.status).toBe(200)
    expect(nonHeadSelectCall).toBe(2)
  })
})
