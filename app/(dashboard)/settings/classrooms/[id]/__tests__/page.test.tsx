import React from 'react'
import { render, screen } from '@testing-library/react'
import ClassroomDetailPage from '@/app/(dashboard)/settings/classrooms/[id]/page'
import { getClassroomById } from '@/lib/api/classrooms'
import { isClassroomUsedInBaselineSchedule } from '@/lib/api/baseline-usage'

const notFoundMock = jest.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})

jest.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
}))

jest.mock('@/lib/api/classrooms', () => ({
  getClassroomById: jest.fn(),
}))

jest.mock('@/lib/api/baseline-usage', () => ({
  isClassroomUsedInBaselineSchedule: jest.fn(),
}))

jest.mock('@/components/settings/ClassroomForm', () => ({
  __esModule: true,
  default: ({ showInactiveBaselineWarning }: { showInactiveBaselineWarning: boolean }) => (
    <div data-testid="classroom-form" data-warning={String(showInactiveBaselineWarning)} />
  ),
}))

describe('Classroom settings detail page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('passes baseline warning when classroom is inactive and used', async () => {
    ;(getClassroomById as jest.Mock).mockResolvedValue({
      id: 'class-1',
      school_id: 'school-1',
      is_active: false,
    })
    ;(isClassroomUsedInBaselineSchedule as jest.Mock).mockResolvedValue(true)

    const ui = await ClassroomDetailPage({ params: Promise.resolve({ id: 'class-1' }) })
    render(ui)

    expect(isClassroomUsedInBaselineSchedule).toHaveBeenCalledWith('class-1', {
      schoolId: 'school-1',
    })
    expect(screen.getByTestId('classroom-form')).toHaveAttribute('data-warning', 'true')
  })

  it('does not check baseline usage when classroom is active', async () => {
    ;(getClassroomById as jest.Mock).mockResolvedValue({
      id: 'class-1',
      school_id: 'school-1',
      is_active: true,
    })

    const ui = await ClassroomDetailPage({ params: Promise.resolve({ id: 'class-1' }) })
    render(ui)

    expect(isClassroomUsedInBaselineSchedule).not.toHaveBeenCalled()
    expect(screen.getByTestId('classroom-form')).toHaveAttribute('data-warning', 'false')
  })

  it('calls notFound when classroom lookup fails', async () => {
    ;(getClassroomById as jest.Mock).mockRejectedValue(new Error('missing'))

    await expect(
      ClassroomDetailPage({ params: Promise.resolve({ id: 'missing-id' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
