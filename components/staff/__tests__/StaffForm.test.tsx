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

    await user.click(screen.getByLabelText('Eligible to be assigned as a substitute'))
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

describe('StaffForm role combinations', () => {
  const roleTypes = [
    { id: 'role-perm', code: 'PERMANENT', label: 'Permanent' },
    { id: 'role-flex', code: 'FLEXIBLE', label: 'Flexible' },
  ] as any

  const fillRequiredFields = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText(/First Name/i), 'Pat')
    await user.type(screen.getByLabelText(/Last Name/i), 'Lee')
  }

  it.each([
    {
      name: 'perm only',
      primaryRoleLabel: /Permanent/i,
      subChecked: false,
      expectedRoleIds: ['role-perm'],
      expectedIsSub: false,
    },
    {
      name: 'perm + sub',
      primaryRoleLabel: /Permanent/i,
      subChecked: true,
      expectedRoleIds: ['role-perm'],
      expectedIsSub: true,
    },
    {
      name: 'flex only',
      primaryRoleLabel: /Flexible/i,
      subChecked: false,
      expectedRoleIds: ['role-flex'],
      expectedIsSub: false,
    },
    {
      name: 'flex + sub',
      primaryRoleLabel: /Flexible/i,
      subChecked: true,
      expectedRoleIds: ['role-flex'],
      expectedIsSub: true,
    },
    {
      name: 'sub only',
      primaryRoleLabel: /Substitute only/i,
      subChecked: true,
      expectedRoleIds: [],
      expectedIsSub: true,
    },
  ])(
    'submits valid role combination: $name',
    async ({ primaryRoleLabel, subChecked, expectedRoleIds, expectedIsSub }) => {
      const user = userEvent.setup()
      const onSubmit = jest.fn(async () => true)

      render(<StaffForm roleTypes={roleTypes} onSubmit={onSubmit} />)

      await fillRequiredFields(user)
      await user.click(screen.getByLabelText(primaryRoleLabel))

      const subCheckbox = screen.getByLabelText('Eligible to be assigned as a substitute')
      if (subChecked) {
        await user.click(subCheckbox)
      }

      await user.click(screen.getByRole('button', { name: 'Create' }))

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          role_type_ids: expectedRoleIds,
          is_sub: expectedIsSub,
        })
      )
    }
  )

  it('blocks submit when neither primary role nor substitute is selected', async () => {
    const user = userEvent.setup()
    const onSubmit = jest.fn(async () => true)

    render(<StaffForm roleTypes={roleTypes} onSubmit={onSubmit} />)

    await fillRequiredFields(user)

    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(
        screen.getByText('Select at least one: Permanent, Flexible, or Substitute.')
      ).toBeInTheDocument()
    })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('forces substitute eligibility on and locked when Substitute only is selected', async () => {
    const user = userEvent.setup()
    const onSubmit = jest.fn(async () => true)

    render(<StaffForm roleTypes={roleTypes} onSubmit={onSubmit} />)

    await fillRequiredFields(user)
    await user.click(screen.getByLabelText(/Substitute only/i))

    const subCheckbox = screen.getByLabelText('Eligible to be assigned as a substitute')
    expect(subCheckbox).toBeChecked()
    expect(subCheckbox).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        role_type_ids: [],
        is_sub: true,
      })
    )
  })
})
