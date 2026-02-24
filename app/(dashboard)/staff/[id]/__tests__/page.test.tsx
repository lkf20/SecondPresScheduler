import React from 'react'
import { render, screen } from '@testing-library/react'
import StaffDetailPage from '@/app/(dashboard)/staff/[id]/page'
import { getStaffById } from '@/lib/api/staff'
import { getScheduleSettings } from '@/lib/api/schedule-settings'
import { isStaffUsedInBaselineSchedule } from '@/lib/api/baseline-usage'

jest.mock('@/lib/api/staff', () => ({
  getStaffById: jest.fn(),
}))

jest.mock('@/lib/api/schedule-settings', () => ({
  getScheduleSettings: jest.fn(),
}))

jest.mock('@/lib/api/baseline-usage', () => ({
  isStaffUsedInBaselineSchedule: jest.fn(),
}))

jest.mock('@/components/staff/StaffFormClient', () => ({
  __esModule: true,
  default: ({
    showInactiveBaselineWarning,
    defaultDisplayNameFormat,
  }: {
    showInactiveBaselineWarning: boolean
    defaultDisplayNameFormat?: string
  }) => (
    <div
      data-testid="staff-form-client"
      data-warning={String(showInactiveBaselineWarning)}
      data-format={defaultDisplayNameFormat ?? ''}
    />
  ),
}))

jest.mock('@/components/shared/ErrorMessage', () => ({
  __esModule: true,
  default: ({ message }: { message: string }) => <div data-testid="error-message">{message}</div>,
}))

describe('Staff detail page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('passes inactive baseline warning when staff is inactive and used', async () => {
    ;(getStaffById as jest.Mock).mockResolvedValue({
      id: 'staff-1',
      school_id: 'school-1',
      active: false,
    })
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({
      default_display_name_format: 'first_last',
    })
    ;(isStaffUsedInBaselineSchedule as jest.Mock).mockResolvedValue(true)

    const ui = await StaffDetailPage({ params: Promise.resolve({ id: 'staff-1' }) })
    render(ui)

    expect(isStaffUsedInBaselineSchedule).toHaveBeenCalledWith('staff-1', { schoolId: 'school-1' })
    expect(screen.getByTestId('staff-form-client')).toHaveAttribute('data-warning', 'true')
    expect(screen.getByTestId('staff-form-client')).toHaveAttribute('data-format', 'first_last')
  })

  it('skips inactive baseline check when staff is active', async () => {
    ;(getStaffById as jest.Mock).mockResolvedValue({
      id: 'staff-1',
      school_id: 'school-1',
      active: true,
    })
    ;(getScheduleSettings as jest.Mock).mockResolvedValue({
      default_display_name_format: 'first_last_initial',
    })

    const ui = await StaffDetailPage({ params: Promise.resolve({ id: 'staff-1' }) })
    render(ui)

    expect(isStaffUsedInBaselineSchedule).not.toHaveBeenCalled()
    expect(screen.getByTestId('staff-form-client')).toHaveAttribute('data-warning', 'false')
  })

  it('renders error state when staff lookup fails', async () => {
    ;(getStaffById as jest.Mock).mockRejectedValue(new Error('Failed to load staff'))

    const ui = await StaffDetailPage({ params: Promise.resolve({ id: 'missing-id' }) })
    render(ui)

    expect(screen.getByTestId('error-message')).toHaveTextContent('Failed to load staff')
  })
})
