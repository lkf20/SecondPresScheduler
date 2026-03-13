import { render, screen } from '@testing-library/react'
import StaffChip from '../staff-chip'

describe('StaffChip', () => {
  it('renders name in chip', () => {
    render(<StaffChip name="Jane Doe" variant="permanent" />)
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
  })

  it('renders a link when staffId and navigable', () => {
    render(<StaffChip staffId="staff-1" name="Jane Doe" variant="permanent" />)
    const link = screen.getByRole('link', { name: /Jane Doe/ })
    expect(link).toHaveAttribute('href', '/staff/staff-1')
  })

  it('renders span when navigable is false', () => {
    render(<StaffChip staffId="staff-1" name="Jane Doe" variant="absent" navigable={false} />)
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('renders span when staffId is absent', () => {
    render(<StaffChip name="Jane Doe" variant="sub" />)
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('renders suffix when provided', () => {
    render(<StaffChip name="Jane Doe" variant="breakCoverage" suffix="☕ 11:00 - 11:30" />)
    expect(screen.getByText('☕ 11:00 - 11:30')).toBeInTheDocument()
  })
})
