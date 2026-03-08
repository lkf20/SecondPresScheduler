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
import { render, waitFor } from '@testing-library/react'
import SubFinderPage from '../page'

const mockReplace = jest.fn()

// Simulate Next.js: after router.replace the URL (and thus searchParams) updates so the
// apply-manual-params effect does not re-run in a loop.
const urlParamsState: { current: string } = {
  current: 'mode=manual&teacher_id=teacher-1&start_date=2026-03-26&end_date=2026-03-27',
}

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: (url: string) => {
      mockReplace(url)
      urlParamsState.current = url === '/sub-finder' ? '' : url.replace(/^\/sub-finder\?/, '')
    },
  }),
  useSearchParams: () => new URLSearchParams(urlParamsState.current),
}))

// Avoid fetch not defined and avoid ShiftSelectionTable's API calls
global.fetch = jest.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
) as jest.Mock

jest.mock('@/components/time-off/ShiftSelectionTable', () => ({
  __esModule: true,
  default: () => <div data-testid="shift-selection-table" />,
}))

const mockTeachers = [{ id: 'teacher-1', first_name: 'Anne', last_name: 'M.', display_name: null }]

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

describe('Sub Finder page – manual URL params from Find Sub', () => {
  beforeEach(() => {
    mockReplace.mockClear()
    urlParamsState.current =
      'mode=manual&teacher_id=teacher-1&start_date=2026-03-26&end_date=2026-03-27'
  })

  it('applies manual URL params and replaces URL so page updates for new date range', async () => {
    render(<SubFinderPage />)

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
})
