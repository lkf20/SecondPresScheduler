import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TimeOffListClient from '@/app/(dashboard)/time-off/TimeOffListClient'

const mockReplace = jest.fn()
const mockRefresh = jest.fn()
let mockSearchParams = new URLSearchParams('view=drafts')

const mockUseTimeOffRequests = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    refresh: mockRefresh,
  }),
  usePathname: () => '/time-off',
  useSearchParams: () => mockSearchParams,
}))

jest.mock('@/lib/hooks/use-time-off-requests', () => ({
  useTimeOffRequests: (...args: unknown[]) => mockUseTimeOffRequests(...args),
}))

jest.mock('@/components/time-off/AddTimeOffButton', () => {
  const MockAddTimeOffButton = () => <div data-testid="add-time-off-button" />
  MockAddTimeOffButton.displayName = 'MockAddTimeOffButton'
  return MockAddTimeOffButton
})

jest.mock('@/components/shared/TimeOffCard', () => {
  const MockTimeOffCard = ({ teacherName }: { teacherName: string }) => (
    <div data-testid="time-off-card">{teacherName}</div>
  )
  MockTimeOffCard.displayName = 'MockTimeOffCard'
  return MockTimeOffCard
})

describe('TimeOffListClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams = new URLSearchParams('view=drafts')
  })

  it('renders loading state', () => {
    mockUseTimeOffRequests.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
      isFetching: false,
    })

    render(<TimeOffListClient view="active" />)

    expect(screen.getByText(/loading time off requests/i)).toBeInTheDocument()
  })

  it('renders error state', () => {
    mockUseTimeOffRequests.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch: jest.fn(),
      isFetching: false,
    })

    render(<TimeOffListClient view="active" />)

    expect(screen.getByText(/failed to load time off requests/i)).toBeInTheDocument()
  })

  it('updates URL query when editing a draft row', async () => {
    const user = userEvent.setup()

    mockUseTimeOffRequests.mockReturnValue({
      data: {
        data: [
          {
            id: 'req-draft-1',
            teacher_name: 'Bella W.',
            start_date: '2026-02-09',
            end_date: '2026-02-09',
            status: 'draft',
            coverage_status: 'needs_coverage',
            total: 1,
            covered: 0,
            partial: 0,
            uncovered: 1,
            shift_details: [],
            classrooms: [],
          },
        ],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isFetching: false,
    })

    render(<TimeOffListClient view="drafts" />)

    await user.click(screen.getByRole('button', { name: /^edit$/i }))
    expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('edit=req-draft-1'))
  })
})
