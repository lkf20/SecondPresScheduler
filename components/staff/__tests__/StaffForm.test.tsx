import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StaffForm from '@/components/staff/StaffForm'

describe('StaffForm dirty tracking', () => {
  it('treats cached draft as unsaved when it differs from server staff state', async () => {
    const user = userEvent.setup()
    const onSubmit = jest.fn(async () => {})

    const staff = {
      id: 'staff-1',
      first_name: 'Anne',
      last_name: 'M',
      display_name: 'Anne M.',
      phone: null,
      email: 'anne@example.com',
      role_type_ids: ['role-perm'],
      active: true,
      is_sub: false,
    } as any

    const roleTypes = [
      { id: 'role-perm', code: 'PERMANENT', label: 'Permanent' },
      { id: 'role-flex', code: 'FLEXIBLE', label: 'Flexible' },
    ] as any

    const draftCacheKey = 'staff-form:staff-1:test'

    const seeded = render(
      <StaffForm
        staff={staff}
        roleTypes={roleTypes}
        draftCacheKey={draftCacheKey}
        onSubmit={onSubmit}
      />
    )

    await user.click(screen.getByLabelText('Substitute'))
    seeded.unmount()

    render(
      <StaffForm
        staff={staff}
        roleTypes={roleTypes}
        draftCacheKey={draftCacheKey}
        onSubmit={onSubmit}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Update' })).toBeEnabled()
    })
  })

  it('does not clear dirty state when submit fails', async () => {
    const user = userEvent.setup()
    const onDirtyChange = jest.fn()
    const onSubmit = jest.fn(async () => false)

    const roleTypes = [{ id: 'role-perm', code: 'PERMANENT', label: 'Permanent' }] as any

    render(<StaffForm roleTypes={roleTypes} onSubmit={onSubmit} onDirtyChange={onDirtyChange} />)

    await user.type(screen.getByLabelText(/First Name/i), 'Anne')
    await user.type(screen.getByLabelText(/Last Name/i), 'M')
    await user.click(screen.getByLabelText(/Permanent/i))
    const falseCallsBeforeSubmit = onDirtyChange.mock.calls.filter(call => call[0] === false).length
    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled()
    })

    const falseCallsAfterSubmit = onDirtyChange.mock.calls.filter(call => call[0] === false).length
    expect(falseCallsAfterSubmit).toBe(falseCallsBeforeSubmit)
  })
})
