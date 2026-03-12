/**
 * New Time Off page: redirect to open Add Time Off panel (open_time_off=1) on sub-finder or time-off.
 */

import { render, waitFor } from '@testing-library/react'
import NewTimeOffPage from '../page'

const mockReplace = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => {
    const p = new URLSearchParams()
    p.set('return_to', 'sub-finder')
    p.set('teacher_id', 'teacher-1')
    p.set('start_date', '2026-03-16')
    p.set('end_date', '2026-03-20')
    return p
  },
}))

describe('New Time Off redirect page', () => {
  beforeEach(() => {
    mockReplace.mockClear()
  })

  it('redirects to sub-finder with open_time_off=1 and params when return_to=sub-finder', async () => {
    render(<NewTimeOffPage />)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledTimes(1)
    })
    const [url] = mockReplace.mock.calls[0]
    expect(url).toContain('open_time_off=1')
    expect(url).toContain('/sub-finder')
    expect(url).toContain('teacher_id=teacher-1')
    expect(url).toContain('start_date=2026-03-16')
    expect(url).toContain('end_date=2026-03-20')
  })
})
