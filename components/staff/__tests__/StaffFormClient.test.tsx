import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StaffFormClient from '@/components/staff/StaffFormClient'

const pushMock = jest.fn()
const refreshMock = jest.fn()
const backMock = jest.fn()
let mockSearchParams = new URLSearchParams()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock, back: backMock }),
  useSearchParams: () => mockSearchParams,
}))

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: jest.fn().mockResolvedValue(undefined),
  }),
}))

jest.mock('@/lib/contexts/SchoolContext', () => ({
  useSchool: () => 'school-1',
}))

const staffEditorTabsMock = jest.fn((props: any) => (
  <div
    data-testid="staff-editor-tabs"
    data-show-availability={props.showAvailabilityTab}
    data-active-tab={props.activeTab}
  >
    <button type="button" onClick={() => props.onActiveTabChange('overview')}>
      Go Overview
    </button>
    <button type="button" onClick={() => props.onActiveTabChange('availability')}>
      Go Availability
    </button>
    <button type="button" onClick={() => props.onActiveTabChange('preferences')}>
      Go Preferences
    </button>
    <button type="button" onClick={() => props.onActiveTabChange('notes')}>
      Go Notes
    </button>
    {props.overview?.content}
  </div>
))

jest.mock('@/components/staff/StaffEditorTabs', () => ({
  __esModule: true,
  default: (props: any) => staffEditorTabsMock(props),
}))

jest.mock('@/components/staff/StaffUnsavedChangesDialog', () => ({
  __esModule: true,
  default: (props: any) =>
    props.open ? (
      <div data-testid="unsaved-dialog">
        <button type="button" onClick={props.onKeepEditing}>
          {props.keepEditingLabel || 'Keep Editing'}
        </button>
        {props.onSaveAndContinue ? (
          <button type="button" onClick={props.onSaveAndContinue}>
            {props.saveLabel || 'Save & Continue'}
          </button>
        ) : null}
        <button type="button" onClick={props.onDiscardAndLeave}>
          {props.discardLabel || 'Discard & Leave'}
        </button>
      </div>
    ) : null,
}))

jest.mock('@/components/subs/SubAvailabilitySection', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/subs/SubPreferencesSection', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/subs/SubNotesSection', () => ({
  __esModule: true,
  default: () => null,
}))

const originalFetch = global.fetch

describe('StaffFormClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams = new URLSearchParams()
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/staff-role-types')) {
        return { ok: true, json: async () => [] } as Response
      }
      if (url.includes('/api/schedule-settings')) {
        return {
          ok: true,
          json: async () => ({ default_display_name_format: 'first_last_initial' }),
        } as Response
      }
      if (url.includes('/api/staff')) {
        return { ok: true, json: async () => [{ id: 'staff-1' }] } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    }) as jest.Mock
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('shows inactive baseline warning when staff is inactive and still used', async () => {
    render(
      <StaffFormClient
        staff={
          {
            id: 'staff-1',
            first_name: 'Amy',
            last_name: 'P',
            active: false,
            is_sub: false,
            school_id: 'school-1',
            role_type_ids: [],
            role_type_codes: [],
          } as any
        }
        showInactiveBaselineWarning
      />
    )

    expect(
      await screen.findByText(
        'This staff member is marked as inactive but still appears in the baseline schedule.'
      )
    ).toBeInTheDocument()
    await waitFor(() => {
      expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(3)
    })
  })

  it('does not show inactive baseline warning when prop is false', async () => {
    render(
      <StaffFormClient
        staff={
          {
            id: 'staff-1',
            first_name: 'Amy',
            last_name: 'P',
            active: false,
            is_sub: false,
            school_id: 'school-1',
            role_type_ids: [],
            role_type_codes: [],
          } as any
        }
      />
    )

    await waitFor(() => {
      expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(3)
    })
    expect(
      screen.queryByText(
        'This staff member is marked as inactive but still appears in the baseline schedule.'
      )
    ).not.toBeInTheDocument()
  })

  it('hides Availability tab when Substitute is unchecked', async () => {
    const user = userEvent.setup()

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/staff-role-types')) {
        return {
          ok: true,
          json: async () => [
            { id: 'role-perm', code: 'PERMANENT', label: 'Permanent' },
            { id: 'role-flex', code: 'FLEXIBLE', label: 'Flexible' },
          ],
        } as Response
      }
      if (url.includes('/api/schedule-settings')) {
        return {
          ok: true,
          json: async () => ({ default_display_name_format: 'first_last_initial' }),
        } as Response
      }
      if (url.includes('/api/staff')) {
        return { ok: true, json: async () => [{ id: 'staff-1' }] } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    }) as jest.Mock

    // Staff has PERMANENT role + is_sub so the substitute checkbox is enabled (not disabled as "Substitute only")
    render(
      <StaffFormClient
        staff={
          {
            id: 'staff-tab-redirect-1',
            first_name: 'Amy',
            last_name: 'P',
            active: true,
            is_sub: true,
            school_id: 'school-1',
            role_type_ids: ['role-perm'],
            role_type_codes: ['PERMANENT'],
          } as any
        }
      />
    )

    await waitFor(() =>
      expect(screen.getByTestId('staff-editor-tabs')).toHaveAttribute('data-show-availability')
    )
    expect(screen.getByTestId('staff-editor-tabs')).toHaveAttribute(
      'data-show-availability',
      'true'
    )

    await user.click(await screen.findByLabelText('Eligible to be assigned as a substitute'))

    await waitFor(() => {
      expect(screen.getByTestId('staff-editor-tabs')).toHaveAttribute(
        'data-show-availability',
        'false'
      )
    })
  })

  it('stays on Overview when toggling substitute eligibility if URL has tab=preferences', async () => {
    const user = userEvent.setup()
    mockSearchParams = new URLSearchParams('tab=preferences')

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/staff-role-types')) {
        return {
          ok: true,
          json: async () => [
            { id: 'role-perm', code: 'PERMANENT', label: 'Permanent' },
            { id: 'role-flex', code: 'FLEXIBLE', label: 'Flexible' },
          ],
        } as Response
      }
      if (url.includes('/api/schedule-settings')) {
        return {
          ok: true,
          json: async () => ({ default_display_name_format: 'first_last_initial' }),
        } as Response
      }
      if (url.includes('/api/staff')) {
        return { ok: true, json: async () => [{ id: 'staff-1' }] } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    }) as jest.Mock

    render(
      <StaffFormClient
        staff={
          {
            id: 'staff-tab-stay-overview',
            first_name: 'Amy',
            last_name: 'P',
            active: true,
            is_sub: true,
            school_id: 'school-1',
            role_type_ids: ['role-perm'],
            role_type_codes: ['PERMANENT'],
          } as any
        }
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('staff-editor-tabs')).toHaveAttribute(
        'data-active-tab',
        'preferences'
      )
    })

    await user.click(screen.getByRole('button', { name: 'Go Overview' }))
    await waitFor(() => {
      expect(screen.getByTestId('staff-editor-tabs')).toHaveAttribute('data-active-tab', 'overview')
    })

    await user.click(await screen.findByLabelText('Eligible to be assigned as a substitute'))

    await waitFor(() => {
      expect(screen.getByTestId('staff-editor-tabs')).toHaveAttribute('data-active-tab', 'overview')
    })
  })

  it('prompts before switching tabs when overview has unsaved changes', async () => {
    const user = userEvent.setup()

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/staff-role-types')) {
        return {
          ok: true,
          json: async () => [
            { id: 'role-perm', code: 'PERMANENT', label: 'Permanent' },
            { id: 'role-flex', code: 'FLEXIBLE', label: 'Flexible' },
          ],
        } as Response
      }
      if (url.includes('/api/schedule-settings')) {
        return {
          ok: true,
          json: async () => ({ default_display_name_format: 'first_last_initial' }),
        } as Response
      }
      if (url.includes('/api/staff')) {
        return { ok: true, json: async () => [{ id: 'staff-1' }] } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    }) as jest.Mock

    render(
      <StaffFormClient
        staff={
          {
            id: 'staff-direct-route-1',
            first_name: 'Amy',
            last_name: 'P',
            active: true,
            is_sub: false,
            school_id: 'school-1',
            role_type_ids: ['role-perm'],
            role_type_codes: ['PERMANENT'],
          } as any
        }
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('staff-editor-tabs')).toHaveAttribute('data-active-tab', 'overview')
    })

    await user.click(await screen.findByLabelText('Eligible to be assigned as a substitute'))
    await user.click(screen.getByRole('button', { name: 'Go Preferences' }))

    expect(screen.getByTestId('staff-editor-tabs')).toHaveAttribute('data-active-tab', 'overview')
    expect(screen.getByTestId('unsaved-dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Discard' }))

    await waitFor(() => {
      expect(screen.getByTestId('staff-editor-tabs')).toHaveAttribute(
        'data-active-tab',
        'preferences'
      )
    })
  })

  it('redirects attempted Availability tab switch to Preferences when sub is unchecked', async () => {
    const user = userEvent.setup()

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/staff-role-types')) {
        return {
          ok: true,
          json: async () => [{ id: 'role-flex', code: 'FLEXIBLE', label: 'Flexible' }],
        } as Response
      }
      if (url.includes('/api/schedule-settings')) {
        return {
          ok: true,
          json: async () => ({ default_display_name_format: 'first_last_initial' }),
        } as Response
      }
      if (url.includes('/api/staff')) {
        return { ok: true, json: async () => [{ id: 'staff-1' }] } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    }) as jest.Mock

    render(
      <StaffFormClient
        staff={
          {
            id: 'staff-1',
            first_name: 'Amy',
            last_name: 'P',
            active: true,
            is_sub: true,
            school_id: 'school-1',
            role_type_ids: ['role-flex'],
            role_type_codes: ['FLEXIBLE'],
          } as any
        }
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('staff-editor-tabs')).toHaveAttribute('data-active-tab', 'overview')
    })

    await user.click(await screen.findByLabelText('Eligible to be assigned as a substitute'))
    await waitFor(() => {
      expect(screen.getByTestId('staff-editor-tabs')).toHaveAttribute(
        'data-show-availability',
        'false'
      )
    })
    await user.click(screen.getByRole('button', { name: 'Go Availability' }))

    expect(screen.getByTestId('unsaved-dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Discard' }))

    await waitFor(() => {
      expect(screen.getByTestId('staff-editor-tabs')).toHaveAttribute(
        'data-active-tab',
        'preferences'
      )
    })
  })

  it('shows Staff Settings back button and routes to /staff when coming from staff settings', async () => {
    const user = userEvent.setup()
    mockSearchParams = new URLSearchParams('from=staff-settings&tab=preferences')

    render(
      <StaffFormClient
        staff={
          {
            id: 'staff-1',
            first_name: 'Amy',
            last_name: 'P',
            active: true,
            is_sub: false,
            school_id: 'school-1',
            role_type_ids: [],
            role_type_codes: [],
          } as any
        }
      />
    )

    await waitFor(() => {
      expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(3)
    })

    const backButton = screen.getByRole('button', { name: 'Back to Staff Settings' })
    await user.click(backButton)

    expect(pushMock).toHaveBeenCalledWith('/staff')
    expect(backMock).not.toHaveBeenCalled()
  })

  it('shows Admin primary role when staff-role-types API includes ADMIN', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/staff-role-types')) {
        return {
          ok: true,
          json: async () => [
            { id: 'role-perm', code: 'PERMANENT', label: 'Permanent' },
            { id: 'role-flex', code: 'FLEXIBLE', label: 'Flexible' },
            { id: 'role-admin', code: 'ADMIN', label: 'Admin' },
          ],
        } as Response
      }
      if (url.includes('/api/schedule-settings')) {
        return {
          ok: true,
          json: async () => ({ default_display_name_format: 'first_last_initial' }),
        } as Response
      }
      if (url.includes('/api/staff')) {
        return { ok: true, json: async () => [{ id: 'staff-1' }] } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    }) as jest.Mock

    render(
      <StaffFormClient
        staff={
          {
            id: 'staff-admin-ui',
            first_name: 'Amy',
            last_name: 'P',
            active: true,
            is_sub: false,
            school_id: 'school-1',
            role_type_ids: [],
            role_type_codes: [],
          } as any
        }
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Admin' })).toBeInTheDocument()
    })
  })
})
