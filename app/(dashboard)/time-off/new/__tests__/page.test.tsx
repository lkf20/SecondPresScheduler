/**
 * New Time Off page: redirect to Sub Finder when return_to=sub-finder (scenario 1).
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NewTimeOffPage from '../page'

const mockPush = jest.fn()
const mockRefresh = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => ({
    get: (key: string) =>
      key === 'return_to' ? 'sub-finder' : key === 'teacher_id' ? 'teacher-1' : null,
  }),
}))

jest.mock('@/components/time-off/TimeOffForm', () => {
  return function MockTimeOffForm({
    onSuccess,
  }: {
    onSuccess?: (
      teacherName: string,
      startDate: string,
      endDate: string,
      requestId?: string
    ) => void
  }) {
    return (
      <div>
        <button
          type="button"
          onClick={() => onSuccess?.('Anne M.', '2026-03-16', '2026-03-20', 'new-absence-123')}
        >
          Simulate create success
        </button>
      </div>
    )
  }
})

jest.mock('sonner', () => ({
  toast: { success: jest.fn() },
}))

describe('New Time Off page – return to Sub Finder', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockRefresh.mockClear()
  })

  it('when return_to=sub-finder and onSuccess called with requestId, redirects to Sub Finder with absence_id (scenario 1)', async () => {
    render(<NewTimeOffPage />)

    await userEvent.click(screen.getByRole('button', { name: /simulate create success/i }))

    expect(mockPush).toHaveBeenCalledWith('/sub-finder?absence_id=new-absence-123')
    expect(mockRefresh).toHaveBeenCalled()
  })
})
