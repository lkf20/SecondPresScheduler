import {
  buildSelectedCellSnapshot,
  calculateAssignmentCounts,
  extractDaysAndTimeSlots,
  generateClassroomsXDaysGridTemplate,
  generateDaysXClassroomsGridTemplate,
  hexToRgba,
  resolveTimeSlotPresentation,
} from '@/components/schedules/WeeklyScheduleGridNew'
import type { WeeklyScheduleDataByClassroom } from '@/lib/api/weekly-schedule'

describe('WeeklyScheduleGridNew helpers', () => {
  it('converts hex colors to rgba values', () => {
    expect(hexToRgba('#4A90E2', 0.5)).toBe('rgba(74, 144, 226, 0.5)')
    expect(hexToRgba('112233')).toBe('rgba(17, 34, 51, 0.08)')
  })

  it('builds grid template for days x classrooms layout', () => {
    const result = generateDaysXClassroomsGridTemplate(
      2,
      [
        { id: 'day-1', name: 'Monday', number: 1 },
        { id: 'day-2', name: 'Tuesday', number: 2 },
      ],
      [
        { id: 'slot-1', code: 'AM' },
        { id: 'slot-2', code: 'MID' },
      ]
    )

    expect(result.columns).toBe('120px repeat(2, minmax(230px, 1fr))')
    expect(result.rows).toBe(
      'auto 36px minmax(120px, auto) minmax(120px, auto) 16px 36px minmax(120px, auto) minmax(120px, auto)'
    )
  })

  it('builds grid template for classrooms x days layout', () => {
    const result = generateClassroomsXDaysGridTemplate(3, 2)

    expect(result.columns).toBe(
      '110px repeat(2, minmax(230px, 1fr)) repeat(2, minmax(230px, 1fr)) repeat(2, minmax(230px, 1fr))'
    )
    expect(result.rows).toBe('auto auto repeat(auto, minmax(120px, auto))')
  })

  it('uses zero-row template when there are no selected days', () => {
    const result = generateClassroomsXDaysGridTemplate(0, 2)

    expect(result.columns).toBe('110px ')
    expect(result.rows).toBe('auto auto repeat(0, minmax(120px, auto))')
  })

  it('calculates assignment counts for chips and coverage issues', () => {
    const data: WeeklyScheduleDataByClassroom[] = [
      {
        classroom_id: 'class-1',
        classroom_name: 'Infant Room',
        classroom_color: '#00AEEF',
        days: [
          {
            day_of_week_id: 'day-mon',
            day_name: 'Monday',
            day_number: 1,
            time_slots: [
              {
                time_slot_id: 'slot-am',
                time_slot_code: 'AM',
                time_slot_name: 'Morning',
                time_slot_display_order: 1,
                time_slot_start_time: null,
                time_slot_end_time: null,
                assignments: [
                  {
                    id: 'a-1',
                    teacher_id: 'teacher-1',
                    teacher_name: 'Teacher A.',
                    classroom_id: 'class-1',
                    classroom_name: 'Infant Room',
                  },
                  {
                    id: 'a-2',
                    teacher_id: 'sub-1',
                    teacher_name: 'Sub A.',
                    classroom_id: 'class-1',
                    classroom_name: 'Infant Room',
                    is_substitute: true,
                  },
                ],
                absences: [
                  {
                    teacher_id: 'teacher-2',
                    teacher_name: 'Teacher B.',
                    has_sub: true,
                    is_partial: false,
                  },
                ],
                schedule_cell: {
                  id: 'cell-1',
                  is_active: true,
                  enrollment_for_staffing: 9,
                  notes: null,
                  class_groups: [
                    {
                      id: 'cg-1',
                      name: 'Infant A',
                      min_age: 1,
                      max_age: 2,
                      required_ratio: 4,
                      preferred_ratio: 3,
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ]

    expect(calculateAssignmentCounts(data)).toEqual({
      all: 2,
      subs: 1,
      permanent: 2,
      coverageIssues: 1,
      absences: 1,
    })
  })

  it('extracts sorted days and time slots for selected days only', () => {
    const data: WeeklyScheduleDataByClassroom[] = [
      {
        classroom_id: 'class-1',
        classroom_name: 'Infant Room',
        classroom_color: null,
        days: [
          {
            day_of_week_id: 'day-sun',
            day_name: 'Sunday',
            day_number: 0,
            time_slots: [
              {
                time_slot_id: 'slot-2',
                time_slot_code: 'PM',
                time_slot_name: 'PM',
                time_slot_display_order: 2,
                time_slot_start_time: null,
                time_slot_end_time: null,
                assignments: [],
                schedule_cell: null,
              },
            ],
          },
          {
            day_of_week_id: 'day-mon',
            day_name: 'Monday',
            day_number: 1,
            time_slots: [
              {
                time_slot_id: 'slot-1',
                time_slot_code: 'AM',
                time_slot_name: 'AM',
                time_slot_display_order: 1,
                time_slot_start_time: null,
                time_slot_end_time: null,
                assignments: [],
                schedule_cell: null,
              },
            ],
          },
        ],
      },
    ]

    const result = extractDaysAndTimeSlots(data, ['day-mon', 'day-sun'])

    expect(result.days.map(day => day.id)).toEqual(['day-mon', 'day-sun'])
    expect(result.timeSlots.map(slot => slot.id)).toEqual(['slot-1', 'slot-2'])
  })

  it('resolves time slot presentation from metadata with fallback to slot code', () => {
    const data: WeeklyScheduleDataByClassroom[] = [
      {
        classroom_id: 'class-1',
        classroom_name: 'Infant Room',
        classroom_color: null,
        days: [
          {
            day_of_week_id: 'day-mon',
            day_name: 'Monday',
            day_number: 1,
            time_slots: [
              {
                time_slot_id: 'slot-1',
                time_slot_code: 'EM',
                time_slot_name: 'Early Morning',
                time_slot_display_order: 1,
                time_slot_start_time: null,
                time_slot_end_time: null,
                assignments: [],
                schedule_cell: null,
              },
            ],
          },
        ],
      },
    ]

    expect(
      resolveTimeSlotPresentation({
        timeSlots: [
          {
            id: 'slot-1',
            code: 'EM',
            name: null,
            default_start_time: '07:30',
            default_end_time: '09:30',
            display_order: 1,
          },
        ],
        data,
        timeSlotId: 'slot-1',
      })
    ).toEqual({
      code: 'EM',
      name: 'Early Morning',
      startTime: '07:30',
      endTime: '09:30',
    })
  })

  it('builds selected cell snapshot and returns undefined for missing cells', () => {
    const data: WeeklyScheduleDataByClassroom[] = [
      {
        classroom_id: 'class-1',
        classroom_name: 'Infant Room',
        classroom_color: null,
        days: [
          {
            day_of_week_id: 'day-mon',
            day_name: 'Monday',
            day_number: 1,
            time_slots: [
              {
                time_slot_id: 'slot-1',
                time_slot_code: 'EM',
                time_slot_name: 'Early Morning',
                time_slot_display_order: 1,
                time_slot_start_time: null,
                time_slot_end_time: null,
                assignments: [
                  {
                    id: 'a-1',
                    teacher_id: 'teacher-1',
                    teacher_name: 'Teacher A',
                    classroom_id: 'class-1',
                    classroom_name: 'Infant Room',
                  },
                ],
                absences: [],
                schedule_cell: {
                  id: 'cell-1',
                  is_active: true,
                  enrollment_for_staffing: 8,
                  notes: null,
                  class_groups: [],
                },
              },
            ],
          },
        ],
      },
    ]

    expect(
      buildSelectedCellSnapshot(data, {
        dayId: 'day-mon',
        classroomId: 'class-1',
        timeSlotId: 'slot-1',
      })
    ).toMatchObject({
      day_of_week_id: 'day-mon',
      time_slot_id: 'slot-1',
      time_slot_code: 'EM',
      assignments: [{ teacher_id: 'teacher-1' }],
    })

    expect(
      buildSelectedCellSnapshot(data, {
        dayId: 'day-tue',
        classroomId: 'class-1',
        timeSlotId: 'slot-1',
      })
    ).toBeUndefined()
  })
})
