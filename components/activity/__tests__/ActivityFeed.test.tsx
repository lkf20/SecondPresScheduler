import { render, screen, waitFor } from '@testing-library/react'
import { ActivityFeed } from '@/components/activity/ActivityFeed'

describe('ActivityFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders contract-compliant school closure copy from API rows', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        rows: [
          {
            id: 'log-1',
            created_at: '2026-03-18T10:00:00.000Z',
            action: 'create',
            category: 'school_calendar',
            entity_type: 'school_closure',
            entity_id: 'closure-1',
            details: { date: '2026-04-26', whole_day: true },
            actor_user_id: 'user-1',
            actor_display_name: 'Director',
          },
        ],
        nextCursor: null,
        actors: [],
      }),
    }) as jest.Mock

    render(<ActivityFeed />)

    await waitFor(() => {
      expect(screen.getByText('Created school closure for April 26')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'School Calendar' })).toBeInTheDocument()
  })

  it('preserves staff links in formatted messages when staff id is present', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        rows: [
          {
            id: 'log-2',
            created_at: '2026-03-18T10:05:00.000Z',
            action: 'create',
            category: 'time_off',
            entity_type: 'time_off_request',
            entity_id: 'time-off-1',
            details: {
              teacher_id: 'staff-1',
              teacher_name: 'Anne M.',
              start_date: '2026-04-26',
              end_date: '2026-04-26',
            },
            actor_user_id: 'user-1',
            actor_display_name: 'Director',
          },
        ],
        nextCursor: null,
        actors: [],
      }),
    }) as jest.Mock

    render(<ActivityFeed />)

    await waitFor(() => {
      expect(screen.getByText(/created time off request/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Anne M.' })).toHaveAttribute(
        'href',
        '/staff/staff-1'
      )
    })
  })
})
