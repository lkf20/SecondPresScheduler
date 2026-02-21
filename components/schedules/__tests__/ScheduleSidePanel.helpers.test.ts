import {
  buildFindSubLink,
  buildStaffingSummary,
  buildFlexRemovalDialogCopy,
  calculateScheduledStaffCount,
  formatFlexWeekdayList,
  mapAssignmentsToTeachers,
  sortAbsencesByTeacherName,
  sortAssignmentsForPanel,
} from '@/components/schedules/ScheduleSidePanel'

describe('ScheduleSidePanel helpers', () => {
  it('maps assignments to unique non-substitute teachers', () => {
    const result = mapAssignmentsToTeachers([
      {
        id: 't-1a',
        teacher_id: 'teacher-1',
        teacher_name: 'Alice T.',
        classroom_id: 'class-1',
        classroom_name: 'Infant Room',
      },
      {
        id: 't-1b',
        teacher_id: 'teacher-1',
        teacher_name: 'Alice T.',
        classroom_id: 'class-2',
        classroom_name: 'Toddler Room',
      },
      {
        id: 'sub-1',
        teacher_id: 'sub-1',
        teacher_name: 'Sub A.',
        classroom_id: 'class-1',
        classroom_name: 'Infant Room',
        is_substitute: true,
      },
      {
        id: 'flex-1',
        teacher_id: 'teacher-2',
        teacher_name: 'Bella F.',
        classroom_id: 'class-1',
        classroom_name: 'Infant Room',
        is_floater: true,
      },
    ])

    expect(result).toEqual([
      {
        id: 'teacher-1',
        name: 'Alice T.',
        teacher_id: 'teacher-1',
        is_floater: false,
      },
      {
        id: 'teacher-2',
        name: 'Bella F.',
        teacher_id: 'teacher-2',
        is_floater: true,
      },
    ])
  })

  it('formats flex weekday list text for different lengths', () => {
    expect(formatFlexWeekdayList([])).toBe('')
    expect(formatFlexWeekdayList(['monday'])).toBe('mondays')
    expect(formatFlexWeekdayList(['monday', 'wednesday'])).toBe('mondays and wednesdays')
    expect(formatFlexWeekdayList(['monday', 'wednesday', 'friday'])).toBe(
      'mondays, wednesdays, and fridays'
    )
  })

  it('builds single-shift flex removal copy without extra options', () => {
    const copy = buildFlexRemovalDialogCopy({
      teacherName: 'Amy P.',
      classroomName: 'Infant Room',
      dayName: 'Monday',
      context: {
        start_date: '2026-02-09',
        end_date: '2026-02-09',
        weekdays: ['Monday'],
        matching_shift_count: 1,
      },
    })

    expect(copy.summary).toBe('Amy P. is assigned as flex staff to Infant Room on Monday, Feb 9.')
    expect(copy.showPrompt).toBe(false)
    expect(copy.showWeekdayOption).toBe(false)
  })

  it('builds multi-day flex removal copy with weekday option', () => {
    const copy = buildFlexRemovalDialogCopy({
      teacherName: 'Bella W.',
      classroomName: 'Infant Room',
      dayName: 'Monday',
      context: {
        start_date: '2026-01-01',
        end_date: '2026-03-01',
        weekdays: ['Monday', 'Wednesday', 'Friday'],
        matching_shift_count: 6,
      },
    })

    expect(copy.summary).toBe(
      'Bella W. is assigned as flex staff to Infant Room on Mondays, Wednesdays, and Fridays from Jan 1 to Mar 1.'
    )
    expect(copy.showPrompt).toBe(true)
    expect(copy.showWeekdayOption).toBe(true)
    expect(copy.weekdayScopeLabel).toBe('All Monday shifts')
  })

  it('calculates scheduled staff count from selected teachers in edit mode', () => {
    expect(
      calculateScheduledStaffCount({
        readOnly: false,
        selectedTeacherCount: 4,
      })
    ).toBe(4)
  })

  it('calculates unique scheduled staff count from assignments in read-only mode', () => {
    expect(
      calculateScheduledStaffCount({
        readOnly: true,
        selectedTeacherCount: 0,
        assignments: [
          {
            id: 'a-1',
            teacher_id: 'teacher-1',
            teacher_name: 'Teacher A.',
            classroom_id: 'class-1',
            classroom_name: 'Infant Room',
          },
          {
            id: 'a-1',
            teacher_id: 'teacher-1',
            teacher_name: 'Teacher A.',
            classroom_id: 'class-1',
            classroom_name: 'Infant Room',
          },
          {
            id: '',
            teacher_id: 'teacher-1',
            teacher_name: 'Teacher A.',
            classroom_id: 'class-1',
            classroom_name: 'Infant Room',
          },
          {
            id: '',
            teacher_id: 'teacher-1',
            teacher_name: 'Teacher A.',
            classroom_id: 'class-2',
            classroom_name: 'Toddler Room',
          },
          {
            id: '',
            teacher_id: 'teacher-1',
            teacher_name: 'Sub A.',
            classroom_id: 'class-2',
            classroom_name: 'Toddler Room',
            is_substitute: true,
          },
        ],
      })
    ).toBe(4)
  })

  it('builds staffing summary labels for required/preferred/adequate/no-target states', () => {
    expect(
      buildStaffingSummary({
        requiredTeachers: 3,
        preferredTeachers: 4,
        scheduledStaffCount: 2,
      })
    ).toEqual({
      status: 'below_required',
      label: 'Below Required by 1',
    })

    expect(
      buildStaffingSummary({
        requiredTeachers: 2,
        preferredTeachers: 4,
        scheduledStaffCount: 3,
      })
    ).toEqual({
      status: 'below_preferred',
      label: 'Below Preferred by 1',
    })

    expect(
      buildStaffingSummary({
        requiredTeachers: 2,
        preferredTeachers: 3,
        scheduledStaffCount: 3,
      })
    ).toEqual({
      status: 'adequate',
      label: 'On Target',
    })

    expect(
      buildStaffingSummary({
        scheduledStaffCount: 0,
      })
    ).toEqual({
      status: null,
      label: 'No staffing target',
    })
  })

  it('sorts absences alphabetically by teacher name', () => {
    expect(
      sortAbsencesByTeacherName([
        {
          teacher_id: 't-2',
          teacher_name: 'Zara T.',
          has_sub: false,
          is_partial: false,
        },
        {
          teacher_id: 't-1',
          teacher_name: 'Amy P.',
          has_sub: true,
          is_partial: true,
        },
      ])
    ).toEqual([
      {
        teacher_id: 't-1',
        teacher_name: 'Amy P.',
        has_sub: true,
        is_partial: true,
      },
      {
        teacher_id: 't-2',
        teacher_name: 'Zara T.',
        has_sub: false,
        is_partial: false,
      },
    ])
  })

  it('sorts assignments into permanent, flex, and floater groups', () => {
    const result = sortAssignmentsForPanel([
      {
        id: 'a-3',
        teacher_id: 'teacher-3',
        teacher_name: 'Floater A.',
        classroom_id: 'class-1',
        classroom_name: 'Infant Room',
        is_floater: true,
      },
      {
        id: 'a-1',
        teacher_id: 'teacher-1',
        teacher_name: 'Teacher Z.',
        classroom_id: 'class-1',
        classroom_name: 'Infant Room',
      },
      {
        id: 'a-2',
        teacher_id: 'teacher-2',
        teacher_name: 'Flex A.',
        classroom_id: 'class-1',
        classroom_name: 'Infant Room',
        is_flexible: true,
      },
      {
        id: 'a-sub',
        teacher_id: 'sub-1',
        teacher_name: 'Sub A.',
        classroom_id: 'class-1',
        classroom_name: 'Infant Room',
        is_substitute: true,
      },
    ])

    expect(result.permanentAssignments.map(a => a.teacher_name)).toEqual(['Teacher Z.'])
    expect(result.flexAssignments.map(a => a.teacher_name)).toEqual(['Flex A.'])
    expect(result.floaterAssignments.map(a => a.teacher_name)).toEqual(['Floater A.'])
  })

  it('builds sub finder links with absence, then teacher, then default fallback', () => {
    expect(
      buildFindSubLink({
        absences: [
          {
            teacher_id: 't-1',
            teacher_name: 'Amy P.',
            has_sub: false,
            is_partial: false,
            time_off_request_id: 'req-1',
          },
        ],
        assignments: [
          {
            id: 'a-1',
            teacher_id: 'teacher-1',
            teacher_name: 'Teacher A.',
            classroom_id: 'class-1',
            classroom_name: 'Infant Room',
          },
        ],
      })
    ).toBe('/sub-finder?absence_id=req-1')

    expect(
      buildFindSubLink({
        absences: [],
        assignments: [
          {
            id: 'a-1',
            teacher_id: 'teacher-1',
            teacher_name: 'Teacher A.',
            classroom_id: 'class-1',
            classroom_name: 'Infant Room',
          },
        ],
      })
    ).toBe('/sub-finder?teacher_id=teacher-1')

    expect(buildFindSubLink({ absences: [], assignments: [] })).toBe('/sub-finder')
  })
})
