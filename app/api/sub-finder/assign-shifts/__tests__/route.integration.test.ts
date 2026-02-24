/** @jest-environment node */

import { POST } from '@/app/api/sub-finder/assign-shifts/route'
import { createJsonRequest } from '@/tests/helpers/api'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getAuditActorContext, logAuditEvent } from '@/lib/audit/logAuditEvent'
import { revalidatePath } from 'next/cache'

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

const createStaffQuery = () => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({
    data: { id: 'sub-1', school_id: 'school-1' },
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
})
