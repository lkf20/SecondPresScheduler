import { render, screen, fireEvent } from '@testing-library/react'
import UnsavedChangesDialog from '@/components/schedules/UnsavedChangesDialog'

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
  }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}))

describe('UnsavedChangesDialog', () => {
  const onSave = jest.fn()
  const onDiscard = jest.fn()
  const onCancel = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows blockSaveReason and disables Save when blockSaveReason is set', () => {
    render(
      <UnsavedChangesDialog
        isOpen
        onSave={onSave}
        onDiscard={onDiscard}
        onCancel={onCancel}
        blockSaveReason="Resolve scheduling conflicts in the panel before saving."
      />
    )

    expect(
      screen.getByText('Resolve scheduling conflicts in the panel before saving.')
    ).toBeInTheDocument()
    const saveButton = screen.getByRole('button', { name: 'Save' })
    expect(saveButton).toBeDisabled()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows saveError and disables Save when saveError is set', () => {
    const errorMessage =
      'Cannot apply: Anne M. is already scheduled in Infant Room for Monday EM. Resolve that conflict first or apply only to this time slot.'
    render(
      <UnsavedChangesDialog
        isOpen
        onSave={onSave}
        onDiscard={onDiscard}
        onCancel={onCancel}
        saveError={errorMessage}
      />
    )

    expect(screen.getByText(errorMessage)).toBeInTheDocument()
    const saveButton = screen.getByRole('button', { name: 'Save' })
    expect(saveButton).toBeDisabled()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('when both blockSaveReason and saveError are set, shows saveError and disables Save', () => {
    render(
      <UnsavedChangesDialog
        isOpen
        onSave={onSave}
        onDiscard={onDiscard}
        onCancel={onCancel}
        blockSaveReason="Resolve conflicts first."
        saveError="Save failed: conflict."
      />
    )

    expect(screen.getByText('Save failed: conflict.')).toBeInTheDocument()
    expect(screen.queryByText('Resolve conflicts first.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('when no error or block reason, Save is enabled and Cancel/Discard work', () => {
    render(
      <UnsavedChangesDialog isOpen onSave={onSave} onDiscard={onDiscard} onCancel={onCancel} />
    )

    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onDiscard).toHaveBeenCalledTimes(1)
  })

  it('when saving, Save shows Saving... and is disabled', () => {
    render(
      <UnsavedChangesDialog
        isOpen
        onSave={onSave}
        onDiscard={onDiscard}
        onCancel={onCancel}
        saving
      />
    )

    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled()
  })
})
