import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SubFinderCard from '@/components/sub-finder/SubFinderCard'

const mockShiftChips = jest.fn(() => <div data-testid="shift-chips" />)

jest.mock('@/components/sub-finder/ShiftChips', () => {
  const MockShiftChips = (props: any) => mockShiftChips(props)
  MockShiftChips.displayName = 'MockShiftChips'
  return MockShiftChips
})

jest.mock('@/components/sub-finder/SubCardHeader', () => {
  const MockSubCardHeader = ({ name }: { name: string }) => <div>{name}</div>
  MockSubCardHeader.displayName = 'MockSubCardHeader'
  return MockSubCardHeader
})

describe('SubFinderCard', () => {
  beforeEach(() => {
    mockShiftChips.mockClear()
  })

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

  it('shows Update button and calls onContact when declined', async () => {
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
        isDeclined
      />
    )

    expect(screen.getByRole('button', { name: /^update$/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^update$/i }))
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

    const textarea = screen.getByRole('textbox')
    await user.clear(textarea)
    await user.type(textarea, 'Updated note')
    await user.tab()

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

    await user.click(screen.getByRole('button', { name: /shifts/i }))
    expect(screen.getByTestId('shift-chips')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /contact & assign/i }))
    expect(onContact).toHaveBeenCalledTimes(1)
  })

  it('uses availability semantics in recommended strip and preserves other-sub names', () => {
    render(
      <SubFinderCard
        name="Sally A."
        phone={null}
        shiftsCovered={1}
        totalShifts={2}
        canCover={[]}
        cannotCover={[]}
        assigned={[]}
        recommendedShiftCount={1}
        allCanCover={[{ date: '2026-03-26', time_slot_code: 'AM' }]}
        recommendedShifts={[{ date: '2026-03-26', time_slot_code: 'AM' }]}
        allShifts={[
          {
            id: 'shift-partial',
            date: '2026-03-26',
            day_name: 'Thursday',
            time_slot_code: 'AM',
            class_name: null,
            classroom_name: 'Infant Room',
            status: 'partially_covered',
            sub_name: 'Victoria I.',
            assigned_sub_names: ['Victoria I.', 'Laura S.'],
            day_display_order: 4,
            time_slot_display_order: 2,
          },
        ]}
      />
    )

    const recommendedStripCall = mockShiftChips.mock.calls.find(
      call => call?.[0]?.mode === 'availability'
    )?.[0]

    expect(recommendedStripCall).toBeTruthy()
    expect(recommendedStripCall.recommendedShifts).toEqual([
      expect.objectContaining({ date: '2026-03-26', time_slot_code: 'AM' }),
    ])
    expect(recommendedStripCall.shifts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: '2026-03-26',
          time_slot_code: 'AM',
          status: 'available',
          assignment_owner: 'other_sub',
          assigned_sub_name: 'Victoria I.',
          assigned_sub_names: ['Victoria I.', 'Laura S.'],
          day_display_order: 4,
          time_slot_display_order: 2,
        }),
      ])
    )
  })

  it('marks assigned-to-this-sub shifts as assigned in recommended strip availability mode', () => {
    render(
      <SubFinderCard
        name="Bella W."
        phone={null}
        shiftsCovered={1}
        totalShifts={1}
        canCover={[]}
        cannotCover={[]}
        assigned={[]}
        recommendedShiftCount={1}
        allShifts={[
          {
            id: 'shift-covered-this-sub',
            date: '2026-03-26',
            day_name: 'Thursday',
            time_slot_code: 'AM',
            class_name: null,
            classroom_name: 'Infant Room',
            status: 'fully_covered',
            sub_name: null,
            assigned_sub_names: ['Bella W.', 'Laura S.'],
            day_display_order: 4,
            time_slot_display_order: 2,
          },
        ]}
        allAssigned={[
          {
            date: '2026-03-26',
            time_slot_code: 'AM',
            classroom_name: 'Infant Room',
          },
        ]}
      />
    )

    const recommendedStripCall = mockShiftChips.mock.calls.find(
      call => call?.[0]?.mode === 'availability'
    )?.[0]

    expect(recommendedStripCall).toBeTruthy()
    expect(recommendedStripCall.shifts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: '2026-03-26',
          time_slot_code: 'AM',
          status: 'assigned',
          assignment_owner: 'this_sub',
        }),
      ])
    )
  })

  it('keeps covered-by-other shifts available when sub is not explicitly marked unavailable', () => {
    render(
      <SubFinderCard
        name="Naina B."
        phone={null}
        shiftsCovered={4}
        totalShifts={4}
        canCover={[]}
        cannotCover={[]}
        assigned={[]}
        recommendedShiftCount={4}
        recommendedShifts={[{ date: '2026-03-26', time_slot_code: 'AM' }]}
        allShifts={[
          {
            id: 'shift-covered-other',
            date: '2026-03-26',
            day_name: 'Thursday',
            time_slot_code: 'AM',
            class_name: null,
            classroom_name: 'Infant Room',
            status: 'fully_covered',
            sub_name: 'Victoria I.',
            assigned_sub_names: ['Victoria I.'],
          },
        ]}
        // Intentionally empty to simulate server omitting covered shifts from can_cover.
        allCanCover={[]}
        allCannotCover={[]}
      />
    )

    const recommendedStripCall = mockShiftChips.mock.calls.find(
      call => call?.[0]?.mode === 'availability'
    )?.[0]
    expect(recommendedStripCall).toBeTruthy()
    expect(recommendedStripCall.shifts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: '2026-03-26',
          time_slot_code: 'AM',
          assignment_owner: 'other_sub',
          status: 'available',
          assigned_sub_name: 'Victoria I.',
        }),
      ])
    )
  })

  it('never uses coverage mode in SubFinderCard shift chips', async () => {
    const user = userEvent.setup()

    render(
      <SubFinderCard
        name="Sally A."
        phone={null}
        shiftsCovered={1}
        totalShifts={2}
        canCover={[]}
        cannotCover={[]}
        assigned={[]}
        recommendedShiftCount={1}
        allShifts={[
          {
            id: 'shift-1',
            date: '2026-03-26',
            day_name: 'Thursday',
            time_slot_code: 'AM',
            class_name: null,
            classroom_name: 'Infant Room',
            status: 'uncovered',
          },
        ]}
        allCanCover={[{ date: '2026-03-26', time_slot_code: 'AM' }]}
        recommendedShifts={[{ date: '2026-03-26', time_slot_code: 'AM' }]}
      />
    )

    expect(mockShiftChips.mock.calls.length).toBeGreaterThan(0)
    let modes = mockShiftChips.mock.calls.map(call => call?.[0]?.mode).filter(Boolean)
    expect(modes.every(mode => mode === 'availability')).toBe(true)

    mockShiftChips.mockClear()

    render(
      <SubFinderCard
        name="Sally A."
        phone={null}
        shiftsCovered={1}
        totalShifts={2}
        canCover={[]}
        cannotCover={[]}
        assigned={[]}
        allShifts={[
          {
            id: 'shift-2',
            date: '2026-03-27',
            day_name: 'Friday',
            time_slot_code: 'EM',
            class_name: null,
            classroom_name: 'Infant Room',
            status: 'uncovered',
          },
        ]}
        allCanCover={[{ date: '2026-03-27', time_slot_code: 'EM' }]}
      />
    )

    await user.click(screen.getByRole('button', { name: /shifts/i }))
    expect(mockShiftChips.mock.calls.length).toBeGreaterThan(0)
    modes = mockShiftChips.mock.calls.map(call => call?.[0]?.mode).filter(Boolean)
    expect(modes.every(mode => mode === 'availability')).toBe(true)
  })
})
