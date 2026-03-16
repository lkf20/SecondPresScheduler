/**
 * Find Sub hot button tests.
 *
 * Find Sub now navigates directly to the Sub Finder page with open_teacher=1
 * so the teacher dropdown is open and the user can pick a teacher there.
 *
 * Scenarios covered:
 * 1. Find Sub button is visible.
 * 2. Clicking Find Sub navigates to /sub-finder?open_teacher=1.
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

jest.mock('@/lib/contexts/AssignSubPanelContext', () => ({
  useAssignSubPanel: () => ({
    assignSubInitials: null,
    clearAssignSubRequest: jest.fn(),
  }),
}))

jest.mock('@/lib/utils/colors', () => ({
  getPanelBackgroundClasses: () => '',
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

describe('Header Find Sub hot button', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows Find Sub button', async () => {
    render(<Header />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /find sub/i })).toBeInTheDocument()
    })
  })

  it('navigates to Sub Finder with open_teacher=1 when Find Sub is clicked', async () => {
    render(<Header />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /find sub/i })).toBeInTheDocument()
    })
    const findSubBtn = screen.getByRole('button', { name: /find sub/i })
    await userEvent.click(findSubBtn)
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith('/sub-finder?open_teacher=1')
  })
})
