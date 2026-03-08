/**
 * Sub Finder page: "Create time off?" banner when in manual mode with results (scenarios 1 & 2).
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SubFinderPage from '../page'

const mockPush = jest.fn()
const mockReplace = jest.fn()

const urlParamsState: { current: string } = { current: '' }

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: (url: string) => {
      mockReplace(url)
      urlParamsState.current = url === '/sub-finder' ? '' : url.replace(/^\/sub-finder\?/, '')
    },
  }),
  useSearchParams: () => new URLSearchParams(urlParamsState.current),
}))

global.fetch = jest.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
) as jest.Mock

jest.mock('@/components/time-off/ShiftSelectionTable', () => ({
  __esModule: true,
  default: () => <div data-testid="shift-selection-table" />,
}))

const mockTeachers = [{ id: 'teacher-1', first_name: 'Anne', last_name: 'M.', display_name: null }]

const manualAbsence = {
  id: 'manual-teacher-1',
  teacher_id: 'teacher-1',
  teacher_name: 'Anne M.',
  start_date: '2026-03-26',
  end_date: '2026-03-27',
  reason: null,
  shifts: {
    total: 2,
    uncovered: 2,
    partially_covered: 0,
    fully_covered: 0,
    shift_details: [],
  },
}

jest.mock('@/components/sub-finder/hooks/useSubFinderData', () => ({
  useSubFinderData: () => ({
    absences: [],
    selectedAbsence: manualAbsence,
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
    teachers: mockTeachers,
    getDisplayName: (t: (typeof mockTeachers)[0]) => `${t.first_name} ${t.last_name}.`,
    fetchAbsences: jest.fn(),
    handleFindSubs: jest.fn(),
    handleFindManualSubs: jest.fn(),
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

jest.mock('@/lib/utils/sub-finder-state', () => ({
  loadSubFinderState: () => null,
  saveSubFinderState: jest.fn(),
}))

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

describe('Sub Finder page – manual mode create time off banner', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockReplace.mockClear()
    urlParamsState.current =
      'mode=manual&teacher_id=teacher-1&start_date=2026-03-26&end_date=2026-03-27'
  })

  it('shows Create time off / Just browsing banner when manual results loaded (scenarios 1 & 2)', () => {
    render(<SubFinderPage />)

    expect(screen.getAllByText(/no time off request for this range yet/i).length).toBeGreaterThan(0)
    expect(
      screen.getAllByRole('button', { name: /create time off for this range/i }).length
    ).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /just browsing/i }).length).toBeGreaterThan(0)
  })

  it('Just browsing hides banner (scenario 2)', async () => {
    render(<SubFinderPage />)

    const justBrowsingButtons = screen.getAllByRole('button', { name: /just browsing/i })
    await userEvent.click(justBrowsingButtons[0])

    expect(screen.queryByText(/no time off request for this range yet/i)).not.toBeInTheDocument()
  })

  it('Create time off for this range navigates to time-off/new with params and return_to (scenario 1)', async () => {
    render(<SubFinderPage />)

    const createButtons = screen.getAllByRole('button', { name: /create time off for this range/i })
    await userEvent.click(createButtons[0])

    expect(mockPush).toHaveBeenCalledTimes(1)
    const [url] = mockPush.mock.calls[0]
    expect(url).toContain('/time-off/new?')
    expect(url).toContain('teacher_id=teacher-1')
    expect(url).toContain('start_date=2026-03-26')
    expect(url).toContain('end_date=2026-03-27')
    expect(url).toContain('return_to=sub-finder')
  })
})
