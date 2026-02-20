import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import TimeOffForm from '@/components/time-off/TimeOffForm'

const mockPush = jest.fn()
const mockRefresh = jest.fn()
const mockToastWarning = jest.fn()
const mockToastSuccess = jest.fn()
const mockToastInfo = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

jest.mock('sonner', () => ({
  toast: {
    warning: (...args: unknown[]) => mockToastWarning(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
  },
}))

jest.mock('@/lib/hooks/use-display-name-format', () => ({
  useDisplayNameFormat: () => ({ format: 'first_last' }),
}))

jest.mock('@/lib/contexts/SchoolContext', () => ({
  useSchool: () => 'school-1',
}))

jest.mock('@/lib/utils/invalidation', () => ({
  invalidateDashboard: jest.fn(async () => undefined),
  invalidateTimeOffRequests: jest.fn(async () => undefined),
  invalidateSubFinderAbsences: jest.fn(async () => undefined),
  invalidateWeeklySchedule: jest.fn(async () => undefined),
}))

jest.mock('@/components/time-off/ShiftSelectionTable', () => {
  const MockShiftSelectionTable = () => <div data-testid="shift-selection-table" />
  MockShiftSelectionTable.displayName = 'MockShiftSelectionTable'
  return MockShiftSelectionTable
})

jest.mock('@/components/ui/date-picker-input', () => {
  const MockDatePickerInput = ({
    id,
    value,
    onChange,
    placeholder,
  }: {
    id: string
    value: string
    onChange: (value: string) => void
    placeholder?: string
  }) => (
    <input
      id={id}
      data-testid={id}
      value={value}
      placeholder={placeholder}
      onChange={event => onChange(event.target.value)}
    />
  )
  MockDatePickerInput.displayName = 'MockDatePickerInput'
  return MockDatePickerInput
})

const renderWithQueryClient = (node: ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>)
}

describe('TimeOffForm', () => {
  const teacher = {
    id: 'teacher-1',
    first_name: 'Bella',
    last_name: 'Wilbanks',
    display_name: 'Bella W.',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/teachers') {
        return {
          ok: true,
          json: async () => [teacher],
        } as Response
      }
      if (url === '/api/time-off') {
        return {
          ok: true,
          json: async () => ({}),
        } as Response
      }
      return {
        ok: false,
        json: async () => ({ error: `Unhandled fetch URL in test: ${url}` }),
      } as Response
    }) as jest.Mock
  })

  it('validates required fields while saving a draft', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<TimeOffForm />)

    await user.click(screen.getByRole('button', { name: /save as draft/i }))
    expect(await screen.findByText(/teacher is required\./i)).toBeInTheDocument()

    const teacherInput = screen.getByPlaceholderText(/select a teacher/i)
    await user.click(teacherInput)
    await user.click(await screen.findByRole('button', { name: /bella wilbanks/i }))

    await user.click(screen.getByRole('button', { name: /save as draft/i }))
    expect(await screen.findByText(/start date is required\./i)).toBeInTheDocument()
  })

  it('submits a new time off request and calls onSuccess', async () => {
    const user = userEvent.setup()
    const onSuccess = jest.fn()

    renderWithQueryClient(<TimeOffForm onSuccess={onSuccess} />)

    const teacherInput = screen.getByPlaceholderText(/select a teacher/i)
    await user.click(teacherInput)
    await user.click(await screen.findByRole('button', { name: /bella wilbanks/i }))

    fireEvent.change(screen.getByTestId('time-off-start-date'), { target: { value: '2026-02-09' } })
    await user.click(screen.getByRole('button', { name: /^create$/i }))

    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith('Bella Wilbanks', '2026-02-09', '2026-02-09')
    )

    const submitCall = (global.fetch as jest.Mock).mock.calls.find(
      call => call[0] === '/api/time-off'
    )
    expect(submitCall).toBeDefined()
    expect(submitCall?.[1]).toMatchObject({ method: 'POST' })
  })
})
