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
jest.mock('@/components/schedules/ClassGroupMultiSelect', () => () => (
  <div>ClassGroupMultiSelect</div>
))
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

    await screen.findByText('Remove flex assignment?')
    expect(screen.getByText(/Amy P. is assigned as flex staff to Infant Room/i)).toBeInTheDocument()
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

    fireEvent.click(await screen.findByRole('button', { name: /edit permanent staff/i }))
    expect(screen.getByText('Edit baseline assignment?')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }))
    expect(screen.getByText('Edit Permanent Staff')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^back$/i }))
    expect(await screen.findByText('Flex Staff')).toBeInTheDocument()
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
        screen.getByText('Amy P. is assigned as flex staff to Infant Room on Monday, Feb 9.')
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

    expect(await screen.findByRole('button', { name: 'Add Flex Staff' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Edit permanent staff' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Edit class groups & enrollment' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled()

    const addTimeOffButtons = screen.getAllByRole('button', { name: 'Add Time Off' })
    addTimeOffButtons.forEach(button => {
      expect(button).toBeDisabled()
    })
  })
})
