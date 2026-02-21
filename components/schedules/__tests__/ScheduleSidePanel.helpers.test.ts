import {
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
})
