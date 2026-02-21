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
  const MockShiftSelectionTable = ({
    onShiftsChange,
    onConflictSummaryChange,
    onConflictRequestsChange,
  }: {
    onShiftsChange?: (
      shifts: Array<{ date: string; day_of_week_id: string; time_slot_id: string }>
    ) => void
    onConflictSummaryChange?: (summary: { conflictCount: number; totalScheduled: number }) => void
    onConflictRequestsChange?: (
      requests: Array<{
        id: string
        start_date: string
        end_date: string | null
        reason: string | null
      }>
    ) => void
  }) => (
    <div data-testid="shift-selection-table">
      <button
        type="button"
        onClick={() =>
          onShiftsChange?.([
            { date: '2026-02-09', day_of_week_id: 'day-1', time_slot_id: 'slot-1' },
          ])
        }
      >
        Mock Select Shift
      </button>
      <button
        type="button"
        onClick={() => onConflictSummaryChange?.({ conflictCount: 1, totalScheduled: 1 })}
      >
        Mock Conflict Summary
      </button>
      <button
        type="button"
        onClick={() =>
          onConflictRequestsChange?.([
            {
              id: 'request-1',
              start_date: '2026-02-09',
              end_date: '2026-02-09',
              reason: 'Vacation',
            },
          ])
        }
      >
        Mock Conflict Requests
      </button>
    </div>
  )
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
    window.sessionStorage.clear()
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

  it('shows shift selection validation when create is clicked with no selected shifts', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<TimeOffForm />)

    const teacherInput = screen.getByPlaceholderText(/select a teacher/i)
    await user.click(teacherInput)
    await user.click(await screen.findByRole('button', { name: /bella wilbanks/i }))

    fireEvent.change(screen.getByTestId('time-off-start-date'), { target: { value: '2026-02-09' } })
    await user.click(screen.getByRole('radio', { name: /select shifts/i }))
    await user.click(screen.getByRole('button', { name: /^create$/i }))

    const messages = await screen.findAllByText(/select at least one shift\./i)
    expect(messages.length).toBeGreaterThan(0)
  })

  it('saves draft and navigates back to time off list', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<TimeOffForm />)

    const teacherInput = screen.getByPlaceholderText(/select a teacher/i)
    await user.click(teacherInput)
    await user.click(await screen.findByRole('button', { name: /bella wilbanks/i }))
    fireEvent.change(screen.getByTestId('time-off-start-date'), { target: { value: '2026-02-09' } })

    await user.click(screen.getByRole('button', { name: /save as draft/i }))

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Draft saved')
      expect(mockPush).toHaveBeenCalledWith('/time-off')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('blocks submission when all selected shifts are already recorded', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<TimeOffForm />)

    const teacherInput = screen.getByPlaceholderText(/select a teacher/i)
    await user.click(teacherInput)
    await user.click(await screen.findByRole('button', { name: /bella wilbanks/i }))
    fireEvent.change(screen.getByTestId('time-off-start-date'), { target: { value: '2026-02-09' } })

    await user.click(screen.getByRole('radio', { name: /select shifts/i }))
    await user.click(screen.getByRole('button', { name: /mock conflict summary/i }))
    await user.click(screen.getByRole('button', { name: /^create$/i }))

    expect(
      await screen.findByText(/all selected shifts already have time off recorded/i)
    ).toBeInTheDocument()
  })

  it('shows formatted warning toast when backend excludes conflicting shifts', async () => {
    const user = userEvent.setup()
    ;(global.fetch as jest.Mock).mockImplementation(async (input: RequestInfo | URL) => {
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
          json: async () => ({
            warning:
              'This teacher already has time off recorded for 1 of these shifts.<br>1 shift will not be recorded: Mon Feb 9',
          }),
        } as Response
      }
      return {
        ok: false,
        json: async () => ({ error: `Unhandled fetch URL in test: ${url}` }),
      } as Response
    })

    renderWithQueryClient(<TimeOffForm />)

    const teacherInput = screen.getByPlaceholderText(/select a teacher/i)
    await user.click(teacherInput)
    await user.click(await screen.findByRole('button', { name: /bella wilbanks/i }))
    fireEvent.change(screen.getByTestId('time-off-start-date'), { target: { value: '2026-02-09' } })
    await user.click(screen.getByRole('button', { name: /^create$/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/time-off',
        expect.objectContaining({ method: 'POST' })
      )
      expect(mockToastWarning).toHaveBeenCalled()
    })

    const warningMessage = (mockToastWarning.mock.calls[0]?.[0] ?? '') as string
    expect(warningMessage).toMatch(/already has time off recorded/i)
  })

  it('surfaces backend error when create fails', async () => {
    const user = userEvent.setup()
    ;(global.fetch as jest.Mock).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/teachers') {
        return {
          ok: true,
          json: async () => [teacher],
        } as Response
      }
      if (url === '/api/time-off') {
        return {
          ok: false,
          json: async () => ({ error: 'Teacher cannot be scheduled on this date' }),
        } as Response
      }
      return {
        ok: false,
        json: async () => ({ error: `Unhandled fetch URL in test: ${url}` }),
      } as Response
    })

    renderWithQueryClient(<TimeOffForm />)

    const teacherInput = screen.getByPlaceholderText(/select a teacher/i)
    await user.click(teacherInput)
    await user.click(await screen.findByRole('button', { name: /bella wilbanks/i }))
    fireEvent.change(screen.getByTestId('time-off-start-date'), { target: { value: '2026-02-09' } })
    await user.click(screen.getByRole('button', { name: /^create$/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/time-off',
        expect.objectContaining({ method: 'POST' })
      )
    })

    expect(await screen.findByText(/teacher cannot be scheduled/i)).toBeInTheDocument()
  })

  it('opens cancel dialog with assignments and supports keeping assignments', async () => {
    const user = userEvent.setup()
    const onCancel = jest.fn()
    ;(global.fetch as jest.Mock).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        const method = init?.method || 'GET'

        if (url === '/api/teachers') {
          return { ok: true, json: async () => [teacher] } as Response
        }

        if (url === '/api/time-off/request-1' && method === 'GET') {
          return {
            ok: true,
            json: async () => ({
              id: 'request-1',
              teacher_id: 'teacher-1',
              start_date: '2026-02-09',
              end_date: '2026-02-09',
              status: 'active',
              shift_selection_mode: 'all_scheduled',
              shifts: [],
            }),
          } as Response
        }

        if (url === '/api/time-off/request-1' && method === 'DELETE' && init?.body === '{}') {
          return {
            ok: true,
            json: async () => ({
              hasAssignments: true,
              assignmentCount: 1,
              assignments: [{ id: 'a1', display: 'Mon Feb 9 • EM • Sally A. • Infant' }],
              teacherName: 'Bella W.',
            }),
          } as Response
        }

        if (url === '/api/time-off/request-1' && method === 'DELETE') {
          return {
            ok: true,
            json: async () => ({ assignmentsKept: 1 }),
          } as Response
        }

        return {
          ok: false,
          json: async () => ({ error: `Unhandled fetch URL in test: ${url}` }),
        } as Response
      }
    )

    renderWithQueryClient(<TimeOffForm timeOffRequestId="request-1" onCancel={onCancel} />)

    expect(
      await screen.findByRole('button', { name: /cancel time off request/i })
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /cancel time off request/i }))

    expect(
      await screen.findByText(/what would you like to do with this assignment/i)
    ).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /keep sub assignments as extra coverage/i }))
    await user.click(screen.getAllByRole('button', { name: /cancel time off/i })[0])

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringMatching(/kept as extra coverage/i)
      )
      expect(onCancel).toHaveBeenCalled()
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('shows no-assignment dialog and allows keeping request', async () => {
    const user = userEvent.setup()
    ;(global.fetch as jest.Mock).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        const method = init?.method || 'GET'

        if (url === '/api/teachers') {
          return { ok: true, json: async () => [teacher] } as Response
        }

        if (url === '/api/time-off/request-2' && method === 'GET') {
          return {
            ok: true,
            json: async () => ({
              id: 'request-2',
              teacher_id: 'teacher-1',
              start_date: '2026-02-09',
              end_date: '2026-02-09',
              status: 'active',
              shift_selection_mode: 'all_scheduled',
              shifts: [],
            }),
          } as Response
        }

        if (url === '/api/time-off/request-2' && method === 'DELETE') {
          return {
            ok: true,
            json: async () => ({ hasAssignments: false, assignmentCount: 0 }),
          } as Response
        }

        return {
          ok: false,
          json: async () => ({ error: `Unhandled fetch URL in test: ${url}` }),
        } as Response
      }
    )

    renderWithQueryClient(<TimeOffForm timeOffRequestId="request-2" />)

    await user.click(await screen.findByRole('button', { name: /cancel time off request/i }))
    expect(
      await screen.findByText(/are you sure you want to cancel this time off request/i)
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /keep request/i }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /keep request/i })).not.toBeInTheDocument()
    })
  })

  it('shows info toast when cancel check reports already cancelled', async () => {
    const user = userEvent.setup()
    ;(global.fetch as jest.Mock).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        const method = init?.method || 'GET'

        if (url === '/api/teachers') {
          return { ok: true, json: async () => [teacher] } as Response
        }

        if (url === '/api/time-off/request-3' && method === 'GET') {
          return {
            ok: true,
            json: async () => ({
              id: 'request-3',
              teacher_id: 'teacher-1',
              start_date: '2026-02-09',
              end_date: '2026-02-09',
              status: 'active',
              shift_selection_mode: 'all_scheduled',
              shifts: [],
            }),
          } as Response
        }

        if (url === '/api/time-off/request-3' && method === 'DELETE') {
          return {
            ok: false,
            json: async () => ({ error: 'Time off request is already cancelled' }),
          } as Response
        }

        return {
          ok: false,
          json: async () => ({ error: `Unhandled fetch URL in test: ${url}` }),
        } as Response
      }
    )

    renderWithQueryClient(<TimeOffForm timeOffRequestId="request-3" />)

    await user.click(await screen.findByRole('button', { name: /cancel time off request/i }))
    await waitFor(() => {
      expect(mockToastInfo).toHaveBeenCalledWith('This time off request was already cancelled.')
    })
  })
})
