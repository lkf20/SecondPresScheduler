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

  it('supports note editing and save callback', async () => {
    const user = userEvent.setup()
    const onSaveNote = jest.fn(async () => undefined)

    render(
      <SubFinderCard
        name="Sally A."
        phone={null}
        shiftsCovered={1}
        totalShifts={2}
        canCover={[]}
        cannotCover={[]}
        assigned={[]}
        notes="Existing note"
        onSaveNote={onSaveNote}
      />
    )

    await user.click(screen.getByRole('button', { name: /notes/i }))
    await user.click(screen.getByRole('button', { name: /^edit$/i }))

    const textarea = screen.getByRole('textbox')
    await user.clear(textarea)
    await user.type(textarea, 'Updated note')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(onSaveNote).toHaveBeenCalledWith('Updated note')
  })

  it('toggles all-shifts section and renders secondary contact action', async () => {
    const user = userEvent.setup()
    const onContact = jest.fn()

    render(
      <SubFinderCard
        name="Sally A."
        phone={null}
        shiftsCovered={1}
        totalShifts={2}
        canCover={[]}
        cannotCover={[]}
        assigned={[]}
        onContact={onContact}
        allShifts={[
          {
            id: 'shift-1',
            date: '2026-02-09',
            day_name: 'Monday',
            time_slot_code: 'EM',
            class_name: null,
            classroom_name: 'Infant Room',
            status: 'uncovered',
          },
        ]}
        allCanCover={[{ date: '2026-02-09', time_slot_code: 'EM' }]}
      />
    )

    await user.click(screen.getByRole('button', { name: /view all shifts/i }))
    expect(screen.getByTestId('shift-chips')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /contact & assign/i }))
    expect(onContact).toHaveBeenCalledTimes(1)
  })
})
