import { render, screen } from '@testing-library/react'
import { StaffingStatusBadge } from '../staffing-status-badge'

describe('StaffingStatusBadge', () => {
  it('renders below_required badge with label', () => {
    render(<StaffingStatusBadge status="below_required" label="Below Required by 1" />)
    expect(screen.getByText('Below Required by 1')).toBeInTheDocument()
  })

  it('renders below_preferred badge with label', () => {
    render(<StaffingStatusBadge status="below_preferred" label="Below Preferred by 1" />)
    expect(screen.getByText('Below Preferred by 1')).toBeInTheDocument()
  })

  it('renders above_target badge with label', () => {
    render(<StaffingStatusBadge status="above_target" label="Above Target" />)
    expect(screen.getByText('Above Target')).toBeInTheDocument()
  })

  it('renders adequate badge with label', () => {
    render(<StaffingStatusBadge status="adequate" label="On target." />)
    expect(screen.getByText('On target.')).toBeInTheDocument()
  })

  it('applies md size classes when size=md', () => {
    const { container } = render(
      <StaffingStatusBadge status="below_required" label="Test" size="md" />
    )
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('px-3.5', 'py-1')
  })
})
