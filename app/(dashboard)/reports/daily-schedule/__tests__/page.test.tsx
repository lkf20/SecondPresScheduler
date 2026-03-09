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
})
