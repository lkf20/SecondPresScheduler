import {
  buildFindSubLink,
  buildStaffingSummary,
  buildStaffingWarningMessage,
  buildFlexRemovalDialogCopy,
  calculateDayNameDate,
  calculateScheduledStaffCount,
  calculateTeacherTargets,
  formatDayNameDateLabel,
  formatFlexWeekdayList,
  formatTimeRange,
  getTotalEnrollmentForCalculation,
  mapAssignmentsToTeachers,
  pickClassGroupForRatio,
  sortAbsencesByTeacherName,
  sortAssignmentsForPanel,
  sortClassGroupsBySettingsOrder,
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
        is_flexible: false,
      },
      {
        id: 'teacher-2',
        name: 'Bella F.',
        teacher_id: 'teacher-2',
        is_floater: true,
        is_flexible: false,
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

    expect(copy.summary).toBe(
      'Amy P. is assigned for temporary coverage to Infant Room on Monday, Feb 9.'
    )
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
      'Bella W. is assigned for temporary coverage to Infant Room on Mondays, Wednesdays, and Fridays from Jan 1 to Mar 1.'
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
        requiredTeachers: 2,
        preferredTeachers: 3,
        scheduledStaffCount: 4,
      })
    ).toEqual({
      status: 'above_target',
      label: 'Above Target',
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

  it('sorts assignments into permanent, baseline flex, temporary coverage, and floater groups', () => {
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
        id: 'a-temp',
        teacher_id: 'teacher-4',
        teacher_name: 'Temp Cover B.',
        classroom_id: 'class-1',
        classroom_name: 'Infant Room',
        is_flexible: true,
        staffing_event_id: 'event-1',
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
    expect(result.baselineFlexAssignments.map(a => a.teacher_name)).toEqual(['Flex A.'])
    expect(result.temporaryCoverageAssignments.map(a => a.teacher_name)).toEqual(['Temp Cover B.'])
    expect(result.floaterAssignments.map(a => a.teacher_name)).toEqual(['Floater A.'])
  })

  it('sorts class groups by settings order then name', () => {
    const groups = [
      { id: 'cg-2', name: 'Toddlers', order: 2 },
      { id: 'cg-1', name: 'Infants', order: 1 },
      { id: 'cg-3', name: 'Preschool', order: 3 },
    ]
    expect(sortClassGroupsBySettingsOrder(groups).map(g => g.name)).toEqual([
      'Infants',
      'Toddlers',
      'Preschool',
    ])
    const withNullOrder = [
      { id: 'cg-a', name: 'Alpha', order: null },
      { id: 'cg-b', name: 'Beta', order: 1 },
    ]
    expect(sortClassGroupsBySettingsOrder(withNullOrder).map(g => g.name)).toEqual([
      'Beta',
      'Alpha',
    ])
    const sameOrder = [
      { id: 'cg-1', name: 'Zebra', order: 1 },
      { id: 'cg-2', name: 'Alpha', order: 1 },
    ]
    expect(sortClassGroupsBySettingsOrder(sameOrder).map(g => g.name)).toEqual(['Alpha', 'Zebra'])
  })

  it('builds staffing warning message (actionable only; no status prefix)', () => {
    const staffingSummary = (status: string) => ({ status, label: '' })

    expect(
      buildStaffingWarningMessage({
        staffingSummary: staffingSummary('below_required'),
        requiredTeachers: 3,
        preferredTeachers: 4,
        scheduledStaffCount: 1,
        absences: [{ teacher_name: 'Bella W.', has_sub: false }],
      })
    ).toEqual({
      message:
        'Assign subs for uncovered absences or assign extra coverage to meet required target.',
      status: 'below_required',
    })

    expect(
      buildStaffingWarningMessage({
        staffingSummary: staffingSummary('below_required'),
        requiredTeachers: 2,
        preferredTeachers: 3,
        scheduledStaffCount: 1,
        absences: [],
      })
    ).toEqual({
      message: 'Assign extra coverage to meet required target.',
      status: 'below_required',
    })

    expect(
      buildStaffingWarningMessage({
        staffingSummary: staffingSummary('below_preferred'),
        requiredTeachers: 2,
        preferredTeachers: 4,
        scheduledStaffCount: 2,
        absences: [{ teacher_name: 'Joe', has_sub: false }],
      })
    ).toEqual({
      message:
        'Assign subs for uncovered absences or assign extra coverage to meet preferred target.',
      status: 'below_preferred',
    })

    expect(
      buildStaffingWarningMessage({
        staffingSummary: staffingSummary('below_preferred'),
        requiredTeachers: 2,
        preferredTeachers: 4,
        scheduledStaffCount: 2,
        absences: [{ teacher_name: 'Jane', has_sub: true }],
      })
    ).toEqual({
      message: 'Assign extra coverage to meet preferred target.',
      status: 'below_preferred',
    })

    expect(
      buildStaffingWarningMessage({
        staffingSummary: staffingSummary('adequate'),
        requiredTeachers: 2,
        preferredTeachers: 4,
        scheduledStaffCount: 4,
        absences: [],
      })
    ).toBeNull()

    expect(
      buildStaffingWarningMessage({
        staffingSummary: staffingSummary('above_target'),
        requiredTeachers: 2,
        preferredTeachers: 4,
        scheduledStaffCount: 5,
        absences: [],
      })
    ).toEqual({
      message: 'Extra coverage available to be re-assigned to another slot if needed.',
      status: 'above_target',
    })

    expect(
      buildStaffingWarningMessage({
        staffingSummary: { status: null, label: 'No staffing target' },
        requiredTeachers: undefined,
        preferredTeachers: undefined,
        scheduledStaffCount: 0,
        absences: [],
      })
    ).toBeNull()
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

  it('builds sub finder link with cellDateISO for manual mode (primary teacher, no absence)', () => {
    const link = buildFindSubLink({
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
      cellDateISO: '2026-03-15',
    })
    expect(link.startsWith('/sub-finder?')).toBe(true)
    const params = new URLSearchParams(link.split('?')[1] ?? '')
    expect(params.get('mode')).toBe('manual')
    expect(params.get('teacher_id')).toBe('teacher-1')
    expect(params.get('start_date')).toBe('2026-03-15')
    expect(params.get('end_date')).toBe('2026-03-15')
  })

  it('builds sub finder link without manual params when cellDateISO is empty', () => {
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
        cellDateISO: '',
      })
    ).toBe('/sub-finder?teacher_id=teacher-1')
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
        cellDateISO: null,
      })
    ).toBe('/sub-finder?teacher_id=teacher-1')
  })

  it('formats panel time range safely with missing values', () => {
    expect(formatTimeRange('08:00', '12:00')).toBe('08:00–12:00')
    expect(formatTimeRange('08:00', null)).toBe('')
    expect(formatTimeRange(null, '12:00')).toBe('')
  })

  it('calculates and formats day-name date labels from week start', () => {
    expect(calculateDayNameDate('2026-02-09', 3)).toBe('2026-02-11')
    expect(calculateDayNameDate(undefined, 3)).toBe('')
    expect(formatDayNameDateLabel('2026-02-11')).toBe('Feb 11')
    expect(formatDayNameDateLabel('')).toBe('')
    expect(formatDayNameDateLabel('not-a-date')).toBe('')
  })

  it('picks the youngest class group and calculates teacher targets', () => {
    const ratioGroup = pickClassGroupForRatio([
      { min_age: 3, required_ratio: 8, preferred_ratio: 6 },
      { min_age: 1, required_ratio: 4, preferred_ratio: 3 },
      { min_age: null, required_ratio: 5, preferred_ratio: 4 },
    ])

    expect(ratioGroup).toEqual({
      min_age: 1,
      required_ratio: 4,
      preferred_ratio: 3,
    })

    expect(
      calculateTeacherTargets({
        classGroupForRatio: ratioGroup,
        enrollmentForCalculation: 9,
      })
    ).toEqual({
      requiredTeachers: 3,
      preferredTeachers: 3,
    })

    expect(
      calculateTeacherTargets({
        classGroupForRatio: null,
        enrollmentForCalculation: 9,
      })
    ).toEqual({
      requiredTeachers: undefined,
      preferredTeachers: undefined,
    })
  })

  describe('getTotalEnrollmentForCalculation', () => {
    it('returns sum of per-class enrollment when any class group has enrollment set', () => {
      expect(
        getTotalEnrollmentForCalculation(
          [
            { id: 'cg-1', name: 'Toddler A', enrollment: 3 },
            { id: 'cg-2', name: 'Toddler B', enrollment: 2 },
          ],
          null
        )
      ).toBe(5)

      expect(
        getTotalEnrollmentForCalculation([{ id: 'cg-1', name: 'Toddler A', enrollment: 10 }], 8)
      ).toBe(10)
    })

    it('returns fallback when no class group has enrollment set', () => {
      expect(
        getTotalEnrollmentForCalculation(
          [
            { id: 'cg-1', name: 'Toddler A', enrollment: null },
            { id: 'cg-2', name: 'Toddler B' },
          ],
          10
        )
      ).toBe(10)

      expect(getTotalEnrollmentForCalculation([], null)).toBe(null)
    })

    it('treats zero enrollment as set (uses sum)', () => {
      expect(
        getTotalEnrollmentForCalculation(
          [
            { id: 'cg-1', name: 'Toddler A', enrollment: 0 },
            { id: 'cg-2', name: 'Toddler B', enrollment: 5 },
          ],
          10
        )
      ).toBe(5)
    })
  })
})
