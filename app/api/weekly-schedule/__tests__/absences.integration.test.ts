/** @jest-environment node */

import { GET } from '@/app/api/weekly-schedule/route'
import { getWeeklyScheduleData } from '@/lib/api/weekly-schedule'
import { getScheduleSettings } from '@/lib/api/schedule-settings'
import { getUserSchoolId } from '@/lib/utils/auth'
import { createClient } from '@/lib/supabase/server'

jest.mock('@/lib/api/schedule-settings', () => ({
  getScheduleSettings: jest.fn(),
}))

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

describe('GET /api/weekly-schedule integration - Absences', () => {
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({
      selected_day_ids: ['d1'],
    })

    const mockChainable = (data: any) => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      then: (resolve: any) => resolve({ data, error: null }),
    })

    mockSupabase = {
      from: jest.fn(table => {
        if (table === 'schedule_settings') return mockChainable(null)
        if (table === 'time_off_shifts')
          return mockChainable([
            {
              id: 'tos1',
              date: '2026-03-02',
              day_of_week_id: 'd1',
              time_slot_id: 's1',
              time_off_request_id: 'req1',
              time_off_requests: { teacher_id: 't1', status: 'active' },
            },
          ])
        if (table === 'staffing_event_shifts') return mockChainable([])
        if (table === 'days_of_week')
          return mockChainable([{ id: 'd1', name: 'Monday', day_number: 1 }])
        if (table === 'time_slots')
          return mockChainable([{ id: 's1', code: 'AM', is_active: true }])
        if (table === 'classrooms')
          return mockChainable([{ id: 'c1', name: 'Room A', is_active: true }])
        if (table === 'teacher_schedules')
          return mockChainable([
            {
              id: 'ts1',
              teacher_id: 't1',
              day_of_week_id: 'd1',
              time_slot_id: 's1',
              classroom_id: 'c1',
              teacher: {
                id: 't1',
                first_name: 'Absent',
                last_name: 'Teacher',
                display_name: 'Absent Teacher',
              },
              classroom: { id: 'c1', name: 'Room A' },
            },
            {
              id: 'ts2',
              teacher_id: 't2',
              day_of_week_id: 'd1',
              time_slot_id: 's1',
              classroom_id: 'c1',
              teacher: {
                id: 't2',
                first_name: 'Present',
                last_name: 'Teacher',
                display_name: 'Present Teacher',
              },
              classroom: { id: 'c1', name: 'Room A' },
            },
          ])
        if (table === 'staff_role_type_assignments') return mockChainable([])
        if (table === 'schedule_cells')
          return mockChainable([
            {
              id: 'cell1',
              classroom_id: 'c1',
              day_of_week_id: 'd1',
              time_slot_id: 's1',
              is_active: true,
              enrollment_for_staffing: 10,
              schedule_cell_class_groups: [],
            },
          ])
        if (table === 'sub_assignments') return mockChainable([])
        if (table === 'staff')
          return mockChainable([
            {
              id: 't1',
              first_name: 'Absent',
              last_name: 'Teacher',
              display_name: 'Absent Teacher',
            },
          ])

        return mockChainable([])
      }),
    }
    ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)
  })

  it('identifies absent teachers and optionally omits them from assignments array', async () => {
    // The AI Simulation Prompts review suggested the API should omit absent permanent teachers
    // from the assignments array so that the frontend math doesn't count them as present.
    // Let's verify what the API actually returns.

    const response = await GET(
      new Request('http://localhost:3000/api/weekly-schedule?weekStartISO=2026-03-02')
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    const classrooms = json.classrooms ?? []
    expect(Array.isArray(classrooms)).toBe(true)

    const roomA = classrooms.find((c: any) => c.classroom_id === 'c1')
    expect(roomA).toBeDefined()

    const monday = roomA.days.find((d: any) => d.day_of_week_id === 'd1')
    expect(monday).toBeDefined()

    const amSlot = monday.time_slots.find((s: any) => s.time_slot_id === 's1')
    expect(amSlot).toBeDefined()

    // The slot should have absences array populated with t1
    expect(amSlot.absences).toBeDefined()
    expect(amSlot.absences.length).toBe(1)
    expect(amSlot.absences[0].teacher_id).toBe('t1')

    // Ideally, t1 should be omitted from the assignments array to avoid double-counting in math.
    // If the API is fixed, this test will ensure t1 is not in assignments.
    // If the API hasn't been fixed yet, this test will fail and prompt a fix.
    const assignedTeacherIds = amSlot.assignments.map((a: any) => a.teacher_id)

    // We expect the present teacher to be assigned
    expect(assignedTeacherIds).toContain('t2')

    // We expect the absent teacher to NOT be assigned
    // (This is the High-Priority Fix 2 contract verification)
    expect(assignedTeacherIds).not.toContain('t1')
  })

  it('shows reassigned marker in source room and avoids duplicate temp+sub in target room', async () => {
    const mockChainable = (data: any) => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      then: (resolve: any) => resolve({ data, error: null }),
    })

    const jenn = {
      id: 'jenn',
      first_name: 'Jenn',
      last_name: 'Stone',
      display_name: 'Jenn S.',
    }
    const sabrina = {
      id: 'sabrina',
      first_name: 'Sabrina',
      last_name: 'Moss',
      display_name: 'Sabrina M.',
    }

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'schedule_settings') return mockChainable(null)
        if (table === 'time_off_shifts')
          return mockChainable([
            {
              id: 'tos-sabrina',
              date: '2026-03-02',
              day_of_week_id: 'd1',
              time_slot_id: 's1',
              time_off_request_id: 'req-sabrina',
              time_off_requests: { teacher_id: 'sabrina', status: 'active' },
            },
          ])
        if (table === 'staffing_event_shifts')
          return mockChainable([
            {
              id: 'ses-1',
              staffing_event_id: 'event-1',
              date: '2026-03-02',
              day_of_week_id: 'd1',
              time_slot_id: 's1',
              classroom_id: 'c2',
              source_classroom_id: 'c1',
              staff_id: 'jenn',
              staff: jenn,
              staffing_event: { event_category: 'reassignment', covered_staff_id: null },
            },
          ])
        if (table === 'days_of_week')
          return mockChainable([{ id: 'd1', name: 'Monday', day_number: 1 }])
        if (table === 'time_slots')
          return mockChainable([{ id: 's1', code: 'AM', is_active: true }])
        if (table === 'classrooms')
          return mockChainable([
            { id: 'c1', name: 'Green Room', is_active: true },
            { id: 'c2', name: 'Infant Room', is_active: true },
          ])
        if (table === 'teacher_schedules')
          return mockChainable([
            {
              id: 'ts-jenn',
              teacher_id: 'jenn',
              day_of_week_id: 'd1',
              time_slot_id: 's1',
              classroom_id: 'c1',
              teacher: jenn,
              classroom: { id: 'c1', name: 'Green Room' },
            },
            {
              id: 'ts-sabrina',
              teacher_id: 'sabrina',
              day_of_week_id: 'd1',
              time_slot_id: 's1',
              classroom_id: 'c2',
              teacher: sabrina,
              classroom: { id: 'c2', name: 'Infant Room' },
            },
          ])
        if (table === 'staff_role_type_assignments') return mockChainable([])
        if (table === 'schedule_cells')
          return mockChainable([
            {
              id: 'cell-green',
              classroom_id: 'c1',
              day_of_week_id: 'd1',
              time_slot_id: 's1',
              is_active: true,
              enrollment_for_staffing: 10,
              schedule_cell_class_groups: [],
            },
            {
              id: 'cell-infant',
              classroom_id: 'c2',
              day_of_week_id: 'd1',
              time_slot_id: 's1',
              is_active: true,
              enrollment_for_staffing: 10,
              schedule_cell_class_groups: [],
            },
          ])
        if (table === 'sub_assignments')
          return mockChainable([
            {
              id: 'sa-1',
              date: '2026-03-02',
              day_of_week_id: 'd1',
              time_slot_id: 's1',
              classroom_id: 'c2',
              sub_id: 'jenn',
              teacher_id: 'sabrina',
              staffing_event_shift_id: 'ses-1',
              is_floater: false,
              non_sub_override: true,
              sub: jenn,
              teacher: sabrina,
            },
          ])
        if (table === 'staff') return mockChainable([jenn, sabrina])
        return mockChainable([])
      }),
    })

    const response = await GET(
      new Request('http://localhost:3000/api/weekly-schedule?weekStartISO=2026-03-02')
    )
    const json = await response.json()
    expect(response.status).toBe(200)

    const rooms = json.classrooms ?? []
    const greenSlot = rooms
      .find((c: any) => c.classroom_id === 'c1')
      ?.days?.[0]?.time_slots?.find((s: any) => s.time_slot_id === 's1')
    const infantSlot = rooms
      .find((c: any) => c.classroom_id === 'c2')
      ?.days?.[0]?.time_slots?.find((s: any) => s.time_slot_id === 's1')

    expect(greenSlot.absences?.some((a: any) => a.teacher_id === 'jenn' && a.is_reassigned)).toBe(
      true
    )

    const jennRowsInInfant = (infantSlot.assignments ?? []).filter(
      (a: any) => a.teacher_id === 'jenn'
    )
    expect(jennRowsInInfant).toHaveLength(1)
    expect(jennRowsInInfant[0].is_substitute).toBe(true)
  })
})
