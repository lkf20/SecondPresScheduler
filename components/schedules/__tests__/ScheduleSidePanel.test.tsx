/* eslint-disable react/display-name */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ScheduleSidePanel from '@/components/schedules/ScheduleSidePanel'

const pushMock = jest.fn()
const toastSuccessMock = jest.fn()
const toastErrorMock = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: jest.fn(),
  }),
}))

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}))

jest.mock('@/lib/hooks/use-display-name-format', () => ({
  useDisplayNameFormat: () => ({ format: 'first_last_initial' }),
}))

jest.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
  }) => (
    <button type={type || 'button'} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}))

jest.mock('@/components/ui/checkbox', () => ({
  Checkbox: () => <input type="checkbox" />,
}))

jest.mock('@/components/ui/radio-group', () => ({
  RadioGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  RadioGroupItem: ({ id, value }: { id: string; value: string }) => (
    <input id={id} value={value} type="radio" readOnly />
  ),
}))

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}))

jest.mock('@/components/ui/textarea', () => ({
  Textarea: () => <textarea />,
}))

jest.mock('@/components/ui/date-picker-input', () => () => <input />)

jest.mock('@/components/time-off/TimeOffForm', () => () => <div>TimeOffForm</div>)
jest.mock('@/components/schedules/SlotStatusToggle', () => () => <div>SlotStatusToggle</div>)
jest.mock('@/components/settings/ClassSelector', () => () => <div>ClassSelector</div>)
jest.mock('@/components/schedules/EnrollmentInput', () => () => <div>EnrollmentInput</div>)
jest.mock('@/components/schedules/TeacherMultiSelect', () => () => <div>TeacherMultiSelect</div>)
jest.mock('@/components/schedules/MultiDayApplySelector', () => ({
  __esModule: true,
  default: ({ disabled }: { disabled?: boolean }) => (
    <div data-testid="multi-day-apply" data-disabled={disabled ? 'true' : 'false'}>
      MultiDayApplySelector
    </div>
  ),
}))
jest.mock('@/components/schedules/UnsavedChangesDialog', () => () => null)
jest.mock('@/components/schedules/ConflictBanner', () => () => <div>ConflictBanner</div>)

const originalFetch = global.fetch

const setupFetch = (removeContext: {
  start_date: string
  end_date: string
  weekdays: string[]
  matching_shift_count: number
}) => {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input)

    if (url.includes('/api/timeslots')) {
      return {
        ok: true,
        json: async () => [{ id: 'slot-1', code: 'EM', name: 'Early Morning' }],
      } as Response
    }
    if (url.includes('/api/classrooms')) {
      return {
        ok: true,
        json: async () => [{ id: 'class-1', allowed_classes: [] }],
      } as Response
    }
    if (url.includes('/api/class-groups?includeInactive=true')) {
      return {
        ok: true,
        json: async () => [],
      } as Response
    }
    if (url.includes('/api/teacher-schedules')) {
      return {
        ok: true,
        json: async () => [],
      } as Response
    }
    if (url.includes('/api/staffing-events/flex/remove?')) {
      return {
        ok: true,
        json: async () => removeContext,
      } as Response
    }
    if (url.includes('/api/schedule-cells?')) {
      return {
        ok: true,
        json: async () => [],
      } as Response
    }
    if (url.includes('/api/dashboard/slot-run?')) {
      return {
        ok: true,
        json: async () => ({
          belowTarget: true,
          dateStart: '2026-03-09',
          dateEnd: '2026-05-11',
          weeksLabel: '9 weeks',
          targetType: 'required',
        }),
      } as Response
    }
    return {
      ok: true,
      json: async () => ({}),
    } as Response
  }) as jest.Mock
}

const buildProps = () => ({
  isOpen: true,
  onClose: jest.fn(),
  dayId: 'day-1',
  dayName: 'Monday',
  timeSlotId: 'slot-1',
  timeSlotName: 'Early Morning',
  timeSlotCode: 'EM',
  timeSlotStartTime: '08:00',
  timeSlotEndTime: '10:00',
  classroomId: 'class-1',
  classroomName: 'Infant Room',
  selectedDayIds: ['day-1'],
  weekStartISO: '2026-02-09',
  readOnly: true,
  selectedCellData: {
    day_of_week_id: 'day-1',
    day_name: 'Monday',
    day_number: 1,
    time_slot_id: 'slot-1',
    time_slot_code: 'EM',
    time_slot_name: 'Early Morning',
    time_slot_display_order: 1,
    assignments: [
      {
        id: 'a-1',
        teacher_id: 'teacher-1',
        teacher_name: 'Bella W.',
        classroom_id: 'class-1',
        classroom_name: 'Infant Room',
      },
      {
        id: 'a-flex',
        teacher_id: 'teacher-2',
        teacher_name: 'Amy P.',
        classroom_id: 'class-1',
        classroom_name: 'Infant Room',
        is_flexible: true,
        staffing_event_id: 'event-1',
      },
    ],
    schedule_cell: {
      id: 'cell-1',
      is_active: true,
      enrollment_for_staffing: 8,
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
    absences: [],
  },
})

describe('ScheduleSidePanel interactions', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('opens remove flex dialog and shows multi-shift choices', async () => {
    setupFetch({
      start_date: '2026-01-01',
      end_date: '2026-03-01',
      weekdays: ['Monday', 'Wednesday', 'Friday'],
      matching_shift_count: 6,
    })

    render(<ScheduleSidePanel {...buildProps()} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }))

    await screen.findByText('Remove temporary coverage?')
    expect(
      screen.getByText(/Amy P. is assigned for temporary coverage to Infant Room/i)
    ).toBeInTheDocument()
    expect(screen.getByText('This shift only')).toBeInTheDocument()
    expect(screen.getByText('All Monday shifts')).toBeInTheDocument()
    expect(screen.getByText('All shifts')).toBeInTheDocument()
  })

  it('shows staffing summary chip and counts in the header', async () => {
    setupFetch({
      start_date: '2026-01-01',
      end_date: '2026-03-01',
      weekdays: ['Monday', 'Wednesday', 'Friday'],
      matching_shift_count: 6,
    })

    render(<ScheduleSidePanel {...buildProps()} />)

    expect(await screen.findByText('Below Preferred by 1')).toBeInTheDocument()
    expect(screen.getByText('Required: 2 • Preferred: 3 • Scheduled: 2')).toBeInTheDocument()
  })

  it('supports baseline edit handoff and return to cell panel', async () => {
    setupFetch({
      start_date: '2026-01-01',
      end_date: '2026-03-01',
      weekdays: ['Monday', 'Wednesday', 'Friday'],
      matching_shift_count: 6,
    })

    render(<ScheduleSidePanel {...buildProps()} />)

    await waitFor(() => {
      expect(screen.getByText('Bella W.')).toBeInTheDocument()
    })

    fireEvent.click(await screen.findByRole('button', { name: /edit baseline staff/i }))
    expect(screen.getByText('Edit baseline assignment?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }))
    expect(screen.getByText('Edit Permanent Staff')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^back$/i })).toBeInTheDocument()
  })

  it('hides Remove button for temporary coverage assignments without staffing_event_id', async () => {
    setupFetch({
      start_date: '2026-02-09',
      end_date: '2026-02-09',
      weekdays: ['Monday'],
      matching_shift_count: 1,
    })

    // Flex assignment from baseline (teacher with FLEXIBLE role) - no staffing_event_id
    const propsWithoutEventId = {
      ...buildProps(),
      selectedCellData: {
        ...buildProps().selectedCellData,
        assignments: [
          {
            id: 'a-1',
            teacher_id: 'teacher-1',
            teacher_name: 'Bella W.',
            classroom_id: 'class-1',
            classroom_name: 'Infant Room',
          },
          {
            id: 'a-flex-baseline',
            teacher_id: 'teacher-2',
            teacher_name: 'Amy P.',
            classroom_id: 'class-1',
            classroom_name: 'Infant Room',
            is_flexible: true,
            staffing_event_id: undefined,
          },
        ],
      },
    }

    render(<ScheduleSidePanel {...propsWithoutEventId} />)

    expect(screen.getByText('Amy P.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })

  it('shows single-shift confirmation copy with no weekday/all-shifts options', async () => {
    setupFetch({
      start_date: '2026-02-09',
      end_date: '2026-02-09',
      weekdays: ['Monday'],
      matching_shift_count: 1,
    })

    render(<ScheduleSidePanel {...buildProps()} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }))

    await waitFor(() => {
      expect(
        screen.getByText(
          'Amy P. is assigned for temporary coverage to Infant Room on Monday, Feb 9.'
        )
      ).toBeInTheDocument()
    })
    expect(screen.queryByText('This shift only')).not.toBeInTheDocument()
    expect(screen.queryByText('All Monday shifts')).not.toBeInTheDocument()
    expect(screen.queryByText('All shifts')).not.toBeInTheDocument()
  })

  it('disables Save and Apply changes when slot is inactive', async () => {
    setupFetch({
      start_date: '2026-02-09',
      end_date: '2026-02-09',
      weekdays: ['Monday'],
      matching_shift_count: 1,
    })

    const props = buildProps()
    render(
      <ScheduleSidePanel
        {...props}
        readOnly={false}
        selectedCellData={{
          ...props.selectedCellData,
          schedule_cell: {
            ...props.selectedCellData.schedule_cell,
            is_active: false,
          },
        }}
      />
    )

    expect(await screen.findByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByTestId('multi-day-apply')).toHaveAttribute('data-disabled', 'true')
  })

  it('disables quick actions in read-only cell panel when slot is inactive', async () => {
    setupFetch({
      start_date: '2026-02-09',
      end_date: '2026-02-09',
      weekdays: ['Monday'],
      matching_shift_count: 1,
    })

    const props = buildProps()
    render(
      <ScheduleSidePanel
        {...props}
        readOnly
        selectedCellData={{
          ...props.selectedCellData,
          schedule_cell: {
            ...props.selectedCellData.schedule_cell,
            is_active: false,
          },
        }}
      />
    )

    expect(await screen.findByRole('button', { name: 'Add Temporary Coverage' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Edit baseline staff' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Edit class groups, enrollment & ratios' })
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled()

    const addTimeOffButtons = screen.getAllByRole('button', { name: 'Add Time Off' })
    addTimeOffButtons.forEach(button => {
      expect(button).toBeDisabled()
    })
  })

  it('disables Save and Apply when classroom is inactive (parent inactive)', async () => {
    setupFetch({
      start_date: '2026-02-09',
      end_date: '2026-02-09',
      weekdays: ['Monday'],
      matching_shift_count: 1,
    })

    const props = buildProps()
    render(
      <ScheduleSidePanel
        {...props}
        readOnly={false}
        selectedCellData={{
          ...props.selectedCellData,
          classroom_is_active: false,
        }}
      />
    )

    expect(await screen.findByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByTestId('multi-day-apply')).toHaveAttribute('data-disabled', 'true')
  })

  it('disables Save and Apply when time slot is inactive (parent inactive)', async () => {
    setupFetch({
      start_date: '2026-02-09',
      end_date: '2026-02-09',
      weekdays: ['Monday'],
      matching_shift_count: 1,
    })

    const props = buildProps()
    render(
      <ScheduleSidePanel
        {...props}
        readOnly={false}
        selectedCellData={{
          ...props.selectedCellData,
          time_slot_is_active: false,
        }}
      />
    )

    expect(await screen.findByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByTestId('multi-day-apply')).toHaveAttribute('data-disabled', 'true')
  })

  it('disables quick actions when classroom is inactive (parent inactive)', async () => {
    setupFetch({
      start_date: '2026-02-09',
      end_date: '2026-02-09',
      weekdays: ['Monday'],
      matching_shift_count: 1,
    })

    const props = buildProps()
    render(
      <ScheduleSidePanel
        {...props}
        readOnly
        selectedCellData={{
          ...props.selectedCellData,
          classroom_is_active: false,
        }}
      />
    )

    expect(await screen.findByRole('button', { name: 'Add Temporary Coverage' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Edit baseline staff' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Edit class groups, enrollment & ratios' })
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled()

    const addTimeOffButtons = screen.getAllByRole('button', { name: 'Add Time Off' })
    addTimeOffButtons.forEach(button => {
      expect(button).toBeDisabled()
    })
  })

  it('disables quick actions when time slot is inactive (parent inactive)', async () => {
    setupFetch({
      start_date: '2026-02-09',
      end_date: '2026-02-09',
      weekdays: ['Monday'],
      matching_shift_count: 1,
    })

    const props = buildProps()
    render(
      <ScheduleSidePanel
        {...props}
        readOnly
        selectedCellData={{
          ...props.selectedCellData,
          time_slot_is_active: false,
        }}
      />
    )

    expect(await screen.findByRole('button', { name: 'Add Temporary Coverage' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Edit baseline staff' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Edit class groups, enrollment & ratios' })
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled()

    const addTimeOffButtons = screen.getAllByRole('button', { name: 'Add Time Off' })
    addTimeOffButtons.forEach(button => {
      expect(button).toBeDisabled()
    })
  })
})

describe('ScheduleSidePanel - Add Temporary Coverage', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  const buildPropsFromDashboard = () => {
    const base = buildProps()
    return {
      ...base,
      selectedCellData: undefined,
      initialPanelMode: 'flex' as const,
      initialFlexStartDate: '2026-03-09',
      initialFlexEndDate: '2026-05-11',
      initialFlexTargetType: 'required' as const,
      initialFlexRequiredStaff: 2,
      initialFlexPreferredStaff: 3,
      initialFlexScheduledStaff: 1,
    }
  }

  it('from dashboard: header shows Required, Preferred, and Scheduled when initial flex staffing is passed', async () => {
    setupFetch({
      start_date: '2026-03-09',
      end_date: '2026-05-11',
      weekdays: ['Monday'],
      matching_shift_count: 10,
    })

    render(<ScheduleSidePanel {...buildPropsFromDashboard()} />)

    await waitFor(() => {
      expect(screen.getByText(/Required: 2.*Preferred: 3.*Scheduled: 1/)).toBeInTheDocument()
    })
  })

  it('from dashboard: shows Summary card with run-length and suggested coverage range', async () => {
    setupFetch({
      start_date: '2026-03-09',
      end_date: '2026-05-11',
      weekdays: ['Monday'],
      matching_shift_count: 10,
    })

    render(<ScheduleSidePanel {...buildPropsFromDashboard()} />)

    await waitFor(() => {
      expect(screen.getByText('Summary')).toBeInTheDocument()
    })
    expect(
      screen.getByText(/Infant Room Monday EM is below required target for the next/)
    ).toBeInTheDocument()
    expect(screen.getByText(/Suggested coverage range: Mar 9 – May 11/)).toBeInTheDocument()
  })

  it('from dashboard: when date range is 8+ weeks shows Long-term assignment detected', async () => {
    setupFetch({
      start_date: '2026-03-09',
      end_date: '2026-05-11',
      weekdays: ['Monday'],
      matching_shift_count: 10,
    })

    render(<ScheduleSidePanel {...buildPropsFromDashboard()} />)

    await waitFor(() => {
      expect(screen.getByText('Long-term assignment detected')).toBeInTheDocument()
    })
    expect(
      screen.getByText(/Assigning for a whole semester\? You might want to do this in the/)
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Baseline Schedule' })).toBeInTheDocument()
  })

  it('from weekly: fetches slot-run and shows Summary when slot is below target', async () => {
    setupFetch({
      start_date: '2026-03-09',
      end_date: '2026-05-11',
      weekdays: ['Monday'],
      matching_shift_count: 10,
    })

    render(<ScheduleSidePanel {...buildProps()} weekStartISO="2026-03-09" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Add Temporary Coverage' }))

    await waitFor(() => {
      expect(screen.getByText('Summary')).toBeInTheDocument()
    })
    expect(
      screen.getByText(/Infant Room Monday EM is below required target for the next 9 weeks/)
    ).toBeInTheDocument()
    expect(screen.getByText(/Suggested coverage range: Mar 9 – May 11/)).toBeInTheDocument()
  })
})
