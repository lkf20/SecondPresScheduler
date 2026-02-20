import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SubFinderCard from '@/components/sub-finder/SubFinderCard'

jest.mock('@/components/sub-finder/ShiftChips', () => {
  const MockShiftChips = () => <div data-testid="shift-chips" />
  MockShiftChips.displayName = 'MockShiftChips'
  return MockShiftChips
})

jest.mock('@/components/sub-finder/SubCardHeader', () => {
  const MockSubCardHeader = ({ name }: { name: string }) => <div>{name}</div>
  MockSubCardHeader.displayName = 'MockSubCardHeader'
  return MockSubCardHeader
})

describe('SubFinderCard', () => {
  it('renders assignment and contact feedback states', () => {
    render(
      <SubFinderCard
        name="Sally A."
        phone="555-111-2222"
        shiftsCovered={2}
        totalShifts={3}
        canCover={[]}
        cannotCover={[]}
        assigned={[{ date: '2026-02-09', time_slot_code: 'EM' }]}
        isContacted
        responseStatus="pending"
      />
    )

    expect(screen.getByText(/assigned/i)).toBeInTheDocument()
    expect(screen.getByText(/contacted/i)).toBeInTheDocument()
    expect(screen.getByText(/pending/i)).toBeInTheDocument()
  })

  it('calls onContact from the Contact & Assign action', async () => {
    const user = userEvent.setup()
    const onContact = jest.fn()

    render(
      <SubFinderCard
        name="Sally A."
        phone="555-111-2222"
        shiftsCovered={1}
        totalShifts={2}
        canCover={[]}
        cannotCover={[]}
        assigned={[]}
        onContact={onContact}
      />
    )

    await user.click(screen.getByRole('button', { name: /contact & assign/i }))
    expect(onContact).toHaveBeenCalledTimes(1)
  })
})
