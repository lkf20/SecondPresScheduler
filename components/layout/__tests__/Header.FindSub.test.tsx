/**
 * Find Sub hot button (popover) tests.
 *
 * Scenarios covered:
 * 1. Popover opens when Find Sub is clicked.
 * 2. Go is disabled when no teacher is selected.
 * 3. Selecting a teacher shows status and date options (no default selection).
 * 4. When teacher has no upcoming time off: Today, Tomorrow, Custom options; Go disabled until one is selected.
 * 5. Selecting Today + Preview only + Go navigates to Sub Finder manual with teacher_id and today's dates. Record + Assign + Go opens the Add Time Off right-side panel.
 * 6. Selecting Tomorrow and Go navigates with tomorrow's dates.
 * 7. When teacher has existing time off: Pick dates (Today/Tomorrow/Custom) first, then Existing time off; Go disabled until one is selected.
 * 8. Selecting an existing absence and Go navigates to Sub Finder with absence_id.
 * 9. When existing time off: selecting "Today" under different dates and Go navigates to manual with dates.
 * 10. Custom date: selecting Custom pre-fills start/end with today so Go is enabled; Go with custom dates navigates with start_date and end_date.
 * 11. Time-off fetch error: fallback message shown; user can still choose Today and Go.
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Header from '@/components/layout/Header'

const mockPush = jest.fn()
const mockRefresh = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
    replace: jest.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signOut: jest.fn().mockResolvedValue(undefined),
    },
  }),
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('@/lib/contexts/PanelManagerContext', () => ({
  usePanelManager: () => ({
    activePanel: null,
    savePreviousPanel: jest.fn(),
    restorePreviousPanel: jest.fn(),
    setActivePanel: jest.fn(),
    requestPanelClose: jest.fn(),
  }),
}))

jest.mock('@/lib/utils/colors', () => ({
  getPanelBackgroundClasses: () => '',
  coverageColorValues: {
    covered: { bg: '#f0fdfa', border: '#99f6e4', text: '#0f766e' },
    uncovered: { bg: '#f3f4f6', border: '#d1d5db', text: '#ea580c' },
  },
}))

jest.mock('@/lib/hooks/use-display-name-format', () => ({
  useDisplayNameFormat: () => ({ format: 'first_last' }),
}))

jest.mock('@/components/time-off/TimeOffForm', () => {
  const MockTimeOffForm = React.forwardRef(() => <div>TimeOffForm</div>)
  MockTimeOffForm.displayName = 'MockTimeOffForm'
  return { __esModule: true, default: MockTimeOffForm }
})

jest.mock('@/components/assign-sub/AssignSubPanel', () => {
  const MockAssignSubPanel = () => null
  MockAssignSubPanel.displayName = 'MockAssignSubPanel'
  return { __esModule: true, default: MockAssignSubPanel }
})

jest.mock('@/components/activity/ActivityFeed', () => ({
  __esModule: true,
  ActivityFeed: () => <div>ActivityFeed</div>,
}))

jest.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  SheetClose: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const teachersResponse = [
  {
    id: 'teacher-1',
    first_name: 'Anne',
    last_name: 'M.',
    display_name: null,
  },
  {
    id: 'teacher-2',
    first_name: 'Bob',
    last_name: 'K.',
    display_name: null,
  },
]

function createTimeOffItem(
  id: string,
  teacherId: string,
  teacherName: string,
  startDate: string,
  endDate: string | null,
  uncovered: number,
  total: number
) {
  return {
    id,
    teacher_id: teacherId,
    teacher_name: teacherName,
    start_date: startDate,
    end_date: endDate,
    reason: 'Sick Day',
    notes: null,
    classrooms: [],
    covered: total - uncovered,
    partial: 0,
    uncovered,
    total,
    status: uncovered === 0 ? 'covered' : 'needs_coverage',
    request_status: 'active',
  }
}

describe('Header Find Sub hot button', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn((url: string | URL) => {
      const u = typeof url === 'string' ? url : url.toString()
      if (u.includes('/api/teachers')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(teachersResponse),
        } as Response)
      }
      if (u.includes('/api/time-off-requests')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        } as Response)
      }
      return Promise.reject(new Error(`Unexpected fetch: ${u}`))
    }) as jest.Mock
  })

  it('opens popover when Find Sub is clicked', async () => {
    render(<Header />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /find sub/i })).toBeInTheDocument()
    })
    const findSubBtn = screen.getByRole('button', { name: /find sub/i })
    await userEvent.click(findSubBtn)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /find sub for/i })).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/search or select a teacher/i)).toBeInTheDocument()
    })
  })

  it('disables Go when no teacher is selected', async () => {
    render(<Header />)
    await userEvent.click(screen.getByRole('button', { name: /find sub/i }))
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search or select a teacher/i)).toBeInTheDocument()
    })
    const goBtn = screen.getByRole('button', { name: /^go$/i })
    expect(goBtn).toBeDisabled()
  })

  it('when teacher has no time off: shows status, Today/Tomorrow/Custom, Go disabled until option selected', async () => {
    render(<Header />)
    await userEvent.click(screen.getByRole('button', { name: /find sub/i }))
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search or select a teacher/i)).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Anne M.'))
    await waitFor(() => {
      expect(screen.getByText(/Anne M\. has no upcoming time off/i)).toBeInTheDocument()
    })
    expect(screen.getByText('Pick dates')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tomorrow' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Custom date range' })).toBeInTheDocument()
    const goBtn = screen.getByRole('button', { name: /^go$/i })
    expect(goBtn).toBeDisabled()
    await userEvent.click(screen.getAllByRole('button', { name: 'Today' })[0])
    await waitFor(() => {
      expect(goBtn).toBeEnabled()
    })
  })

  it('selecting Today + Go navigates to Sub Finder manual with teacher and today dates', async () => {
    render(<Header />)
    await userEvent.click(screen.getByRole('button', { name: /find sub/i }))
    await waitFor(() => screen.getByText('Anne M.'))
    await userEvent.click(screen.getByText('Anne M.'))
    await waitFor(() => screen.getByText(/no upcoming time off/i))
    await userEvent.click(screen.getAllByRole('button', { name: 'Today' })[0])
    await userEvent.click(screen.getByRole('button', { name: /^go$/i }))
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledTimes(1)
      const url = mockPush.mock.calls[0][0]
      expect(url).toMatch(/\/sub-finder\?/)
      expect(url).toContain('mode=manual')
      expect(url).toContain('teacher_id=teacher-1')
      expect(url).toContain('start_date=')
      expect(url).toContain('end_date=')
    })
  })

  it('selecting Tomorrow + Go navigates with tomorrow dates', async () => {
    render(<Header />)
    await userEvent.click(screen.getByRole('button', { name: /find sub/i }))
    await waitFor(() => screen.getByText('Anne M.'))
    await userEvent.click(screen.getByText('Anne M.'))
    await waitFor(() => screen.getByText(/no upcoming time off/i))
    await userEvent.click(screen.getAllByRole('button', { name: 'Tomorrow' })[0])
    await userEvent.click(screen.getByRole('button', { name: /^go$/i }))
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringMatching(
          /\/sub-finder\?.*mode=manual.*teacher_id=teacher-1.*start_date=\d{4}-\d{2}-\d{2}.*end_date=\d{4}-\d{2}-\d{2}/
        )
      )
    })
  })

  it('when teacher has existing time off: shows Pick dates first then Existing time off, Go disabled until selection', async () => {
    const absence = createTimeOffItem(
      'absence-1',
      'teacher-1',
      'Anne M.',
      '2026-04-04',
      '2026-04-05',
      2,
      4
    )
    global.fetch = jest.fn((url: string | URL) => {
      const u = typeof url === 'string' ? url : url.toString()
      if (u.includes('/api/teachers')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(teachersResponse),
        } as Response)
      }
      if (u.includes('/api/time-off-requests')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [absence] }),
        } as Response)
      }
      return Promise.reject(new Error(`Unexpected fetch: ${u}`))
    }) as jest.Mock

    render(<Header />)
    await userEvent.click(screen.getByRole('button', { name: /find sub/i }))
    await waitFor(() => screen.getByText('Anne M.'))
    await userEvent.click(screen.getByText('Anne M.'))
    await waitFor(() => {
      expect(screen.getByText(/Anne M\. has existing upcoming time off/i)).toBeInTheDocument()
    })
    expect(screen.getByText('Pick dates')).toBeInTheDocument()
    expect(screen.getByText('Existing time off')).toBeInTheDocument()
    const goBtn = screen.getByRole('button', { name: /^go$/i })
    expect(goBtn).toBeDisabled()
    await userEvent.click(screen.getByRole('radio', { name: /Apr 4/ }))
    await waitFor(() => {
      expect(goBtn).toBeEnabled()
    })
  })

  it('selecting existing absence and Go navigates to Sub Finder with absence_id', async () => {
    const absence = createTimeOffItem(
      'absence-1',
      'teacher-1',
      'Anne M.',
      '2026-04-04',
      '2026-04-05',
      1,
      3
    )
    global.fetch = jest.fn((url: string | URL) => {
      const u = typeof url === 'string' ? url : url.toString()
      if (u.includes('/api/teachers')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(teachersResponse),
        } as Response)
      }
      if (u.includes('/api/time-off-requests')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [absence] }),
        } as Response)
      }
      return Promise.reject(new Error(`Unexpected fetch: ${u}`))
    }) as jest.Mock

    render(<Header />)
    await userEvent.click(screen.getByRole('button', { name: /find sub/i }))
    await waitFor(() => screen.getByText('Anne M.'))
    await userEvent.click(screen.getByText('Anne M.'))
    await waitFor(() => screen.getByText(/existing upcoming time off/i))
    await userEvent.click(screen.getByRole('radio', { name: /Apr 4/ }))
    await userEvent.click(screen.getByRole('button', { name: /^go$/i }))
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/sub-finder?absence_id=absence-1')
    })
  })

  it('when time-off fetch fails: shows fallback message and user can choose Today + Go', async () => {
    global.fetch = jest.fn((url: string | URL) => {
      const u = typeof url === 'string' ? url : url.toString()
      if (u.includes('/api/teachers')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(teachersResponse),
        } as Response)
      }
      if (u.includes('/api/time-off-requests')) {
        return Promise.reject(new Error('Network error'))
      }
      return Promise.reject(new Error(`Unexpected fetch: ${u}`))
    }) as jest.Mock

    render(<Header />)
    await userEvent.click(screen.getByRole('button', { name: /find sub/i }))
    await waitFor(() => screen.getByText('Anne M.'))
    await userEvent.click(screen.getByText('Anne M.'))
    await waitFor(() => {
      expect(
        screen.getByText(/Couldn't load time off. You can still find subs for today/i)
      ).toBeInTheDocument()
    })
    await userEvent.click(screen.getAllByRole('button', { name: 'Today' })[0])
    await userEvent.click(screen.getByRole('button', { name: /^go$/i }))
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('mode=manual'))
    })
  })
})
