import React, { useImperativeHandle } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddTimeOffButton from '@/components/time-off/AddTimeOffButton'

const mockRefresh = jest.fn()
const mockPush = jest.fn()
const mockToastSuccess = jest.fn()
const mockSavePreviousPanel = jest.fn()
const mockRestorePreviousPanel = jest.fn()
const mockSetActivePanel = jest.fn()
const mockRequestPanelClose = jest.fn()
const mockFormReset = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: mockPush,
  }),
}))

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}))

jest.mock('@/lib/utils/colors', () => ({
  getPanelBackgroundClasses: () => '',
}))

jest.mock('@/lib/contexts/PanelManagerContext', () => ({
  usePanelManager: () => ({
    activePanel: 'weekly-schedule',
    savePreviousPanel: mockSavePreviousPanel,
    restorePreviousPanel: mockRestorePreviousPanel,
    setActivePanel: mockSetActivePanel,
    requestPanelClose: mockRequestPanelClose,
  }),
}))

jest.mock('@/components/ui/sheet', () => ({
  Sheet: ({
    children,
    onOpenChange,
  }: {
    children: React.ReactNode
    onOpenChange?: (open: boolean) => void
  }) => (
    <div>
      <button type="button" onClick={() => onOpenChange?.(false)}>
        Close Sheet
      </button>
      {children}
    </div>
  ),
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

jest.mock('@/components/time-off/TimeOffForm', () => {
  const MockTimeOffForm = React.forwardRef(function MockTimeOffForm(
    {
      onSuccess,
      onHasUnsavedChanges,
    }: {
      onSuccess?: (teacherName: string, startDate: string, endDate: string) => void
      onHasUnsavedChanges?: (hasChanges: boolean) => void
    },
    ref: React.Ref<{ reset: () => void }>
  ) {
    useImperativeHandle(ref, () => ({
      reset: () => mockFormReset(),
    }))

    return (
      <div>
        <button type="button" onClick={() => onHasUnsavedChanges?.(true)}>
          Mark Dirty
        </button>
        <button type="button" onClick={() => onSuccess?.('Bella W.', '2026-02-09', '2026-02-09')}>
          Submit Success
        </button>
      </div>
    )
  })
  return MockTimeOffForm
})

describe('AddTimeOffButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('opens add time off and coordinates panel manager state', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })

    render(<AddTimeOffButton />)

    await user.click(screen.getByRole('button', { name: /add time off/i }))

    expect(mockSavePreviousPanel).toHaveBeenCalledWith('weekly-schedule')
    expect(mockRequestPanelClose).toHaveBeenCalledWith('weekly-schedule')
    expect(mockSetActivePanel).toHaveBeenCalledWith('time-off')
    expect(screen.getByRole('heading', { name: /add time off request/i })).toBeInTheDocument()
  })

  it('shows success toast and refreshes after successful submit', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })

    render(<AddTimeOffButton />)

    await user.click(screen.getByRole('button', { name: /add time off/i }))
    await user.click(screen.getByRole('button', { name: /submit success/i }))

    expect(mockToastSuccess).toHaveBeenCalledWith(
      expect.stringMatching(/time off added for bella w\./i)
    )
    expect(mockRefresh).toHaveBeenCalled()

    jest.advanceTimersByTime(120)
    await waitFor(() => expect(mockRestorePreviousPanel).toHaveBeenCalled())
  })

  it('renders edit mode without add trigger and supports discard flow', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    const onClose = jest.fn()

    render(<AddTimeOffButton timeOffRequestId="request-1" onClose={onClose} />)

    expect(screen.queryByRole('button', { name: /add time off/i })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /edit time off request/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /mark dirty/i }))
    await user.click(screen.getByRole('button', { name: /close sheet/i }))

    expect(mockSetActivePanel).not.toHaveBeenCalledWith(null)

    await user.click(screen.getByRole('button', { name: /discard changes/i }))

    expect(mockFormReset).toHaveBeenCalled()
    expect(mockSetActivePanel).toHaveBeenCalledWith(null)
    jest.advanceTimersByTime(120)
    await waitFor(() => expect(mockRestorePreviousPanel).toHaveBeenCalled())
    expect(onClose).toHaveBeenCalled()
  })

  it('uses custom renderTrigger when provided', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(
      <AddTimeOffButton
        renderTrigger={({ onClick }) => (
          <button type="button" onClick={onClick}>
            Open Custom Trigger
          </button>
        )}
      />
    )

    await user.click(screen.getByRole('button', { name: /open custom trigger/i }))
    expect(mockSetActivePanel).toHaveBeenCalledWith('time-off')
    expect(screen.getByRole('heading', { name: /add time off request/i })).toBeInTheDocument()
  })
})
