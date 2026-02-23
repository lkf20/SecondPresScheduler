import { render, screen } from '@testing-library/react'
import ShiftChips, { formatShiftLabel } from '@/components/sub-finder/ShiftChips'

describe('ShiftChips', () => {
  it('formats shift labels with day, slot code, and date', () => {
    expect(formatShiftLabel('2026-02-09', 'EM')).toBe('Mon EM • Feb 9')
  })

  it('renders nothing when there are no shifts', () => {
    const { container } = render(<ShiftChips canCover={[]} cannotCover={[]} assigned={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('prioritizes assigned shifts when the same shift exists in multiple arrays', () => {
    render(
      <ShiftChips
        assigned={[{ date: '2026-02-09', time_slot_code: 'EM', classroom_name: 'Infant Room' }]}
        canCover={[{ date: '2026-02-09', time_slot_code: 'EM' }]}
        cannotCover={[{ date: '2026-02-09', time_slot_code: 'EM', reason: 'Unavailable' }]}
      />
    )

    expect(screen.getAllByText('Mon EM • Feb 9')).toHaveLength(1)
  })

  it('shows legend when enabled', () => {
    render(
      <ShiftChips
        assigned={[{ date: '2026-02-09', time_slot_code: 'EM' }]}
        canCover={[]}
        cannotCover={[]}
        showLegend
      />
    )

    expect(screen.getByText('Assigned')).toBeInTheDocument()
    expect(screen.getByText('Available')).toBeInTheDocument()
    expect(screen.getByText('Unavailable')).toBeInTheDocument()
  })
})
