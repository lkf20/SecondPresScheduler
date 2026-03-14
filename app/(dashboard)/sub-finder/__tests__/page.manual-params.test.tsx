/**
 * Sub Finder page: manual URL params from Find Sub hot button.
 *
 * When the user is already on Sub Finder (e.g. viewing Anne M. Mar 16–20) and uses
 * the Find Sub hot button to pick the same teacher and a new range (e.g. Mar 26–27),
 * the page must apply the new manual params and update (mode, teacher, dates, clear
 * selected absence and manual shifts so the new finder runs).
 *
 * This test verifies that when the page receives manual URL params, it applies them
 * and replaces the URL (so the effect runs every time the params are present, not
 * only on first mount).
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SubFinderPage from '../page'

const mockReplace = jest.fn()
const mockPush = jest.fn()

// Simulate Next.js: after router.replace the URL (and thus searchParams) updates so the
// apply-manual-params effect does not re-run in a loop.
const urlParamsState: { current: string } = {
  current: 'mode=manual&teacher_id=teacher-1&start_date=2026-03-26&end_date=2026-03-27',
}

// Return stable URLSearchParams per URL string so effect deps don't loop
const paramsCache: Record<string, URLSearchParams> = {}
function getSearchParams() {
  const s = urlParamsState.current
  if (!paramsCache[s]) paramsCache[s] = new URLSearchParams(s)
  return paramsCache[s]
}

// Stable router reference so layout effect deps don't cause a loop
const mockRouter = {
  push: mockPush,
  replace: (url: string) => {
    mockReplace(url)
    urlParamsState.current = url === '/sub-finder' ? '' : url.replace(/^\/sub-finder\?/, '')
  },
}

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/sub-finder',
  useSearchParams: () => getSearchParams(),
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

jest.mock('@/lib/contexts/SchoolContext', () => ({
  useSchool: () => 'school-1',
}))

// Avoid fetch not defined and avoid ShiftSelectionTable's API calls
global.fetch = jest.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
) as jest.Mock

jest.mock('@/components/time-off/ShiftSelectionTable', () => ({
  __esModule: true,
  default: () => <div data-testid="shift-selection-table" />,
}))

jest.mock('@/components/ui/date-picker-input', () => {
  return function MockDatePickerInput({ value, onChange, placeholder }: any) {
    return (
      <input
        data-testid={placeholder ? `mock-datepicker-${placeholder}` : 'mock-datepicker'}
        value={value || ''}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    )
  }
})

const mockTeachers = [{ id: 'teacher-1', first_name: 'Anne', last_name: 'M.', display_name: null }]
const mockGetDisplayName = jest.fn(
  (t: (typeof mockTeachers)[0]) => `${t.first_name} ${t.last_name}.`
)
const mockSetSelectedAbsence = jest.fn()
const mockSetRecommendedCombinations = jest.fn()
const mockApplySubResults = jest.fn()

jest.mock('@/components/sub-finder/hooks/useSubFinderData', () => ({
  useSubFinderData: () => ({
    absences: [],
    selectedAbsence: null,
    setSelectedAbsence: mockSetSelectedAbsence,
    recommendedSubs: [],
    allSubs: [],
    recommendedCombinations: [],
    setRecommendedCombinations: mockSetRecommendedCombinations,
    loading: false,
    includePartiallyCovered: false,
    setIncludePartiallyCovered: jest.fn(),
    includeFlexibleStaff: false,
    setIncludeFlexibleStaff: jest.fn(),
    includeOnlyRecommended: false,
    setIncludeOnlyRecommended: jest.fn(),
    teachers: mockTeachers,
    getDisplayName: mockGetDisplayName,
    fetchAbsences: jest.fn(),
    handleFindSubs: jest.fn(),
    handleFindManualSubs: jest.fn(),
    applySubResults: mockApplySubResults,
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

jest.mock('@/lib/utils/sub-finder-state', () => ({
  loadSubFinderState: () => null,
  saveSubFinderState: jest.fn(),
  clearSubFinderState: jest.fn(),
}))

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

// So that start_date=2026-03-26 is treated as custom (not today/tomorrow)
jest.mock('@/lib/utils/date', () => ({
  ...jest.requireActual('@/lib/utils/date'),
  getTodayISO: () => '2026-03-09',
  getTomorrowISO: () => '2026-03-10',
}))

describe('Sub Finder page – manual URL params from Find Sub', () => {
  beforeEach(() => {
    mockReplace.mockClear()
    urlParamsState.current =
      'mode=manual&teacher_id=teacher-1&start_date=2026-03-26&end_date=2026-03-27'
  })

  it('applies manual URL params and replaces URL so page updates for new date range', async () => {
    renderWithQueryClient(<SubFinderPage />)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledTimes(1)
      const [url] = mockReplace.mock.calls[0]
      expect(url).toMatch(/^\/sub-finder(\?|$)/)
      expect(url).not.toContain('mode=manual')
      expect(url).not.toContain('teacher_id=')
      expect(url).not.toContain('start_date=')
      expect(url).not.toContain('end_date=')
    })
  })

  it('with custom date in URL, sets pickDateChoice to custom and shows start date in picker', async () => {
    renderWithQueryClient(<SubFinderPage />)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalled()
    })

    // Manual mode with custom date: start date input should show URL date
    const startDateInputs = screen.getAllByDisplayValue('2026-03-26')
    expect(startDateInputs.length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('shift-selection-table').length).toBeGreaterThan(0)
  })

  it('with teacher_id not in list, applies manual params and replaces URL without crashing', async () => {
    urlParamsState.current =
      'mode=manual&teacher_id=unknown-teacher-id&start_date=2026-03-26&end_date=2026-03-26'

    renderWithQueryClient(<SubFinderPage />)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledTimes(1)
      const [url] = mockReplace.mock.calls[0]
      expect(url).not.toContain('teacher_id=')
      expect(url).not.toContain('start_date=')
    })

    // Page is in manual mode (shift table present)
    expect(screen.getAllByTestId('shift-selection-table').length).toBeGreaterThan(0)
  })
})
