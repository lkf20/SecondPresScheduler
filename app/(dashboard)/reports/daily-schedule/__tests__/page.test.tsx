import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import DailyScheduleReportPage from '@/app/(dashboard)/reports/daily-schedule/page'
import { useDailySchedule } from '@/lib/hooks/use-daily-schedule'

const replaceMock = jest.fn()
const openMock = jest.fn()
const toastMock = jest.fn() as jest.Mock & { error: jest.Mock }
toastMock.error = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => new URLSearchParams('date=2026-03-09'),
}))

jest.mock('sonner', () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}))

jest.mock('@/lib/hooks/use-daily-schedule', () => ({
  useDailySchedule: jest.fn(),
}))

jest.mock('@/components/ui/date-picker-input', () => {
  return function MockDatePickerInput({
    value,
    onChange,
  }: {
    value: string
    onChange: (value: string) => void
  }) {
    return (
      <input
        aria-label="Select date"
        value={value}
        onChange={event => onChange(event.target.value)}
      />
    )
  }
})

jest.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe("Today's Schedule report page", () => {
  const originalOpen = window.open

  beforeEach(() => {
    jest.clearAllMocks()
    window.open = openMock as any
    ;(useDailySchedule as jest.Mock).mockReturnValue({
      data: {
        date: '2026-03-09',
        day_of_week_id: 'day-mon',
        day_name: 'Monday',
        data: [
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
        ],
        school_closures: [],
        no_schedule: false,
      },
      isLoading: false,
      error: null,
    })
  })

  afterEach(() => {
    window.open = originalOpen
  })

  it('opens print pdf with expected default query params', async () => {
    openMock.mockReturnValue({} as Window)
    render(<DailyScheduleReportPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Print PDF' }))

    await waitFor(() => {
      expect(openMock).toHaveBeenCalledWith(
        '/api/reports/daily-schedule/pdf?date=2026-03-09&showAbsencesAndSubs=true&showEnrollment=false&showPreferredRatios=false&showRequiredRatios=false&colorFriendly=false&layout=one&teacherNameFormat=default&paperSize=letter',
        '_blank',
        'noopener,noreferrer'
      )
    })
  })

  it('renders closure reason when a slot is closed', async () => {
    ;(useDailySchedule as jest.Mock).mockReturnValue({
      data: {
        date: '2026-03-09',
        day_of_week_id: 'day-mon',
        day_name: 'Monday',
        data: [
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
        ],
        school_closures: [
          {
            id: 'closure-1',
            date: '2026-03-09',
            time_slot_id: 'slot-am',
            reason: 'Holiday',
          },
        ],
        no_schedule: false,
      },
      isLoading: false,
      error: null,
    })

    render(<DailyScheduleReportPage />)
    expect(await screen.findByText('School Closed')).toBeInTheDocument()
    expect(screen.getByText('Holiday')).toBeInTheDocument()
  })

  it('shows no-schedule message and disables print action', async () => {
    ;(useDailySchedule as jest.Mock).mockReturnValue({
      data: {
        date: '2026-03-08',
        day_of_week_id: null,
        day_name: null,
        data: [],
        school_closures: [],
        no_schedule: true,
        no_schedule_message:
          "No schedule is configured for this date. This day isn't included in your school's schedule.",
        next_scheduled_date: '2026-03-09',
        next_scheduled_day_name: 'Monday',
      },
      isLoading: false,
      error: null,
    })

    render(<DailyScheduleReportPage />)
    expect(
      await screen.findByText(
        "No schedule is configured for this date. This day isn't included in your school's schedule."
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Print PDF' })).toBeDisabled()
  })

  it('uses grayscale-only styling in schedule cells when Black & White mode is selected', async () => {
    ;(useDailySchedule as jest.Mock).mockReturnValue({
      data: {
        date: '2026-03-09',
        day_of_week_id: 'day-mon',
        day_name: 'Monday',
        data: [
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
                    assignments: [
                      {
                        id: 'assignment-regular',
                        teacher_id: 'teacher-regular',
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
                      {
                        id: 'assignment-flex',
                        teacher_id: 'teacher-flex',
                        teacher_name: 'Flex Teacher',
                        teacher_first_name: 'Flex',
                        teacher_last_name: 'Teacher',
                        teacher_display_name: 'Flex Teacher',
                        is_substitute: false,
                        is_floater: false,
                        is_flexible: true,
                        classroom_id: 'classroom-1',
                        classroom_name: 'Infant Room',
                      },
                      {
                        id: 'assignment-floater',
                        teacher_id: 'teacher-floater',
                        teacher_name: 'Floater Teacher',
                        teacher_first_name: 'Floater',
                        teacher_last_name: 'Teacher',
                        teacher_display_name: 'Floater Teacher',
                        is_substitute: false,
                        is_floater: true,
                        is_flexible: false,
                        classroom_id: 'classroom-1',
                        classroom_name: 'Infant Room',
                      },
                    ],
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
                    schedule_cell: null,
                  },
                ],
              },
            ],
          },
        ],
        school_closures: [],
        no_schedule: false,
      },
      isLoading: false,
      error: null,
    })

    const { container } = render(<DailyScheduleReportPage />)
    const table = await screen.findByRole('table')
    expect(table).toBeInTheDocument()

    // In Black & White mode (default), schedule cells should not use non-gray accent classes.
    const forbiddenColorSelectors = [
      '.text-blue-800',
      '.text-purple-700',
      '.text-teal-600',
      '.text-amber-700',
      '.text-orange-600',
      '.bg-amber-100',
    ]
    forbiddenColorSelectors.forEach(selector => {
      expect(container.querySelector(selector)).toBeNull()
    })

    // No-sub row should use grayscale styling in Black & White mode.
    const noSubBadge = screen.getByText('No sub')
    expect(noSubBadge.className).toContain('bg-slate-100')
    expect(noSubBadge.className).toContain('text-slate-600')
  })

  it('does not render enrollment text when Show enrollments is disabled', async () => {
    ;(useDailySchedule as jest.Mock).mockReturnValue({
      data: {
        date: '2026-03-09',
        day_of_week_id: 'day-mon',
        day_name: 'Monday',
        data: [
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
                    schedule_cell: {
                      id: 'cell-1',
                      is_active: true,
                      enrollment_for_staffing: 9,
                      notes: null,
                      required_staff_override: null,
                      preferred_staff_override: null,
                      class_groups: [
                        {
                          id: 'group-1',
                          name: 'Infants',
                          age_unit: 'years',
                          min_age: 0,
                          max_age: 1,
                          required_ratio: 4,
                          preferred_ratio: 5,
                          enrollment: 9,
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        ],
        school_closures: [],
        no_schedule: false,
      },
      isLoading: false,
      error: null,
    })

    render(<DailyScheduleReportPage />)
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.queryByText('Infants (9)')).not.toBeInTheDocument()
  })
})
