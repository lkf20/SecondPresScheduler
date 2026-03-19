import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AssignSubPanelProvider } from '@/lib/contexts/AssignSubPanelContext'
import DashboardClient from '../DashboardClient'
import { clearDataHealthCache } from '@/lib/dashboard/data-health-cache'

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

jest.mock('@/lib/contexts/SchoolContext', () => ({
  useSchool: () => 'school-1',
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
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AssignSubPanelProvider>
        <DashboardClient overview={overview} startDate="2026-02-27" endDate="2026-03-12" />
      </AssignSubPanelProvider>
    </QueryClientProvider>
  )
}

describe('DashboardClient - Below Staffing Target', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    clearDataHealthCache()

    global.fetch = jest.fn().mockImplementation(url => {
      if (url === '/api/dashboard/data-health') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ orphanedShifts: [] }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      })
    }) as jest.Mock

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

  it('renders light icon circles for section headers', () => {
    renderDashboard()

    expect(screen.getByTestId('coverage-header-icon-circle')).toHaveStyle({
      backgroundColor: 'rgba(243, 244, 246, 1)',
      color: 'rgba(55, 65, 81, 1)',
    })
    expect(screen.getByTestId('scheduled-subs-header-icon-circle')).toHaveStyle({
      backgroundColor: 'rgba(236, 253, 245, 1)',
      color: '#0D9488',
    })
    expect(screen.getByTestId('staffing-target-header-icon-circle')).toBeInTheDocument()
  })

  it('shows expandable orphaned shift details in action-required banner', async () => {
    const user = userEvent.setup()
    ;(global.fetch as jest.Mock).mockImplementation(url => {
      if (url === '/api/dashboard/data-health') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              orphanedShifts: [
                {
                  shift_id: 'shift-1',
                  date: '2026-03-12',
                  reason: 'missing_baseline',
                  teacher_name: 'Anne M.',
                  day_name: 'Thursday',
                  time_slot_code: 'LB1',
                },
                {
                  shift_id: 'shift-2',
                  date: '2026-03-13',
                  reason: 'school_closed',
                  teacher_name: 'Victoria I.',
                  day_name: 'Friday',
                  time_slot_code: 'AM',
                },
              ],
            }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ orphanedShifts: [] }),
      })
    })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText(/Action Required:/i)).toBeInTheDocument()
    })

    expect(screen.queryByTestId('orphaned-shift-list')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /expand issue details/i }))

    expect(screen.getByTestId('orphaned-shift-list')).toBeInTheDocument()
    expect(screen.getByText(/Anne M\./)).toBeInTheDocument()
    expect(screen.getByText(/Victoria I\./)).toBeInTheDocument()
    expect(screen.getByText(/missing a baseline classroom assignment/i)).toBeInTheDocument()
    expect(screen.getByText(/falls on a school closure/i)).toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: /add coverage/i })).toBeInTheDocument()
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
    expect(screen.getAllByRole('button', { name: /add coverage/i }).length).toBe(1)
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
    // Two groups (different scheduled_staff): two Add Coverage buttons
    const assignButtons = screen.getAllByRole('button', { name: /add coverage/i })
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

  it('opens ScheduleSidePanel when Add Coverage is clicked', async () => {
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

    await user.click(screen.getByRole('button', { name: /add coverage/i }))

    expect(screen.getByTestId('schedule-side-panel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /close panel/i })).toBeInTheDocument()
    // Add Temporary Coverage panel receives staffing so header shows required, preferred, scheduled
    const panel = screen.getByTestId('schedule-side-panel')
    expect(panel).toHaveAttribute('data-initial-flex-required', '2')
    expect(panel).toHaveAttribute('data-initial-flex-preferred', '3')
    expect(panel).toHaveAttribute('data-initial-flex-scheduled', '1')
  })
})

describe('DashboardClient - Scheduled Subs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    clearDataHealthCache()
    global.fetch = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({ orphanedShifts: [] }) })
      ) as jest.Mock
    mockUseProfile.mockReturnValue({ data: { first_name: 'Test' }, isLoading: false })
    mockUseDisplayNameFormat.mockReturnValue({ format: 'first_last_initial', isLoaded: true })
  })

  it('shows Remove and Update Sub for scheduled subs with coverage_request_id and sub_id', async () => {
    const overviewWithScheduledSub = {
      ...defaultOverview,
      summary: { ...defaultOverview.summary, scheduled_subs: 1 },
      scheduled_subs: [
        {
          id: 'assign-1',
          date: '2026-03-10',
          day_name: 'Tuesday',
          time_slot_code: 'AM',
          classroom_name: 'Infant Room',
          classroom_color: '#dbeafe',
          notes: null,
          sub_name: 'Jane D.',
          sub_id: 'sub-1',
          teacher_name: 'Amy P.',
          coverage_request_id: 'cr-1',
        },
      ],
    }
    mockUseDashboard.mockReturnValue({
      data: overviewWithScheduledSub,
      isLoading: false,
      isFetching: false,
      refetch: mockRefetch,
    })

    renderDashboard(overviewWithScheduledSub)

    expect(screen.getByText('Jane D.')).toBeInTheDocument()
    expect(screen.getByText(/covering amy p\./i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove sub/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /update sub/i })).toBeInTheDocument()
  })

  it('does not show Remove when scheduled sub lacks coverage_request_id or sub_id', () => {
    const overviewWithoutIds = {
      ...defaultOverview,
      summary: { ...defaultOverview.summary, scheduled_subs: 1 },
      scheduled_subs: [
        {
          id: 'assign-1',
          date: '2026-03-10',
          day_name: 'Tuesday',
          time_slot_code: 'AM',
          classroom_name: 'Infant Room',
          classroom_color: null,
          notes: null,
          sub_name: 'Jane D.',
          sub_id: undefined,
          teacher_name: 'Amy P.',
          coverage_request_id: null,
        },
      ],
    }
    mockUseDashboard.mockReturnValue({
      data: overviewWithoutIds,
      isLoading: false,
      isFetching: false,
      refetch: mockRefetch,
    })

    renderDashboard(overviewWithoutIds)

    expect(screen.getByText('Jane D.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remove sub/i })).not.toBeInTheDocument()
  })
})

describe('DashboardClient - Upcoming Time Off ordering', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    clearDataHealthCache()
    global.fetch = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({ orphanedShifts: [] }) })
      ) as jest.Mock
    mockUseProfile.mockReturnValue({ data: { first_name: 'Test' }, isLoading: false })
    mockUseDisplayNameFormat.mockReturnValue({ format: 'first_last_initial', isLoaded: true })
  })

  it('sorts upcoming time off by soonest start date first', () => {
    const overviewWithUnsortedCoverage = {
      ...defaultOverview,
      coverage_requests: [
        {
          id: 'cr-late',
          source_request_id: 'tor-late',
          request_type: 'time_off',
          teacher_name: 'Later Start',
          start_date: '2026-03-20',
          end_date: '2026-03-20',
          reason: null,
          notes: null,
          classrooms: [],
          classroom_label: '',
          total_shifts: 1,
          assigned_shifts: 0,
          covered_shifts: 0,
          uncovered_shifts: 1,
          partial_shifts: 0,
          remaining_shifts: 1,
          status: 'needs_coverage' as const,
        },
        {
          id: 'cr-soon',
          source_request_id: 'tor-soon',
          request_type: 'time_off',
          teacher_name: 'Sooner Start',
          start_date: '2026-03-08',
          end_date: '2026-03-08',
          reason: null,
          notes: null,
          classrooms: [],
          classroom_label: '',
          total_shifts: 1,
          assigned_shifts: 0,
          covered_shifts: 0,
          uncovered_shifts: 1,
          partial_shifts: 0,
          remaining_shifts: 1,
          status: 'needs_coverage' as const,
        },
      ],
    }

    mockUseDashboard.mockReturnValue({
      data: overviewWithUnsortedCoverage,
      isLoading: false,
      isFetching: false,
      refetch: mockRefetch,
    })

    renderDashboard(overviewWithUnsortedCoverage)

    const cards = screen.getAllByTestId('time-off-card')
    expect(cards[0]).toHaveTextContent('Sooner Start')
    expect(cards[1]).toHaveTextContent('Later Start')
  })
})
