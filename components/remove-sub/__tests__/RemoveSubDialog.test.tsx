import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RemoveSubDialog } from '../RemoveSubDialog'

describe('RemoveSubDialog', () => {
  const defaultContext = {
    absenceId: 'tor-1',
    subId: 'sub-1',
    subName: 'Jane D.',
    teacherName: 'Amy P.',
    assignmentId: 'assign-1',
    hasMultiple: false,
    isConfirmed: false,
  }

  it('renders dialog with single-shift copy when hasMultiple is false', () => {
    render(
      <RemoveSubDialog
        open
        onOpenChange={() => {}}
        context={defaultContext}
        onConfirm={() => {}}
        isPending={false}
      />
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/remove sub assignment/i)).toBeInTheDocument()
    expect(
      screen.getByText(/are you sure you want to remove jane d\. from this shift/i)
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /all shifts/i })).not.toBeInTheDocument()
  })

  it('renders All shifts option when hasMultiple is true', () => {
    render(
      <RemoveSubDialog
        open
        onOpenChange={() => {}}
        context={{ ...defaultContext, hasMultiple: true }}
        onConfirm={() => {}}
        isPending={false}
      />
    )

    expect(screen.getByRole('button', { name: /all shifts/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /this shift only/i })).toBeInTheDocument()
  })

  it('shows confirmed warning when isConfirmed is true', () => {
    render(
      <RemoveSubDialog
        open
        onOpenChange={() => {}}
        context={{ ...defaultContext, isConfirmed: true }}
        onConfirm={() => {}}
        isPending={false}
      />
    )

    expect(screen.getByText(/this sub is marked confirmed/i)).toBeInTheDocument()
  })

  it('calls onConfirm with single when Remove clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = jest.fn()

    render(
      <RemoveSubDialog
        open
        onOpenChange={() => {}}
        context={defaultContext}
        onConfirm={onConfirm}
        isPending={false}
      />
    )

    await user.click(screen.getByRole('button', { name: /remove/i }))
    expect(onConfirm).toHaveBeenCalledWith('single')
  })

  it('calls onConfirm with all_for_absence when All shifts clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = jest.fn()

    render(
      <RemoveSubDialog
        open
        onOpenChange={() => {}}
        context={{ ...defaultContext, hasMultiple: true }}
        onConfirm={onConfirm}
        isPending={false}
      />
    )

    await user.click(screen.getByRole('button', { name: /all shifts/i }))
    expect(onConfirm).toHaveBeenCalledWith('all_for_absence')
  })
})
