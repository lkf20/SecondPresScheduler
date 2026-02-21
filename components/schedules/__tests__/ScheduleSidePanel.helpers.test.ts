import {
  buildFlexRemovalDialogCopy,
  formatFlexWeekdayList,
  mapAssignmentsToTeachers,
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
})
