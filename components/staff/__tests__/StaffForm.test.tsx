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
})
