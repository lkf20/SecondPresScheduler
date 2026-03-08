import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StaffFormClient from '@/components/staff/StaffFormClient'

const pushMock = jest.fn()
const refreshMock = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
  useSearchParams: () => new URLSearchParams(),
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
            role_type_ids: [],
            role_type_codes: [],
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

    await user.click(await screen.findByLabelText('Substitute'))

    await waitFor(() => {
      expect(screen.getByTestId('staff-editor-tabs')).toHaveAttribute(
        'data-show-availability',
        'false'
      )
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

    await user.click(await screen.findByLabelText('Substitute'))
    await user.click(screen.getByRole('button', { name: 'Go Preferences' }))

    expect(screen.getByTestId('staff-editor-tabs')).toHaveAttribute('data-active-tab', 'overview')
    expect(screen.getByTestId('unsaved-dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Discard and continue' }))

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

    await user.click(await screen.findByLabelText('Substitute'))
    await waitFor(() => {
      expect(screen.getByTestId('staff-editor-tabs')).toHaveAttribute(
        'data-show-availability',
        'false'
      )
    })
    await user.click(screen.getByRole('button', { name: 'Go Availability' }))

    expect(screen.getByTestId('unsaved-dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Discard and continue' }))

    await waitFor(() => {
      expect(screen.getByTestId('staff-editor-tabs')).toHaveAttribute(
        'data-active-tab',
        'preferences'
      )
    })
  })
})
