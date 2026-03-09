import { buildDailySchedulePdfHtml } from '@/lib/reports/daily-schedule-pdf'

describe('daily schedule pdf html', () => {
  const baseData = [
    {
      classroom_id: 'classroom-1',
      classroom_name: 'Infant Room',
      classroom_color: '#1d4ed8',
      classroom_is_active: true,
      days: [
        {
          day_of_week_id: 'day-mon',
          day_name: 'Monday',
          day_number: 1,
          time_slots: [
            {
              time_slot_id: 'slot-am',
              time_slot_code: 'AM',
              time_slot_name: 'School Morning',
              time_slot_display_order: 1,
              time_slot_start_time: '09:00:00',
              time_slot_end_time: '12:00:00',
              time_slot_is_active: true,
              assignments: [],
              absences: [],
              schedule_cell: null,
            },
          ],
        },
      ],
    },
    {
      classroom_id: 'classroom-2',
      classroom_name: 'Toddler Room',
      classroom_color: '#0f766e',
      classroom_is_active: true,
      days: [
        {
          day_of_week_id: 'day-mon',
          day_name: 'Monday',
          day_number: 1,
          time_slots: [
            {
              time_slot_id: 'slot-am',
              time_slot_code: 'AM',
              time_slot_name: 'School Morning',
              time_slot_display_order: 1,
              time_slot_start_time: '09:00:00',
              time_slot_end_time: '12:00:00',
              time_slot_is_active: true,
              assignments: [],
              absences: [],
              schedule_cell: null,
            },
          ],
        },
      ],
    },
  ] as any

  it('renders a merged school-closed row with reason', () => {
    const html = buildDailySchedulePdfHtml({
      dateISO: '2026-03-09',
      generatedAt: 'Mar 9, 2026, 9:00 AM',
      data: baseData,
      options: {
        showAbsencesAndSubs: true,
        showEnrollment: false,
        showPreferredRatios: false,
        showRequiredRatios: false,
        colorFriendly: true,
        layout: 'one',
        teacherNameFormat: 'default',
      },
      timeZone: 'America/New_York',
      schoolClosures: [{ date: '2026-03-09', time_slot_id: 'slot-am', reason: 'Holiday' }],
    })

    expect(html).toContain('School Closed')
    expect(html).toContain('Holiday')
    expect(html).toContain('colspan="2"')
  })

  it('uses medium font weight for time range and teacher lines', () => {
    const dataWithTeacher = [
      {
        ...baseData[0],
        days: [
          {
            ...baseData[0].days[0],
            time_slots: [
              {
                ...baseData[0].days[0].time_slots[0],
                assignments: [
                  {
                    id: 'assignment-1',
                    teacher_id: 'teacher-1',
                    teacher_name: 'Anne M.',
                    teacher_first_name: 'Anne',
                    teacher_last_name: 'M',
                    teacher_display_name: 'Anne M.',
                    is_substitute: false,
                    is_floater: false,
                    is_flexible: false,
                    classroom_id: 'classroom-1',
                    classroom_name: 'Infant Room',
                  },
                ],
              },
            ],
          },
        ],
      },
    ] as any

    const html = buildDailySchedulePdfHtml({
      dateISO: '2026-03-09',
      generatedAt: 'Mar 9, 2026, 9:00 AM',
      data: dataWithTeacher,
      options: {
        showAbsencesAndSubs: true,
        showEnrollment: false,
        showPreferredRatios: false,
        showRequiredRatios: false,
        colorFriendly: true,
        layout: 'one',
        teacherNameFormat: 'default',
      },
      timeZone: 'America/New_York',
      schoolClosures: [],
    })

    expect(html).toContain('font-size:11px; font-weight:500;')
    expect(html).toContain(
      'font-size:10px; font-weight:500; line-height:1.2; margin-bottom:1px;">Anne M.'
    )
  })

  it('renders enrollment and ratio summaries when enabled', () => {
    const dataWithMetrics = [
      {
        ...baseData[0],
        days: [
          {
            ...baseData[0].days[0],
            time_slots: [
              {
                ...baseData[0].days[0].time_slots[0],
                schedule_cell: {
                  id: 'cell-1',
                  is_active: true,
                  enrollment_for_staffing: 11,
                  notes: null,
                  required_staff_override: null,
                  preferred_staff_override: null,
                  class_groups: [
                    {
                      id: 'group-1',
                      name: 'Infants',
                      required_ratio: 4,
                      preferred_ratio: 5,
                      enrollment: 7,
                    },
                  ],
                },
                assignments: [],
              },
            ],
          },
        ],
      },
    ] as any

    const html = buildDailySchedulePdfHtml({
      dateISO: '2026-03-09',
      generatedAt: 'Mar 9, 2026, 9:00 AM',
      data: dataWithMetrics,
      options: {
        showAbsencesAndSubs: true,
        showEnrollment: true,
        showPreferredRatios: true,
        showRequiredRatios: true,
        colorFriendly: true,
        layout: 'one',
        teacherNameFormat: 'default',
      },
      timeZone: 'America/New_York',
      schoolClosures: [],
    })

    expect(html).toContain('Infants (7)')
    expect(html).toContain('1:4 (R) 1:5 (P)')
  })

  it('uses only grayscale tones for schedule content in black-and-white mode', () => {
    const dataWithNoSub = [
      {
        ...baseData[0],
        days: [
          {
            ...baseData[0].days[0],
            time_slots: [
              {
                ...baseData[0].days[0].time_slots[0],
                assignments: [],
                absences: [
                  {
                    teacher_id: 'teacher-absent',
                    teacher_name: 'Absent Teacher',
                    teacher_first_name: 'Absent',
                    teacher_last_name: 'Teacher',
                    teacher_display_name: 'Absent Teacher',
                    has_sub: false,
                    is_partial: false,
                  },
                ],
              },
            ],
          },
        ],
      },
    ] as any

    const html = buildDailySchedulePdfHtml({
      dateISO: '2026-03-09',
      generatedAt: 'Mar 9, 2026, 9:00 AM',
      data: dataWithNoSub,
      options: {
        showAbsencesAndSubs: true,
        showEnrollment: false,
        showPreferredRatios: false,
        showRequiredRatios: false,
        colorFriendly: false,
        layout: 'one',
        teacherNameFormat: 'default',
      },
      timeZone: 'America/New_York',
      schoolClosures: [],
    })

    // No-sub styling in B&W mode should be grayscale.
    expect(html).toContain('background:#F1F5F9')
    expect(html).toContain('color:#475569')

    // Ensure amber/yellow no-sub highlight colors are not used in B&W output.
    expect(html).not.toContain('#FEF3C7')
    expect(html).not.toContain('#92400E')
    expect(html).not.toContain('#B45309')
  })
})
