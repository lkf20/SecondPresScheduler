import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecommendedSubsList from '@/components/sub-finder/RecommendedSubsList'

jest.mock('@/components/sub-finder/SubFinderCard', () => {
  const MockSubFinderCard = ({ name }: { name: string }) => <div>{name}</div>
  MockSubFinderCard.displayName = 'MockSubFinderCard'
  return MockSubFinderCard
})

const absence = {
  id: 'absence-1',
  teacher_name: 'Teacher One',
  start_date: '2026-02-09',
  end_date: '2026-02-10',
}

const shiftDetails = [
  {
    id: 'shift-1',
    date: '2026-02-09',
    day_name: 'Monday',
    time_slot_code: 'EM',
    class_name: null,
    classroom_name: 'Infant Room',
    classroom_color: null,
    status: 'uncovered' as const,
  },
]

const baseSub = {
  id: 'sub-base',
  name: 'Base Sub',
  phone: null,
  email: null,
  coverage_percent: 100,
  shifts_covered: 1,
  total_shifts: 1,
  can_cover: [{ date: '2026-02-09', day_name: 'Monday', time_slot_code: 'EM', class_name: null }],
  cannot_cover: [],
  assigned_shifts: [],
  response_status: 'none',
  is_sub: true,
  is_flexible_staff: false,
}

describe('RecommendedSubsList', () => {
  it('renders loading state', () => {
    render(
      <RecommendedSubsList
        subs={[]}
        loading
        absence={absence}
        shiftDetails={shiftDetails}
        showAllSubs
      />
    )

    expect(screen.getByText(/finding recommended subs/i)).toBeInTheDocument()
  })

  it('renders empty state when no subs are available', () => {
    render(
      <RecommendedSubsList
        subs={[]}
        loading={false}
        absence={absence}
        shiftDetails={shiftDetails}
        showAllSubs
      />
    )

    expect(screen.getByText(/no subs found/i)).toBeInTheDocument()
  })

  it('renders recommended-mode empty state copy when showAllSubs is false', () => {
    render(
      <RecommendedSubsList
        subs={[]}
        loading={false}
        absence={absence}
        shiftDetails={shiftDetails}
      />
    )

    expect(screen.getByText(/no recommended subs found/i)).toBeInTheDocument()
  })

  it('falls back to showing processed subs when none cover remaining shifts in recommended mode', () => {
    render(
      <RecommendedSubsList
        subs={
          [
            {
              ...baseSub,
              id: 'fallback-sub',
              name: 'Fallback Sub',
              coverage_percent: 0,
              shifts_covered: 0,
              can_cover: [],
              cannot_cover: [
                {
                  date: '2026-02-09',
                  day_name: 'Monday',
                  time_slot_code: 'EM',
                  reason: 'Unavailable',
                },
              ],
            },
          ] as any
        }
        loading={false}
        absence={absence}
        shiftDetails={shiftDetails}
      />
    )

    expect(screen.getByText('Fallback Sub')).toBeInTheDocument()
  })

  it('groups subs by status in show-all mode and filters by selected bucket', async () => {
    const user = userEvent.setup()

    const subs = [
      {
        ...baseSub,
        id: 'assigned',
        name: 'Assigned Sub',
        assigned_shifts: [{ date: '2026-02-09', day_name: 'Monday', time_slot_code: 'EM' }],
      },
      { ...baseSub, id: 'contacted', name: 'Contacted Sub', response_status: 'pending' },
      { ...baseSub, id: 'available', name: 'Available Sub' },
      { ...baseSub, id: 'limited', name: 'Limited Sub', is_sub: false, is_flexible_staff: true },
      {
        ...baseSub,
        id: 'unavailable',
        name: 'Unavailable Sub',
        coverage_percent: 0,
        shifts_covered: 0,
        can_cover: [],
        cannot_cover: [
          { date: '2026-02-09', day_name: 'Monday', time_slot_code: 'EM', reason: 'Unavailable' },
        ],
      },
      {
        ...baseSub,
        id: 'declined',
        name: 'Declined Sub',
        response_status: 'declined_all',
        can_cover: [],
        cannot_cover: [
          { date: '2026-02-09', day_name: 'Monday', time_slot_code: 'EM', reason: 'Declined' },
        ],
      },
    ]

    render(
      <RecommendedSubsList
        subs={subs as any}
        loading={false}
        absence={absence}
        shiftDetails={shiftDetails}
        showAllSubs
      />
    )

    const filterBar = screen.getByRole('button', { name: /all \(6\)/i }).parentElement
    expect(filterBar).not.toBeNull()
    const filters = within(filterBar as HTMLElement)

    expect(filters.getByRole('button', { name: /assigned \(1\)/i })).toBeInTheDocument()
    expect(filters.getByRole('button', { name: /contacted \(1\)/i })).toBeInTheDocument()
    expect(filters.getByRole('button', { name: /^Available \(1\)$/i })).toBeInTheDocument()
    expect(
      filters.getByRole('button', { name: /available with limitations \(1\)/i })
    ).toBeInTheDocument()
    expect(filters.getByRole('button', { name: /unavailable \(1\)/i })).toBeInTheDocument()
    expect(filters.getByRole('button', { name: /declined \(1\)/i })).toBeInTheDocument()

    await user.click(filters.getByRole('button', { name: /unavailable \(1\)/i }))

    expect(screen.getByText('Unavailable Sub')).toBeInTheDocument()
    expect(screen.queryByText('Available Sub')).not.toBeInTheDocument()

    await user.click(filters.getByRole('button', { name: /unavailable \(1\)/i }))

    expect(screen.getByText('Unavailable Sub')).toBeInTheDocument()
    expect(screen.getByText('Available Sub')).toBeInTheDocument()
  })

  it('hides header copy when hideHeader is true', () => {
    render(
      <RecommendedSubsList
        subs={[{ ...baseSub, id: 'sub-1', name: 'Sally A.' }] as any}
        loading={false}
        absence={absence}
        shiftDetails={shiftDetails}
        hideHeader
      />
    )

    expect(screen.queryByText(/recommended subs for/i)).not.toBeInTheDocument()
    expect(screen.getByText('Sally A.')).toBeInTheDocument()
  })
})
