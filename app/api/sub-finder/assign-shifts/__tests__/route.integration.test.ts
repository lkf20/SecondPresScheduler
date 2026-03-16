/** @jest-environment node */

import { POST } from '@/app/api/sub-finder/assign-shifts/route'
import { createJsonRequest } from '@/tests/helpers/api'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getAuditActorContext, logAuditEvent } from '@/lib/audit/logAuditEvent'
import { revalidatePath } from 'next/cache'
import { getSchoolClosuresForDateRange } from '@/lib/api/school-calendar'

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

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

jest.mock('@/lib/api/school-calendar', () => ({
  getSchoolClosuresForDateRange: jest.fn().mockResolvedValue([]),
}))

const createStaffQuery = ({
  subRecord = {
    id: 'sub-1',
    school_id: 'school-1',
    first_name: 'Sub',
    last_name: 'One',
    display_name: null,
    active: true,
    is_sub: true,
  },
}: {
  subRecord?: {
    id: string
    school_id: string
    first_name?: string | null
    last_name?: string | null
    display_name?: string | null
    active?: boolean | null
    is_sub?: boolean | null
  }
} = {}) => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({
    data: subRecord,
    error: null,
  }),
  maybeSingle: jest.fn().mockResolvedValue({
    data: { first_name: 'Teacher', last_name: 'Name', display_name: null },
    error: null,
  }),
})

const createSubAssignmentsQuery = ({
  existingAssignments = [],
  collisionAssignments = [],
  coveredRows = [],
  insertData = [{ id: 'assignment-1', coverage_request_shift_id: 'shift-1' }],
  insertError = null,
}: {
  existingAssignments?: Array<{ id: string; coverage_request_shift_id: string }>
  collisionAssignments?: Array<{
    id: string
    date: string
    time_slot_id: string
    is_partial?: boolean
  }>
  coveredRows?: Array<{ coverage_request_shift_id: string }>
  insertData?: Array<{ id: string; coverage_request_shift_id: string }> | null
  insertError?: { message?: string; code?: string } | null
} = {}) => {
  let selectShape = ''
  const query: any = {
    select: jest.fn((columns?: string) => {
      selectShape = columns || ''
      return query
    }),
    eq: jest.fn((column: string) => {
      if (column === 'coverage_request_shifts.status') {
        return Promise.resolve({ data: coveredRows, error: null })
      }
      return query
    }),
    in: jest.fn((column: string) => {
      if (column === 'date') return query
      if (column === 'time_slot_id') {
        return Promise.resolve({ data: collisionAssignments, error: null })
      }
      if (
        column === 'coverage_request_shift_id' &&
        selectShape.includes('id, coverage_request_shift_id')
      ) {
        return Promise.resolve({ data: existingAssignments, error: null })
      }
      if (
        column === 'coverage_request_shift_id' &&
        selectShape.includes('coverage_request_shifts!inner')
      ) {
        return Promise.resolve({ data: coveredRows, error: null })
      }
      return Promise.resolve({ data: [], error: null })
    }),
    update: jest.fn((payload: Record<string, unknown>) => ({
      eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      payload,
    })),
    insert: jest.fn(() => ({
      select: jest.fn().mockResolvedValue({ data: insertData, error: insertError }),
    })),
  }
  return query
}

describe('POST /api/sub-finder/assign-shifts integration', () => {
  beforeEach(() => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getAuditActorContext as jest.Mock).mockResolvedValue({
      actorId: 'user-1',
      actorName: 'Test User',
    })
    ;(logAuditEvent as jest.Mock).mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns 400 when required fields are missing', async () => {
    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/assign-shifts',
      'POST',
      {
        coverage_request_id: 'request-1',
        sub_id: 'sub-1',
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/missing required fields/i)
  })

  it('returns 404 when coverage request cannot be found', async () => {
    const coverageRequestQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'No rows found', code: 'PGRST116' },
      }),
    }

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'coverage_requests') return coverageRequestQuery
        if (table === 'staff') return createStaffQuery()
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/assign-shifts',
      'POST',
      {
        coverage_request_id: 'coverage-1',
        sub_id: 'sub-1',
        selected_shift_ids: ['shift-1'],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toMatch(/coverage request not found/i)
  })

  it('rejects non-sub assignment unless override flag is explicitly enabled', async () => {
    const coverageRequestsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          teacher_id: 'teacher-1',
          source_request_id: 'timeoff-1',
          request_type: 'absence',
          school_id: 'school-1',
        },
        error: null,
      }),
    }

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'coverage_requests') return coverageRequestsQuery
        if (table === 'staff') {
          return createStaffQuery({
            subRecord: {
              id: 'staff-override',
              school_id: 'school-1',
              first_name: 'Alex',
              last_name: 'Admin',
              display_name: null,
              active: true,
              is_sub: false,
            },
          })
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/assign-shifts',
      'POST',
      {
        coverage_request_id: 'coverage-1',
        sub_id: 'staff-override',
        selected_shift_ids: ['shift-1'],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/non-sub override/i)
  })

  it('allows non-sub assignment when override flag is enabled and records override metadata', async () => {
    let insertedAssignments: Array<Record<string, unknown>> = []
    const coverageRequestsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({ error: null }),
        }),
      }),
      single: jest.fn().mockResolvedValue({
        data: {
          teacher_id: 'teacher-1',
          source_request_id: 'timeoff-1',
          request_type: 'absence',
          school_id: 'school-1',
        },
        error: null,
      }),
    }
    const coverageRequestShiftsQuery = {
      select: jest.fn().mockImplementation((columns?: string, options?: { head?: boolean }) => {
        if (options?.head) {
          return {
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ count: 1, error: null }),
            }),
          }
        }
        if (columns?.includes('classroom_id')) {
          return {
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'shift-1',
                  date: '2099-02-10',
                  day_of_week_id: 'day-1',
                  time_slot_id: 'slot-1',
                  classroom_id: 'classroom-1',
                },
              ],
              error: null,
            }),
          }
        }
        return {
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'shift-1',
                date: '2099-02-10',
                days_of_week: { name: 'Monday' },
                time_slots: { code: 'EM' },
              },
            ],
            error: null,
          }),
        }
      }),
    }
    const subAssignmentsQuery = createSubAssignmentsQuery()
    const originalInsert = subAssignmentsQuery.insert
    subAssignmentsQuery.insert = jest.fn((assignments: Array<Record<string, unknown>>) => {
      insertedAssignments = assignments
      return originalInsert(assignments)
    })
    const substituteContactsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    }
    const overridesQuery = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: [], error: null }),
    }

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'coverage_requests') return coverageRequestsQuery
        if (table === 'coverage_request_shifts') return coverageRequestShiftsQuery
        if (table === 'sub_assignments') return subAssignmentsQuery
        if (table === 'staff') {
          return createStaffQuery({
            subRecord: {
              id: 'staff-override',
              school_id: 'school-1',
              first_name: 'Alex',
              last_name: 'Admin',
              display_name: null,
              active: true,
              is_sub: false,
            },
          })
        }
        if (table === 'substitute_contacts') return substituteContactsQuery
        if (table === 'sub_contact_shift_overrides') return overridesQuery
        if (table === 'teacher_schedules') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/assign-shifts',
      'POST',
      {
        coverage_request_id: 'coverage-1',
        sub_id: 'staff-override',
        allow_non_sub_override: true,
        selected_shift_ids: ['shift-1'],
      }
    )
    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.non_sub_override).toBe(true)
    expect(insertedAssignments[0]?.non_sub_override).toBe(true)
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          non_sub_override: true,
          assignee_is_sub: false,
        }),
      })
    )
  })

  it('creates assignments and returns assigned shift details on success', async () => {
    let coverageRequestShiftsSelectCount = 0

    const coverageRequestsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({ error: null }),
        }),
      }),
      single: jest.fn().mockResolvedValue({
        data: {
          teacher_id: 'teacher-1',
          source_request_id: 'timeoff-1',
          request_type: 'absence',
          school_id: 'school-1',
        },
        error: null,
      }),
    }

    const coverageRequestShiftsQuery = {
      select: jest.fn().mockImplementation((columns?: string, options?: { head?: boolean }) => {
        coverageRequestShiftsSelectCount += 1
        if (options?.head) {
          return {
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                count: 1,
                error: null,
              }),
            }),
          }
        }

        if (columns?.includes('classroom_id')) {
          return {
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'shift-1',
                  date: '2099-02-10',
                  day_of_week_id: 'day-1',
                  time_slot_id: 'slot-1',
                  classroom_id: 'classroom-1',
                },
              ],
              error: null,
            }),
          }
        }

        return {
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'shift-1',
                date: '2099-02-10',
                days_of_week: { name: 'Monday' },
                time_slots: { code: 'EM' },
              },
            ],
            error: null,
          }),
        }
      }),
    }

    const subAssignmentsQuery = createSubAssignmentsQuery()

    const substituteContactsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'contact-1' },
        error: null,
      }),
    }

    const overridesQuery = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: [{ coverage_request_shift_id: 'shift-1', override_availability: true }],
        error: null,
      }),
    }

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'coverage_requests') return coverageRequestsQuery
        if (table === 'coverage_request_shifts') return coverageRequestShiftsQuery
        if (table === 'sub_assignments') return subAssignmentsQuery
        if (table === 'staff') return createStaffQuery()
        if (table === 'substitute_contacts') return substituteContactsQuery
        if (table === 'sub_contact_shift_overrides') return overridesQuery
        if (table === 'teacher_schedules') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/assign-shifts',
      'POST',
      {
        coverage_request_id: 'coverage-1',
        sub_id: 'sub-1',
        selected_shift_ids: ['shift-1'],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(logAuditEvent).toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalledWith('/sub-finder')
    expect(json).toMatchObject({
      success: true,
      assignments_created: 1,
      assigned_count: 1,
    })
    expect(json.assigned_shifts[0]).toMatchObject({
      coverage_request_shift_id: 'shift-1',
      day_name: 'Monday',
      time_slot_code: 'EM',
    })
  })

  it('returns 409 when a selected shift falls on a school closed day', async () => {
    ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([
      { date: '2099-02-10', time_slot_id: null },
    ])
    let coverageRequestShiftsSelectCount = 0
    const coverageRequestsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({ error: null }),
        }),
      }),
      single: jest.fn().mockResolvedValue({
        data: {
          teacher_id: 'teacher-1',
          source_request_id: 'timeoff-1',
          request_type: 'absence',
          school_id: 'school-1',
        },
        error: null,
      }),
    }
    const coverageRequestShiftsQuery = {
      select: jest.fn().mockImplementation((columns?: string, options?: { head?: boolean }) => {
        coverageRequestShiftsSelectCount += 1
        if (options?.head) {
          return {
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ count: 1, error: null }),
            }),
          }
        }
        if (columns?.includes('classroom_id')) {
          return {
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'shift-1',
                  date: '2099-02-10',
                  day_of_week_id: 'day-1',
                  time_slot_id: 'slot-1',
                  classroom_id: 'classroom-1',
                },
              ],
              error: null,
            }),
          }
        }
        return {
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'shift-1',
                date: '2099-02-10',
                days_of_week: { name: 'Monday' },
                time_slots: { code: 'EM' },
              },
            ],
            error: null,
          }),
        }
      }),
    }
    const substituteContactsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    }
    const overridesQuery = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: [], error: null }),
    }
    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'coverage_requests') return coverageRequestsQuery
        if (table === 'coverage_request_shifts') return coverageRequestShiftsQuery
        if (table === 'sub_assignments') return createSubAssignmentsQuery()
        if (table === 'staff') return createStaffQuery()
        if (table === 'substitute_contacts') return substituteContactsQuery
        if (table === 'sub_contact_shift_overrides') return overridesQuery
        if (table === 'teacher_schedules') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/assign-shifts',
      'POST',
      {
        coverage_request_id: 'coverage-1',
        sub_id: 'sub-1',
        selected_shift_ids: ['shift-1'],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(409)
    expect(json.error).toMatch(/school is closed/i)
    expect(json.error).toMatch(/deselect shifts/i)
  })

  it('returns 404 when coverage request has no teacher_id', async () => {
    const coverageRequestsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          teacher_id: null,
          source_request_id: 'timeoff-1',
          request_type: 'absence',
          school_id: 'school-1',
        },
        error: null,
      }),
    }

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'coverage_requests') return coverageRequestsQuery
        if (table === 'staff') return createStaffQuery()
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/assign-shifts',
      'POST',
      {
        coverage_request_id: 'coverage-1',
        sub_id: 'sub-1',
        selected_shift_ids: ['shift-1'],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toMatch(/teacher id not found/i)
  })

  it('returns 500 when fallback classroom lookup fails', async () => {
    ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([])
    const coverageRequestsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({ error: null }),
        }),
      }),
      single: jest.fn().mockResolvedValue({
        data: {
          teacher_id: 'teacher-1',
          source_request_id: 'timeoff-1',
          request_type: 'absence',
          school_id: 'school-1',
        },
        error: null,
      }),
    }

    const coverageRequestShiftsQuery = {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'shift-1',
              date: '2099-02-10',
              day_of_week_id: 'day-1',
              time_slot_id: 'slot-1',
              classroom_id: null,
            },
          ],
          error: null,
        }),
      }),
    }

    const teacherSchedulesQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'schedule lookup failed' },
      }),
    }

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'coverage_requests') return coverageRequestsQuery
        if (table === 'coverage_request_shifts') return coverageRequestShiftsQuery
        if (table === 'sub_assignments') return createSubAssignmentsQuery()
        if (table === 'staff') return createStaffQuery()
        if (table === 'teacher_schedules') return teacherSchedulesQuery
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/assign-shifts',
      'POST',
      {
        coverage_request_id: 'coverage-1',
        sub_id: 'sub-1',
        selected_shift_ids: ['shift-1'],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toMatch(/failed to resolve classroom/i)
  })

  it('returns 500 when selected shifts cannot resolve a classroom', async () => {
    ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([])
    const coverageRequestsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          teacher_id: 'teacher-1',
          source_request_id: 'timeoff-1',
          request_type: 'absence',
          school_id: 'school-1',
        },
        error: null,
      }),
    }

    const coverageRequestShiftsQuery = {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'shift-1',
              date: '2099-02-10',
              day_of_week_id: 'day-1',
              time_slot_id: 'slot-1',
              classroom_id: null,
            },
          ],
          error: null,
        }),
      }),
    }

    const teacherSchedulesQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    }

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'coverage_requests') return coverageRequestsQuery
        if (table === 'coverage_request_shifts') return coverageRequestShiftsQuery
        if (table === 'sub_assignments') return createSubAssignmentsQuery()
        if (table === 'staff') return createStaffQuery()
        if (table === 'teacher_schedules') return teacherSchedulesQuery
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/assign-shifts',
      'POST',
      {
        coverage_request_id: 'coverage-1',
        sub_id: 'sub-1',
        selected_shift_ids: ['shift-1'],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toMatch(/missing classroom assignment/i)
  })

  it('returns 500 when coverage_request_shifts lookup fails', async () => {
    const coverageRequestsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          teacher_id: 'teacher-1',
          source_request_id: 'timeoff-1',
          request_type: 'absence',
          school_id: 'school-1',
        },
        error: null,
      }),
    }

    const coverageRequestShiftsQuery = {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'shift lookup failed' },
        }),
      }),
    }

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'coverage_requests') return coverageRequestsQuery
        if (table === 'coverage_request_shifts') return coverageRequestShiftsQuery
        if (table === 'staff') return createStaffQuery()
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/assign-shifts',
      'POST',
      {
        coverage_request_id: 'coverage-1',
        sub_id: 'sub-1',
        selected_shift_ids: ['shift-1'],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toMatch(/failed to fetch shift details/i)
  })

  it('returns 404 when selected shift IDs do not match active coverage shifts', async () => {
    const coverageRequestsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          teacher_id: 'teacher-1',
          source_request_id: 'timeoff-1',
          request_type: 'absence',
          school_id: 'school-1',
        },
        error: null,
      }),
    }

    const coverageRequestShiftsQuery = {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }),
    }

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'coverage_requests') return coverageRequestsQuery
        if (table === 'coverage_request_shifts') return coverageRequestShiftsQuery
        if (table === 'staff') return createStaffQuery()
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/assign-shifts',
      'POST',
      {
        coverage_request_id: 'coverage-1',
        sub_id: 'sub-1',
        selected_shift_ids: ['shift-does-not-exist'],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toMatch(/no valid shifts found/i)
  })

  it('returns 500 when assignment insert fails and skips contact lookup', async () => {
    ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([])
    const coverageRequestsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({ error: null }),
        }),
      }),
      single: jest.fn().mockResolvedValue({
        data: {
          teacher_id: 'teacher-1',
          source_request_id: 'timeoff-1',
          request_type: 'absence',
          school_id: 'school-1',
        },
        error: null,
      }),
    }

    const coverageRequestShiftsQuery = {
      select: jest.fn().mockImplementation((columns?: string, options?: { head?: boolean }) => {
        if (options?.head) {
          return {
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                count: 1,
                error: null,
              }),
            }),
          }
        }

        if (columns?.includes('classroom_id')) {
          return {
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'shift-1',
                  date: '2099-02-10',
                  day_of_week_id: 'day-1',
                  time_slot_id: 'slot-1',
                  classroom_id: 'classroom-1',
                },
              ],
              error: null,
            }),
          }
        }

        return {
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }
      }),
    }

    const subAssignmentsQuery = createSubAssignmentsQuery({
      insertData: null,
      insertError: { message: 'insert failed', code: 'PGRST999' },
    })

    const substituteContactsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    }

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'coverage_requests') return coverageRequestsQuery
        if (table === 'coverage_request_shifts') return coverageRequestShiftsQuery
        if (table === 'sub_assignments') return subAssignmentsQuery
        if (table === 'staff') return createStaffQuery()
        if (table === 'substitute_contacts') return substituteContactsQuery
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/assign-shifts',
      'POST',
      {
        coverage_request_id: 'coverage-1',
        sub_id: 'sub-1',
        selected_shift_ids: ['shift-1'],
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toMatch(/failed to create assignments/i)
    expect(substituteContactsQuery.single).not.toHaveBeenCalled()
  })

  it('with resolution "move" cancels existing assignment and creates new one', async () => {
    ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([])
    const coverageRequestsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({ error: null }),
        }),
      }),
      single: jest.fn().mockResolvedValue({
        data: {
          teacher_id: 'teacher-1',
          source_request_id: 'timeoff-1',
          request_type: 'absence',
          school_id: 'school-1',
        },
        error: null,
      }),
    }
    const coverageRequestShiftsQuery = {
      select: jest.fn().mockImplementation((columns?: string, options?: { head?: boolean }) => {
        if (options?.head) {
          return {
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ count: 1, error: null }),
            }),
          }
        }
        if (columns?.includes('classroom_id')) {
          return {
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'shift-1',
                  date: '2099-02-10',
                  day_of_week_id: 'day-1',
                  time_slot_id: 'slot-1',
                  classroom_id: 'classroom-1',
                },
              ],
              error: null,
            }),
          }
        }
        return {
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'shift-1',
                date: '2099-02-10',
                days_of_week: { name: 'Monday' },
                time_slots: { code: 'EM' },
              },
            ],
            error: null,
          }),
        }
      }),
    }
    const subAssignmentsQuery = createSubAssignmentsQuery({
      existingAssignments: [{ id: 'existing-1', coverage_request_shift_id: 'shift-1' }],
      collisionAssignments: [{ id: 'existing-1', date: '2099-02-10', time_slot_id: 'slot-1' }],
    })
    const substituteContactsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    }
    const overridesQuery = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: [], error: null }),
    }
    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'coverage_requests') return coverageRequestsQuery
        if (table === 'coverage_request_shifts') return coverageRequestShiftsQuery
        if (table === 'sub_assignments') return subAssignmentsQuery
        if (table === 'staff') return createStaffQuery()
        if (table === 'substitute_contacts') return substituteContactsQuery
        if (table === 'sub_contact_shift_overrides') return overridesQuery
        if (table === 'teacher_schedules') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/assign-shifts',
      'POST',
      {
        coverage_request_id: 'coverage-1',
        sub_id: 'sub-1',
        selected_shift_ids: ['shift-1'],
        resolutions: { 'shift-1': 'move' },
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.assignments_created).toBe(1)
    expect(subAssignmentsQuery.update).toHaveBeenCalledWith({ status: 'cancelled' })
    expect(subAssignmentsQuery.insert).toHaveBeenCalled()
  })

  it('with resolution "floater" updates existing to is_floater and inserts new with is_floater', async () => {
    ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([])
    const coverageRequestsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({ error: null }),
        }),
      }),
      single: jest.fn().mockResolvedValue({
        data: {
          teacher_id: 'teacher-1',
          source_request_id: 'timeoff-1',
          request_type: 'absence',
          school_id: 'school-1',
        },
        error: null,
      }),
    }
    const coverageRequestShiftsQuery = {
      select: jest.fn().mockImplementation((columns?: string, options?: { head?: boolean }) => {
        if (options?.head) {
          return {
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ count: 1, error: null }),
            }),
          }
        }
        if (columns?.includes('classroom_id')) {
          return {
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'shift-1',
                  date: '2099-02-10',
                  day_of_week_id: 'day-1',
                  time_slot_id: 'slot-1',
                  classroom_id: 'classroom-1',
                },
              ],
              error: null,
            }),
          }
        }
        return {
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'shift-1',
                date: '2099-02-10',
                days_of_week: { name: 'Monday' },
                time_slots: { code: 'EM' },
              },
            ],
            error: null,
          }),
        }
      }),
    }
    const subAssignmentsQuery = createSubAssignmentsQuery({
      existingAssignments: [{ id: 'existing-1', coverage_request_shift_id: 'shift-1' }],
      collisionAssignments: [{ id: 'existing-1', date: '2099-02-10', time_slot_id: 'slot-1' }],
    })
    const substituteContactsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    }
    const overridesQuery = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: [], error: null }),
    }
    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'coverage_requests') return coverageRequestsQuery
        if (table === 'coverage_request_shifts') return coverageRequestShiftsQuery
        if (table === 'sub_assignments') return subAssignmentsQuery
        if (table === 'staff') return createStaffQuery()
        if (table === 'substitute_contacts') return substituteContactsQuery
        if (table === 'sub_contact_shift_overrides') return overridesQuery
        if (table === 'teacher_schedules') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const request = createJsonRequest(
      'http://localhost:3000/api/sub-finder/assign-shifts',
      'POST',
      {
        coverage_request_id: 'coverage-1',
        sub_id: 'sub-1',
        selected_shift_ids: ['shift-1'],
        resolutions: { 'shift-1': 'floater' },
      }
    )

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(subAssignmentsQuery.update).toHaveBeenCalledWith({ is_floater: true })
    const insertPayload = subAssignmentsQuery.insert.mock.calls[0][0]
    expect(Array.isArray(insertPayload)).toBe(true)
    expect(insertPayload[0]).toMatchObject({
      is_floater: true,
      coverage_request_shift_id: 'shift-1',
    })
  })
})
