import React from 'react'
import { render, screen } from '@testing-library/react'
import ClassDetailPage from '@/app/(dashboard)/settings/classes/[id]/page'
import { getClassGroupById } from '@/lib/api/class-groups'
import { isClassGroupUsedInBaselineSchedule } from '@/lib/api/baseline-usage'

const notFoundMock = jest.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})

jest.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

jest.mock('@/lib/api/class-groups', () => ({
  getClassGroupById: jest.fn(),
}))

jest.mock('@/lib/api/baseline-usage', () => ({
  isClassGroupUsedInBaselineSchedule: jest.fn(),
}))

jest.mock('@/components/settings/ClassGroupForm', () => ({
  __esModule: true,
  default: ({ showInactiveBaselineWarning }: { showInactiveBaselineWarning: boolean }) => (
    <div data-testid="class-group-form" data-warning={String(showInactiveBaselineWarning)} />
  ),
}))

describe('Class group settings detail page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('passes baseline warning when class group is inactive and used', async () => {
    ;(getClassGroupById as jest.Mock).mockResolvedValue({
      id: 'cg-1',
      school_id: 'school-1',
      is_active: false,
      name: 'Infant A',
    })
    ;(isClassGroupUsedInBaselineSchedule as jest.Mock).mockResolvedValue(true)

    const ui = await ClassDetailPage({ params: Promise.resolve({ id: 'cg-1' }) })
    render(ui)

    expect(isClassGroupUsedInBaselineSchedule).toHaveBeenCalledWith('cg-1', {
      schoolId: 'school-1',
    })
    expect(screen.getByTestId('class-group-form')).toHaveAttribute('data-warning', 'true')
  })

  it('does not check baseline usage when class group is active', async () => {
    ;(getClassGroupById as jest.Mock).mockResolvedValue({
      id: 'cg-1',
      school_id: 'school-1',
      is_active: true,
      name: 'Infant A',
    })

    const ui = await ClassDetailPage({ params: Promise.resolve({ id: 'cg-1' }) })
    render(ui)

    expect(isClassGroupUsedInBaselineSchedule).not.toHaveBeenCalled()
    expect(screen.getByTestId('class-group-form')).toHaveAttribute('data-warning', 'false')
  })

  it('calls notFound when class group lookup fails', async () => {
    ;(getClassGroupById as jest.Mock).mockRejectedValue(new Error('missing'))

    await expect(
      ClassDetailPage({ params: Promise.resolve({ id: 'missing-id' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
