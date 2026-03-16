import {
  buildSubAssignmentKey,
  dedupeFlexAssignmentsForSlot,
  dedupeSubAssignmentsForSlot,
  fetchSubAssignmentsForRange,
  getStaffDisplayName,
  getStaffNameParts,
  getTeachersAssignedToClassroom,
  getWeekEndISO,
} from '@/lib/api/weekly-schedule'

describe('weekly schedule helpers', () => {
  it('returns Unknown when staff is missing', () => {
    expect(getStaffDisplayName(null, 'first_last_initial')).toBe('Unknown')
  })

  it('formats display names for object and array staff inputs', () => {
    const staff = {
      id: 'staff-1',
      first_name: 'Bella',
      last_name: 'Wilbanks',
      display_name: null,
    }
    expect(getStaffDisplayName(staff, 'first_last_initial')).toBe('Bella W.')
    expect(getStaffDisplayName([staff], 'first_name')).toBe('Bella')
  })

  it('returns normalized name parts for missing and present staff', () => {
    expect(getStaffNameParts(undefined, 'first_last_initial')).toEqual({
      first_name: null,
      last_name: null,
      display_name: null,
    })

    expect(
      getStaffNameParts(
        {
          id: 'staff-2',
          first_name: 'Amy',
          last_name: 'Parks',
          display_name: null,
        },
        'first_last_initial'
      )
    ).toEqual({
      first_name: 'Amy',
      last_name: 'Parks',
      display_name: 'Amy P.',
    })
  })

  it('calculates week end date from week start', () => {
    expect(getWeekEndISO('2026-02-09')).toBe('2026-02-15')
    expect(getWeekEndISO('2026-12-28')).toBe('2027-01-03')
  })

  it('builds stable key for sub assignments including nullable day id', () => {
    expect(
      buildSubAssignmentKey({
        date: '2026-02-09',
        day_of_week_id: null,
        time_slot_id: 'slot-1',
        classroom_id: 'room-1',
        teacher_id: 'teacher-1',
        sub_id: 'sub-1',
      })
    ).toBe('2026-02-09|null|slot-1|room-1|teacher-1|sub-1')
  })

  it('dedupes sub assignments by key and keeps latest duplicate', () => {
    const deduped = dedupeSubAssignmentsForSlot([
      {
        id: 'a',
        date: '2026-02-09',
        day_of_week_id: 'monday',
        time_slot_id: 'slot-1',
        classroom_id: 'room-1',
        teacher_id: 'teacher-1',
        sub_id: 'sub-1',
      },
      {
        id: 'b',
        date: '2026-02-09',
        day_of_week_id: 'monday',
        time_slot_id: 'slot-1',
        classroom_id: 'room-1',
        teacher_id: 'teacher-1',
        sub_id: 'sub-1',
      },
      {
        id: 'c',
        date: '2026-02-09',
        day_of_week_id: 'monday',
        time_slot_id: 'slot-2',
        classroom_id: 'room-1',
        teacher_id: 'teacher-1',
        sub_id: 'sub-2',
      },
    ])

    expect(deduped).toHaveLength(2)
    expect(deduped[0].id).toBe('b')
    expect(deduped[1].id).toBe('c')
  })

  it('dedupes flex assignments by staff id and keeps latest duplicate', () => {
    const deduped = dedupeFlexAssignmentsForSlot([
      {
        id: 'shift-1',
        staff_id: 'staff-1',
        event_id: 'event-1',
        school_id: 'school-1',
        date: '2026-02-09',
        day_of_week_id: 'monday',
        time_slot_id: 'slot-1',
        classroom_id: 'room-1',
        assignment_type: 'flex',
        status: 'scheduled',
      },
      {
        id: 'shift-2',
        staff_id: 'staff-1',
        event_id: 'event-2',
        school_id: 'school-1',
        date: '2026-02-10',
        day_of_week_id: 'tuesday',
        time_slot_id: 'slot-1',
        classroom_id: 'room-2',
        assignment_type: 'flex',
        status: 'scheduled',
      },
      {
        id: 'shift-3',
        staff_id: 'staff-2',
        event_id: 'event-3',
        school_id: 'school-1',
        date: '2026-02-09',
        day_of_week_id: 'monday',
        time_slot_id: 'slot-2',
        classroom_id: 'room-1',
        assignment_type: 'flex',
        status: 'scheduled',
      },
    ])

    expect(deduped).toHaveLength(2)
    expect(deduped[0].id).toBe('shift-2')
    expect(deduped[1].id).toBe('shift-3')
  })

  it('collects teacher ids assigned to a classroom from direct and sub assignments', () => {
    const teachers = getTeachersAssignedToClassroom({
      assignmentsForSlot: [
        { classroom_id: 'room-1', teacher_id: 'teacher-1' },
        { classroom_id: 'room-2', teacher_id: 'teacher-2' },
        { classroom_id: 'room-1', teacher_id: 'teacher-3' },
      ],
      uniqueSubsForSlot: [{ teacher_id: 'teacher-4' }, { teacher_id: 'teacher-1' }],
      classroomId: 'room-1',
    })

    expect(Array.from(teachers).sort()).toEqual(['teacher-1', 'teacher-3', 'teacher-4'])
  })

  it('falls back when non_sub_override column is missing and still returns sub assignments', async () => {
    const firstResult = {
      data: null,
      error: { code: '42703', message: 'column sub_assignments.non_sub_override does not exist' },
    }
    const secondResult = {
      data: [{ id: 'sa-1', teacher_id: 'teacher-1', sub_id: 'sub-1' }],
      error: null,
    }

    const selectMock = jest
      .fn()
      .mockImplementationOnce(() => {
        const chain: any = {
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockResolvedValue(firstResult),
        }
        return chain
      })
      .mockImplementationOnce(() => {
        const chain: any = {
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockResolvedValue(secondResult),
        }
        return chain
      })

    const fromMock = jest.fn().mockReturnValue({ select: selectMock })
    const supabase = { from: fromMock } as any

    const result = await fetchSubAssignmentsForRange({
      supabase,
      schoolId: 'school-1',
      startDateISO: '2026-03-16',
      endDateISO: '2026-03-22',
    })

    expect(fromMock).toHaveBeenCalledTimes(2)
    expect(selectMock).toHaveBeenCalledTimes(2)
    expect(String(selectMock.mock.calls[0][0])).toContain('non_sub_override')
    expect(String(selectMock.mock.calls[1][0])).not.toContain('non_sub_override')
    expect(result).toEqual(secondResult)
  })
})
