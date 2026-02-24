import React from 'react'
import { render, screen } from '@testing-library/react'
import TimeSlotDetailPage from '@/app/(dashboard)/settings/timeslots/[id]/page'
import { getTimeSlotById } from '@/lib/api/timeslots'
import { isTimeSlotUsedInBaselineSchedule } from '@/lib/api/baseline-usage'

const notFoundMock = jest.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})

jest.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
}))

jest.mock('@/lib/api/timeslots', () => ({
  getTimeSlotById: jest.fn(),
}))

jest.mock('@/lib/api/baseline-usage', () => ({
  isTimeSlotUsedInBaselineSchedule: jest.fn(),
}))

jest.mock('@/components/settings/TimeSlotForm', () => ({
  __esModule: true,
  default: ({ showInactiveBaselineWarning }: { showInactiveBaselineWarning: boolean }) => (
    <div data-testid="timeslot-form" data-warning={String(showInactiveBaselineWarning)} />
  ),
}))

describe('Time slot settings detail page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('passes baseline warning when time slot is inactive and used', async () => {
    ;(getTimeSlotById as jest.Mock).mockResolvedValue({
      id: 'slot-em',
      school_id: 'school-1',
      is_active: false,
    })
    ;(isTimeSlotUsedInBaselineSchedule as jest.Mock).mockResolvedValue(true)

    const ui = await TimeSlotDetailPage({ params: Promise.resolve({ id: 'slot-em' }) })
    render(ui)

    expect(isTimeSlotUsedInBaselineSchedule).toHaveBeenCalledWith('slot-em', {
      schoolId: 'school-1',
    })
    expect(screen.getByTestId('timeslot-form')).toHaveAttribute('data-warning', 'true')
  })

  it('does not check baseline usage when time slot is active', async () => {
    ;(getTimeSlotById as jest.Mock).mockResolvedValue({
      id: 'slot-em',
      school_id: 'school-1',
      is_active: true,
    })

    const ui = await TimeSlotDetailPage({ params: Promise.resolve({ id: 'slot-em' }) })
    render(ui)

    expect(isTimeSlotUsedInBaselineSchedule).not.toHaveBeenCalled()
    expect(screen.getByTestId('timeslot-form')).toHaveAttribute('data-warning', 'false')
  })

  it('calls notFound when time slot lookup fails', async () => {
    ;(getTimeSlotById as jest.Mock).mockRejectedValue(new Error('missing'))

    await expect(
      TimeSlotDetailPage({ params: Promise.resolve({ id: 'missing-id' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
