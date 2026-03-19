import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import DailyScheduleReportPage from '@/app/(dashboard)/reports/daily-schedule/page'
import { useDailySchedule } from '@/lib/hooks/use-daily-schedule'

const replaceMock = jest.fn()
const openMock = jest.fn()
const fetchMock = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => new URLSearchParams('date=2026-03-09'),
}))

jest.mock('sonner', () => {
  const toast = jest.fn() as jest.Mock & { error: jest.Mock; success: jest.Mock }
  toast.error = jest.fn()
  toast.success = jest.fn()
  return { toast }
})

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

jest.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const { toast: toastMock } = jest.requireMock('sonner') as {
  toast: jest.Mock & { error: jest.Mock; success: jest.Mock }
}

describe("Today's Schedule report page", () => {
  const originalOpen = window.open
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.clearAllMocks()
    window.open = openMock as any
    global.fetch = fetchMock as any
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        top_header_html: '',
        footer_notes_html: '',
      }),
    })
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
    global.fetch = originalFetch
  })

  it('opens print pdf with expected default query params', async () => {
    openMock.mockReturnValue({} as Window)
    render(<DailyScheduleReportPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Print PDF' }))

    await waitFor(() => {
      expect(openMock).toHaveBeenCalledWith(
        '/api/reports/daily-schedule/pdf?date=2026-03-09&showAbsencesAndSubs=true&showEnrollment=false&showNotes=false&showPreferredRatios=false&showRequiredRatios=false&colorFriendly=true&layout=one&teacherNameFormat=default&paperSize=letter',
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
                        id: 'assignment-temp',
                        teacher_id: 'teacher-temp',
                        teacher_name: 'Temp Cover Teacher',
                        teacher_first_name: 'Temp',
                        teacher_last_name: 'Teacher',
                        teacher_display_name: 'Temp Cover Teacher',
                        is_substitute: false,
                        is_floater: false,
                        is_flexible: true,
                        staffing_event_id: 'event-temp-1',
                        event_category: 'standard',
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
    expect(screen.getByText('Temporary Coverage')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Black & White' }))

    // In Black & White mode, schedule cells should not use non-gray accent classes.
    const reportContainer = container.querySelector('.daily-report-print-area') || container
    const forbiddenColorSelectors = [
      '.text-blue-800',
      '.text-purple-700',
      '.text-rose-700',
      '.text-teal-600',
      '.text-amber-700',
      '.text-orange-600',
      '.bg-amber-100',
    ]
    forbiddenColorSelectors.forEach(selector => {
      expect(reportContainer.querySelector(selector)).toBeNull()
    })

    // No-sub row should use grayscale styling in Black & White mode.
    const noSubBadge = screen.getByText('No sub')
    expect(noSubBadge.className).toContain('bg-slate-100')
    expect(noSubBadge.className).toContain('text-slate-600')
    expect(screen.getByText('Temp Cover Teacher')).toBeInTheDocument()
    const bwText = (reportContainer.textContent || '').split('◇')
    expect(bwText.length).toBeGreaterThanOrEqual(3)
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

  it('renders notes only when Show notes is enabled and includes showNotes in PDF url', async () => {
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
                      enrollment_for_staffing: null,
                      notes: 'Bring nap mats from storage',
                      required_staff_override: null,
                      preferred_staff_override: null,
                      class_groups: [],
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
    openMock.mockReturnValue({} as Window)

    render(<DailyScheduleReportPage />)
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.queryByText('Bring nap mats from storage')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Show notes' }))
    expect(screen.getByText('Bring nap mats from storage')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Print PDF' }))
    await waitFor(() => {
      expect(openMock).toHaveBeenCalledWith(
        expect.stringContaining('showNotes=true'),
        '_blank',
        'noopener,noreferrer'
      )
    })
  })

  it('includes rich text header/footer params in PDF url when editors have content', async () => {
    openMock.mockReturnValue({} as Window)
    const { container } = render(<DailyScheduleReportPage />)
    const editors = Array.from(container.querySelectorAll('div[contenteditable="true"]'))
    expect(editors).toHaveLength(2)
    editors[0].innerHTML = '<div>Top Header</div>'
    fireEvent.input(editors[0])
    editors[1].innerHTML = '<div>Bottom Footer</div>'
    fireEvent.input(editors[1])

    fireEvent.click(screen.getByRole('button', { name: 'Print PDF' }))

    await waitFor(() => {
      const openedUrl = openMock.mock.calls[0]?.[0] as string
      expect(openedUrl).toContain('topHeaderHtml=')
      expect(openedUrl).toContain('footerNotesHtml=')
    })
  })

  it('saves default top and footer content independently', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ top_header_html: '', footer_notes_html: '' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ top_header_html: '<div>Top Header (saved)</div>' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ footer_notes_html: '<div>Bottom Footer (saved)</div>' }),
      })

    const { container } = render(<DailyScheduleReportPage />)
    const editors = Array.from(container.querySelectorAll('div[contenteditable="true"]'))
    expect(editors).toHaveLength(2)
    editors[0].innerHTML = '<div>Top Header</div>'
    fireEvent.input(editors[0])
    editors[1].innerHTML = '<div>Bottom Footer</div>'
    fireEvent.input(editors[1])

    fireEvent.click(screen.getByRole('button', { name: 'Save as default header' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save as default footer' }))

    await waitFor(() => {
      const putCalls = fetchMock.mock.calls.filter(
        call => call[0] === '/api/reports/daily-schedule/defaults' && call[1]?.method === 'PUT'
      )
      expect(putCalls.length).toBeGreaterThanOrEqual(2)
      const putBodies = putCalls.map(call => String(call[1]?.body || ''))
      expect(putBodies).toContain(JSON.stringify({ top_header_html: '<div>Top Header</div>' }))
      expect(putBodies).toContain(JSON.stringify({ footer_notes_html: '<div>Bottom Footer</div>' }))
    })

    await waitFor(() => {
      expect(editors[0].innerHTML).toContain('Top Header (saved)')
      expect(editors[1].innerHTML).toContain('Bottom Footer (saved)')
    })
  })

  it('does not overwrite user edits when defaults resolve late', async () => {
    let resolveDefaults: ((value: any) => void) | null = null
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/reports/daily-schedule/defaults') && !init?.method) {
        return new Promise(resolve => {
          resolveDefaults = resolve
        })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      })
    })

    const { container } = render(<DailyScheduleReportPage />)
    const editors = Array.from(container.querySelectorAll('div[contenteditable="true"]'))
    expect(editors).toHaveLength(2)

    editors[0].innerHTML = '<div>User Header</div>'
    fireEvent.input(editors[0])

    resolveDefaults?.({
      ok: true,
      json: async () => ({
        top_header_html: '<div>Server Header</div>',
        footer_notes_html: '<div>Server Footer</div>',
      }),
    })

    await waitFor(() => {
      expect(editors[0].innerHTML).toContain('User Header')
    })
  })

  it('does not show non-sub override tooltip indicator in non-print view', async () => {
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
                        id: 'sub-assign-1',
                        teacher_id: 'staff-override',
                        teacher_name: 'Dana D.',
                        teacher_first_name: 'Dana',
                        teacher_last_name: 'D',
                        teacher_display_name: 'Dana D.',
                        is_substitute: true,
                        non_sub_override: true,
                        is_floater: false,
                        is_flexible: false,
                        absent_teacher_id: 'teacher-1',
                        classroom_id: 'classroom-1',
                        classroom_name: 'Infant Room',
                      },
                    ],
                    absences: [
                      {
                        teacher_id: 'teacher-1',
                        teacher_name: 'Sally A.',
                        teacher_first_name: 'Sally',
                        teacher_last_name: 'A',
                        teacher_display_name: 'Sally A.',
                        has_sub: true,
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

    render(<DailyScheduleReportPage />)
    expect(await screen.findByText('Dana D.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Non-sub staff override')).not.toBeInTheDocument()
  })

  it('shows Reassigned legend and renders reassigned staff as Name *', async () => {
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
                    absences: [
                      {
                        teacher_id: 'teacher-reassigned',
                        teacher_name: 'Jenn S.',
                        teacher_first_name: 'Jenn',
                        teacher_last_name: 'S',
                        teacher_display_name: 'Jenn S.',
                        has_sub: true,
                        is_partial: false,
                        is_reassigned: true,
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

    render(<DailyScheduleReportPage />)
    expect(await screen.findByText('Reassigned')).toBeInTheDocument()
    const reassignedName = screen.getByText('Jenn S.')
    const reassignedRow = reassignedName.closest('span')?.parentElement
    expect(reassignedName).toBeInTheDocument()
    expect(reassignedRow).toBeTruthy()
    expect(reassignedRow).toHaveTextContent('Jenn S. *')
    expect(reassignedName).toHaveClass('line-through')
    expect(reassignedRow).not.toHaveClass('line-through')
  })
})
