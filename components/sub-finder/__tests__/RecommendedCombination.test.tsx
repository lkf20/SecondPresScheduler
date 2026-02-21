import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecommendedCombination from '@/components/sub-finder/RecommendedCombination'

jest.mock('@/components/sub-finder/SubFinderCard', () => {
  const MockSubFinderCard = ({
    name,
    onContact,
    shiftsCovered,
    totalShifts,
    recommendedShiftCount,
    coverageSegments,
  }: {
    name: string
    onContact?: () => void
    shiftsCovered?: number
    totalShifts?: number
    recommendedShiftCount?: number
    coverageSegments?: string[]
  }) => (
    <div>
      <p>{name}</p>
      <p>{`Covered ${shiftsCovered ?? 0}/${totalShifts ?? 0}`}</p>
      <p>{`Recommended ${recommendedShiftCount ?? 0}`}</p>
      <p>{`Segments ${(coverageSegments || []).join(',')}`}</p>
      <button type="button" onClick={onContact}>
        Contact {name}
      </button>
    </div>
  )
  MockSubFinderCard.displayName = 'MockSubFinderCard'
  return MockSubFinderCard
})

describe('RecommendedCombination', () => {
  it('renders nothing when there are no combinations', () => {
    const { container } = render(
      <RecommendedCombination combinations={[]} onContactSub={jest.fn()} totalShifts={2} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders combinations, supports paging, contact, and show-all callback', async () => {
    const user = userEvent.setup()
    const onContactSub = jest.fn()
    const onShowAllSubs = jest.fn()

    const combinations = [
      {
        subs: [
          {
            subId: 'sub-1',
            subName: 'Sally A.',
            phone: '555-1111',
            shifts: [
              {
                date: '2099-02-10',
                day_name: 'Tuesday',
                time_slot_code: 'EM',
                class_name: 'Infant A',
              },
            ],
            shiftsCovered: 1,
            totalShifts: 2,
            coveragePercent: 50,
            conflicts: {
              missingDiaperChanging: 0,
              missingLifting: 0,
              missingQualifications: 0,
              total: 0,
            },
          },
        ],
        totalShiftsCovered: 1,
        totalShiftsNeeded: 2,
        totalConflicts: 0,
        coveragePercent: 50,
      },
      {
        subs: [
          {
            subId: 'sub-2',
            subName: 'Bella W.',
            phone: '555-2222',
            shifts: [
              {
                date: '2099-02-10',
                day_name: 'Tuesday',
                time_slot_code: 'AM',
                class_name: 'Infant B',
              },
            ],
            shiftsCovered: 2,
            totalShifts: 2,
            coveragePercent: 100,
            conflicts: {
              missingDiaperChanging: 0,
              missingLifting: 0,
              missingQualifications: 0,
              total: 0,
            },
          },
        ],
        totalShiftsCovered: 2,
        totalShiftsNeeded: 2,
        totalConflicts: 0,
        coveragePercent: 100,
      },
    ]

    render(
      <RecommendedCombination
        combinations={combinations as any}
        onContactSub={onContactSub}
        totalShifts={2}
        allSubs={[] as any}
        allShifts={[{ date: '2099-02-10', time_slot_code: 'EM', status: 'uncovered' }] as any}
        onShowAllSubs={onShowAllSubs}
      />
    )

    expect(screen.getByText(/recommended sub|recommended combination/i)).toBeInTheDocument()
    expect(screen.getByText('Sally A.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /contact sally a\./i }))
    expect(onContactSub).toHaveBeenCalledWith('sub-1')

    await user.click(screen.getByRole('button', { name: /next recommended combination/i }))
    expect(screen.getByText('Bella W.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /show all subs/i }))
    expect(onShowAllSubs).toHaveBeenCalled()
  })

  it('uses remaining-label filtering, includes past shifts when requested, and renders conflicts', () => {
    const combinations = [
      {
        subs: [
          {
            subId: 'sub-1',
            subName: 'Sally A.',
            phone: '555-1111',
            shifts: [
              {
                date: '2020-02-10',
                day_name: 'Monday',
                time_slot_code: 'EM',
                class_name: 'Infant A',
              },
            ],
            shiftsCovered: 1,
            totalShifts: 3,
            coveragePercent: 33,
            conflicts: {
              missingDiaperChanging: 1,
              missingLifting: 0,
              missingQualifications: 0,
              total: 1,
            },
          },
        ],
        totalShiftsCovered: 1,
        totalShiftsNeeded: 3,
        totalConflicts: 1,
        coveragePercent: 33,
      },
    ]

    render(
      <RecommendedCombination
        combinations={combinations as any}
        onContactSub={jest.fn()}
        totalShifts={3}
        useRemainingLabel
        includePastShifts
        allSubs={
          [
            {
              id: 'sub-1',
              can_cover: [
                { date: '2020-02-10', time_slot_code: 'EM' },
                { date: '2020-02-10', time_slot_code: 'AM' },
              ],
              cannot_cover: [{ date: '2020-02-10', time_slot_code: 'PM', reason: 'Unavailable' }],
              assigned_shifts: [{ date: '2020-02-10', time_slot_code: 'EM' }],
            },
          ] as any
        }
        allShifts={
          [
            { date: '2020-02-10', time_slot_code: 'EM', status: 'uncovered' },
            { date: '2020-02-10', time_slot_code: 'AM', status: 'covered' },
            { date: '2020-02-10', time_slot_code: 'PM', status: 'uncovered' },
          ] as any
        }
      />
    )

    expect(screen.getByText(/1 conflict/i)).toBeInTheDocument()
    expect(screen.getByText('Covered 1/2')).toBeInTheDocument()
    expect(screen.getByText('Recommended 1')).toBeInTheDocument()
    expect(screen.getByText(/Segments assigned,unavailable/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /show all subs/i })).not.toBeInTheDocument()
  })
})
