import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
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

jest.mock('@/components/staff/StaffEditorTabs', () => ({
  __esModule: true,
  default: () => <div data-testid="staff-editor-tabs" />,
}))

jest.mock('@/components/staff/StaffUnsavedChangesDialog', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/subs/SubAvailabilitySection', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/subs/SubPreferencesSection', () => ({
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
})
