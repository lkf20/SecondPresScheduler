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
    expect(screen.getByText(/not contacted/i)).toBeInTheDocument()
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
})
