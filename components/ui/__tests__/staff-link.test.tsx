import { render, screen } from '@testing-library/react'
import StaffLink from '../staff-link'

describe('StaffLink', () => {
  it('renders Link with correct href when staffId is present', () => {
    render(<StaffLink staffId="staff-123" name="Jane Doe" />)
    const link = screen.getByRole('link', { name: 'Jane Doe' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/staff/staff-123')
  })

  it('renders plain span when staffId is absent', () => {
    const { container } = render(<StaffLink name="Jane Doe" />)
    expect(container.querySelector('a')).not.toBeInTheDocument()
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Doe').tagName).toBe('SPAN')
  })

  it('applies className when provided', () => {
    render(<StaffLink staffId="staff-1" name="John" className="font-semibold text-lg" />)
    const link = screen.getByRole('link', { name: 'John' })
    expect(link).toHaveClass('font-semibold', 'text-lg')
  })
})
