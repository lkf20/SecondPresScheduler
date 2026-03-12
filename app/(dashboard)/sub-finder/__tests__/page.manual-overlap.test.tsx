import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SubFinderPage from '../page'

const mockPush = jest.fn()
const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/sub-finder',
}))

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

// Mock DatePickerInput
jest.mock('@/components/ui/date-picker-input', () => {
  return function MockDatePickerInput({ value, onChange, placeholder }: any) {
    return (
      <input
        data-testid={`mock-datepicker-${placeholder}`}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    )
  }
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
            onConflictSummaryChange?.({ conflictCount: 0, totalScheduled: 2 })
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
            onConflictSummaryChange?.({ conflictCount: 2, totalScheduled: 2 })
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
            onConflictSummaryChange?.({ conflictCount: 1, totalScheduled: 2 })
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
            onConflictSummaryChange?.({ conflictCount: 2, totalScheduled: 3 })
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
}))

// Fixed dates so Today/Tomorrow overlap tests are deterministic
jest.mock('@/lib/utils/date', () => ({
  ...jest.requireActual('@/lib/utils/date'),
  getTodayISO: () => '2026-03-09',
  getTomorrowISO: () => '2026-03-10',
}))

describe('SubFinderPage - Manual Overlap', () => {
  beforeEach(() => {
    mockHandleFindManualSubs.mockClear()
    mockPush.mockClear()
    mockReplace.mockClear()
  })

  it('enables Find Subs button for 100% overlap and calls find manual subs with conflict shifts', async () => {
    render(<SubFinderPage />)

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
    render(<SubFinderPage />)

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
    fireEvent.click(findSubsBtn)
    expect(mockHandleFindManualSubs).toHaveBeenCalledWith({
      teacherId: 't-1',
      startDate: '2026-03-09',
      endDate: '2026-03-09',
      shifts: [{ date: '2026-03-10', day_of_week_id: 'tue', time_slot_id: 'slot-1' }],
    })
  })

  it('enables Find Subs when Today is selected and shifts are 100% covered', async () => {
    render(<SubFinderPage />)

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

  it('enables Find Subs when Tomorrow is selected and shifts are 100% covered', async () => {
    render(<SubFinderPage />)

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

    fireEvent.click(findSubsBtn)
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
    render(<SubFinderPage />)

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

  it('no time off: shows Create time off request box and button in left panel', async () => {
    render(<SubFinderPage />)

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

    expect(screen.getAllByText(/No time off request for these dates yet/).length).toBeGreaterThan(0)
    const createBtns = screen.getAllByRole('button', { name: 'Create time off request' })
    expect(createBtns.length).toBeGreaterThan(0)

    fireEvent.click(createBtns[0])
    expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('open_time_off=1'))
  })

  it('partial overlap: shows Extend and Create new options in left panel', async () => {
    render(<SubFinderPage />)

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
    render(<SubFinderPage />)

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
    render(<SubFinderPage />)

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
