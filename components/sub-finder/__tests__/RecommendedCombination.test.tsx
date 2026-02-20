import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecommendedCombination from '@/components/sub-finder/RecommendedCombination'

jest.mock('@/components/sub-finder/SubFinderCard', () => {
  const MockSubFinderCard = ({ name, onContact }: { name: string; onContact?: () => void }) => (
    <div>
      <p>{name}</p>
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
})
