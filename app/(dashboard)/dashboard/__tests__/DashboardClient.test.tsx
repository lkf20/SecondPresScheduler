import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DashboardClient from '../DashboardClient'

const mockRefetch = jest.fn()
const mockUseDashboard = jest.fn()
const mockUseProfile = jest.fn()
const mockUseDisplayNameFormat = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}))

jest.mock('@/lib/hooks/use-dashboard', () => ({
  useDashboard: (...args: unknown[]) => mockUseDashboard(...args),
}))

jest.mock('@/lib/hooks/use-profile', () => ({
  useProfile: () => mockUseProfile(),
}))

jest.mock('@/lib/hooks/use-display-name-format', () => ({
  useDisplayNameFormat: () => mockUseDisplayNameFormat(),
}))

jest.mock('@/components/schedules/ScheduleSidePanel', () => {
  const MockScheduleSidePanel = (props: {
    isOpen: boolean
    onClose: () => void
    initialFlexRequiredStaff?: number
    initialFlexPreferredStaff?: number | null
    initialFlexScheduledStaff?: number
  }) =>
    props.isOpen ? (
      <div
        data-testid="schedule-side-panel"
        data-initial-flex-required={props.initialFlexRequiredStaff ?? ''}
        data-initial-flex-preferred={
          props.initialFlexPreferredStaff != null ? String(props.initialFlexPreferredStaff) : ''
        }
        data-initial-flex-scheduled={props.initialFlexScheduledStaff ?? ''}
      >
        <button type="button" onClick={props.onClose}>
          Close panel
        </button>
      </div>
    ) : null
  MockScheduleSidePanel.displayName = 'MockScheduleSidePanel'
  return MockScheduleSidePanel
})

jest.mock('@/components/time-off/AddTimeOffButton', () => {
  const Mock = () => <div data-testid="add-time-off-button" />
  Mock.displayName = 'MockAddTimeOffButton'
  return Mock
})

jest.mock('@/components/shared/TimeOffCard', () => {
  const Mock = ({ teacherName }: { teacherName: string }) => (
    <div data-testid="time-off-card">{teacherName}</div>
  )
  Mock.displayName = 'MockTimeOffCard'
  return Mock
})

const defaultOverview = {
  summary: {
    absences: 0,
    uncovered_shifts: 0,
    partially_covered_shifts: 0,
    scheduled_subs: 0,
  },
  coverage_requests: [],
  staffing_targets: [] as Array<{
    id: string
    date?: string
    day_of_week_id: string
    day_name: string
    day_number: number
    day_order: number
    time_slot_id: string
    time_slot_code: string
    time_slot_order: number
    classroom_id: string
    classroom_name: string
    classroom_color: string | null
    required_staff: number
    preferred_staff: number | null
    scheduled_staff: number
    status: 'below_required' | 'below_preferred'
  }>,
  scheduled_subs: [],
}

function renderDashboard(overview = defaultOverview) {
  return render(<DashboardClient overview={overview} startDate="2026-02-27" endDate="2026-03-12" />)
}

describe('DashboardClient - Below Staffing Target', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseDashboard.mockReturnValue({
      data: defaultOverview,
      isLoading: false,
      isFetching: false,
      refetch: mockRefetch,
    })
    mockUseProfile.mockReturnValue({
      data: { first_name: 'Test' },
      isLoading: false,
    })
    mockUseDisplayNameFormat.mockReturnValue({
      format: 'first_last_initial',
      isLoaded: true,
    })
  })

  it('shows "All classrooms meet staffing targets" when staffing_targets is empty', () => {
    mockUseDashboard.mockReturnValue({
      data: { ...defaultOverview, staffing_targets: [] },
      isLoading: false,
      isFetching: false,
      refetch: mockRefetch,
    })

    renderDashboard()

    expect(screen.getByText(/below staffing target/i)).toBeInTheDocument()
    expect(screen.getByText(/all classrooms meet staffing targets/i)).toBeInTheDocument()
  })

  it('shows exclusion note about permanent staff, floaters, and temporary coverage', () => {
    renderDashboard()

    expect(
      screen.getByText(
        /counts permanent staff, flex staff, floaters \(0\.5\), and temporary coverage/i
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(/subs and absences are excluded from the calculation/i)
    ).toBeInTheDocument()
  })

  it('shows Below Required section with count and grouped cards when slots are below required', () => {
    const overviewWithBelowRequired = {
      ...defaultOverview,
      staffing_targets: [
        {
          id: 'cell1|2026-03-09',
          date: '2026-03-09',
          day_of_week_id: 'dow-mon',
          day_name: 'Monday',
          day_number: 1,
          day_order: 0,
          time_slot_id: 'ts-lb',
          time_slot_code: 'LB',
          time_slot_order: 0,
          classroom_id: 'room-infant',
          classroom_name: 'Infant Room',
          classroom_color: '#dbeafe',
          required_staff: 2,
          preferred_staff: 3,
          scheduled_staff: 1,
          status: 'below_required' as const,
        },
      ],
    }
    mockUseDashboard.mockReturnValue({
      data: overviewWithBelowRequired,
      isLoading: false,
      isFetching: false,
      refetch: mockRefetch,
    })

    renderDashboard(overviewWithBelowRequired)

    expect(screen.getByText(/below required \(1\)/i)).toBeInTheDocument()
    expect(screen.getByText('Infant Room (1)')).toBeInTheDocument()
    expect(screen.getByText(/mon mar 9 • lb/i)).toBeInTheDocument()
    expect(screen.getByText(/below required by 1/i)).toBeInTheDocument()
    expect(screen.getByText(/required: 2 · scheduled: 1/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /assign coverage/i })).toBeInTheDocument()
  })

  it('groups slots with same classroom, time slot, day, required and scheduled into one card with date range label', () => {
    const overviewWithGroupedSlots = {
      ...defaultOverview,
      staffing_targets: [
        {
          id: 'cell1|2026-03-09',
          date: '2026-03-09',
          day_of_week_id: 'dow-mon',
          day_name: 'Monday',
          day_number: 1,
          day_order: 0,
          time_slot_id: 'ts-lb',
          time_slot_code: 'LB',
          time_slot_order: 0,
          classroom_id: 'room-infant',
          classroom_name: 'Infant Room',
          classroom_color: '#dbeafe',
          required_staff: 2,
          preferred_staff: 3,
          scheduled_staff: 1,
          status: 'below_required' as const,
        },
        {
          id: 'cell1|2026-03-16',
          date: '2026-03-16',
          day_of_week_id: 'dow-mon',
          day_name: 'Monday',
          day_number: 1,
          day_order: 0,
          time_slot_id: 'ts-lb',
          time_slot_code: 'LB',
          time_slot_order: 0,
          classroom_id: 'room-infant',
          classroom_name: 'Infant Room',
          classroom_color: '#dbeafe',
          required_staff: 2,
          preferred_staff: 3,
          scheduled_staff: 1,
          status: 'below_required' as const,
        },
      ],
    }
    mockUseDashboard.mockReturnValue({
      data: overviewWithGroupedSlots,
      isLoading: false,
      isFetching: false,
      refetch: mockRefetch,
    })

    renderDashboard(overviewWithGroupedSlots)

    expect(screen.getByText(/below required \(2\)/i)).toBeInTheDocument()
    expect(screen.getByText('Infant Room (2)')).toBeInTheDocument()
    // Grouped: date range label "Mar 9 - Mar 16 • Monday LB"
    expect(screen.getByText(/mar 9 - mar 16 • monday lb/i)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /assign coverage/i }).length).toBe(1)
  })

  it('shows separate cards when required or scheduled differ for same classroom/time slot/day', () => {
    const overviewWithDifferentRequired = {
      ...defaultOverview,
      staffing_targets: [
        {
          id: 'cell1|2026-03-09',
          date: '2026-03-09',
          day_of_week_id: 'dow-mon',
          day_name: 'Monday',
          day_number: 1,
          day_order: 0,
          time_slot_id: 'ts-lb',
          time_slot_code: 'LB',
          time_slot_order: 0,
          classroom_id: 'room-infant',
          classroom_name: 'Infant Room',
          classroom_color: null,
          required_staff: 2,
          preferred_staff: 3,
          scheduled_staff: 1,
          status: 'below_required' as const,
        },
        {
          id: 'cell1|2026-03-16',
          date: '2026-03-16',
          day_of_week_id: 'dow-mon',
          day_name: 'Monday',
          day_number: 1,
          day_order: 0,
          time_slot_id: 'ts-lb',
          time_slot_code: 'LB',
          time_slot_order: 0,
          classroom_id: 'room-infant',
          classroom_name: 'Infant Room',
          classroom_color: null,
          required_staff: 2,
          preferred_staff: 3,
          scheduled_staff: 0,
          status: 'below_required' as const,
        },
      ],
    }
    mockUseDashboard.mockReturnValue({
      data: overviewWithDifferentRequired,
      isLoading: false,
      isFetching: false,
      refetch: mockRefetch,
    })

    renderDashboard(overviewWithDifferentRequired)

    expect(screen.getByText(/below required \(2\)/i)).toBeInTheDocument()
    expect(screen.getByText('Infant Room (2)')).toBeInTheDocument()
    // Two groups (different scheduled_staff): two Assign Coverage buttons
    const assignButtons = screen.getAllByRole('button', { name: /assign coverage/i })
    expect(assignButtons.length).toBe(2)
  })

  it('shows Below Preferred section when slots are below preferred only', () => {
    const overviewWithBelowPreferred = {
      ...defaultOverview,
      staffing_targets: [
        {
          id: 'cell1|2026-03-10',
          date: '2026-03-10',
          day_of_week_id: 'dow-tue',
          day_name: 'Tuesday',
          day_number: 2,
          day_order: 1,
          time_slot_id: 'ts-am',
          time_slot_code: 'AM',
          time_slot_order: 0,
          classroom_id: 'room-toddler',
          classroom_name: 'Toddler Room',
          classroom_color: null,
          required_staff: 1,
          preferred_staff: 2,
          scheduled_staff: 1,
          status: 'below_preferred' as const,
        },
      ],
    }
    mockUseDashboard.mockReturnValue({
      data: overviewWithBelowPreferred,
      isLoading: false,
      isFetching: false,
      refetch: mockRefetch,
    })

    renderDashboard(overviewWithBelowPreferred)

    expect(screen.getByText(/below preferred \(1\)/i)).toBeInTheDocument()
    expect(screen.getByText('Toddler Room (1)')).toBeInTheDocument()
    expect(screen.getByText(/below preferred by 1/i)).toBeInTheDocument()
    expect(screen.getByText(/preferred: 2 · scheduled: 1/i)).toBeInTheDocument()
  })

  it('opens ScheduleSidePanel when Assign Coverage is clicked', async () => {
    const user = userEvent.setup()
    const overviewWithSlot = {
      ...defaultOverview,
      staffing_targets: [
        {
          id: 'cell1|2026-03-09',
          date: '2026-03-09',
          day_of_week_id: 'dow-mon',
          day_name: 'Monday',
          day_number: 1,
          day_order: 0,
          time_slot_id: 'ts-lb',
          time_slot_code: 'LB',
          time_slot_order: 0,
          classroom_id: 'room-infant',
          classroom_name: 'Infant Room',
          classroom_color: null,
          required_staff: 2,
          preferred_staff: 3,
          scheduled_staff: 1,
          status: 'below_required' as const,
        },
      ],
    }
    mockUseDashboard.mockReturnValue({
      data: overviewWithSlot,
      isLoading: false,
      isFetching: false,
      refetch: mockRefetch,
    })

    renderDashboard(overviewWithSlot)

    expect(screen.queryByTestId('schedule-side-panel')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /assign coverage/i }))

    expect(screen.getByTestId('schedule-side-panel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /close panel/i })).toBeInTheDocument()
    // Add Temporary Coverage panel receives staffing so header shows required, preferred, scheduled
    const panel = screen.getByTestId('schedule-side-panel')
    expect(panel).toHaveAttribute('data-initial-flex-required', '2')
    expect(panel).toHaveAttribute('data-initial-flex-preferred', '3')
    expect(panel).toHaveAttribute('data-initial-flex-scheduled', '1')
  })
})
