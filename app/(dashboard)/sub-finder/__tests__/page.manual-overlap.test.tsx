import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SubFinderPage from '../page'

const mockPush = jest.fn()
const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/sub-finder',
}))

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

jest.mock('@/components/layout/Header', () => ({
  Header: () => <div data-testid="header" />,
}))
jest.mock('@/components/sub-finder/ContactSubPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="contact-sub-panel" />,
}))
jest.mock('@/components/sub-finder/CoverageSummary', () => ({
  __esModule: true,
  default: () => <div data-testid="coverage-summary" />,
}))
jest.mock('@/components/sub-finder/RecommendedCombination', () => ({
  __esModule: true,
  default: () => <div data-testid="recommended-combination" />,
}))
jest.mock('@/components/sub-finder/AbsenceList', () => ({
  __esModule: true,
  default: () => <div data-testid="absence-list" />,
}))

// Mock DatePickerInput (forwardRef so ref from SubFinderPage doesn't warn)
jest.mock('@/components/ui/date-picker-input', () => {
  const React = require('react')
  return React.forwardRef(function MockDatePickerInput(
    { value, onChange, placeholder }: any,
    _ref: any
  ) {
    return (
      <input
        data-testid={`mock-datepicker-${placeholder}`}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    )
  })
})

jest.mock('@/components/time-off/ShiftSelectionTable', () => {
  return function MockShiftSelectionTable({
    onShiftsChange,
    onConflictSummaryChange,
    onConflictCheckReady,
    onConflictRequestsChange,
    onConflictShiftsChange,
  }: any) {
    const markReady = () => onConflictCheckReady?.(true)
    return (
      <div data-testid="shift-selection-table">
        <button
          data-testid="simulate-no-overlap"
          onClick={() => {
            onConflictSummaryChange?.({ conflictCount: 0, totalScheduled: 2, totalAssignable: 2 })
            onConflictRequestsChange?.([])
            onShiftsChange?.([
              { date: '2026-03-09', day_of_week_id: 'mon', time_slot_id: 'slot-1' },
              { date: '2026-03-10', day_of_week_id: 'tue', time_slot_id: 'slot-1' },
            ])
            markReady()
          }}
        >
          Simulate No Overlap
        </button>
        <button
          data-testid="simulate-100-overlap"
          onClick={() => {
            onConflictSummaryChange?.({ conflictCount: 2, totalScheduled: 2, totalAssignable: 2 })
            onConflictRequestsChange?.([
              { id: 'req-1', start_date: '2026-03-09', end_date: '2026-03-10', reason: 'Vacation' },
            ])
            onShiftsChange?.([]) // all filtered out
            onConflictShiftsChange?.([
              { date: '2026-03-09', day_of_week_id: 'mon', time_slot_id: 'slot-1' },
              { date: '2026-03-10', day_of_week_id: 'tue', time_slot_id: 'slot-1' },
            ])
            markReady()
          }}
        >
          Simulate 100% Overlap
        </button>
        <button
          data-testid="simulate-partial-overlap"
          onClick={() => {
            onConflictSummaryChange?.({ conflictCount: 1, totalScheduled: 2, totalAssignable: 2 })
            onConflictRequestsChange?.([
              { id: 'req-1', start_date: '2026-03-09', end_date: '2026-03-09', reason: 'Vacation' },
            ])
            onShiftsChange?.([
              { date: '2026-03-10', day_of_week_id: 'tue', time_slot_id: 'slot-1' },
            ])
            markReady()
          }}
        >
          Simulate Partial Overlap
        </button>
        <button
          data-testid="simulate-multiple-partial-overlap"
          onClick={() => {
            onConflictSummaryChange?.({ conflictCount: 2, totalScheduled: 3, totalAssignable: 3 })
            onConflictRequestsChange?.([
              { id: 'req-1', start_date: '2026-03-09', end_date: '2026-03-09', reason: 'Sick Day' },
              {
                id: 'req-2',
                start_date: '2026-03-10',
                end_date: '2026-03-11',
                reason: 'Personal Day',
              },
            ])
            onShiftsChange?.([
              { date: '2026-03-11', day_of_week_id: 'tue', time_slot_id: 'slot-1' },
            ])
            markReady()
          }}
        >
          Simulate Multiple Partial Overlap
        </button>
      </div>
    )
  }
})

const mockHandleFindManualSubs = jest.fn()

jest.mock('@/components/sub-finder/hooks/useSubFinderData', () => ({
  useSubFinderData: () => ({
    absences: [],
    selectedAbsence: null,
    setSelectedAbsence: jest.fn(),
    recommendedSubs: [],
    allSubs: [],
    recommendedCombinations: [],
    setRecommendedCombinations: jest.fn(),
    loading: false,
    includePartiallyCovered: false,
    setIncludePartiallyCovered: jest.fn(),
    includeFlexibleStaff: false,
    setIncludeFlexibleStaff: jest.fn(),
    includeOnlyRecommended: false,
    setIncludeOnlyRecommended: jest.fn(),
    teachers: [{ id: 't-1', first_name: 'John', last_name: 'Doe' }],
    getDisplayName: () => 'John Doe',
    fetchAbsences: jest.fn(),
    handleFindSubs: jest.fn(),
    handleFindManualSubs: mockHandleFindManualSubs,
    applySubResults: jest.fn(),
  }),
}))

jest.mock('@/lib/contexts/SchoolContext', () => ({
  useSchool: () => 'school-1',
}))

jest.mock('@/lib/contexts/PanelManagerContext', () => ({
  usePanelManager: () => ({
    activePanel: null,
    setActivePanel: jest.fn(),
    previousPanel: null,
    restorePreviousPanel: jest.fn(),
    savePreviousPanel: jest.fn(),
    registerPanelCloseHandler: jest.fn(),
    requestPanelClose: jest.fn(),
  }),
}))

jest.mock('@/components/time-off/AddTimeOffButton', () => {
  return function MockAddTimeOffButton({
    timeOffRequestId,
    onClose,
  }: {
    timeOffRequestId?: string | null
    onClose?: () => void
  }) {
    if (!timeOffRequestId) return null
    return (
      <div data-testid="edit-time-off-panel" data-request-id={timeOffRequestId}>
        Edit Time Off Request (mock)
      </div>
    )
  }
})
jest.mock('@/lib/utils/sub-finder-state', () => ({
  loadSubFinderState: () => null,
  saveSubFinderState: jest.fn(),
  clearSubFinderState: jest.fn(),
}))

const mockToastSuccess = jest.fn()
const mockToastError = jest.fn()
const mockToastWarning = jest.fn()
jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    warning: (...args: unknown[]) => mockToastWarning(...args),
  },
}))

// Fixed dates so Today/Tomorrow overlap tests are deterministic
jest.mock('@/lib/utils/date', () => ({
  ...jest.requireActual('@/lib/utils/date'),
  getTodayISO: () => '2026-03-09',
  getTomorrowISO: () => '2026-03-10',
}))

describe('SubFinderPage - Manual Overlap', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    mockHandleFindManualSubs.mockClear()
    mockPush.mockClear()
    mockReplace.mockClear()
    mockToastSuccess.mockClear()
    mockToastError.mockClear()
    mockToastWarning.mockClear()
    global.fetch = originalFetch
  })

  it('enables Find Subs button for 100% overlap and calls find manual subs with conflict shifts', async () => {
    renderWithQueryClient(<SubFinderPage />)

    // Select teacher
    const input = screen.getAllByPlaceholderText('Search or select a teacher...')[0]
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'John' } })
    const teacherOptions = await screen.findAllByText('John Doe')
    fireEvent.click(teacherOptions[0])

    // Wait for "Pick dates" to appear
    await screen.findAllByText('Pick dates')

    // Select custom dates so the form renders
    fireEvent.click(screen.getAllByText('Custom date range')[0])
    const startDateInput = screen.getAllByTestId('mock-datepicker-Select start date')[0]
    fireEvent.change(startDateInput, { target: { value: '2026-03-09' } })

    // Simulate 100% overlap (all shifts have existing time off)
    fireEvent.click(screen.getAllByTestId('simulate-100-overlap')[0])

    // Find Subs button should be enabled
    const findSubsBtn = screen.getAllByRole('button', { name: 'Find Subs' })[0]
    expect(findSubsBtn).toBeEnabled()

    // Clicking it should call find manual subs with the conflict shifts (preview mode off = assign allowed)
    fireEvent.click(findSubsBtn)
    expect(mockHandleFindManualSubs).toHaveBeenCalledWith({
      teacherId: 't-1',
      startDate: '2026-03-09',
      endDate: '2026-03-09',
      shifts: [
        { date: '2026-03-09', day_of_week_id: 'mon', time_slot_id: 'slot-1' },
        { date: '2026-03-10', day_of_week_id: 'tue', time_slot_id: 'slot-1' },
      ],
    })
  })

  it('enables Find Subs for partial overlap and calls find manual subs with non-overlapping shifts', async () => {
    renderWithQueryClient(<SubFinderPage />)

    // Select teacher
    const input = screen.getAllByPlaceholderText('Search or select a teacher...')[0]
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'John' } })
    const teacherOptions = await screen.findAllByText('John Doe')
    fireEvent.click(teacherOptions[0])

    // Wait for "Pick dates" to appear
    await screen.findAllByText('Pick dates')

    fireEvent.click(screen.getAllByText('Custom date range')[0])
    fireEvent.change(screen.getAllByTestId('mock-datepicker-Select start date')[0], {
      target: { value: '2026-03-09' },
    })

    // Simulate partial overlap (mock sets manualSelectedShifts to the non-overlapping shift)
    fireEvent.click(screen.getAllByTestId('simulate-partial-overlap')[0])

    // Partial overlap shows "Find Subs in Preview Mode" (some shifts lack time off)
    const findSubsBtn = screen.getAllByRole('button', { name: 'Find Subs in Preview Mode' })[0]
    expect(findSubsBtn).toBeEnabled()

    // Clicking calls find manual subs with manualSelectedShifts (non-overlapping shifts)
    await act(async () => {
      fireEvent.click(findSubsBtn)
      await waitFor(() => expect(mockHandleFindManualSubs).toHaveBeenCalled())
    })
    expect(mockHandleFindManualSubs).toHaveBeenCalledWith({
      teacherId: 't-1',
      startDate: '2026-03-09',
      endDate: '2026-03-09',
      shifts: [{ date: '2026-03-10', day_of_week_id: 'tue', time_slot_id: 'slot-1' }],
    })
  })

  it('enables Find Subs when Today is selected and shifts are 100% covered', async () => {
    renderWithQueryClient(<SubFinderPage />)

    const input = screen.getAllByPlaceholderText('Search or select a teacher...')[0]
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'John' } })
    const teacherOptions = await screen.findAllByText('John Doe')
    fireEvent.click(teacherOptions[0])

    await screen.findAllByText('Pick dates')

    fireEvent.click(screen.getAllByRole('button', { name: 'Today' })[0])
    fireEvent.click(screen.getAllByTestId('simulate-100-overlap')[0])

    const findSubsBtn = screen.getAllByRole('button', { name: 'Find Subs' })[0]
    expect(findSubsBtn).toBeEnabled()

    await act(async () => {
      fireEvent.click(findSubsBtn)
      await waitFor(() => expect(mockHandleFindManualSubs).toHaveBeenCalled())
    })
    expect(mockHandleFindManualSubs).toHaveBeenCalledWith({
      teacherId: 't-1',
      startDate: '2026-03-09',
      endDate: '2026-03-09',
      shifts: [
        { date: '2026-03-09', day_of_week_id: 'mon', time_slot_id: 'slot-1' },
        { date: '2026-03-10', day_of_week_id: 'tue', time_slot_id: 'slot-1' },
      ],
    })
  })

  it('enables Find Subs when Tomorrow is selected and shifts are 100% covered', async () => {
    renderWithQueryClient(<SubFinderPage />)

    const input = screen.getAllByPlaceholderText('Search or select a teacher...')[0]
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'John' } })
    const teacherOptions = await screen.findAllByText('John Doe')
    fireEvent.click(teacherOptions[0])

    await screen.findAllByText('Pick dates')

    fireEvent.click(screen.getAllByRole('button', { name: 'Tomorrow' })[0])
    fireEvent.click(screen.getAllByTestId('simulate-100-overlap')[0])

    const findSubsBtn = screen.getAllByRole('button', { name: 'Find Subs' })[0]
    expect(findSubsBtn).toBeEnabled()

    await act(async () => {
      fireEvent.click(findSubsBtn)
      await waitFor(() => expect(mockHandleFindManualSubs).toHaveBeenCalled())
    })
    expect(mockHandleFindManualSubs).toHaveBeenCalledWith({
      teacherId: 't-1',
      startDate: '2026-03-10',
      endDate: '2026-03-10',
      shifts: [
        { date: '2026-03-09', day_of_week_id: 'mon', time_slot_id: 'slot-1' },
        { date: '2026-03-10', day_of_week_id: 'tue', time_slot_id: 'slot-1' },
      ],
    })
  })

  it('100% overlap: Find Subs is enabled and calls find manual subs with conflict shifts (no preview mode)', async () => {
    renderWithQueryClient(<SubFinderPage />)

    const input = screen.getAllByPlaceholderText('Search or select a teacher...')[0]
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'John' } })
    const teacherOptions = await screen.findAllByText('John Doe')
    fireEvent.click(teacherOptions[0])

    await screen.findAllByText('Pick dates')

    fireEvent.click(screen.getAllByText('Custom date range')[0])
    fireEvent.change(screen.getAllByTestId('mock-datepicker-Select start date')[0], {
      target: { value: '2026-03-09' },
    })

    fireEvent.click(screen.getAllByTestId('simulate-100-overlap')[0])

    const findSubsBtn = screen.getAllByRole('button', { name: 'Find Subs' })[0]
    expect(findSubsBtn).toBeEnabled()

    await act(async () => {
      fireEvent.click(findSubsBtn)
      await waitFor(() => expect(mockHandleFindManualSubs).toHaveBeenCalled())
    })
    expect(mockHandleFindManualSubs).toHaveBeenCalledWith({
      teacherId: 't-1',
      startDate: '2026-03-09',
      endDate: '2026-03-09',
      shifts: [
        { date: '2026-03-09', day_of_week_id: 'mon', time_slot_id: 'slot-1' },
        { date: '2026-03-10', day_of_week_id: 'tue', time_slot_id: 'slot-1' },
      ],
    })
  })

  it('no time off: shows inline Create Time Off & Find Sub and Find Subs in Preview Mode', async () => {
    renderWithQueryClient(<SubFinderPage />)

    const input = screen.getAllByPlaceholderText('Search or select a teacher...')[0]
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'John' } })
    const teacherOptions = await screen.findAllByText('John Doe')
    fireEvent.click(teacherOptions[0])

    await screen.findAllByText('Pick dates')

    fireEvent.click(screen.getAllByText('Custom date range')[0])
    fireEvent.change(screen.getAllByTestId('mock-datepicker-Select start date')[0], {
      target: { value: '2026-03-09' },
    })

    fireEvent.click(screen.getAllByTestId('simulate-no-overlap')[0])

    // Inline create card and actions (no separate "Create time off request" that navigates with open_time_off=1)
    expect(screen.getAllByText(/do not have a time off request/).length).toBeGreaterThan(0)
    expect(
      screen.getAllByRole('button', { name: 'Create Time Off & Find Sub' }).length
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByRole('button', { name: 'Find Subs in Preview Mode' }).length
    ).toBeGreaterThan(0)
    expect(mockReplace).not.toHaveBeenCalledWith(expect.stringContaining('open_time_off=1'))
  })

  const defaultFetchResponse = {
    ok: true,
    status: 200,
    json: () => Promise.resolve([]),
  } as Response

  it('Create Time Off & Find Sub: on success shows banner and auto-runs Find Subs after table refresh', async () => {
    const createdTimeOffId = 'req-created-1'
    const coverageRequestId = 'cr-1'
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as URL).href
      const method =
        init?.method ??
        (typeof input === 'object' && 'method' in input ? (input as Request).method : 'GET')
      if (url.includes('/api/time-off') && method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: createdTimeOffId }),
        } as Response)
      }
      if (
        url.includes(`/api/sub-finder/coverage-request/${encodeURIComponent(createdTimeOffId)}`)
      ) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ coverage_request_id: coverageRequestId }),
        } as Response)
      }
      return Promise.resolve(defaultFetchResponse)
    }) as typeof fetch

    renderWithQueryClient(<SubFinderPage />)

    const input = screen.getAllByPlaceholderText('Search or select a teacher...')[0]
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'John' } })
    const teacherOptions = await screen.findAllByText('John Doe')
    fireEvent.click(teacherOptions[0])

    await screen.findAllByText('Pick dates')

    fireEvent.click(screen.getAllByText('Custom date range')[0])
    fireEvent.change(screen.getAllByTestId('mock-datepicker-Select start date')[0], {
      target: { value: '2026-03-09' },
    })

    fireEvent.click(screen.getAllByTestId('simulate-no-overlap')[0])

    const createBtn = screen.getAllByRole('button', { name: 'Create Time Off & Find Sub' })[0]
    await act(async () => {
      fireEvent.click(createBtn)
      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Time off request created.')
      })
    })

    // Table remounts after create; simulate 100% overlap so auto-run effect runs.
    // Effect runs after state updates from the click; wait for it to call the handler.
    const simulate100 = screen.getAllByTestId('simulate-100-overlap')[0]
    fireEvent.click(simulate100)
    await waitFor(() => expect(mockHandleFindManualSubs).toHaveBeenCalled(), { timeout: 3000 })
    expect(mockHandleFindManualSubs).toHaveBeenCalledWith({
      teacherId: 't-1',
      startDate: '2026-03-09',
      endDate: '2026-03-09',
      shifts: [
        { date: '2026-03-09', day_of_week_id: 'mon', time_slot_id: 'slot-1' },
        { date: '2026-03-10', day_of_week_id: 'tue', time_slot_id: 'slot-1' },
      ],
    })
    // Success path: confirmed coverage, so green banner with "Time off successfully added... Finding recommended subs" is shown when 100% overlap is simulated
    const successBanners = screen.getAllByText(
      content =>
        content.includes('Time off successfully added') &&
        content.includes('Finding recommended subs')
    )
    expect(successBanners.length).toBeGreaterThan(0)
  })

  it('Create Time Off & Find Sub: when coverage GET fails after retries, shows unconfirmed banner and warning toast', async () => {
    const createdTimeOffId = 'req-created-2'
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as URL).href
      const method =
        init?.method ??
        (typeof input === 'object' && 'method' in input ? (input as Request).method : 'GET')
      if (url.includes('/api/time-off') && method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: createdTimeOffId }),
        } as Response)
      }
      if (url.includes('/api/sub-finder/coverage-request/')) {
        return Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({}),
        } as Response)
      }
      return Promise.resolve(defaultFetchResponse)
    }) as typeof fetch

    renderWithQueryClient(<SubFinderPage />)

    const input = screen.getAllByPlaceholderText('Search or select a teacher...')[0]
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'John' } })
    const teacherOptions = await screen.findAllByText('John Doe')
    fireEvent.click(teacherOptions[0])

    await screen.findAllByText('Pick dates')

    fireEvent.click(screen.getAllByText('Custom date range')[0])
    fireEvent.change(screen.getAllByTestId('mock-datepicker-Select start date')[0], {
      target: { value: '2026-03-09' },
    })

    fireEvent.click(screen.getAllByTestId('simulate-no-overlap')[0])

    const createBtn = screen.getAllByRole('button', { name: 'Create Time Off & Find Sub' })[0]
    fireEvent.click(createBtn)

    // Handler retries coverage GET at 0, 500, 1000 ms so wait for toasts after retries
    await waitFor(
      () => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Time off request created.')
        expect(mockToastWarning).toHaveBeenCalledWith(
          'There was a delay confirming coverage. Refresh the page or click Find Subs to continue.'
        )
      },
      { timeout: 2500 }
    )
  })

  it('partial overlap: shows Extend and Create new options in left panel', async () => {
    renderWithQueryClient(<SubFinderPage />)

    const input = screen.getAllByPlaceholderText('Search or select a teacher...')[0]
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'John' } })
    const teacherOptions = await screen.findAllByText('John Doe')
    fireEvent.click(teacherOptions[0])

    await screen.findAllByText('Pick dates')

    fireEvent.click(screen.getAllByText('Custom date range')[0])
    fireEvent.change(screen.getAllByTestId('mock-datepicker-Select start date')[0], {
      target: { value: '2026-03-09' },
    })

    fireEvent.click(screen.getAllByTestId('simulate-partial-overlap')[0])

    const extendBtns = screen.getAllByRole('button', { name: 'Extend existing request' })
    const createBtns = screen.getAllByRole('button', { name: 'Or create new time off request' })
    expect(extendBtns.length).toBeGreaterThan(0)
    expect(createBtns.length).toBeGreaterThan(0)

    fireEvent.click(extendBtns[0])
    expect(screen.getByTestId('edit-time-off-panel')).toBeInTheDocument()
    expect(screen.getByTestId('edit-time-off-panel')).toHaveAttribute('data-request-id', 'req-1')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('partial overlap with multiple existing requests: shows radios, inline warning if Extend without selection', async () => {
    renderWithQueryClient(<SubFinderPage />)

    const input = screen.getAllByPlaceholderText('Search or select a teacher...')[0]
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'John' } })
    const teacherOptions = await screen.findAllByText('John Doe')
    fireEvent.click(teacherOptions[0])

    await screen.findAllByText('Pick dates')

    fireEvent.click(screen.getAllByText('Custom date range')[0])
    fireEvent.change(screen.getAllByTestId('mock-datepicker-Select start date')[0], {
      target: { value: '2026-03-09' },
    })

    fireEvent.click(screen.getAllByTestId('simulate-multiple-partial-overlap')[0])

    expect(
      screen.getAllByText(/2 of 3 shifts overlap with existing time off/).length
    ).toBeGreaterThan(0)
    const extendBtns = screen.getAllByRole('button', { name: 'Extend existing request' })
    expect(extendBtns[0]).not.toBeDisabled()

    fireEvent.click(extendBtns[0])
    await waitFor(() =>
      expect(screen.getAllByText('Select a request to extend first.').length).toBeGreaterThan(0)
    )
    expect(mockPush).not.toHaveBeenCalled()

    const radios = screen.getAllByRole('radio')
    expect(radios.length).toBeGreaterThanOrEqual(2)
    fireEvent.click(radios[0])
    fireEvent.click(extendBtns[0])
    expect(screen.getByTestId('edit-time-off-panel')).toHaveAttribute('data-request-id', 'req-1')
    expect(mockPush).not.toHaveBeenCalled()

    fireEvent.click(radios[1])
    fireEvent.click(extendBtns[0])
    expect(screen.getByTestId('edit-time-off-panel')).toHaveAttribute('data-request-id', 'req-2')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('100% overlap: shows helper text about using Find Subs', async () => {
    renderWithQueryClient(<SubFinderPage />)

    const input = screen.getAllByPlaceholderText('Search or select a teacher...')[0]
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'John' } })
    const teacherOptions = await screen.findAllByText('John Doe')
    fireEvent.click(teacherOptions[0])

    await screen.findAllByText('Pick dates')

    fireEvent.click(screen.getAllByText('Custom date range')[0])
    fireEvent.change(screen.getAllByTestId('mock-datepicker-Select start date')[0], {
      target: { value: '2026-03-09' },
    })

    fireEvent.click(screen.getAllByTestId('simulate-100-overlap')[0])

    expect(
      screen.getAllByText(/Teacher already has recorded time off for these shifts/).length
    ).toBeGreaterThan(0)
    expect(screen.getAllByText(/Use Find Subs to see recommended subs/).length).toBeGreaterThan(0)
    expect(
      screen.queryByRole('button', { name: 'Extend existing request' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Create new time off request' })
    ).not.toBeInTheDocument()
  })
})
