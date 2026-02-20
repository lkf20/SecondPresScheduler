/** @jest-environment node */

import { POST } from '@/app/api/sub-finder/assign-shifts/route'
import { createJsonRequest } from '@/tests/helpers/api'
import { createClient } from '@/lib/supabase/server'
import { createAuditLog } from '@/lib/api/audit-logs'
import { revalidatePath } from 'next/cache'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/api/audit-logs', () => ({
  createAuditLog: jest.fn(),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

describe('POST /api/sub-finder/assign-shifts integration', () => {
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
      single: jest.fn().mockResolvedValue({
        data: {
          teacher_id: 'teacher-1',
          source_request_id: 'timeoff-1',
          request_type: 'time_off',
          school_id: 'school-1',
        },
        error: null,
      }),
    }

    const coverageRequestShiftsQuery = {
      select: jest.fn().mockImplementation(() => {
        coverageRequestShiftsSelectCount += 1
        if (coverageRequestShiftsSelectCount === 1) {
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

    const subAssignmentsQuery = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue({
        data: [{ id: 'assignment-1', coverage_request_shift_id: 'shift-1' }],
        error: null,
      }),
    }

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
    expect(createAuditLog).toHaveBeenCalled()
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
})
