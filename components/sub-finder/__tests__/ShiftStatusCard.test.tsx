import { render, screen } from '@testing-library/react'
import ShiftStatusCard from '@/components/sub-finder/ShiftStatusCard'
import { buildSubFinderShift } from '@/tests/factories/entities'

describe('ShiftStatusCard', () => {
  it('renders uncovered status details and absence teacher', () => {
    const shift = buildSubFinderShift({
      status: 'uncovered',
      day_name: 'Monday',
      time_slot_code: 'EM',
      date: '2026-02-09',
    })

    render(<ShiftStatusCard shift={shift} teacherName="Amy P." />)

    expect(screen.getByText(/monday feb 9/i)).toBeInTheDocument()
    expect(screen.getByText(/absence: amy p\./i)).toBeInTheDocument()
    expect(screen.getByText(/uncovered/i)).toBeInTheDocument()
    expect(screen.getByText(/no subs contacted/i)).toBeInTheDocument()
  })

  it('renders confirmed sub label when fully covered with sub name', () => {
    const shift = buildSubFinderShift({
      status: 'fully_covered',
      sub_name: 'Bella W.',
    })

    render(<ShiftStatusCard shift={shift} teacherName="Amy P." />)

    expect(screen.getByText(/covered/i)).toBeInTheDocument()
    expect(screen.getByText(/bella w\./i)).toBeInTheDocument()
  })

  it('shows contacted counts and Find Sub button for uncovered shift', () => {
    const shift = buildSubFinderShift({
      status: 'uncovered',
      day_name: 'Wednesday',
      date: '2026-03-18',
      time_slot_code: 'AM',
    })
    const onSelectShift = jest.fn()

    render(
      <ShiftStatusCard
        shift={shift}
        teacherName="Anne M."
        contactedSubsForShift={[
          { id: 'sub-1', name: 'Sally A.', status: 'pending' },
          { id: 'sub-2', name: 'Bella W.', status: 'confirmed' },
          { id: 'sub-3', name: 'Test S.', status: 'declined' },
        ]}
        onSelectShift={onSelectShift}
      />
    )

    expect(screen.getByText(/uncovered/i)).toBeInTheDocument()
    expect(screen.getByText(/3 contacted/i)).toBeInTheDocument()
    expect(screen.getByText(/1 pending/i)).toBeInTheDocument()
    expect(screen.getByText(/1 declined/i)).toBeInTheDocument()
    const findSubButton = screen.getByRole('button', { name: /find sub for this shift/i })
    expect(findSubButton).toBeInTheDocument()
    findSubButton.click()
    expect(onSelectShift).toHaveBeenCalledWith(shift)
  })
})
